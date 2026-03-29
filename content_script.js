// content_script.js - AO3 Tracker con Visibilidad Dinámica de Botones

/**
 * 1. GESTIÓN DE INTERFAZ Y NAVEGACIÓN
 */
async function cargarInterfaz(nombreArchivo) {
    const liPadre = document.getElementById('li-tracker-ao3');
    if (!liPadre) return;

    try {
        const url = chrome.runtime.getURL(`interfaz/${nombreArchivo}.html`);
        const respuesta = await fetch(url);
        const htmlTexto = await respuesta.text();
        const menuUl = liPadre.querySelector('.dropdown-menu');

        liPadre.classList.toggle('tema-seguidos', nombreArchivo === 'seguidos');
        menuUl.innerHTML = htmlTexto;

        if (window.Alpine) {
            if (typeof window.registrarComponenteAlpine === 'function') window.registrarComponenteAlpine();
            window.Alpine.initTree(menuUl);
        }
    } catch (e) { console.error("Error interfaz:", e); }
}

function inyectarBase() {
    const menuAO3 = document.querySelector('ul.primary.navigation.actions');
    if (!menuAO3 || document.getElementById('li-tracker-ao3')) return;

    const li = document.createElement('li');
    li.id = 'li-tracker-ao3';
    li.className = 'dropdown';
    li.innerHTML = `
        <a>Tracker AO3 <span id="badge-conteo-inline" style="background:#900; color:white; border-radius:10px; padding:0 6px; font-size:10px; margin-left:4px; display:none; font-weight:bold;">0</span></a>
        <ul class="menu dropdown-menu" style="width: 420px; border: 1px solid #ccc; background: white;"></ul>
    `;

    const searchLi = menuAO3.querySelector('li.search');
    searchLi ? menuAO3.insertBefore(li, searchLi) : menuAO3.appendChild(li);

    cargarInterfaz('notificaciones');
    actualizarContadorEnPagina();
}

/**
 * 2. ACTUALIZAR BADGE CONTADOR
 */
function actualizarContadorEnPagina() {
    chrome.storage.local.get(['misNotificaciones'], (data) => {
        const notis = Array.isArray(data.misNotificaciones) ? data.misNotificaciones : [];
        const noLeidos = notis.filter(f => !f.leido).length;
        const span = document.getElementById('badge-conteo-inline');
        if (span) {
            span.textContent = noLeidos;
            span.style.display = noLeidos > 0 ? 'inline-block' : 'none';
        }
    });
}

// Listener para actualizar el badge en tiempo real
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.misNotificaciones) {
        actualizarContadorEnPagina();
    }
});

/**
 * 3. MOTOR DE SCRAPING (FETCH A PÁGINA PRINCIPAL)
 */
async function scrapearDatosFic(ficId) {
    const baseUrl = `https://archiveofourown.org/works/${ficId}?view_adult=true`;
    try {
        const respuesta = await fetch(baseUrl);
        
        if (!respuesta.ok) {
            console.error(`[Scraper] Error HTTP ${respuesta.status} para fic ${ficId}`);
            return null;
        }
        
        const htmlTexto = await respuesta.text();
        const parser = new DOMParser();
        const docPrincipal = parser.parseFromString(htmlTexto, 'text/html');

        const titulo = docPrincipal.querySelector("h2.title.heading")?.textContent.trim() || "Sin título";
        const autor = docPrincipal.querySelector("a[rel='author'], .byline")?.textContent.trim() || "Anonymous";
        const fandom = docPrincipal.querySelector("dd.fandom.tags")?.textContent.trim() || "N/A";

        const sumarioElemento = docPrincipal.querySelector(".summary blockquote") || docPrincipal.querySelector(".summary .userstuff");
        const sumarioRaw = sumarioElemento?.innerHTML
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .trim() || "Sin sumario disponible.";

        const capStats = docPrincipal.querySelector("dd.chapters")?.textContent.trim() || "1/1";
        const capActual = parseInt(capStats.split("/")[0]) || 1;

        return {
            titulo, autor, fandom,
            sumario: sumarioRaw,
            capitulo: capActual,
            rating: docPrincipal.querySelector("dd.rating.tags")?.textContent.trim() || "N/A",
            warnings: docPrincipal.querySelector("dd.warning.tags")?.textContent.trim() || "N/A",
            ship: docPrincipal.querySelector("dd.relationship.tags")?.textContent.trim() || "None",
            url: baseUrl.split('?')[0]
        };
    } catch (e) {
        console.error(`[Scraper] Error al scrapear fic ${ficId}:`, e.message);
        return null;
    }
}

/**
 * 4. BOTÓN SEGUIR (ACTIVA EL BOTÓN DE LECTURA)
 */
