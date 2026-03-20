// ui_logic.js
console.log("AO3 Tracker: ui_logic.js cargado.");

window.idFicAbierto = null; 

// --- NAVEGACIÓN ---
function vincularNavegacion() {
    const btnNotis = document.querySelectorAll('.nav-btn-notis');
    const btnSeguidos = document.querySelectorAll('.nav-btn-seguidos');
    const btnConfig = document.querySelectorAll('.nav-btn-config');

    btnNotis.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            if (typeof window.cargarInterfaz === 'function') window.cargarInterfaz('notificaciones');
        };
    });

    btnSeguidos.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            if (typeof window.cargarInterfaz === 'function') window.cargarInterfaz('seguidos');
        };
    });

    btnConfig.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            window.open(chrome.runtime.getURL('interfaz/configuracion.html'));
        };
    });
}

// --- RENDERIZADO DE LISTAS ---
window.renderizarLista = function(fics, esSeguidos = false) {
    const contenedor = document.getElementById('lista-notificaciones');
    const molde = document.getElementById('molde-contenedor');
    
    if (!contenedor || !molde) return;

    contenedor.innerHTML = '';

    if (!fics || fics.length === 0) {
        contenedor.innerHTML = `<li style="padding:20px; color:#999; text-align:center; list-style:none;">No hay registros aquí.</li>`;
        return;
    }

    fics.forEach(fic => {
        const instancia = molde.cloneNode(true);
        instancia.classList.remove('hidden-template');
        instancia.id = '';

        const link = instancia.querySelector('.fic-link');
        link.textContent = fic.titulo || "Sin título";
        link.href = fic.url || fic.urlCapitulo || "#";

        const capTotal = parseInt(fic.capitulo || fic.numCapitulo || 1);
        const ultimoLeido = parseInt(fic.ultimoLeido || capTotal);
        const pendientes = capTotal - ultimoLeido;

        const spanCap = instancia.querySelector('.fic-cap');
        if (esSeguidos && pendientes > 0) {
            spanCap.innerHTML = `Cap: ${capTotal} <span style="color: #900; font-weight: bold;">(${pendientes} pdt.)</span>`;
        } else {
            spanCap.textContent = `Cap: ${capTotal}`;
        }

        instancia.querySelector('.txt-fandom').textContent = fic.fandom || "N/A";
        instancia.querySelector('.txt-ship').textContent = fic.ship || "N/A";
        instancia.querySelector('.txt-sumario').textContent = fic.sumario || "Sin sumario.";

        const panel = instancia.querySelector('.fic-info-extra');
        panel.style.display = (window.idFicAbierto === fic.ficId) ? 'block' : 'none';

        instancia.querySelector('.btn-detalles').onclick = (e) => {
            e.preventDefault();
            window.idFicAbierto = (window.idFicAbierto === fic.ficId) ? null : fic.ficId;
            window.renderizarLista(fics, esSeguidos);
        };

        const btnEliminar = instancia.querySelector('.btn-eliminar') || instancia.querySelector('.btn-quitar-seguido');
        if (btnEliminar) {
            btnEliminar.onclick = (e) => {
                e.preventDefault();
                if (esSeguidos) window.eliminarDato(fic.ficId, "misSeguidos");
                else window.eliminarDato(fic.ficId, "misNotificaciones");
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
                    instancia.style.opacity = '0.5';
                    btnLeer.textContent = "Desmarcar";
                }
                btnLeer.onclick = (e) => {
                    e.preventDefault();
                    window.actualizarEstadoLeido(fic.ficId, !fic.leido);
                };
            }
        }
        contenedor.appendChild(instancia);
    });
};

// --- PERSISTENCIA ---
window.eliminarDato = function(id, storageKey) {
    chrome.storage.local.get(storageKey, (data) => {
        let lista = (data[storageKey] || []).filter(f => f.ficId !== id);
        chrome.storage.local.set({ [storageKey]: lista }, () => {
            window.renderizarLista(lista, storageKey === "misSeguidos");
        });
    });
};

window.actualizarEstadoLeido = function(id, nuevoEstado) {
    chrome.storage.local.get("misNotificaciones", (data) => {
        let lista = data.misNotificaciones || [];
        lista = lista.map(f => f.ficId === id ? {...f, leido: nuevoEstado} : f);
        
        chrome.storage.local.set({"misNotificaciones": lista}, () => {
            // Esto refresca la lista visualmente
            window.recuperarYMostrarNotificaciones();
            // El contador de la pestaña se actualizará solo por el listener en content_script
        });
    });
};

window.actualizarProgresoLectura = function(id, numCap) {
    chrome.storage.local.get(["misSeguidos", "webAppUrl"], (data) => {
        let seguidos = data.misSeguidos || [];
        let index = seguidos.findIndex(f => f.ficId === id);
        if (index !== -1) {
            seguidos[index].ultimoLeido = numCap;
            chrome.storage.local.set({ "misSeguidos": seguidos }, () => {
                window.renderizarLista(seguidos, true);
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