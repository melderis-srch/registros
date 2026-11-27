/**
 * AppDB.gs · Base de datos del sistema web (pantalla /sistema.html).
 *
 * Guarda cada documento de la app (RCC, remitos, OC, recepciones, registros de calidad, configuración)
 * como una fila JSON en la pestaña AppDB de esta planilla. La web lee todo al entrar y después
 * pide solo lo que cambió (cada pocos segundos), así varias personas trabajan a la vez.
 *
 * También da a la web acceso controlado a Google Sheets y Drive con la cuenta DT:
 *  - solo a las planillas del sistema (Registros, Seguimiento, Catálogo Maestro) y a las planillas
 *    de kardex que figuran en el Catálogo Maestro;
 *  - en Drive, solo crear carpetas y subir PDF dentro de carpetas que ya existen.
 * Todo cambio queda en AppDB_Log con usuario y hora.
 */

var APPDB = 'AppDB', APPDB_LOG = 'AppDB_Log', APPDB_MAX = 49000;
var APPDB_COLS = ['coleccion', 'id', 'json', 'ts', 'usuario', 'borrado'];

function appdbHoja_() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(APPDB);
  if (!sh) {
    sh = ss.insertSheet(APPDB);
    sh.getRange(1, 1, 1, APPDB_COLS.length).setValues([APPDB_COLS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('C:C').setWrap(false);
    sh.getRange('A:B').setNumberFormat('@');
  }
  return sh;
}
function appdbLog_(accion, detalle) {
  try {
    var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(APPDB_LOG);
    if (!sh) { sh = ss.insertSheet(APPDB_LOG); sh.appendRow(['fecha', 'usuario', 'accion', 'detalle']); sh.setFrozenRows(1); }
    sh.appendRow([new Date(), USUARIO || '', accion, String(detalle).slice(0, 500)]);
  } catch (e) { }
}
function appdbFilas_() {
  var sh = appdbHoja_(), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, APPDB_COLS.length).getValues();
}

/** Todo el contenido (sin borrados). La web lo pide al entrar. */
function dbTodo() {
  var docs = [];
  appdbFilas_().forEach(function (r) {
    if (r[5] === true || r[5] === 1 || r[5] === '1' || !r[0] || !r[1]) return;
    try { docs.push({ c: String(r[0]), id: String(r[1]), d: JSON.parse(r[2] || '{}') }); } catch (e) { }
  });
  return { ts: Date.now(), docs: docs };
}

/** Solo lo que cambió desde `desde` (ms). Incluye los borrados (d = null). */
function dbCambios(desde) {
  desde = Number(desde) || 0;
  var docs = [];
  appdbFilas_().forEach(function (r) {
    if (!r[0] || !r[1] || !(Number(r[3]) > desde)) return;
    var borrado = r[5] === true || r[5] === 1 || r[5] === '1';
    var d = null;
    if (!borrado) { try { d = JSON.parse(r[2] || '{}'); } catch (e) { return; } }
    docs.push({ c: String(r[0]), id: String(r[1]), d: d });
  });
  return { ts: Date.now(), docs: docs };
}

function appdbFila_(sh, col, id) {
  var n = sh.getLastRow();
  if (n < 2) return 0;
  var hits = sh.getRange(2, 2, n - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findAll();
  for (var i = 0; i < hits.length; i++) {
    var row = hits[i].getRow();
    if (String(sh.getRange(row, 1).getValue()) === String(col)) return row;
  }
  return 0;
}
function appdbValidar_(col, id) {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(col))) throw new Error('Colección inválida');
  if (!/^[A-Za-z0-9_.-]{1,80}$/.test(String(id))) throw new Error('Identificador inválido');
}

/** Crea o reemplaza un documento. Devuelve el ts de la escritura. */
function dbSet(col, id, data) {
  appdbValidar_(col, id);
  var json = JSON.stringify(data || {});
  if (json.length > APPDB_MAX) throw new Error('El registro es demasiado grande para guardarse (' + json.length + ' caracteres).');
  var lock = LockService.getDocumentLock(); lock.waitLock(20000);
  try {
    var sh = appdbHoja_(), row = appdbFila_(sh, col, id), ts = Date.now();
    var vals = [[String(col), String(id), json, ts, USUARIO || '', '']];
    if (row) sh.getRange(row, 1, 1, APPDB_COLS.length).setValues(vals);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, APPDB_COLS.length).setValues(vals);
    SpreadsheetApp.flush();
    return { ts: ts };
  } finally { lock.releaseLock(); }
}

/** Borra un documento (queda marcado como borrado para que las otras sesiones se enteren). */
function dbDelete(col, id) {
  appdbValidar_(col, id);
  var lock = LockService.getDocumentLock(); lock.waitLock(20000);
  try {
    var sh = appdbHoja_(), row = appdbFila_(sh, col, id), ts = Date.now();
    if (row) sh.getRange(row, 3, 1, 4).setValues([['', ts, USUARIO || '', '1']]);
    appdbLog_('borrar', col + '/' + id);
    return { ts: ts };
  } finally { lock.releaseLock(); }
}

/** Carga masiva (migración desde la app de Claude). Reemplaza los documentos con el mismo id. */
function dbImportar(docs) {
  var n = 0;
  (docs || []).forEach(function (x) { dbSet(x.c, x.id, x.d); n++; });
  appdbLog_('importar', n + ' documentos');
  return { importados: n };
}

// ---------------- Acceso a planillas y Drive (con la cuenta DT) ----------------

