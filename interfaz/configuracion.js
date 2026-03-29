// configuracion.js - Maneja la página de configuración

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // Cargar URL guardada
  chrome.storage.local.get(['webAppUrl'], (data) => {
    if (data.webAppUrl) {
      urlInput.value = data.webAppUrl;
      status.textContent = 'URL ya configurada. Puedes actualizarla si es necesario.';
      status.className = 'info';
    }
  });

  // Guardar URL
  saveBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
      status.textContent = '❌ Por favor ingresa una URL válida';
      status.className = 'error';
      return;
    }

    // Validar que sea una URL de Google Apps Script
    if (!url.includes('script.google.com')) {
      status.textContent = '❌ La URL debe ser de Google Apps Script (script.google.com)';
      status.className = 'error';
      return;
    }

    try {
      await chrome.storage.local.set({ webAppUrl: url });
      status.textContent = '✅ URL guardada correctamente. La extensión se sincronizará automáticamente.';
      status.className = 'success';
      
      // Forzar sincronización inmediata
      chrome.runtime.sendMessage({ action: 'sync_now' });
    } catch (error) {
      status.textContent = '❌ Error al guardar: ' + error.message;
      status.className = 'error';
    }
  });
});
