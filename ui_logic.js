// ui_logic.js
console.log("AO3 Tracker: ui_logic.js cargado.");

window.idFicAbierto = null; 

// ---  DETECCIÓN DE ENTORNO ---
document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const saveBtn = document.getElementById('saveBtn');

    if (urlInput && saveBtn) {
        inicializarConfiguracion(urlInput, saveBtn);
    } else {
        vincularNavegacion();
        window.recuperarYMostrarNotificaciones();
    }
});

chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "refrescar_interfaz_ao3") {
        window.recuperarYMostrarNotificaciones();
    }
});

// ---  LÓGICA DE CONFIGURACIÓN ---
function inicializarConfiguracion(input, boton) {
    const status = document.getElementById('status');
    chrome.storage.local.get("webAppUrl", (data) => {
        if (data.webAppUrl) input.value = data.webAppUrl;
    });

    boton.onclick = (e) => {
        e.preventDefault();
        const url = input.value.trim();
        if (url.startsWith("https://script.google.com/")) {
            chrome.storage.local.set({ "webAppUrl": url }, () => {
                status.innerText = "✅ URL guardada correctamente.";
                status.style.color = "green";
            });
        } else {
            status.innerText = "❌ URL no válida.";
            status.style.color = "red";
        }
    };
}

// ---  NAVEGACIÓN ---
function vincularNavegacion() {
    const btnNotis = document.querySelectorAll('.nav-btn-notis');
    const btnSeguidos = document.querySelectorAll('.nav-btn-seguidos');
    const btnConfig = document.querySelectorAll('.nav-btn-config');

    btnNotis.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.cargarInterfaz === 'function') window.cargarInterfaz('notificaciones');
        };
    });

    btnSeguidos.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.cargarInterfaz === 'function') window.cargarInterfaz('seguidos');
        };
    });

    btnConfig.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            const configUrl = chrome.runtime.getURL('interfaz/configuracion.html');
            window.open(configUrl, '_blank');
        };
    });
}

// ---  RENDERIZADO DE LISTA ---
window.renderizarLista = function(fics, esSeguidos = false) {
    const contenedor = document.getElementById('lista-notificaciones');
    const molde = document.getElementById('molde-contenedor');
    
    if (!contenedor || !molde) return;
    contenedor.innerHTML = '';

    if (!fics || fics.length === 0) {
        contenedor.innerHTML = `<li style="padding:20px; color:#999; text-align:center; list-style:none;">No hay registros en ${esSeguidos ? 'Seguidos' : 'Notificaciones'}.</li>`;
        return;
    }

    fics.forEach((fic, index) => {
        const instancia = molde.cloneNode(true);
        instancia.classList.remove('hidden-template');
        instancia.style.display = "block";
        instancia.id = '';

        // Título y Enlace
        const link = instancia.querySelector('.fic-link');
        link.textContent = fic.titulo || "Sin título";
        link.href = fic.url || fic.urlCapitulo || "#";

        // Variables de capítulos
        const capTotal = parseInt(fic.capitulo || fic.numCapitulo || 0);
        const ultimoLeido = parseInt(fic.ultimoLeido || 0);
        const pendientes = capTotal - ultimoLeido;
        const llaveUnicaItem = capTotal > 0 ? `${fic.ficId}-${capTotal}` : `${fic.ficId}-inbox-${index}`;

        //LÓGICA DE ELEMENTOS 
        const spanCap = instancia.querySelector('.fic-cap'); 
        const panelProgreso = instancia.querySelector('.progreso-seguidos'); 
        const txtLeido = instancia.querySelector('.txt-leido-hasta');
        const txtPendientes = instancia.querySelector('.txt-pendientes'); 

        if (esSeguidos && panelProgreso) {
            spanCap.textContent = `Cap: ${capTotal}`; 
            panelProgreso.style.display = 'flex';
            
            if (txtLeido) txtLeido.textContent = `Leído: ${ultimoLeido}/${capTotal}`; 
            
            if (txtPendientes) { 
                if (pendientes > 0) {
                    txtPendientes.textContent = `${pendientes} pdt.`;
                    txtPendientes.style.cssText = "background: #900; color: #fff; padding: 1px 6px; border-radius: 10px; font-weight: bold; font-size: 10px; margin-left: 5px;";
                } else {
                    txtPendientes.textContent = "✓ Al día";
                    txtPendientes.style.cssText = "color: #2b580c; font-weight: bold; font-size: 10px; margin-left: 5px;";
                }
            }
        } else {
            
            if (spanCap) spanCap.textContent = capTotal > 0 ? `Cap: ${capTotal}` : `Comentario`;
            if (panelProgreso) panelProgreso.style.display = 'none';
        }

        // Metadatos y Acordeón
        instancia.querySelector('.txt-fandom').textContent = fic.fandom || "N/A";
        instancia.querySelector('.txt-ship').textContent = fic.ship || "N/A";
        instancia.querySelector('.txt-sumario').textContent = fic.sumario || "Sin sumario disponible.";

        const panel = instancia.querySelector('.fic-info-extra');
        panel.style.display = (window.idFicAbierto === llaveUnicaItem) ? 'block' : 'none';

        instancia.querySelector('.btn-detalles').onclick = (e) => {
            e.preventDefault();
            window.idFicAbierto = (window.idFicAbierto === llaveUnicaItem) ? null : llaveUnicaItem;
            window.renderizarLista(fics, esSeguidos);
        };

        // Botones de Acción
        const btnEliminar = instancia.querySelector('.btn-eliminar') || instancia.querySelector('.btn-quitar-seguido');
        if (btnEliminar) {
            btnEliminar.onclick = (e) => {
                e.preventDefault();
                if(confirm("¿Eliminar este registro?")) {
                    window.eliminarDato(fic.ficId, esSeguidos ? "misSeguidos" : "misNotificaciones", capTotal, index);
                }
            };
        }

        const btnLeer = instancia.querySelector('.btn-leer');
        if (btnLeer) {
            if (esSeguidos) {
                btnLeer.textContent = "Marcar leído";
                btnLeer.onclick = (e) => {
                    e.preventDefault();
                    window.actualizarProgresoLectura(fic.ficId, capTotal);
                };
            } else {
                if (fic.leido) {
                    instancia.style.opacity = '0.6';
                    btnLeer.textContent = "Leído ✅";
                }
                btnLeer.onclick = (e) => {
                    e.preventDefault();
                    window.actualizarEstadoLeido(fic.ficId, capTotal, !fic.leido, index);
                };
            }
        }
        contenedor.appendChild(instancia);
    });
};

