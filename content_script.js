// content_script.js

//  LISTENERS DE MENSAJES Y CAMBIOS
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

//  NAVEGACIÓN E INTERFAZ
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

//  RECUPERACIÓN DE DATOS
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

//  LÓGICA DEL CONTADOR (BADGE)
function actualizarContadorEnPagina() {
    chrome.storage.local.get(['misNotificaciones'], (data) => {
        const lista = data.misNotificaciones || [];
        // Solo cuenta los no leídos de la bandeja de entrada
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

//  INYECCIÓN INICIAL
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
        <ul class="menu dropdown-menu" style="max-width: 90vw; width: 420px;"></ul>
    `;
    
    // Insertar antes del buscador si es posible
    const searchLi = menuAO3.querySelector('li.search');
    if (searchLi) menuAO3.insertBefore(li, searchLi);
    else menuAO3.appendChild(li);
    
    cargarInterfaz('notificaciones');
    actualizarContadorEnPagina();
}

inyectarBase();

//  BOTÓN "SEGUIR" DENTRO DE WORKS (SCRAPER)
if (window.location.pathname.includes("/works/")) {
    const menuAcciones = document.querySelector("ul.work.navigation.actions");
    if (menuAcciones && !document.getElementById("btn-tracker-follow")) {
        const li = document.createElement("li");
        li.innerHTML = `<a id="btn-tracker-follow" style="background: #2b580c; color: white !important; cursor:pointer;">Seguir en Tracker</a>`;
        
        li.onclick = async (e) => {
    e.preventDefault();
    
    // 1. Obtener el ID y la URL base
    const currentFicId = window.location.href.match(/works\/(\d+)/)[1];
    const baseUrl = `https://archiveofourown.org/works/${currentFicId}`;

    try {
        // 2. FETCH SILENCIOSO A LA URL BASE
        const respuesta = await fetch(baseUrl);
        const htmlTexto = await respuesta.text();
        const parser = new DOMParser();
        const docPrincipal = parser.parseFromString(htmlTexto, 'text/html');

        // 3. SCRAPPING DE LA PÁGINA PRINCIPAL
        const titulo = docPrincipal.querySelector("h2.title.heading")?.textContent.trim() || "Sin título";
        const autor = docPrincipal.querySelector("a[rel='author']")?.textContent.trim() || "Anonymous";
        const fandom = docPrincipal.querySelector("dd.fandom.tags")?.textContent.trim() || "N/A";
        
        // Extrae sumario completo
        const sumarioRaw = docPrincipal.querySelector(".summary blockquote")?.innerHTML
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .trim() || "Sin sumario";

        // Extrae capítulos totales (ej: "10/25" - extraemos el 10)
        const capStats = docPrincipal.querySelector("dd.chapters")?.textContent.trim() || "1/1";
        const capActual = parseInt(capStats.split("/")[0]) || 1;

        // 4. PREPARAR EL PAQUETE DE DATOS
        const datos = {
            action: "marcar_seguido",
            ficId: currentFicId,
            titulo: titulo,
            autor: autor,
            fandom: fandom,
            url: baseUrl,
            capitulo: capActual,      // El total publicado a la fecha
            numCapitulo: capActual,   // Para el motor core
            sumario: sumarioRaw,
            rating: docPrincipal.querySelector("dd.rating.tags")?.textContent.trim() || "N/A",
            warnings: docPrincipal.querySelector("dd.warning.tags")?.textContent.trim() || "N/A",
            ship: docPrincipal.querySelector("dd.relationship.tags")?.textContent.trim() || "None"
        };

        // 5. GUARDAR LOCALMENTE Y ENVIAR AL GOOGLE SHEET
        chrome.storage.local.get(["misSeguidos", "webAppUrl"], (data) => {
            let seguidos = data.misSeguidos || [];
            // Evita duplicados
            if (!seguidos.find(f => f.ficId === currentFicId)) {
                seguidos.push(datos);
                chrome.storage.local.set({ "misSeguidos": seguidos });
            }

            if (data.webAppUrl) {
                fetch(data.webAppUrl, {
                    method: "POST",
                    mode: "no-cors",
                    body: JSON.stringify(datos)
                })
            }
        });

    } catch (error) {
        console.error("Error al obtener datos base:", error);
        alert("Error al conectar con AO3 para extraer el sumario.");
    }
};

// Función para inyectar el botón de "Leido hasta X"
function inyectarBotonMarcarLectura() {
    const currentFicId = window.location.href.match(/works\/(\d+)/)?.[1];
    if (!currentFicId) return;

    chrome.storage.local.get(["misSeguidos"], (data) => {
        const seguidos = data.misSeguidos || [];
        const esSeguido = seguidos.find(f => f.ficId == currentFicId);

        if (esSeguido) {
            // Busca la barra de acciones inferior (Kudos, Bookmark, etc.)
            const barraAccionesInferior = document.querySelector("#feedback ul.actions");
            
            if (barraAccionesInferior && !document.getElementById("btn-marcar-lectura-inline")) {
                // Obtener capítulo actual del selector o URL
                const capSelect = document.querySelector("#selected_id option[selected]");
                let capActual = 1;
                
                if (capSelect) {
                    capActual = parseInt(capSelect.textContent.match(/^\d+/)?.[0]) || 1;
                } else {
                    const titleCap = document.querySelector("h3.title")?.textContent.match(/Chapter (\d+)/);
                    if (titleCap) capActual = parseInt(titleCap[1]);
                }

                const li = document.createElement("li");
                // Inyecta el boton
                li.innerHTML = `<a id="btn-marcar-lectura-inline" style="background: #d2c7c7; color: white !important; cursor:pointer;">Leído hasta cap. ${capActual}</a>`;
                
                li.onclick = (e) => {
                    e.preventDefault();
                    if(confirm(`¿Marcar "${esSeguido.titulo}" como leído hasta el capítulo ${capActual}?`)) {
                        window.actualizarProgresoLectura(currentFicId, capActual);
                    }
                };
                
                // Lo inserta en la lista de botones inferior
                barraAccionesInferior.appendChild(li);
            }
        }
    });
}

// Ejecutar la detección al cargar
inyectarBotonMarcarLectura();

        menuAcciones.appendChild(li);
    }
}