function idsPermitidos_() {
  var cache = CacheService.getScriptCache(), k = 'appdb_ids', c = cache.get(k);
  if (c) return JSON.parse(c);
  var ids = {};
  ids[SpreadsheetApp.getActive().getId()] = 1;
  ['seguimientoId', 'maestroId'].forEach(function (key) { var v = cfg_(key); if (v) ids[String(v)] = 1; });
  ids['15HI2_nU6Tc6mFxRdDuJRSCmNgTH3gKQFq1ATwhab63M'] = 1;
  ids['1MvXkmp88wPqKz-xyT9IQud1YD7R0A5B5Y5XzeqoYERM'] = 1;
  try { // planillas de kardex linkeadas en el Catálogo Maestro (columna E)
    var cat = SpreadsheetApp.openById(cfg_('maestroId') || '1MvXkmp88wPqKz-xyT9IQud1YD7R0A5B5Y5XzeqoYERM').getSheetByName('catalogo');
    var vals = cat.getRange('E3:E' + Math.max(3, cat.getLastRow())).getValues();
    var rich = cat.getRange('E3:E' + Math.max(3, cat.getLastRow())).getRichTextValues();
    vals.forEach(function (r, i) {
      var t = String(r[0] || '') + ' ' + (rich[i][0] && rich[i][0].getLinkUrl() || '');
      var m = t.match(/[-\w]{25,}/g); if (m) m.forEach(function (id) { ids[id] = 1; });
    });
  } catch (e) { }
  cache.put(k, JSON.stringify(ids), 21600);
  return ids;
}
function planillaPermitida_(id) {
  id = String(id || '');
  if (idsPermitidos_()[id]) return true;
  CacheService.getScriptCache().remove('appdb_ids'); // por si se agregó un producto nuevo al catálogo
  if (idsPermitidos_()[id]) return true;
  throw new Error('La app no tiene permiso para esa planilla (' + id + '). Solo usa las planillas del sistema y las del kardex del Catálogo Maestro.');
}
function rangoDe_(ss, a1) {
  var r = ss.getRange(a1);
  if (!r) throw new Error('Rango inválido: ' + a1);
  return r;
}
function recortar_(vals) {
  var out = vals.map(function (row) { var n = row.length; while (n && (row[n - 1] === '' || row[n - 1] == null)) n--; return row.slice(0, n); });
  var m = out.length; while (m && !out[m - 1].length) m--;
  return out.slice(0, m);
}

/** Equivalente a las herramientas de Google Sheets que usaba la app de Claude. */
function sheetsProxy(tool, input) {
  input = input || {};
  planillaPermitida_(input.spreadsheetId);
  var ss = SpreadsheetApp.openById(input.spreadsheetId);
  if (tool === 'get_values') {
    var r = rangoDe_(ss, input.range);
    return { range: input.range, values: recortar_(r.getDisplayValues()) };
  }
  if (tool === 'update_values') {
    var vals = input.values || [], w = Math.max.apply(null, vals.map(function (x) { return x.length; }).concat([1]));
    var pad = vals.map(function (x) { var y = x.slice(); while (y.length < w) y.push(''); return y; });
    var r0 = rangoDe_(ss, input.range);
    r0.getSheet().getRange(r0.getRow(), r0.getColumn(), pad.length, w).setValues(pad);
    appdbLog_('planilla: escribir', ss.getName() + ' ' + input.range + ' (' + pad.length + ' filas)');
    return { updatedRange: input.range, updatedRows: pad.length };
  }
  if (tool === 'append_values') {
    var v = input.values || [], wa = Math.max.apply(null, v.map(function (x) { return x.length; }).concat([1]));
    var pv = v.map(function (x) { var y = x.slice(); while (y.length < wa) y.push(''); return y; });
    var sh = rangoDe_(ss, input.range).getSheet(), col = rangoDe_(ss, input.range).getColumn();
    if (pv.length) sh.getRange(sh.getLastRow() + 1, col, pv.length, wa).setValues(pv);
    appdbLog_('planilla: agregar', ss.getName() + ' ' + sh.getName() + ' (' + pv.length + ' filas)');
    return { updates: { updatedRows: pv.length } };
  }
  throw new Error('Herramienta de planillas no disponible: ' + tool);
}

/** Equivalente a las herramientas de Drive que usaba la app (carpetas y subida de PDF). */
function driveProxy(tool, input) {
  input = input || {};
  if (tool === 'search_files') {
    var q = String(input.query || '');
    var p = q.match(/parentId\s*=\s*'([^']+)'/), t = q.match(/title\s*=\s*'((?:[^'\\]|\\.)*)'/);
    if (!p || !t) throw new Error('Búsqueda no soportada');
    var it = DriveApp.getFolderById(p[1]).getFoldersByName(t[1].replace(/\\'/g, "'")), files = [];
    while (it.hasNext() && files.length < (input.pageSize || 5)) { var f = it.next(); if (!f.isTrashed()) files.push({ id: f.getId(), title: f.getName() }); }
    return { files: files };
  }
  if (tool === 'create_file') {
    var padre = DriveApp.getFolderById(input.parentId);
    if (input.contentMimeType === 'application/vnd.google-apps.folder') {
      var nf = padre.createFolder(input.title);
      return { id: nf.getId(), viewUrl: nf.getUrl() };
    }
    if (!input.base64Content) throw new Error('Falta el contenido del archivo');
    var blob = Utilities.newBlob(Utilities.base64Decode(input.base64Content), input.contentMimeType || 'application/pdf', input.title);
    var file = padre.createFile(blob);
    appdbLog_('drive: subir', input.title);
    return { id: file.getId(), viewUrl: file.getUrl() };
  }
  throw new Error('Herramienta de Drive no disponible: ' + tool);
}
