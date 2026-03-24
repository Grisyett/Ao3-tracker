// ui_logic.js - Gestión de Interfaz y Sincronización Excel

let trackerAppRegistered = false;

window.setupTrackerApp = () => ({
    registros: [],
    esSeguidos: false,
    idFicAbierto: null,
    loading: true,

    async init() {
        const contenedorRaiz = document.getElementById('li-tracker-ao3');
        this.esSeguidos = contenedorRaiz ? contenedorRaiz.classList.contains('tema-seguidos') : false;
        await this.cargarDatos();

        chrome.storage.onChanged.addListener((changes, area) => {
            const key = this.esSeguidos ? "misSeguidos" : "misNotificaciones";
            if (area === 'local' && changes[key]) {
                this.registros = changes[key].newValue || [];
                if (window.actualizarContadorEnPagina) window.actualizarContadorEnPagina();
            }
        });
    },

    async cargarDatos() {
        this.loading = true;
        const key = this.esSeguidos ? "misSeguidos" : "misNotificaciones";
        const data = await chrome.storage.local.get(key);
        this.registros = Array.isArray(data[key]) ? data[key] : [];
        this.loading = false;
    },

    navNotificaciones() { if (window.cargarInterfaz) window.cargarInterfaz('notificaciones'); },
    navSeguidos() { if (window.cargarInterfaz) window.cargarInterfaz('seguidos'); },
    navConfig() { chrome.runtime.sendMessage({ action: 'open_config' }); },

    toggleDetalles(fic, index) {
        const llave = `${fic.ficId}-${index}`;
        this.idFicAbierto = (this.idFicAbierto === llave) ? null : llave;
    },

    async eliminar(fic, index) {
        if (!confirm(`¿Eliminar "${fic.titulo}"?`)) return;
        const key = this.esSeguidos ? "misSeguidos" : "misNotificaciones";
        const res = await chrome.storage.local.get([key, 'eliminadosIds', 'webAppUrl']);
        
        let lista = Array.isArray(res[key]) ? res[key] : [];
        lista = lista.filter(f => String(f.ficId) !== String(fic.ficId));

        if (!this.esSeguidos) {
            let eliminados = Array.isArray(res.eliminadosIds) ? res.eliminadosIds : [];
            if (!eliminados.includes(fic.ficId)) eliminados.push(fic.ficId);
            await chrome.storage.local.set({ "misNotificaciones": lista, "eliminadosIds": eliminados });
        } else {
            await chrome.storage.local.set({ "misSeguidos": lista });
            // Notificar al Excel
            if (res.webAppUrl) {
                fetch(res.webAppUrl, {
                    method: "POST", mode: "no-cors",
                    body: JSON.stringify({ action: "dejar_de_seguir", ficId: fic.ficId })
                });
            }
        }
    },

    async marcarLeido(fic, index) {
        if (this.esSeguidos) {
            await window.actualizarProgresoLectura(fic.ficId, fic.capitulo);
        } else {
            const res = await chrome.storage.local.get('misNotificaciones');
            let notis = res.misNotificaciones || [];
            const idx = notis.findIndex(f => String(f.ficId) === String(fic.ficId));
            if (idx !== -1) {
                notis[idx].leido = !notis[idx].leido;
                await chrome.storage.local.set({ 'misNotificaciones': notis });
            }
        }
    }
});

// Función global para actualizar progreso (Excel + Local)
window.actualizarProgresoLectura = async (ficId, capitulo) => {
    const res = await chrome.storage.local.get(['misSeguidos', 'webAppUrl']);
    let seguidos = res.misSeguidos || [];
    const idx = seguidos.findIndex(f => String(f.ficId) === String(ficId));
    
    if (idx !== -1) {
        seguidos[idx].ultimoLeido = capitulo;
        await chrome.storage.local.set({ 'misSeguidos': seguidos });
        
        if (res.webAppUrl) {
            fetch(res.webAppUrl, {
                method: "POST", mode: "no-cors",
                body: JSON.stringify({ action: "actualizar_progreso", ficId: ficId, ultimoLeido: capitulo })
            });
        }
        alert(`✅ Guardado hasta cap. ${capitulo}`);
    }
};

window.registrarComponenteAlpine = () => {
    if (window.Alpine && !trackerAppRegistered) {
        window.Alpine.data('trackerApp', window.setupTrackerApp);
        trackerAppRegistered = true;
    }
};
window.registrarComponenteAlpine();
document.addEventListener('alpine:init', window.registrarComponenteAlpine);