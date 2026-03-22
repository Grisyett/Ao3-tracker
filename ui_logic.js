// ui_logic.js

// Flag para evitar registro duplicado
let trackerAppRegistered = false;

// Registrar trackerApp inmediatamente para que esté disponible cuando Alpine lo necesite
window.setupTrackerApp = () => ({
    registros: [],
    esSeguidos: false,
    idFicAbierto: null,
    loading: true,

    async init() {
        const contenedorRaiz = document.getElementById('li-tracker-ao3');
        this.esSeguidos = contenedorRaiz ? contenedorRaiz.classList.contains('tema-seguidos') : false;
        await this.cargarDatos();
    },

    async cargarDatos() {
        this.loading = true;
        const key = this.esSeguidos ? "misSeguidos" : "misNotificaciones";
        const data = await chrome.storage.local.get(key);
        this.registros = Array.isArray(data[key]) ? data[key] : [];
        console.log('[TrackerApp] Cargando datos:', key, 'Registros encontrados:', this.registros.length);
        this.loading = false;
    },

    navNotificaciones() { window.cargarInterfaz('notificaciones'); },
    navSeguidos() { window.cargarInterfaz('seguidos'); },
    navConfig() { chrome.runtime.sendMessage({action:'open_config'}); },

    toggleDetalles(fic, index) {
        const llave = `${fic.ficId}-${index}`;
        this.idFicAbierto = (this.idFicAbierto === llave) ? null : llave;
    },

    async eliminar(fic, index) {
        if (!confirm("¿Eliminar este registro?")) return;
        const key = this.esSeguidos ? "misSeguidos" : "misNotificaciones";

        this.registros.splice(index, 1);
        const update = { [key]: this.registros };

        // Si es de notificaciones, lo añadimos a la lista negra
        if (!this.esSeguidos && fic.ficId) {
            const data = await chrome.storage.local.get('eliminadosIds');
            let eliminados = Array.isArray(data.eliminadosIds) ? data.eliminadosIds : [];
            if (!eliminados.includes(fic.ficId)) {
                eliminados.push(fic.ficId);
                update.eliminadosIds = eliminados;
            }
        }

        await chrome.storage.local.set(update);
        if (window.actualizarContadorEnPagina) window.actualizarContadorEnPagina();
    },

    async marcarLeido(fic, index) {
        if (this.esSeguidos) {
            fic.ultimoLeido = fic.capitulo;
        } else {
            fic.leido = !fic.leido;
        }
        const key = this.esSeguidos ? "misSeguidos" : "misNotificaciones";
        await chrome.storage.local.set({ [key]: this.registros });
        if (window.actualizarContadorEnPagina) window.actualizarContadorEnPagina();
    }
});

// Registrar trackerApp en Alpine inmediatamente
const registerAlpineComponent = () => {
    if (window.Alpine && !trackerAppRegistered) {
        window.Alpine.data('trackerApp', window.setupTrackerApp);
        trackerAppRegistered = true;
        console.log('[TrackerApp] Componente registrado en Alpine');
    }
};

// Intentar registrar inmediatamente
registerAlpineComponent();

// También registrar cuando Alpine se inicialice
document.addEventListener('alpine:init', () => {
    registerAlpineComponent();
});

// Hacer setupTrackerApp disponible globalmente para content_script.js
window.registerTrackerApp = registerAlpineComponent;