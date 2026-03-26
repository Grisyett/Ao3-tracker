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
                console.log(`[Sync] Procesando fic: ${ficIdStr} - ${nuevo.titulo} (Cap: ${nuevo.capitulo})`);

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
                // Solo actualizamos los fics que el usuario YA está siguiendo
                const idxSeg = seguidos.findIndex(f => String(f.ficId) === ficIdStr);
                if (idxSeg !== -1) {
                    const viejoSeg = seguidos[idxSeg];
                    const hayNuevoCap = parseInt(nuevo.capitulo) > (parseInt(viejoSeg.capitulo) || 0);
                    const cambioSeg = viejoSeg.capitulo !== nuevo.capitulo ||
                                     viejoSeg.sumario !== nuevo.sumario ||
                                     viejoSeg.titulo !== nuevo.titulo ||
                                     viejoSeg.ship !== nuevo.ship ||
                                     viejoSeg.fandom !== nuevo.fandom;

                    if (cambioSeg) {
                        if (hayNuevoCap) {
                            // Nuevo capítulo: mover al inicio con timestamp actualizado
                            seguidos.splice(idxSeg, 1);
                            seguidos.unshift({ ...viejoSeg, ...nuevo, timestamp: Date.now(), isUpdated: true });
                        } else {
                            seguidos[idxSeg] = { ...viejoSeg, ...nuevo };
                        }
                        huboCambios = true;
                    }
                }
                // Si el fic NO está en seguidos, NO lo agregamos automáticamente

                // --- B. LÓGICA DE NOTIFICACIONES Y RESURRECCIÓN ---
                const idxNoti = notis.findIndex(f => String(f.ficId) === ficIdStr);
                const estaEnEliminados = eliminados.map(String).includes(ficIdStr);

                if (idxNoti === -1) {
                    // Fic nuevo en notificaciones (o resurrección)
                    const esResurreccion = estaEnEliminados && capExcel > 0;
                    const esNuevoTotal = !estaEnEliminados;

                    if (esNuevoTotal || esResurreccion) {
                        notis.unshift({ ...nuevo, leido: false, isUpdated: true, timestamp: Date.now() });
                        huboCambios = true;
                        console.log(`[Sync] Nueva notificación: ${nuevo.titulo}`);

                        if (esResurreccion) {
                            eliminados = eliminados.filter(id => String(id) !== ficIdStr);
                            console.log(`[Sync] Fic resucitado: ${nuevo.titulo}`);
                        }
                    }
                } else {
                    const viejo = notis[idxNoti];
                    const capLocal = parseInt(viejo.capitulo) || 0;

                    // Si hay nuevo capítulo, mover al inicio y marcar como no leído + isUpdated
                    if (capExcel > capLocal) {
                        let registro = notis.splice(idxNoti, 1)[0];
                        notis.unshift({ ...registro, ...nuevo, leido: false, isUpdated: true, timestamp: Date.now() });
                        huboCambios = true;
                        console.log(`[Sync] Actualización detectada: ${nuevo.titulo} (Cap ${capLocal} → ${capExcel})`);
                    }
                }
            });

            if (huboCambios) {
                // Ordenar seguidos por timestamp (más reciente primero)
                seguidos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                const listaFinal = notis.slice(0, 50);
                await chrome.storage.local.set({
                    "misNotificaciones": listaFinal,
                    "misSeguidos": seguidos,
                    "eliminadosIds": eliminados
                });

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
        const lista = changes.misNotificaciones.newValue || [];
        actualizarBadge(lista);
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