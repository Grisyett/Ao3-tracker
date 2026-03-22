// content_script.js
async function cargarInterfaz(nombreArchivo) {
    const liPadre = document.getElementById('li-tracker-ao3');
    if (!liPadre) return;

    try {
        const url = chrome.runtime.getURL(`interfaz/${nombreArchivo}.html`);
        const respuesta = await fetch(url);
        const htmlTexto = await respuesta.text();
        const menuUl = liPadre.querySelector('.dropdown-menu');

        if (nombreArchivo === 'seguidos') liPadre.classList.add('tema-seguidos');
        else liPadre.classList.remove('tema-seguidos');

        menuUl.innerHTML = htmlTexto;

        // Inicializar Alpine en el nuevo contenido
        if (window.Alpine) {
            // Asegurar que trackerApp esté registrado antes de inicializar
            if (window.registerTrackerApp) {
                window.registerTrackerApp();
            }
            // Pequeño delay para asegurar que el registro se procese
            setTimeout(() => {
                window.Alpine.initTree(menuUl);
            }, 10);
        }
    } catch (e) { console.error("Error al cargar interfaz:", e); }
}

function inyectarBase() {
    const menuAO3 = document.querySelector('ul.primary.navigation.actions');
    if (!menuAO3 || document.getElementById('li-tracker-ao3')) return;

    const li = document.createElement('li');
    li.id = 'li-tracker-ao3';
    li.className = 'dropdown';
    li.innerHTML = `
        <a>Tracker AO3 <span id="badge-conteo-inline" style="background:#900; color:white; border-radius:10px; padding:0 6px; font-size:10px; margin-left:4px; display:none;">0</span></a>
        <ul class="menu dropdown-menu" style="width: 420px;"></ul>
    `;

    const searchLi = menuAO3.querySelector('li.search');
    searchLi ? menuAO3.insertBefore(li, searchLi) : menuAO3.appendChild(li);
    cargarInterfaz('notificaciones');
    
    // Actualizar badge después de inyectar la interfaz
    setTimeout(() => window.actualizarContadorEnPagina(), 100);
}

window.actualizarContadorEnPagina = () => {
    chrome.storage.local.get(['misNotificaciones'], (data) => {
        const notis = Array.isArray(data.misNotificaciones) ? data.misNotificaciones : [];
        const noLeidos = notis.filter(f => !f.leido).length;
        const span = document.getElementById('badge-conteo-inline');
        if (span) {
            span.textContent = noLeidos;
            span.style.display = noLeidos > 0 ? 'inline-block' : 'none';
        }
    });
};

// Escuchar mensajes del background para actualizar el badge cuando hay sync
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "refrescar_interfaz_ao3") {
        window.actualizarContadorEnPagina();
    }
    return true;
});

const observer = new MutationObserver(() => { if (document.querySelector('ul.primary.navigation.actions')) { inyectarBase(); observer.disconnect(); } });
observer.observe(document.body, { childList: true, subtree: true });