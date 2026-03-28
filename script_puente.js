/**
 * AO3 Tracker - Conector de Usuario (Script Puente)
 * Requiere Biblioteca: AO3_Engine_Core
 */

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // ← NUEVO: Obtener timestamp de última sincronización
  const since = parseInt(e.parameter.since) || 0;
  const fullSync = e.parameter.sync === 'full';
  
  const cola = JSON.parse(props.getProperty('COLA_NOTIFICACIONES') || "[]");
  const hojaSeg = ss.getSheetByName("Seguimiento");
  const hojaData = ss.getSheetByName("Data");
  
  let ficsConsolidados = {};
  let stats = { data: 0, seguimiento: 0, filtrados: 0 };

  // 2. PROCESAR HOJA DATA (con filtro incremental)
  if (hojaData) {
    const dataValues = hojaData.getDataRange().getValues();
    for (let i = 1; i < dataValues.length; i++) {
      const fId = String(dataValues[i][5]).trim();
      if (!fId || fId === "") continue;
      
      // ← NUEVO: Filtrar por fecha de actualización (si no es full sync)
      if (!fullSync && since > 0) {
        const fechaFic = new Date(dataValues[i][0]).getTime();
        if (fechaFic <= since) {
          stats.filtrados++;
          continue; // Saltar fic no actualizado desde última sync
        }
      }
      
      ficsConsolidados[fId] = mapearFilaAFic(dataValues[i]);
      stats.data++;
    }
  }

  // 3. PROCESAR HOJA SEGUIMIENTO (con filtro incremental)
  if (hojaSeg) {
    const segValues = hojaSeg.getDataRange().getValues();
    for (let i = 1; i < segValues.length; i++) {
      const fId = String(segValues[i][5]).trim();
      if (!fId || fId === "") continue;
      
      // ← NUEVO: Filtrar por fecha de actualización (si no es full sync)
      if (!fullSync && since > 0) {
        const fechaFic = new Date(segValues[i][0]).getTime();
        if (fechaFic <= since) {
          stats.filtrados++;
          continue; // Saltar fic no actualizado desde última sync
        }
      }
      
      ficsConsolidados[fId] = mapearFilaAFic(segValues[i]);
      stats.seguimiento++;
    }
  }

  // Limpiar cola si se enviaron novedades
  if (cola.length > 0) props.setProperty('COLA_NOTIFICACIONES', "[]");

  const respuesta = {
    update: cola.length > 0,
    fics: Object.values(ficsConsolidados),
    fullSync: fullSync,
    incremental: since > 0 && !fullSync,
    since: since > 0 ? new Date(since).toLocaleString() : "N/A",
    debug: {
      total_enviados: Object.keys(ficsConsolidados).length,
      leidos_de_data: stats.data,
      leidos_de_seguimiento: stats.seguimiento,
      filtrados_por_fecha: stats.filtrados,
      en_cola_notificaciones: cola.length,
      timestamp: new Date().toLocaleString()
    }
  };

  console.log("Resumen de Sincronización: " + JSON.stringify(respuesta.debug));

  return ContentService.createTextOutput(JSON.stringify(respuesta))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let response = { status: "ERROR", detalle: "" };
  
  try {
    const params = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaSeguimiento = ss.getSheetByName("Seguimiento") || ss.insertSheet("Seguimiento");
    const hojaData = ss.getSheetByName("Data");
    
    const action = params.action;
    const ficId = String(params.ficId).trim();

    if (action === "marcar_seguido") {
      let datosNav = params; // Datos del scraping
      let metaExcel = { rating: "", warnings: "", sumario: "", fandom: "", ship: "", titulo: "", autor: "" };
      let encontradoEnData = false;

      // A. Buscar en DATA (Prioridad 1 - Fuente más confiable)
      if (hojaData) {
        const valsData = hojaData.getDataRange().getValues();
        for (let i = 1; i < valsData.length; i++) {
          if (String(valsData[i][5]).trim() === ficId) {
            // Solo usar si el valor existe y no está vacío/"N/A"
            const tituloData = valsData[i][1];
            const autorData = valsData[i][2];
            const fandomData = valsData[i][3];
            const shipData = valsData[i][4];
            const ratingData = valsData[i][11];
            const warningsData = valsData[i][12];
            const sumarioData = valsData[i][13];

            if (tituloData && tituloData !== "") metaExcel.titulo = tituloData;
            if (autorData && autorData !== "") metaExcel.autor = autorData;
            if (fandomData && fandomData !== "N/A" && fandomData !== "") metaExcel.fandom = fandomData;
            if (shipData && shipData !== "None" && shipData !== "") metaExcel.ship = shipData;
            if (ratingData && ratingData !== "N/A" && ratingData !== "") metaExcel.rating = ratingData;
            if (warningsData && warningsData !== "N/A" && warningsData !== "") metaExcel.warnings = warningsData;
            if (sumarioData && sumarioData !== "Sin sumario" && sumarioData !== "") metaExcel.sumario = sumarioData;

            encontradoEnData = true;
            break;
          }
        }
      }

      // B. Buscar en SEGUIMIENTO (Para preservar progreso y datos existentes)
      const valsSeg = hojaSeguimiento.getDataRange().getValues();
      let filaAfectada = -1;
      let ultimoLeidoGuardado = 0;
      let encontradoEnSeguimiento = false;

      for (let j = 1; j < valsSeg.length; j++) {
        if (String(valsSeg[j][5]).trim() === ficId) {
          filaAfectada = j + 1;
          ultimoLeidoGuardado = valsSeg[j][9];
          encontradoEnSeguimiento = true;

          // Solo usar de Seguimiento si Data no tiene el dato (prioridad: Data > Seguimiento > Scraper)
          if (!metaExcel.rating || metaExcel.rating === "") {
            const ratingSeg = valsSeg[j][11];
            if (ratingSeg && ratingSeg !== "N/A") metaExcel.rating = ratingSeg;
          }
          if (!metaExcel.warnings || metaExcel.warnings === "") {
            const warningsSeg = valsSeg[j][12];
            if (warningsSeg && warningsSeg !== "N/A") metaExcel.warnings = warningsSeg;
          }
          if (!metaExcel.sumario || metaExcel.sumario === "") {
            const sumarioSeg = valsSeg[j][13];
            if (sumarioSeg && sumarioSeg !== "Sin sumario") metaExcel.sumario = sumarioSeg;
          }
          break;
        }
      }

      // C. Lógica de selección (Prioridad: Data > Seguimiento > Scraper)
      const fTitulo   = (metaExcel.titulo && metaExcel.titulo !== "") ? metaExcel.titulo : datosNav.titulo;
      const fAutor    = (metaExcel.autor && metaExcel.autor !== "") ? metaExcel.autor : datosNav.autor;
      const fFandom   = (metaExcel.fandom && metaExcel.fandom !== "") ? metaExcel.fandom : datosNav.fandom;
      const fShip     = (metaExcel.ship && metaExcel.ship !== "") ? metaExcel.ship : (datosNav.ship || "None");
      const fRating   = (metaExcel.rating && metaExcel.rating !== "") ? metaExcel.rating : datosNav.rating;
      const fWarnings = (metaExcel.warnings && metaExcel.warnings !== "") ? metaExcel.warnings : datosNav.warnings;
      const fSumario  = (metaExcel.sumario && metaExcel.sumario !== "") ? metaExcel.sumario : (datosNav.sumario || "Sin sumario");

      let progresoFinal = (filaAfectada === -1) ? 0 : ultimoLeidoGuardado;

      const nuevaFila = [
        new Date(), fTitulo, fAutor, fFandom, fShip, ficId,
        datosNav.url, datosNav.capitulo, datosNav.palabras || 0,
        progresoFinal, "", fRating, fWarnings, fSumario
      ];

      if (filaAfectada !== -1) {
        hojaSeguimiento.getRange(filaAfectada, 1, 1, 14).setValues([nuevaFila]);
      } else {
        hojaSeguimiento.appendRow(nuevaFila);
        filaAfectada = hojaSeguimiento.getLastRow();
      }

      hojaSeguimiento.getRange(filaAfectada, 11).setFormula(`=H${filaAfectada}-J${filaAfectada}`);

      const fuenteDatos = encontradoEnData ? "Data" : (encontradoEnSeguimiento ? "Seguimiento" : "Scraper");
      response.status = "SUCCESS";
      response.detalle = "Datos guardados. Fuente prioritaria: " + fuenteDatos + ".";
    }
    
    else if (action === "dejar_de_seguir") {
      const vals = hojaSeguimiento.getDataRange().getValues();
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][5]).trim() === ficId) {
          hojaSeguimiento.deleteRow(i + 1);
          response.status = "SUCCESS";
          break;
        }
      }
    } 
    
    else if (action === "actualizar_progreso") {
      const vals = hojaSeguimiento.getDataRange().getValues();
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][5]).trim() === ficId) {
          hojaSeguimiento.getRange(i + 1, 10).setValue(params.ultimoLeido);
          response.status = "SUCCESS";
          break;
        }
      }
    }

    else if (action === "actualizar_metadata") {
      // Actualizar metadata de un fic en Seguimiento (sync forzada por cambio detectado)
      const vals = hojaSeguimiento.getDataRange().getValues();
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][5]).trim() === ficId) {
          const fila = i + 1;
          
          // Actualizar solo los campos que vienen en params
          if (params.titulo) hojaSeguimiento.getRange(fila, 2).setValue(params.titulo);
          if (params.sumario) hojaSeguimiento.getRange(fila, 14).setValue(params.sumario);
          if (params.ship && params.ship !== "None") hojaSeguimiento.getRange(fila, 5).setValue(params.ship);
          if (params.fandom && params.fandom !== "N/A") hojaSeguimiento.getRange(fila, 4).setValue(params.fandom);
          if (params.rating && params.rating !== "N/A") hojaSeguimiento.getRange(fila, 12).setValue(params.rating);
          if (params.warnings && params.warnings !== "N/A") hojaSeguimiento.getRange(fila, 13).setValue(params.warnings);
          
          // Actualizar fecha (columna A)
          hojaSeguimiento.getRange(fila, 1).setValue(new Date());
          
          response.status = "SUCCESS";
          response.detalle = "Metadata actualizada.";
          break;
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "ERROR", detalle: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}

