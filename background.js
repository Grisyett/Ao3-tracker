// background.js
async function consultarServidorExcel() {
  const data = await chrome.storage.local.get(['webAppUrl', 'misNotificaciones', 'misSeguidos', 'eliminadosIds']);

  if (!data.webAppUrl) return;

  try {
    const urlFinal = `${data.webAppUrl}${data.webAppUrl.includes('?') ? '&' : '?'}sync=full&t=${Date.now()}`;
    const response = await fetch(urlFinal);
    const result = await response.json();

    if (result.fics) {
      // Asegurar que sean arrays válidos
      let notisActuales = Array.isArray(data.misNotificaciones) ? data.misNotificaciones : [];
      let seguidosActuales = Array.isArray(data.misSeguidos) ? data.misSeguidos : [];
      let eliminados = Array.isArray(data.eliminadosIds) ? data.eliminadosIds : [];
      let huboCambios = false;

      result.fics.forEach(nuevoFic => {
        const idxNoti = notisActuales.findIndex(f => f.ficId === nuevoFic.ficId);
        const yaEstaEnListaNegra = eliminados.includes(nuevoFic.ficId);
        
        // Verificar si hay nuevo capítulo (comparando como números)
        const capituloActual = parseInt(nuevoFic.capitulo) || 0;
        const capituloGuardado = idxNoti !== -1 ? (parseInt(notisActuales[idxNoti].capitulo) || 0) : 0;
        const hayNuevoCapitulo = capituloActual > capituloGuardado;

        // Si ya está en notificaciones y hay nuevo capítulo
        if (idxNoti !== -1 && hayNuevoCapitulo) {
          // Actualizar con nuevo capítulo
          notisActuales[idxNoti] = { ...nuevoFic, leido: false };
          huboCambios = true;
          
          // Si estaba en lista negra, lo "resucitamos" porque hay contenido nuevo
          const indexNegra = eliminados.indexOf(nuevoFic.ficId);
          if (indexNegra > -1) {
            eliminados.splice(indexNegra, 1);
          }
        }
        // Si es nuevo y NO está en lista negra, lo añadimos
        else if (idxNoti === -1 && !yaEstaEnListaNegra) {
          notisActuales.unshift({ ...nuevoFic, leido: false });
          huboCambios = true;
        }
        // Si está en lista negra y no hay nuevo capítulo, lo ignoramos
        // (no hacemos nada, permanece eliminado)
      });

      if (huboCambios) {
        if (notisActuales.length > 50) notisActuales = notisActuales.slice(0, 50);
        await chrome.storage.local.set({
          "misNotificaciones": notisActuales,
          "eliminadosIds": eliminados
        });
        actualizarBadge(notisActuales);
        chrome.runtime.sendMessage({ action: "refrescar_interfaz_ao3" }).catch(() => {});
      }
    }
  } catch (error) {
    console.error("Error en sincronización:", error);
  }
}

function actualizarBadge(lista) {
  const notis = Array.isArray(lista) ? lista : [];
  const noLeidos = notis.filter(f => !f.leido).length;
  chrome.action.setBadgeText({ text: noLeidos > 0 ? noLeidos.toString() : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#990000" });
}

chrome.alarms.create("syncAO3", { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === "syncAO3") consultarServidorExcel(); });

// Listener para abrir la página de configuración y sync
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'open_config') {
    chrome.tabs.create({ url: chrome.runtime.getURL('interfaz/configuracion.html') });
  } else if (message.action === 'sync_now') {
    consultarServidorExcel();
  }
  return true;
});