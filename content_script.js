// content_script.js

// 1. ESCUCHADORES DE MENSAJES Y CAMBIOS
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "refrescar_interfaz_ao3") {
        window.recuperarYMostrarNotificaciones();
    }
});

// Actualiza el numerito rojo cada vez que cambian los datos
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.misNotificaciones || changes.misSeguidos)) {
        actualizarContadorEnPagina();
    }
});

// 2. NAVEGACIÓN E INTERFAZ
async function cargarInterfaz(nombreArchivo) {
    const liPadre = document.getElementById('li-tracker-ao3');
    if (!liPadre) return;

    try {
        const url = chrome.runtime.getURL(`interfaz/${nombreArchivo}.html`);
        const respuesta = await fetch(url);
        const htmlTexto = await respuesta.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlTexto, 'text/html');
        
        // Manejo de clases para saber en qué pestaña estamos
        if (nombreArchivo === 'seguidos') liPadre.classList.add('tema-seguidos');
        else liPadre.classList.remove('tema-seguidos');

        // Inyectar el contenido del menú
        const nuevoContenido = doc.querySelector('.dropdown-menu').innerHTML;
        liPadre.querySelector('.dropdown-menu').innerHTML = nuevoContenido;
        
        // Vincular clics de botones (Notis, Seguidos, Config) definidos en ui_logic.js
        if (typeof window.vincularNavegacion === 'function') window.vincularNavegacion();
        
        // Mostrar los datos
        window.recuperarYMostrarNotificaciones();
    } catch (e) { 
        console.error("Error al cargar interfaz:", e); 
    }
}

// Hacerlo disponible para ui_logic.js
window.cargarInterfaz = cargarInterfaz;

// 3. RECUPERACIÓN DE DATOS
window.recuperarYMostrarNotificaciones = function() {
    const liPadre = document.getElementById('li-tracker-ao3');
    const esSeguidos = liPadre && liPadre.classList.contains('tema-seguidos');
    const key = esSeguidos ? "misSeguidos" : "misNotificaciones";

    chrome.storage.local.get(key, (data) => {
        if (typeof window.renderizarLista === 'function') {
            window.renderizarLista(data[key] || [], esSeguidos);
        }
    });
};

// 4. LÓGICA DEL CONTADOR (BADGE)
function actualizarContadorEnPagina() {
    chrome.storage.local.get(['misNotificaciones'], (data) => {
        const lista = data.misNotificaciones || [];
        // Solo contamos los no leídos de la bandeja de entrada
        const noLeidos = lista.filter(f => f.leido === false).length;
        
        const span = document.getElementById('badge-conteo-inline');
        if (span) {
            if (noLeidos > 0) {
                span.textContent = noLeidos;
                span.style.display = 'inline-block';
            } else {
                span.style.display = 'none';
            }
        }
    });
}

// 5. INYECCIÓN INICIAL
function inyectarBase() {
    if (document.getElementById('li-tracker-ao3')) return;
    const menuAO3 = document.querySelector('ul.primary.navigation.actions');
    if (!menuAO3) return;

    const li = document.createElement('li');
    li.id = 'li-tracker-ao3';
    li.className = 'dropdown';
    // Se añade el span del badge al lado del nombre
    li.innerHTML = `
        <a>Tracker AO3 <span id="badge-conteo-inline" style="background:#900; color:white; border-radius:10px; padding:0 6px; font-size:10px; margin-left:4px; display:none; font-weight:bold;">0</span></a>
        <ul class="menu dropdown-menu" style="width: 420px;"></ul>
    `;
    
    // Insertar antes del buscador si es posible
    const searchLi = menuAO3.querySelector('li.search');
    if (searchLi) menuAO3.insertBefore(li, searchLi);
    else menuAO3.appendChild(li);
    
    cargarInterfaz('notificaciones');
    actualizarContadorEnPagina();
}

inyectarBase();

// 6. BOTÓN "SEGUIR" DENTRO DE WORKS
if (window.location.pathname.includes("/works/")) {
    const menuAcciones = document.querySelector("ul.work.navigation.actions");
    if (menuAcciones && !document.getElementById("btn-tracker-follow")) {
        const li = document.createElement("li");
        li.innerHTML = `<a id="btn-tracker-follow" style="background: #2b580c; color: white !important; cursor:pointer;">Seguir en Tracker</a>`;
        li.onclick = () => {
            const currentFicId = window.location.pathname.split("/")[2];
            chrome.storage.local.get(["misSeguidos", "webAppUrl"], (data) => {
                let seguidos = data.misSeguidos || [];
                if (seguidos.find(f => f.ficId === currentFicId)) return alert("Ya lo sigues.");

                // Scraper mejorado para evitar NaN
                const capRaw = document.querySelector("dd.chapters")?.textContent.split("/")[0].trim() || "1";
                const capLimpio = parseInt(capRaw) || 1;

                const datos = {
                    ficId: currentFicId,
                    titulo: document.querySelector("h2.title.heading")?.textContent.trim() || "Sin título",
                    fandom: document.querySelector("dd.fandom.tags")?.textContent.trim() || "N/A",
                    url: window.location.href.split("?")[0],
                    capitulo: capLimpio,
                    numCapitulo: capLimpio,
                    ultimoLeido: capLimpio,
                    leido: true
                };

                seguidos.push(datos);
                chrome.storage.local.set({ "misSeguidos": seguidos }, () => {
                    alert("Fic seguido.");
                    if (data.webAppUrl) {
                        fetch(data.webAppUrl, { 
                            method: "POST", 
                            mode: "no-cors", 
                            body: JSON.stringify({ action: "marcar_seguido", ...datos }) 
                        });
                    }
                });
            });
        };
        menuAcciones.appendChild(li);
    }
}