function mapearFilaAFic(fila) {
  return {
    fecha: fila[0],
    titulo: fila[1],
    autor: fila[2],
    fandom: fila[3],
    ship: fila[4],
    ficId: String(fila[5]),
    url: fila[6],
    capitulo: fila[7],
    palabrasCapitulo: fila[8],
    ultimoLeido: fila[9],
    rating: fila[11],
    warnings: fila[12],
    sumario: fila[13]
  };
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🚀 AO3 Tracker')
    .addItem('1. Inicializar Tablas (14 cols)', 'celdas')
    .addItem('2. Sincronizar Gmail ahora', 'ejecutarSincronizacion')
    .addSeparator()
    .addItem('3. Activar Rastreo Automático', 'activarRastreoDiezMinutos')
    .addToUi();
}

function celdas() { AO3_Engine_Core.inicializarEstructuraDeHojas(); }

function ejecutarSincronizacion() {
  AO3_Engine_Core.procesarNotificacionesAO3(PropertiesService.getScriptProperties());
  SpreadsheetApp.getUi().alert("✅ Sincronización manual completada.");
}

function activarRastreoDiezMinutos() {
  const func = 'disparadorAutomaticoAO3'; 
  ScriptApp.getProjectTriggers().forEach(t => { if(t.getHandlerFunction() === func) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger(func).timeBased().everyMinutes(10).create();
  SpreadsheetApp.getUi().alert("🕵️ Rastreo automático activado.");
}

function disparadorAutomaticoAO3() {
  AO3_Engine_Core.procesarNotificacionesAO3(PropertiesService.getScriptProperties());
}

function onEdit(e) {
  if (!e || !e.range) return;
   
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
 
  // Solo aplicar en Data y Seguimiento
  if (sheetName !== "Data" && sheetName !== "Seguimiento") {
    return;
    } 
  const fila = range.getRow();
   
   // Ignorar header (fila 1)
      if (fila <= 1) {
        return;
      }

        // Actualizar Columna A con fecha/hora actual
        sheet.getRange(fila, 1).setValue(new Date());

        console.log(`[onEdit] Fila ${fila} en ${sheetName} actualizada a ${new Date().toLocaleString()}`);
     }