// PERSISTENCIA
window.recuperarYMostrarNotificaciones = function() {
    
    const esPestañaSeguidos = !!document.querySelector('.tema-seguidos');
    const storageKey = esPestañaSeguidos ? "misSeguidos" : "misNotificaciones";

    chrome.storage.local.get([storageKey], (data) => {
        const lista = data[storageKey] || [];
        window.renderizarLista(lista, esPestañaSeguidos);
    });
};
window.eliminarDato = function(id, storageKey, index) {
    chrome.storage.local.get([storageKey, "webAppUrl"], (data) => {
        let lista = data[storageKey] || [];
        if (storageKey === "misNotificaciones") {
            lista.splice(index, 1);
        } else {
            lista = lista.filter(f => f.ficId != id);
        }
        chrome.storage.local.set({ [storageKey]: lista }, () => {
            window.recuperarYMostrarNotificaciones();
            if (storageKey === "misSeguidos" && data.webAppUrl) {
                fetch(data.webAppUrl, {
                    method: "POST", mode: "no-cors",
                    body: JSON.stringify({ action: "dejar_de_seguir", ficId: id })
                });
            }
            chrome.runtime.sendMessage({ action: "actualizar_badge_manual" });
        });
    });
};

window.actualizarEstadoLeido = function(nuevoEstado, index) {
    chrome.storage.local.get("misNotificaciones", (data) => {
        let lista = data.misNotificaciones || [];
        if (lista[index]) {
            lista[index].leido = nuevoEstado;
            chrome.storage.local.set({ "misNotificaciones": lista }, () => {
                window.recuperarYMostrarNotificaciones();
                chrome.runtime.sendMessage({ action: "actualizar_badge_manual" });
            });
        }
    });
};

window.actualizarProgresoLectura = function(id, numCap) {
    chrome.storage.local.get(["misSeguidos", "webAppUrl"], (data) => {
        let seguidos = data.misSeguidos || [];
        let index = seguidos.findIndex(f => f.ficId == id);
        if (index !== -1) {
            seguidos[index].ultimoLeido = numCap;
            chrome.storage.local.set({ "misSeguidos": seguidos }, () => {
                window.recuperarYMostrarNotificaciones();
                if (data.webAppUrl) {
                    fetch(data.webAppUrl, {
                        method: "POST", mode: "no-cors",
                        body: JSON.stringify({ action: "actualizar_progreso", ficId: id, ultimoLeido: numCap })
                    });
                }
            });
        }
    });
};