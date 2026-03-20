// background.js

async function consultarServidorExcel() {
  const data = await chrome.storage.local.get(['webAppUrl', 'misNotificaciones']);
  if (!data.webAppUrl) return;

  try {
    const separador = data.webAppUrl.includes('?') ? '&' : '?';
    const urlFinal = `${data.webAppUrl}${separador}t=${Date.now()}`;
    
    const response = await fetch(urlFinal);
    const result = await response.json();
    
    if (result.update && result.fics) {
      let listaActual = data.misNotificaciones || [];
      
      result.fics.forEach(nuevoFic => {
        const existe = listaActual.some(f => f.ficId === nuevoFic.ficId && f.numCapitulo === nuevoFic.numCapitulo);
        
        if (!existe) {
          listaActual.unshift({
            ...nuevoFic,
            leido: false,
            fecha: nuevoFic.fecha || new Date().toISOString()
          });
        }
      });

      await chrome.storage.local.set({ "misNotificaciones": listaActual });
      actualizarBadge(listaActual);
    }
  } catch (error) {
    console.error("Error de conexión con Google:", error);
  }
}

// FUNCIÓN CORREGIDA PARA EL BADGE
function actualizarBadge(lista) {
  if (!chrome.action) return; // Seguridad extra
  
  const listaSegura = lista || [];
  const noLeidos = listaSegura.filter(f => f.leido === false).length;
  
  chrome.action.setBadgeText({ 
    text: noLeidos > 0 ? noLeidos.toString() : "" 
  });
  
  chrome.action.setBadgeBackgroundColor({ color: "#990000" });
}

// Escuchar mensajes de ui_logic.js para actualizar el badge al instante
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "actualizar_badge_manual") {
    chrome.storage.local.get("misNotificaciones", (data) => {
      actualizarBadge(data.misNotificaciones || []);
    });
  }
});

// Alarmas para actualización periódica
chrome.alarms.create("checkUpdates", { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkUpdates") consultarServidorExcel();
});