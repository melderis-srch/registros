/**
 * Surchérie · Registros — Diagnóstico.
 * Acciones que devuelven conteos y el log de la ejecución, para probar el motor sin abrir el editor.
 * Se llaman por la app web con el token de la API o con DIAG_TOKEN (gas/Local.gs, fuera del repo).
 */

var LOG_ = [];
function log_(msg) {
  var linea = Utilities.formatDate(new Date(), TZ, 'HH:mm:ss') + ' ' + msg;
  LOG_.push(linea);
  Logger.log(linea);
}

/** Token válido: el de la API (Vercel) o el de diagnóstico (Claude Code). */
function tokenValido_(t) {
  if (!t) return false;
  var api = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (api && t === api) return true;
  return typeof DIAG_TOKEN === 'string' && DIAG_TOKEN.length >= 32 && t === DIAG_TOKEN;
}

/** Última fila con valor en la columna clave (no getLastRow, que cuenta casillas vacías). */
function ultimaConDato_(sh, col) {
  var lr = sh.getLastRow();
  if (lr < 2) return 1;
  var v = sh.getRange(1, col || 1, lr, 1).getDisplayValues();
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]).trim() !== '') return i + 1;
  return 1;
}

/** Estado general: quién ejecuta, zona horaria, filas reales por pestaña y Catálogo Maestro. */
function diag() {
  var t0 = Date.now();
  var ss = SpreadsheetApp.getActive();
  log_('Zona ' + ss.getSpreadsheetTimeZone());
  var tabs = {};
  ss.getSheets().forEach(function (sh) {
    tabs[sh.getName()] = { getLastRow: sh.getLastRow(), filasConDato: ultimaConDato_(sh, 1) - 1 };
  });
  log_('Pestañas leídas: ' + Object.keys(tabs).length);
  var cat = null;
  try {
    var c = SpreadsheetApp.openById(cfg_('maestroId')).getSheetByName(cfg_('maestroHoja') || 'catalogo');
    var v = c.getRange(3, 1, Math.max(c.getLastRow() - 2, 1), 11).getDisplayValues().filter(function (r) { return r[0]; });
    var conK = v.filter(function (r) { return r[4] && r[5]; });
    var planillas = {};
    conK.forEach(function (r) { planillas[sheetIdDe_(r[4])] = true; });
    cat = { productos: v.length, conKardex: conK.length, sinKardex: v.length - conK.length, planillas: Object.keys(planillas).length };
    log_('Catálogo: ' + JSON.stringify(cat));
  } catch (e) { log_('ERROR catálogo: ' + e.message); }
  return {
    zona: ss.getSpreadsheetTimeZone(),
    tabs: tabs, catalogo: cat, config: { ultimoRCC: cfg_('ultimoRCC'), ultimoRemito: cfg_('ultimoRemito'), ultimaOC: cfg_('ultimaOC') },
    ms: Date.now() - t0, log: LOG_
  };
}

/** Lee una pestaña de kardex tal cual (valores visibles) para ver su forma real. */
function diagKardex(sid, hoja, filas) {
  var sh = SpreadsheetApp.openById(sid).getSheetByName(hoja);
  if (!sh) throw new Error('No existe la pestaña "' + hoja + '"');
  var n = Math.min(filas || 30, Math.max(sh.getLastRow(), 1));
  return {
    zona: sh.getParent().getSpreadsheetTimeZone(), getLastRow: sh.getLastRow(), ultimaConDatoD: ultimaConDato_(sh, 4),
    encabezados: sh.getRange(5, 1, 1, 12).getDisplayValues()[0],
    filas: sh.getRange(1, 1, n, 12).getDisplayValues()
  };
}
