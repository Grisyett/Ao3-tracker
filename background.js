// background.js - Versión Unificada: Lista Negra + Resurrección por Capítulos

async function consultarServidorExcel() {
  // Añadimos 'eliminadosIds' a la carga de datos inicial
  const data = await chrome.storage.local.get(['webAppUrl', 'misNotificaciones', 'misSeguidos', 'eliminadosIds']);
  
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
    
    if (result.fics && result.fics.length > 0) {
      let notisActuales = data.misNotificaciones || [];
      let seguidosActuales = data.misSeguidos || [];
      let eliminados = data.eliminadosIds || []; 
      let huboCambios = false;
      
      result.fics.forEach(nuevoFic => {
        const idxNoti = notisActuales.findIndex(f => f.ficId === nuevoFic.ficId);
        const yaEstaEnListaNegra = eliminados.includes(nuevoFic.ficId);

        // --- LÓGICA DE LISTA NEGRA Y RESURRECCIÓN ---
        if (yaEstaEnListaNegra) {
          const ficPrevio = notisActuales[idxNoti];
          // Si el fic actualizado tiene más capítulos que el que ocultamos, lo "resucitamos"
          if (ficPrevio && nuevoFic.capitulo !== ficPrevio.capitulo) {
            console.log(`RESURRECCIÓN: ${nuevoFic.titulo} tiene nuevos capítulos. Saliendo de lista negra.`);
            eliminados = eliminados.filter(id => id !== nuevoFic.ficId);
            // Al salir de la lista negra, el código de abajo lo tratará como una actualización normal
          } else {
            // Si no ha cambiado capítulos, ignoramos este fic completamente
            return; 
          }
        }

        // --- ACTUALIZAR EN NOTIFICACIONES ---
        if (idxNoti !== -1) {
          // Si hay cambio de capítulos, lo marcamos como no leído
          if (notisActuales[idxNoti].capitulo !== nuevoFic.capitulo) {
            console.log(`ACTUALIZACIÓN: ${nuevoFic.titulo} (${notisActuales[idxNoti].capitulo} -> ${nuevoFic.capitulo})`);
            notisActuales[idxNoti] = { 
              ...notisActuales[idxNoti], 
              ...nuevoFic, 
              leido: false,
              fecha: new Date().toISOString() 
            };
            huboCambios = true;
          } else {
            // Actualización silenciosa de otros datos (fandom, ship, etc)
            notisActuales[idxNoti] = { ...notisActuales[idxNoti], ...nuevoFic };
          }
        } else {
          // Es un fic totalmente nuevo que no conocíamos
          console.log(`NUEVA ENTRADA: ${nuevoFic.titulo}`);
          notisActuales.unshift({
            ...nuevoFic,
            leido: false,
            fecha: nuevoFic.fecha || new Date().toISOString()
          });
          huboCambios = true;
        }

        // --- ACTUALIZAR EN SEGUIDOS ---
        const idxSeg = seguidosActuales.findIndex(f => f.ficId === nuevoFic.ficId);
        if (idxSeg !== -1) {
          if (seguidosActuales[idxSeg].capitulo !== nuevoFic.capitulo) {
            seguidosActuales[idxSeg] = { ...seguidosActuales[idxSeg], ...nuevoFic };
            huboCambios = true;
          }
        }
      });

      if (huboCambios) {
        // Mantener historial manejable
        if (notisActuales.length > 50) notisActuales = notisActuales.slice(0, 50);

        await chrome.storage.local.set({ 
          "misNotificaciones": notisActuales,
          "misSeguidos": seguidosActuales,
          "eliminadosIds": eliminados
        });
        
        actualizarBadge(notisActuales);
        
        chrome.runtime.sendMessage({ action: "refrescar_interfaz_ao3" }).catch(() => {
          // Ignorar error si no hay pestañas abiertas
        });
      }
    }
  } catch (error) {
    console.error("AO3 Tracker Error:", error);
  }
}

// --- RESTO DE FUNCIONES (Badge, Alarms, Listeners) ---

function actualizarBadge(lista) {
  if (!chrome.action) return; 
  const noLeidos = (lista || []).filter(f => f.leido === false).length;
  chrome.action.setBadgeText({ text: noLeidos > 0 ? noLeidos.toString() : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#990000" });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "actualizar_badge_manual") {
    chrome.storage.local.get("misNotificaciones", (data) => {
      actualizarBadge(data.misNotificaciones || []);
      consultarServidorExcel();
    });
  }
});

chrome.alarms.create("checkUpdates", { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkUpdates") consultarServidorExcel();
});

// Ejecución al iniciar
consultarServidorExcel();