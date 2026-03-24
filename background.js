// background.js - Sincronización, Badge Global y Reordenamiento Dinámico

async function consultarServidorExcel() {
    // 1. Recuperar datos necesarios del storage
    const data = await chrome.storage.local.get(['webAppUrl', 'misNotificaciones', 'misSeguidos', 'eliminadosIds']);
    if (!data.webAppUrl) {
        console.warn("[Background] No hay URL de Web App configurada.");
        return;
    }

    try {
        console.log("[Background] Iniciando sincronización...");
        const res = await fetch(`${data.webAppUrl}?sync=full&t=${Date.now()}`);
        const result = await res.json();

        if (result && result.fics) {
            let notis = Array.isArray(data.misNotificaciones) ? data.misNotificaciones : [];
            let seguidos = Array.isArray(data.misSeguidos) ? data.misSeguidos : [];
            let eliminados = Array.isArray(data.eliminadosIds) ? data.eliminadosIds : [];
            let huboCambios = false;

            result.fics.forEach(nuevo => {
                const ficIdStr = String(nuevo.ficId).trim();
                
                // --- LIMPIEZA DE CAPÍTULO (Evitar fechas y procesar "4/?") ---
                let capRaw = String(nuevo.capitulo || "").trim();
                let capLimpio;

                if (capRaw.includes("/")) {
                    capLimpio = capRaw.split("/")[0].trim();
                } else if (capRaw.includes("-") || capRaw.includes(":") || capRaw.length > 5) {
                    capLimpio = "1*"; // Asterisco para indicar provisional
                } else {
                    capLimpio = capRaw || "1*";
                }
                nuevo.capitulo = capLimpio;

                const capExcel = parseInt(capLimpio) || 0;

                // --- A. ACTUALIZACIÓN SILENCIOSA DE "SEGUIDOS" ---
                const idxSeg = seguidos.findIndex(f => String(f.ficId) === ficIdStr);
                if (idxSeg !== -1) {
                    const viejoSeg = seguidos[idxSeg];
                    const cambioSeg = viejoSeg.capitulo !== nuevo.capitulo || 
                                     viejoSeg.sumario !== nuevo.sumario ||
                                     viejoSeg.titulo !== nuevo.titulo ||
                                     viejoSeg.ship !== nuevo.ship ||
                                     viejoSeg.fandom !== nuevo.fandom;
                    
                    if (cambioSeg) {
                        seguidos[idxSeg] = { ...viejoSeg, ...nuevo };
                        huboCambios = true;
                    }
                }

                // --- B. LÓGICA DE NOTIFICACIONES Y RESURRECCIÓN ---
                const idxNoti = notis.findIndex(f => String(f.ficId) === ficIdStr);
                const estaEnEliminados = eliminados.map(String).includes(ficIdStr);

                if (idxNoti === -1) {
                    // Resucita si: está eliminado PERO el capítulo del Excel es mayor al último registrado
                    const esResurreccion = estaEnEliminados && capExcel > (parseInt(nuevo.ultimoLeido) || 0);
                    const esNuevoTotal = !estaEnEliminados;

                    if (esNuevoTotal || esResurreccion) {
                        notis.unshift({ ...nuevo, leido: false });
                        huboCambios = true;
                        
                        if (esResurreccion) {
                            eliminados = eliminados.filter(id => String(id) !== ficIdStr);
                            console.log(`[Sync] Fic resucitado: ${nuevo.titulo}`);
                        }
                    }
                } else {
                    const viejo = notis[idxNoti];
                    const capLocal = parseInt(viejo.capitulo) || 0;

                    const cambioMetadata = 
                        viejo.titulo !== nuevo.titulo ||
                        viejo.autor !== nuevo.autor ||
                        viejo.fandom !== nuevo.fandom ||
                        viejo.ship !== nuevo.ship ||
                        viejo.rating !== nuevo.rating ||
                        viejo.warnings !== nuevo.warnings ||
                        viejo.sumario !== nuevo.sumario;

                    if (capExcel > capLocal) {
                        let registro = notis.splice(idxNoti, 1)[0];
                        notis.unshift({ ...registro, ...nuevo, leido: false });
                        huboCambios = true;
                    } 
                    else if (cambioMetadata) {
                        notis[idxNoti] = { ...viejo, ...nuevo }; 
                        huboCambios = true;
                    }
                }
            });

            if (huboCambios) {
                const listaFinal = notis.slice(0, 50);
                await chrome.storage.local.set({ 
                    "misNotificaciones": listaFinal,
                    "misSeguidos": seguidos,
                    "eliminadosIds": eliminados
                });
                
                actualizarBadge(listaFinal);
                chrome.runtime.sendMessage({ action: "refrescar_interfaz_ao3" }).catch(() => {});
                console.log("[Background] Sincronización finalizada con cambios.");
            } else {
                console.log("[Background] Sincronización finalizada: Sin novedades.");
            }
        }
    } catch (e) { 
        console.error("[Background] Error en Sync:", e); 
    }
}

// --- FUNCIONES DE SOPORTE ---

function actualizarBadge(lista) {
    const noLeidos = lista.filter(f => !f.leido).length;
    chrome.action.setBadgeText({ text: noLeidos > 0 ? noLeidos.toString() : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#990000" });
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.misNotificaciones) {
        actualizarBadge(changes.misNotificaciones.newValue || []);
    }
});

chrome.alarms.create("syncAO3", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(a => { 
    if(a.name === "syncAO3") consultarServidorExcel(); 
});

chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
    if (m.action === 'sync_now') consultarServidorExcel();
    if (m.action === 'open_config') {
        const url = chrome.runtime.getURL('interfaz/configuracion.html');
        chrome.tabs.create({ url });
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log("[Background] AO3 Tracker iniciado.");
    consultarServidorExcel();
});