async function inyectarBotonSeguir() {
    const menuAcciones = document.querySelector('ul.work.navigation.actions');
    if (!menuAcciones) return;

    const ficId = window.location.pathname.match(/works\/(\d+)/)?.[1];
    if (!ficId) return;

    const res = await chrome.storage.local.get(['misSeguidos', 'webAppUrl']);
    let seguidos = Array.isArray(res.misSeguidos) ? res.misSeguidos : [];
    const esSeguido = seguidos.some(f => String(f.ficId) === String(ficId));

    const btnExistente = document.getElementById('li-tracker-follow');
    if (btnExistente) btnExistente.remove();

    const li = document.createElement('li');
    li.id = 'li-tracker-follow';
    const colorBtn = esSeguido ? "#900" : "#2b580c";
    const textoBtn = esSeguido ? "Dejar de seguir" : "Seguir en Tracker";

    li.innerHTML = `<a id="btn-tracker-follow" style="background: ${colorBtn}; color: white !important; cursor:pointer;">${textoBtn}</a>`;
    
    li.onclick = async (e) => {
        e.preventDefault();
        const btnLink = document.getElementById('btn-tracker-follow');
        btnLink.innerText = "Esperando...";

        const freshRes = await chrome.storage.local.get(['misSeguidos', 'webAppUrl']);
        let listaActual = Array.isArray(freshRes.misSeguidos) ? freshRes.misSeguidos : [];

        if (esSeguido) {
            // ACCIÓN: DEJAR DE SEGUIR
            listaActual = listaActual.filter(f => String(f.ficId) !== String(ficId));
            await chrome.storage.local.set({ 'misSeguidos': listaActual });

            // ELIMINAR EL BOTÓN DE LECTURA inmediatamente
            const btnLectura = document.getElementById("li-marcar-inline");
            if (btnLectura) btnLectura.remove();

            if (freshRes.webAppUrl) {
                fetch(freshRes.webAppUrl, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: "dejar_de_seguir", ficId: ficId }) });
            }
            inyectarBotonSeguir();
        } else {
            // ACCIÓN: SEGUIR
            const meta = await scrapearDatosFic(ficId);
            if (!meta) return;

            const datos = { action: "marcar_seguido", ficId: ficId, ...meta, ultimoLeido: 0, fechaRegistro: new Date().toLocaleString(), timestamp: Date.now() };
            listaActual.unshift(datos);
            await chrome.storage.local.set({ 'misSeguidos': listaActual });

            if (freshRes.webAppUrl) {
                fetch(freshRes.webAppUrl, { method: "POST", mode: "no-cors", body: JSON.stringify(datos) });
            }
            
            // LLAMADA CLAVE: Inyectar el botón de lectura justo después de seguir
            await inyectarBotonSeguir(); 
            inyectarBotonMarcarLectura(); 
        }
    };
    menuAcciones.appendChild(li);
}

/**
 * 5. BOTÓN MARCAR LECTURA (CONTROL DE VISIBILIDAD)
 */
function inyectarBotonMarcarLectura() {
    const ficId = window.location.pathname.match(/works\/(\d+)/)?.[1];
    if (!ficId) return;

    chrome.storage.local.get(["misSeguidos"], (data) => {
        const seguidos = data.misSeguidos || [];
        const fic = seguidos.find(f => String(f.ficId) === String(ficId));

        const barraAcciones = document.querySelector("#feedback ul.actions");
        const btnPrevio = document.getElementById("li-marcar-inline");

        // SI NO ESTÁ SEGUIDO: Eliminar botón si existe y salir
        if (!fic) {
            if (btnPrevio) btnPrevio.remove();
            return;
        }

        // SI ESTÁ SEGUIDO: Crear o actualizar botón
        if (barraAcciones) {
            if (btnPrevio) btnPrevio.remove();

            const capSelect = document.querySelector("#selected_id option[selected]");
            let capActual = 1;
            if (capSelect) {
                capActual = parseInt(capSelect.textContent.match(/^\d+/)?.[0]) || 1;
            } else {
                const titleMatch = document.querySelector("h3.title")?.textContent.match(/Chapter (\d+)/);
                capActual = titleMatch ? parseInt(titleMatch[1]) : 1;
            }

            const yaMarcado = parseInt(fic.ultimoLeido) === capActual;
            const li = document.createElement('li');
            li.id = "li-marcar-inline";
            li.innerHTML = `<a style="background: ${yaMarcado ? '#444' : '#900'}; color: white !important; cursor:pointer;">
                ${yaMarcado ? 'Cap. ' + capActual + ' leído ✓' : 'Marcar cap. ' + capActual + ' como leído'}
            </a>`;

            li.onclick = (e) => {
                e.preventDefault();
                const nuevoProgreso = yaMarcado ? 0 : capActual;
                if (window.actualizarProgresoLectura) {
                    window.actualizarProgresoLectura(ficId, nuevoProgreso);
                    setTimeout(inyectarBotonMarcarLectura, 500);
                }
            };
            barraAcciones.appendChild(li);
        }
    });
}

/**
 * 6. LISTENER DE MENSAJES
 */
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "refrescar_interfaz_ao3") {
        actualizarContadorEnPagina();
    }
});

/**
 * 7. INICIALIZACIÓN
 */
window.addEventListener('load', () => {
    inyectarBase();
    if (window.location.pathname.includes("/works/")) {
        inyectarBotonSeguir();
        inyectarBotonMarcarLectura();
    }
});

window.cargarInterfaz = cargarInterfaz;