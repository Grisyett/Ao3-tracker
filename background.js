// background.js - Versión con Logs de Depuración

async function consultarServidorExcel() {
  const data = await chrome.storage.local.get(['webAppUrl', 'misNotificaciones', 'misSeguidos']);
  if (!data.webAppUrl) {
    console.warn("AO3 Tracker: No hay URL de WebApp configurada.");
    return;
  }

  try {
    const separador = data.webAppUrl.includes('?') ? '&' : '?';
    const urlFinal = `${data.webAppUrl}${separador}sync=full&t=${Date.now()}`;
    
    console.log("AO3 Tracker: Consultando servidor...", urlFinal);
    
    const response = await fetch(urlFinal);
    const result = await response.json();
    
    console.log("DATOS RECIBIDOS DEL EXCEL:", result.fics);
    
    if (result.fics && result.fics.length > 0) {
      let notisActuales = data.misNotificaciones || [];
      let seguidosActuales = data.misSeguidos || [];
      let huboCambios = false;
      
      result.fics.forEach(nuevoFic => {
        // ACTUALIZAR EN NOTIFICACIONES
        const idxNoti = notisActuales.findIndex(f => f.ficId === nuevoFic.ficId);
        if (idxNoti !== -1) {
          // Actualiza los datos manteniendo el estado 'leido' local
          notisActuales[idxNoti] = { ...notisActuales[idxNoti], ...nuevoFic };
          huboCambios = true;
        } else if (result.update) {
          notisActuales.unshift({
            ...nuevoFic,
            leido: false,
            fecha: nuevoFic.fecha || new Date().toISOString()
          });
          huboCambios = true;
          console.log(`NUEVA NOTIFICACIÓN: ${nuevoFic.titulo}`);
        }

        // ACTUALIZAR EN SEGUIDOS
        const idxSeg = seguidosActuales.findIndex(f => f.ficId === nuevoFic.ficId);
        if (idxSeg !== -1) {
          seguidosActuales[idxSeg] = { ...seguidosActuales[idxSeg], ...nuevoFic };
          huboCambios = true;
          console.log(`ACTUALIZADO EN SEGUIDOS: ${nuevoFic.titulo}`);
        }
      });

      if (huboCambios) {
        await chrome.storage.local.set({ 
          "misNotificaciones": notisActuales,
          "misSeguidos": seguidosActuales
        });
        
        actualizarBadge(notisActuales);
       
        chrome.runtime.sendMessage({ action: "refrescar_interfaz_ao3" }).catch(() => {
          console.log("AO3 Tracker: No hay pestañas activas para refrescar.");
        });
      }
    } else {
      console.log("AO3 Tracker: No se recibieron fics o la lista está vacía.");
    }
  } catch (error) {
    console.error("Error de conexión con Google:", error);
  }
}

// FUNCIÓN PARA EL BADGE
function actualizarBadge(lista) {
  if (!chrome.action) return; 
  
  const listaSegura = lista || [];
  const noLeidos = listaSegura.filter(f => f.leido === false).length;
  
  chrome.action.setBadgeText({ 
    text: noLeidos > 0 ? noLeidos.toString() : "" 
  });
  
  chrome.action.setBadgeBackgroundColor({ color: "#990000" });
}

// Escuchar mensajes de ui_logic.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "actualizar_badge_manual") {
    chrome.storage.local.get("misNotificaciones", (data) => {
      actualizarBadge(data.misNotificaciones || []);
      // Aprovecha para disparar una consulta al Excel si el usuario abre el menú
      consultarServidorExcel();
    });
  }
});

// Alarmas para actualización periódica (5 min)
chrome.alarms.create("checkUpdates", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkUpdates") {
    console.log("AO3 Tracker: Alarma activada, sincronizando...");
    consultarServidorExcel();
  }
});

consultarServidorExcel();