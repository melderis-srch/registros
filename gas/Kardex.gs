/**
 * Surchérie · Registros — Kardex, stock, reposición y pendientes.
 *
 * El kardex (FORM POE 14-02) es una planilla por producto, con una pestaña por variante, y el
 * Catálogo Maestro tiene el link y la pestaña de cada código. Cada unidad es una fila:
 *   A total ingresado (solo en la fila de grupo) · B fecha ingreso · C cantidad (1) · D lote · E vto ·
 *   F remito · G fecha egreso · H N° RCC · I médico/paciente · J factura
 * Disponible = filas con C = 1 y H vacío (la misma cuenta que la fórmula de la planilla).
 *
 * La pestaña "Stock" de este Sheet guarda una copia de lo leído para que la app responda rápido;
 * se actualiza con "Leer kardex" (app o menú), todas las noches si se activa, y después de cada
 * baja o ingreso del producto tocado.
 */

var KARDEX_FILA_INICIO = 6; // las primeras 5 filas son título y encabezados

/* ---------------- utilidades ---------------- */

/** Código comparable entre la lista vieja y el Catálogo Maestro: "SPP 59-40S" → "spp5940s" */
function ncode_(s) { return String(s || '').toLowerCase().replace(/[\s\-_.]/g, ''); }

function sheetIdDe_(url) { var m = String(url || '').match(/\/d\/([\w-]{20,})/); return m ? m[1] : ''; }

var MESES_CORTOS = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11 };

/** Vencimiento en cualquiera de los formatos que aparecen en el kardex → Date (o null) */
function parseVto_(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate(), 12);
  var s = String(v || '').trim().toLowerCase(), m;
  if (!s) return null;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) { var y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1], 12); }
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/))) return new Date(+m[2], +m[1] - 1, 1, 12);
  if ((m = s.match(/^([a-z]{3})[a-z]*[\/\-. ]+(\d{2,4})$/)) && MESES_CORTOS[m[1]] !== undefined) {
    var a = +m[2]; if (a < 100) a += 2000; return new Date(a, MESES_CORTOS[m[1]], 1, 12);
  }
  return null;
}

function textoVto_(v) {
  if (v instanceof Date) return fmtFecha_(v);
  return String(v || '').trim();
}

function apellido_(medico) { return String(medico || '').split(',')[0].trim(); }
function primeraPalabra_(s) { return String(s || '').replace(/,/g, ' ').trim().split(/\s+/)[0] || ''; }

function diasDesde_(f) {
  var d = f instanceof Date ? f : aFecha_(f);
  if (!d) return null;
  var h = new Date(); h = new Date(h.getFullYear(), h.getMonth(), h.getDate(), 12);
  return Math.round((h.getTime() - d.getTime()) / 864e5);
}

/* ---------------- lectura del kardex ---------------- */

/** Productos del Catálogo Maestro que tienen planilla de kardex */
function catalogo_() {
  var ss = SpreadsheetApp.openById(cfg_('maestroId'));
  var sh = ss.getSheetByName(cfg_('maestroHoja') || 'catalogo');
  if (!sh) throw new Error('No encuentro la pestaña "' + (cfg_('maestroHoja') || 'catalogo') + '" en el Catálogo Maestro.');
  var lr = sh.getLastRow();
  if (lr < 3) return [];
  return sh.getRange(3, 1, lr - 2, 11).getValues()
    .filter(function (r) { return r[0] && r[4] && r[5]; })
    .map(function (r) {
      return {
        codigo: String(r[0]).trim(), desc: String(r[1] || ''), proveedor: String(r[2] || ''), marca: String(r[3] || ''),
        sid: sheetIdDe_(r[4]), hoja: String(r[5]).trim(), precioOC: num_(r[6]), minimo: num_(r[8])
      };
    })
    .filter(function (p) { return p.sid; });
}

/** Unidades de una pestaña de kardex */
function leerUnidades_(sid, hoja) {
  var sh = SpreadsheetApp.openById(sid).getSheetByName(hoja);
  if (!sh) throw new Error('No existe la pestaña "' + hoja + '"');
  var lr = sh.getLastRow();
  var units = [];
  if (lr >= KARDEX_FILA_INICIO) {
    var vals = sh.getRange(KARDEX_FILA_INICIO, 1, lr - KARDEX_FILA_INICIO + 1, 10).getValues();
    vals.forEach(function (r, i) {
      var lote = String(r[3] || '').trim();
      var cant = typeof r[2] === 'number' ? r[2] : num_(r[2]);
      if (!lote || !cant) return;
      var rcc = String(r[7] || '').trim();
      units.push({ fila: KARDEX_FILA_INICIO + i, lote: lote, vto: textoVto_(r[4]), vtoD: parseVto_(r[4]), cant: cant, rcc: rcc, disp: !rcc && cant === 1,
        ingreso: r[1] instanceof Date ? r[1] : aFecha_(r[1]), remito: String(r[5] || ''), egreso: r[6] instanceof Date ? r[6] : aFecha_(r[6]),
        mp: String(r[8] || ''), factura: String(r[9] || '') });
    });
  }
  return { sh: sh, units: units, ultima: ultimaFilaAJ_(sh) };
}

/** Última fila con algo escrito entre A y J (para agregar debajo sin chocar con fórmulas de otras columnas) */
function ultimaFilaAJ_(sh) {
  var lr = sh.getLastRow();
  if (!lr) return 0;
  var v = sh.getRange(1, 1, lr, 10).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (v[i].join('') !== '') return i + 1;
  return 0;
}

function resumenUnidades_(units) {
  var lotes = {}, disp = 0;
  units.forEach(function (u) {
    var l = lotes[u.lote] || (lotes[u.lote] = { vto: u.vto, vtoIso: u.vtoD ? Utilities.formatDate(u.vtoD, TZ, 'yyyy-MM-dd') : '', disp: 0, total: 0 });
    l.total += u.cant;
    if (u.disp) { l.disp++; disp++; }
  });
  return { lotes: lotes, disp: disp };
}

/* ---------------- pestaña Stock ---------------- */

function leerStock_() {
  return leer_('Stock').map(function (r) {
    try { r.lotes = r.lotes ? JSON.parse(r.lotes) : {}; } catch (e) { r.lotes = {}; }
    r.disp = num_(r.disp); r.minimo = num_(r.minimo);
    return r;
  });
}

function escribirStock_(lista) {
  var sh = hoja_('Stock'), h = heads_(sh);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, h.length).clearContent();
  if (!lista.length) return;
  var rows = lista.map(function (s) {
    var o = {}; for (var k in s) o[k] = s[k];
    o.lotes = JSON.stringify(s.lotes || {});
    return filaDe_(h, 'Stock', o);
  });
  if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
  sh.getRange(2, 1, rows.length, h.length).setValues(rows);
}

/** Índice para encontrar el producto de stock de un ítem (por código y, si no, por descripción) */
function indiceStock_(stock) {
  var porCod = {}, porDesc = {};
  stock.forEach(function (s) { porCod[ncode_(s.codigo)] = s; porDesc[norm_(s.desc)] = porDesc[norm_(s.desc)] || s; });
  return function (codigo, desc) {
    return (codigo && porCod[ncode_(codigo)]) || (desc && porDesc[norm_(desc)]) || null;
  };
}

/** Vuelve a leer un producto y actualiza su fila en Stock */
function refrescarProducto_(s) {
  try {
    var r = resumenUnidades_(leerUnidades_(s.sid, s.hoja).units);
    s.lotes = r.lotes; s.disp = r.disp; s.error = ''; s.leido = new Date();
  } catch (e) { s.error = String(e.message || e); }
  var sh = hoja_('Stock'), h = heads_(sh);
  var o = {}; for (var k in s) o[k] = s[k];
  o.lotes = JSON.stringify(s.lotes || {});
  if (s._fila) reemplazarFila_('Stock', s._fila, o);
}

/**
 * Lee el kardex de a tandas (la app llama varias veces: cada llamada tiene que entrar en el minuto de Vercel).
 * Devuelve { total, hechos, siguiente (null si terminó), errores }
 */
function kardexSync(desde, cuantos) {
  verificar_();
  desde = Number(desde) || 0; cuantos = Number(cuantos) || 25;
  var cat = catalogo_();
  var lote = cat.slice(desde, desde + cuantos);
  var leidos = lote.map(function (p) {
    var s = {}; for (var k in p) s[k] = p[k];
    try { var r = resumenUnidades_(leerUnidades_(p.sid, p.hoja).units); s.lotes = r.lotes; s.disp = r.disp; s.error = ''; }
    catch (e) { s.lotes = {}; s.disp = 0; s.error = String(e.message || e); }
    s.leido = new Date();
    return s;
  });
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var actual = leerStock_(), porCod = {};
    actual.forEach(function (s) { delete s._fila; porCod[ncode_(s.codigo)] = s; });
    leidos.forEach(function (s) { porCod[ncode_(s.codigo)] = s; });
    var termino = desde + cuantos >= cat.length;
    if (termino) {
      var validos = {}; cat.forEach(function (p) { validos[ncode_(p.codigo)] = true; });
      Object.keys(porCod).forEach(function (k) { if (!validos[k]) delete porCod[k]; });
    }
    var lista = Object.keys(porCod).map(function (k) { return porCod[k]; })
      .sort(function (a, b) { return (a.proveedor + a.desc).localeCompare(b.proveedor + b.desc); });
    escribirStock_(lista);
    if (termino) setCfg_('kardexLeido', Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'));
    return {
      total: cat.length, hechos: Math.min(desde + cuantos, cat.length), siguiente: termino ? null : desde + cuantos,
      errores: leidos.filter(function (s) { return s.error; }).length
    };
  } finally { lock.releaseLock(); }
}

/** Lee todo el kardex (menú o disparador nocturno) */
function kardexSyncTodo() {
  var t0 = Date.now(), desde = 0, r;
  do { r = kardexSync(desde, 30); desde = r.siguiente; } while (desde !== null && Date.now() - t0 < 300000);
  try { SpreadsheetApp.getActive().toast('Kardex leído: ' + r.hechos + ' de ' + r.total + ' productos.'); } catch (e) { }
  return r;
}

function activarLecturaDiaria() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'kardexSyncTodo') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('kardexSyncTodo').timeBased().everyDays(1).atHour(4).create();
  try { SpreadsheetApp.getUi().alert('Listo: el kardex se lee todas las noches (4 a 5 h).'); } catch (e) { }
}

/** Stock para la pantalla de Stock */
function getStock() {
  verificar_();
  var lim = new Date(); lim.setMonth(lim.getMonth() + 6);
  var limIso = Utilities.formatDate(lim, TZ, 'yyyy-MM-dd'), hoyIso = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  return {
    leido: cfg_('kardexLeido') || '',
    productos: leerStock_().map(function (s) {
      delete s._fila;
      s.bajoMin = s.minimo > 0 && s.disp < s.minimo;
      s.vence = Object.keys(s.lotes).some(function (l) { var x = s.lotes[l]; return x.disp > 0 && x.vtoIso && x.vtoIso < limIso; });
      s.vencido = Object.keys(s.lotes).some(function (l) { var x = s.lotes[l]; return x.disp > 0 && x.vtoIso && x.vtoIso < hoyIso; });
      return s;
    })
  };
}

/* ---------------- lotes y bajas por cirugía ---------------- */

/** Guarda los lotes de los stickers sin regenerar el PDF. lotes = [{renglon, lote, desc}] (desc evita pisar otro renglón) */
function guardarLotes(numero, lotes) {
  verificar_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var items = leer_('Consumo_Items').filter(function (r) { return String(r.numero) === String(numero); });
    (lotes || []).forEach(function (x) {
      var it = items.filter(function (r) { return Number(r.renglon) === Number(x.renglon); })[0];
      if (it && !it.baja && (!x.desc || norm_(x.desc) === norm_(it.desc))) reemplazarFila_('Consumo_Items', it._fila, { lote: String(x.lote || '').trim() });
    });
    return true;
  } finally { lock.releaseLock(); }
}

/**
 * Da de baja en el kardex lo consumido en un registro: escribe fecha de egreso, N° RCC y médico/paciente
 * en las unidades del lote cargado (o en las que vencen primero, marcado como "lote asumido").
 */
function darBajaConsumo(numero) {
  verificar_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var cons = leer_('Consumos').filter(function (r) { return String(r.numero) === String(numero); })[0];
    if (!cons) throw new Error('No existe el registro ' + numero);
    var stock = leerStock_(), buscar = indiceStock_(stock);
    var items = leer_('Consumo_Items').filter(function (r) { return String(r.numero) === String(numero) && !r.baja; });
    var fecha = aFecha_(cons.fechaCx) || aFecha_(cons.fecha) || new Date();
    var mp = apellido_(cons.medico) + '/' + primeraPalabra_(cons.paciente);
    var ok = 0, errores = [], sinKardex = [];
    items.forEach(function (it) {
      var s = buscar(it.codigo, it.desc);
      if (!s) { sinKardex.push(it.desc || it.codigo); return; }
      var cant = num_(it.cant) || 1;
      try {
        var k = leerUnidades_(s.sid, s.hoja);
        var disp = k.units.filter(function (u) { return u.disp; });
        var cand = it.lote
          ? disp.filter(function (u) { return norm_(u.lote) === norm_(it.lote); })
          : disp.slice().sort(function (a, b) { return (a.vtoD ? a.vtoD.getTime() : 9e15) - (b.vtoD ? b.vtoD.getTime() : 9e15); });
        if (cand.length < cant) {
          errores.push((it.desc || it.codigo) + ': ' + (it.lote ? 'el lote ' + it.lote + ' tiene ' + cand.length + ' disponibles' : 'no hay stock disponible') + ' en ' + s.hoja);
          return;
        }
        var usar = cand.slice(0, cant);
        usar.forEach(function (u) { k.sh.getRange(u.fila, 7, 1, 3).setValues([[fecha, String(numero), mp]]); });
        var texto = fmtFecha_(new Date()) + ' · lote ' + usar[0].lote + ' · fila' + (usar.length > 1 ? 's ' : ' ') +
          usar.map(function (u) { return u.fila; }).join(', ') + (it.lote ? '' : ' · lote asumido');
        reemplazarFila_('Consumo_Items', it._fila, { baja: texto, lote: it.lote || usar[0].lote });
        refrescarProducto_(s);
        ok++;
      } catch (e) { errores.push((it.desc || it.codigo) + ': ' + (e.message || e)); }
    });
    return { ok: ok, errores: errores, sinKardex: sinKardex };
  } finally { lock.releaseLock(); }
}

/* ---------------- ingreso al kardex desde la recepción ---------------- */

function ingresarRecepcionKardex_(numero) {
  var rec = leer_('Recepciones').filter(function (r) { return String(r.numero) === String(numero); })[0];
  if (!rec) return null;
  var stock = leerStock_(), buscar = indiceStock_(stock);
  var items = leer_('Recepcion_Items').filter(function (r) { return String(r.numero) === String(numero) && !r.kardex; });
  var fecha = aFecha_(rec.fecha) || new Date();
  var out = { ok: 0, sinKardex: [], errores: [] };
  items.forEach(function (it) {
    var s = buscar(it.codigo, it.desc);
    if (!s) { out.sinKardex.push(it.desc || it.codigo); reemplazarFila_('Recepcion_Items', it._fila, { kardex: 'Sin planilla de kardex' }); return; }
    var n = Math.round(num_(it.cant));
    if (!n) return;
    try {
      var sh = SpreadsheetApp.openById(s.sid).getSheetByName(s.hoja);
      if (!sh) throw new Error('No existe la pestaña "' + s.hoja + '"');
      var desde = Math.max(ultimaFilaAJ_(sh), KARDEX_FILA_INICIO - 1) + 1;
      var vto = aFecha_(it.vto) || it.vto;
      var filas = [[n, '', '', '', '', '', '', '-', '', '']];
      for (var i = 0; i < n; i++) filas.push(['', fecha, 1, String(it.lote), vto, String(rec.remitoProv || ''), '', '', '', String(rec.factura || '')]);
      if (sh.getMaxRows() < desde + filas.length - 1) sh.insertRowsAfter(sh.getMaxRows(), desde + filas.length - 1 - sh.getMaxRows());
      sh.getRange(desde, 1, filas.length, 10).setValues(filas);
      reemplazarFila_('Recepcion_Items', it._fila, { kardex: 'Cargado ' + fmtFecha_(new Date()) + ' · ' + s.hoja + ' filas ' + desde + '–' + (desde + filas.length - 1) });
      refrescarProducto_(s);
      out.ok++;
    } catch (e) { out.errores.push((it.desc || it.codigo) + ': ' + (e.message || e)); }
  });
  return out;
}

/** Al editar un documento, conserva lo que la app no manda de vuelta (lote, baja, OC; ingreso al kardex) */
function conservarDePrevios_(tipo, o, previos) {
  if (!previos || !previos.length) return;
  var clave = function (x) { return ncode_(x.codigo) + '|' + norm_(x.desc); };
  var p = null;
  if (tipo === 'consumo') {
    p = previos.filter(function (x) { return !x._usado && clave(x) === clave(o); })[0];
    if (!p) return;
    p._usado = true;
    if (!o.lote && p.lote) o.lote = p.lote;
    if (!o.baja && p.baja) o.baja = p.baja;
    if (!o.oc && p.oc) o.oc = p.oc;
  }
  if (tipo === 'recepcion') {
    p = previos.filter(function (x) {
      return !x._usado && x.kardex && clave(x) === clave(o) && norm_(x.lote) === norm_(o.lote) && num_(x.cant) === num_(o.cant);
    })[0];
    if (!p) return;
    p._usado = true;
    o.kardex = p.kardex;
  }
}

/* ---------------- reposición ---------------- */

function marcarOC_(filas, numeroOC) {
  if (!filas || !filas.length) return;
  var sh = hoja_('Consumo_Items'), h = heads_(sh), j = h.indexOf(colNombre_('Consumo_Items', 'oc')) + 1;
  if (!j) return;
  filas.forEach(function (f) { sh.getRange(f, j).setValue(numeroOC); });
}

/** Lo consumido que todavía no está en ninguna OC */
function pendientesRCC_(consumos, items, productos) {
  var cons = {}; consumos.forEach(function (c) { cons[c.numero] = c; });
  var prods = {}; productos.forEach(function (p) { prods[ncode_(p.codigo)] = p; });
  return items.filter(function (it) {
    var c = cons[it.numero];
    return c && !String(c.revisar || '').trim() && !it.oc && (it.desc || it.codigo) && num_(it.cant) > 0;
  }).map(function (it) {
    var p = prods[ncode_(it.codigo)] || {};
    var c = cons[it.numero];
    return {
      numero: it.numero, renglon: it.renglon, fila: it._fila, fechaCx: c.fechaCx, paciente: c.paciente,
      codigo: it.codigo, desc: it.desc, cant: num_(it.cant), proveedor: it.proveedor || p.proveedor || '',
      costo: num_(p.costo) || num_(it.costo), alicuota: p.alicuota || '21', moneda: p.moneda || it.moneda || ''
    };
  }).filter(function (x) { return x.proveedor; });
}

/** Productos bajo el mínimo, descontando lo pedido y lo consumido pendiente de pedir */
function faltantesStock_(stock, buscar, ocs, ocItems, pendRcc) {
  var abiertas = {};
  ocs.forEach(function (o) { if (serieDe_('oc', o) === 'oc' && ['Recibida', 'Anulada'].indexOf(o.estado) < 0) abiertas[o.numero] = true; });
  var pedido = {};
  ocItems.forEach(function (it) {
    if (!abiertas[it.numero]) return;
    var s = buscar(it.codigo, it.desc); if (!s) return;
    var k = ncode_(s.codigo);
    pedido[k] = (pedido[k] || 0) + Math.max(0, num_(it.cant) - num_(it.recibido));
  });
  pendRcc.forEach(function (x) {
    var s = buscar(x.codigo, x.desc); if (!s) return;
    var k = ncode_(s.codigo);
    pedido[k] = (pedido[k] || 0) + x.cant;
  });
  return stock.filter(function (s) { return s.minimo > 0 && s.disp < s.minimo; }).map(function (s) {
    return {
      codigo: s.codigo, desc: s.desc, proveedor: s.proveedor, disp: s.disp, minimo: s.minimo,
      pedido: pedido[ncode_(s.codigo)] || 0, falta: Math.max(0, s.minimo - s.disp - (pedido[ncode_(s.codigo)] || 0)),
      costo: num_(s.precioOC)
    };
  }).filter(function (x) { return x.falta > 0; });
}

function getReposicion() {
  verificar_();
  var stock = leerStock_(), buscar = indiceStock_(stock);
  var ocs = leer_('OC'), ocItems = leer_('OC_Items');
  var pend = pendientesRCC_(leer_('Consumos'), leer_('Consumo_Items'), leer_('Productos'));
  pend.forEach(function (x) { delete x.fila; });
  return {
    rcc: pend,
    stock: faltantesStock_(stock, buscar, ocs, ocItems, pend),
    emitidas: ocs.filter(function (o) { return serieDe_('oc', o) === 'oc' && o.estado === 'Emitida'; })
      .map(function (o) { return { numero: o.numero, proveedor: o.proveedor, fecha: o.fecha }; })
  };
}

/**
 * Pasa lo elegido a una OC: nueva (destino vacío) o sumándolo a una OC Emitida del mismo proveedor.
 * refs = [{numero (RCC), renglon}] · extras = [{codigo, desc, cant, costo}] (faltantes de stock)
 */
function pasarAOC(destino, proveedor, refs, extras) {
  var email = verificar_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var todos = leer_('Consumo_Items'), prods = {};
    leer_('Productos').forEach(function (p) { prods[ncode_(p.codigo)] = p; });
    var elegidos = (refs || []).map(function (r) {
      return todos.filter(function (it) { return String(it.numero) === String(r.numero) && Number(it.renglon) === Number(r.renglon) && !it.oc; })[0];
    }).filter(Boolean);
    var nuevos = elegidos.map(function (it) {
      var p = prods[ncode_(it.codigo)] || {};
      return { codigo: it.codigo, desc: it.desc, cant: num_(it.cant), costo: num_(p.costo) || num_(it.costo), alicuota: p.alicuota || '21' };
    }).concat((extras || []).map(function (x) {
      return { codigo: x.codigo, desc: x.desc, cant: num_(x.cant), costo: num_(x.costo), alicuota: '21' };
    }));
    if (!nuevos.length) throw new Error('No hay ítems para pasar (¿ya estaban en otra OC?).');

    var cab, items, numero, previo = null;
    if (destino) {
      previo = leer_('OC').filter(function (o) { return String(o.numero) === String(destino); })[0];
      if (!previo) throw new Error('No existe la OC ' + destino);
      if (previo.estado !== 'Emitida') throw new Error('La OC ' + destino + ' ya no está Emitida (' + previo.estado + '): armá una nueva.');
      cab = {}; for (var k in previo) cab[k] = previo[k];
      delete cab._fila;
      items = leer_('OC_Items').filter(function (r) { return String(r.numero) === String(destino); })
        .sort(function (a, b) { return a.renglon - b.renglon; })
        .map(function (r) { return { codigo: r.codigo, desc: r.desc, cant: num_(r.cant), costo: num_(r.costo), alicuota: r.alicuota || '21' }; });
      numero = destino;
    } else {
      var pv = leer_('Proveedores').filter(function (p) { return norm_(p.razon) === norm_(proveedor) || norm_(p.codigo) === norm_(proveedor); })[0] || {};
      var moneda = pv.moneda || 'ARS';
      cab = {
        tipo: 'Orden de compra', fecha: fmtFecha_(new Date()), estado: 'Emitida', pedido: 'Reposición',
        proveedor: pv.razon || proveedor, cuit: pv.cuit || '', domicilio: pv.domicilio || '', localidad: pv.localidad || '',
        pago: pv.pago || '', lugar: cfg_('lugarEntrega') || '', moneda: moneda,
        tc: moneda === 'USD' ? num_(cfg_('tcUSD')) : '', descuento: 0, obs: ''
      };
      items = [];
      var n = proximo_('oc'); numero = NUMERACION.oc.fmt(n); setCfg_('ultimaOC', n);
      cab.creado = new Date();
    }
    nuevos.forEach(function (x) {
      var igual = items.filter(function (y) { return (x.codigo && ncode_(y.codigo) === ncode_(x.codigo)) || norm_(y.desc) === norm_(x.desc); })[0];
      if (igual) igual.cant = num_(igual.cant) + x.cant; else items.push(x);
    });
    var rccs = {}; elegidos.forEach(function (it) { rccs[it.numero] = true; });
    var lista = Object.keys(rccs);
    if (lista.length) {
      var txt = 'Reposición RCC ' + lista.join(', ');
      cab.obs = cab.obs ? (cab.obs.indexOf(txt) >= 0 ? cab.obs : cab.obs + ' · ' + txt) : txt;
    }
    cab.numero = numero; cab.modificado = new Date(); cab.usuario = email;
    calcularServidor_('oc', cab, items);
    var filasItems = items.map(function (x, i) { x.numero = numero; x.renglon = i + 1; return x; });
    if (previo) {
      reemplazarFila_('OC', previo._fila, cab);
      borrarFilasDonde_('OC_Items', 'numero', numero);
    } else agregar_('OC', [cab]);
    agregar_('OC_Items', filasItems);
    recalcularOC_(numero);

    // vínculos: cada ítem del RCC queda con su OC, y el RCC lista sus OC
    todos = leer_('Consumo_Items');
    var filas = elegidos.map(function (e) {
      var it = todos.filter(function (t) { return String(t.numero) === String(e.numero) && Number(t.renglon) === Number(e.renglon); })[0];
      return it ? it._fila : null;
    }).filter(Boolean);
    marcarOC_(filas, numero);
    var consumos = leer_('Consumos');
    lista.forEach(function (r) {
      var c = consumos.filter(function (x) { return String(x.numero) === String(r); })[0];
      if (!c) return;
      var prev = c.ocs ? String(c.ocs).split(/\s*·\s*/) : [];
      if (prev.indexOf(numero) < 0) reemplazarFila_('Consumos', c._fila, { ocs: prev.concat([numero]).join(' · ') });
    });
    return { numero: numero, items: items.length, sumados: nuevos.length, nueva: !previo };
  } finally { lock.releaseLock(); }
}

/* ---------------- pendientes (tablero de inicio) ---------------- */

function getPendientes() {
  verificar_();
  var A = [];
  var stock = leerStock_(), buscar = indiceStock_(stock);
  var consumos = leer_('Consumos'), items = leer_('Consumo_Items');
  var porRcc = {}; items.forEach(function (it) { (porRcc[it.numero] = porRcc[it.numero] || []).push(it); });
  var hrefRcc = function (n) { return '/cirugias/consumo?numero=' + encodeURIComponent(n); };

  if (!stock.length) A.push({ key: 'kardex', tit: 'Kardex sin leer', nivel: 'rojo', n: 1, sub: 'Sin esto no se puede saber qué falta bajar ni qué está bajo mínimo.', head: [], rows: [], accion: { label: 'Leer kardex', href: '/stock?leer=1' } });

  // stickers y bajas
  var stickers = [], listas = [];
  consumos.forEach(function (c) {
    var its = (porRcc[c.numero] || []).filter(function (it) { return !it.baja && buscar(it.codigo, it.desc); });
    if (!its.length) return;
    var sinLote = its.filter(function (it) { return !String(it.lote || '').trim(); });
    var d = diasDesde_(c.fechaCx);
    if (sinLote.length) stickers.push({ c: c, d: d, its: sinLote }); else listas.push({ c: c, d: d, its: its });
  });
  var porDias = function (a, b) { return (b.d || 0) - (a.d || 0); };
  stickers.sort(porDias); listas.sort(porDias);
  var viejos = stickers.filter(function (x) { return x.d > 30; }).length;
  A.push({
    key: 'stickers', tit: 'Esperando stickers (falta lote)', nivel: viejos ? 'rojo' : 'ambar', n: stickers.length, urg: viejos,
    sub: viejos ? viejos + ' con más de 30 días desde la cirugía.' : 'Cirugías con productos de kardex sin lote cargado.',
    head: ['RCC', 'Cirugía', 'Hace', 'Paciente / Médico', 'Productos sin lote'],
    rows: stickers.map(function (x) {
      return { href: hrefRcc(x.c.numero), bad: x.d > 30, c: [x.c.numero, x.c.fechaCx, dias_(x.d), x.c.paciente + ' · ' + apellido_(x.c.medico),
        x.its.map(function (it) { return it.desc + (num_(it.cant) > 1 ? ' ×' + num_(it.cant) : ''); }).join(', ')] };
    })
  });
  A.push({
    key: 'bajas', tit: 'Listas para dar de baja', nivel: 'azul', n: listas.length, urg: listas.filter(function (x) { return x.d > 15; }).length,
    sub: 'Tienen todos los lotes: falta escribirlas en el kardex.', head: ['RCC', 'Cirugía', 'Hace', 'Paciente', 'Productos'],
    rows: listas.map(function (x) { return { href: hrefRcc(x.c.numero), c: [x.c.numero, x.c.fechaCx, dias_(x.d), x.c.paciente, String(x.its.length)] }; }),
    accion: { label: 'Dar de baja en tanda', accion: 'bajaTanda', refs: listas.map(function (x) { return x.c.numero; }) }
  });

  var rev = consumos.filter(function (c) { return String(c.revisar || '').trim(); });
  A.push({ key: 'revisar', tit: 'RCC a revisar', nivel: 'ambar', n: rev.length, sub: 'Tienen una observación pendiente; no se reponen hasta resolverla.', head: ['RCC', 'Cirugía', 'Paciente', 'Qué revisar'],
    rows: rev.map(function (c) { return { href: hrefRcc(c.numero), c: [c.numero, c.fechaCx, c.paciente, c.revisar] }; }) });

  // cirugías del Seguimiento
  try {
    var seg = leerSeguimiento_().filas, sinRcc = [], sinRem = [];
    seg.forEach(function (c) {
      if (c.pendiente || !c.fecha || ['Suspendida', 'Dada de baja'].indexOf(c.estado) >= 0) return;
      var d = diasDesde_(c.fecha);
      if (d > 0 && d <= 120 && !c.rcc) sinRcc.push({ c: c, d: d });
      if (d <= 0 && d >= -7 && !c.remito) sinRem.push({ c: c, d: d });
    });
    sinRcc.sort(function (a, b) { return b.d - a.d; });
    sinRem.sort(function (a, b) { return b.d - a.d; });
    A.push({ key: 'sinRcc', tit: 'Cirugías hechas sin RCC', nivel: 'ambar', n: sinRcc.length, urg: sinRcc.filter(function (x) { return x.d > 7; }).length,
      sub: 'Ya pasó la fecha y no tienen registro de consumo. Tocá una para emitirlo.', head: ['Fecha', 'Hace', 'Paciente', 'Médico', 'Institución'],
      rows: sinRcc.map(function (x) { return { href: '/cirugias/consumo?cirugia=' + encodeURIComponent(x.c.id), bad: x.d > 7, c: [x.c.fecha, dias_(x.d), x.c.paciente, x.c.medico, x.c.institucion] }; }) });
    A.push({ key: 'sinRemito', tit: 'Próximas cirugías sin remito', nivel: 'rojo', n: sinRem.length, urg: sinRem.filter(function (x) { return x.d >= -2; }).length,
      sub: 'En los próximos 7 días y sin remito de transporte. Tocá una para hacerlo.', head: ['Fecha', 'Falta', 'Paciente', 'Médico', 'Institución'],
      rows: sinRem.map(function (x) { return { href: '/cirugias/remito?cirugia=' + encodeURIComponent(x.c.id), bad: x.d >= -2, c: [x.c.fecha, x.d === 0 ? 'hoy' : -x.d + ' días', x.c.paciente, x.c.medico, x.c.institucion] }; }) });
  } catch (e) {
    A.push({ key: 'seg', tit: 'No pude leer el Seguimiento', nivel: 'rojo', n: 1, sub: String(e.message || e), head: [], rows: [] });
  }

  // reposición
  var ocs = leer_('OC'), ocItems = leer_('OC_Items');
  var pend = pendientesRCC_(consumos, items, leer_('Productos'));
  var grupos = {};
  pend.forEach(function (x) {
    var g = grupos[x.proveedor] || (grupos[x.proveedor] = { n: 0, u: 0, rcc: {}, d: 0 });
    g.n++; g.u += x.cant; g.rcc[x.numero] = true; g.d = Math.max(g.d, diasDesde_(x.fechaCx) || 0);
  });
  var provs = Object.keys(grupos).sort(function (a, b) { return grupos[b].d - grupos[a].d; });
  A.push({ key: 'reponer', tit: 'Consumo sin pasar a OC', nivel: 'azul', n: pend.length, sub: 'Lo usado en cirugías que todavía no está en ninguna OC. Lo mandás cuando quieras.',
    head: ['Proveedor', 'Ítems', 'Unidades', 'Más viejo', 'RCC'],
    rows: provs.map(function (p) { var g = grupos[p]; return { href: '/compras/reponer?proveedor=' + encodeURIComponent(p), c: [p, String(g.n), String(g.u), dias_(g.d), Object.keys(g.rcc).join(', ')] }; }),
    accion: { label: 'Reponer pendientes', href: '/compras/reponer' } });

  var falt = stock.length ? faltantesStock_(stock, buscar, ocs, ocItems, pend) : [];
  A.push({ key: 'minimo', tit: 'Stock bajo mínimo', nivel: 'rojo', n: falt.length, urg: falt.filter(function (x) { return x.disp === 0; }).length,
    sub: 'Ya descuenta lo pedido en OC abiertas y lo consumido pendiente de pedir.', head: ['Producto', 'Proveedor', 'Disp.', 'Mín.', 'Falta pedir'],
    rows: falt.map(function (x) { return { href: '/stock?codigo=' + encodeURIComponent(x.codigo), bad: x.disp === 0, c: [x.desc, x.proveedor, String(x.disp), String(x.minimo), String(x.falta)] }; }),
    accion: { label: 'Reponer pendientes', href: '/compras/reponer' } });

  // OC
  var soloOC = ocs.filter(function (o) { return serieDe_('oc', o) === 'oc'; });
  var emit = soloOC.filter(function (o) { return o.estado === 'Emitida'; });
  var esp = soloOC.filter(function (o) { return o.estado === 'Enviada' || o.estado === 'Recibida parcial'; });
  var lle = soloOC.filter(function (o) { return o.estado === 'Llegó'; });
  A.push({ key: 'llego', tit: 'Llegó y falta la recepción', nivel: 'rojo', n: lle.length, urg: lle.filter(function (o) { return diasDesde_(o.modificado || o.fecha) > 2; }).length,
    sub: 'Mercadería en el depósito sin recepción cargada: no suma al stock hasta que la cargues.', head: ['OC', 'Fecha OC', 'Proveedor', 'Ítems'],
    rows: lle.map(function (o) { return { href: '/compras/recepcion?oc=' + encodeURIComponent(o.numero), c: [o.numero, o.fecha, o.proveedor, String(ocItems.filter(function (i) { return i.numero === o.numero; }).length)] }; }) });
  var sinIng = sinIngresar_(stock, buscar);
  A.push({ key: 'sinIngresar', tit: 'Recibido sin ingresar al kardex', nivel: 'rojo', n: sinIng.length,
    sub: 'Tiene recepción pero no se pudo escribir en la planilla del producto.', head: ['Recepción', 'Fecha', 'Proveedor', 'Producto', 'Lote', 'Cant.'],
    rows: sinIng.map(function (x) { return { href: '/compras/recepcion?numero=' + encodeURIComponent(x.numero), c: [x.numero, x.fecha, x.proveedor, x.desc, x.lote, String(x.cant)] }; }),
    accion: { label: 'Reintentar ingreso', accion: 'reingresar', refs: sinIng.map(function (x) { return x.numero; }).filter(function (v, i, a) { return a.indexOf(v) === i; }) } });
  var hrefOC = function (n) { return '/compras/oc?numero=' + encodeURIComponent(n); };
  A.push({ key: 'ocEmit', tit: 'OC armadas sin enviar', nivel: 'ambar', n: emit.length, sub: 'Cuando la mandes, pasala a “Enviada”.', head: ['OC', 'Fecha', 'Hace', 'Proveedor', 'Total'],
    rows: emit.map(function (o) { return { href: hrefOC(o.numero), c: [o.numero, o.fecha, dias_(diasDesde_(o.fecha)), o.proveedor, (o.moneda === 'USD' ? 'USD ' : '$ ') + num_(o.total).toFixed(2)] }; }) });
  A.push({ key: 'ocEsp', tit: 'OC esperando mercadería', nivel: 'azul', n: esp.length, urg: esp.filter(function (o) { return diasDesde_(o.fecha) > 15; }).length,
    sub: 'Enviadas o recibidas en parte. Cuando llegue: “Nueva recepción”.', head: ['OC', 'Fecha', 'Hace', 'Proveedor', 'Estado'],
    rows: esp.map(function (o) { var d = diasDesde_(o.fecha); return { href: hrefOC(o.numero), bad: d > 15, c: [o.numero, o.fecha, dias_(d), o.proveedor, o.estado] }; }) });

  // remitos
  var rems = leer_('Remitos').filter(function (r) { return ['Emitido', 'Entregado'].indexOf(r.estado) >= 0 && num_(r.cajasVueltas) < num_(r.cajasEnviadas); });
  A.push({ key: 'remitos', tit: 'Remitos sin retorno', nivel: 'ambar', n: rems.length, urg: rems.filter(function (r) { return diasDesde_(r.fechaCx || r.fecha) > 7; }).length,
    sub: 'Material que salió y no volvió completo.', head: ['Remito', 'Cirugía', 'Hace', 'Institución', 'Cajas'],
    rows: rems.map(function (r) { var d = diasDesde_(r.fechaCx || r.fecha); return { href: '/cirugias/remito?numero=' + encodeURIComponent(r.numero), bad: d > 7, c: [r.numero, r.fechaCx || r.fecha, dias_(d), r.institucion, num_(r.cajasVueltas) + '/' + num_(r.cajasEnviadas)] }; }) });

  // vencimientos
  var lim = Utilities.formatDate(new Date(new Date().setMonth(new Date().getMonth() + 6)), TZ, 'yyyy-MM-dd');
  var hoyIso = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), ven = [];
  stock.forEach(function (s) {
    Object.keys(s.lotes).forEach(function (l) { var x = s.lotes[l]; if (x.disp > 0 && x.vtoIso && x.vtoIso < lim) ven.push({ s: s, l: l, x: x, venc: x.vtoIso < hoyIso }); });
  });
  ven.sort(function (a, b) { return a.x.vtoIso.localeCompare(b.x.vtoIso); });
  A.push({ key: 'vence', tit: 'Vencidos o por vencer (6 meses)', nivel: ven.some(function (v) { return v.venc; }) ? 'rojo' : 'ambar', n: ven.length, urg: ven.filter(function (v) { return v.venc; }).length,
    sub: 'Lotes con unidades disponibles.', head: ['Producto', 'Lote', 'Vence', 'Disp.'],
    rows: ven.map(function (v) { return { href: '/stock?codigo=' + encodeURIComponent(v.s.codigo), bad: v.venc, c: [v.s.desc, v.l, v.x.vto + (v.venc ? ' (vencido)' : ''), String(v.x.disp)] }; }) });

  var kerr = stock.filter(function (s) { return s.error; });
  A.push({ key: 'kerr', tit: 'Planillas de kardex con error', nivel: 'rojo', n: kerr.length, sub: 'No se pudieron leer: revisá link y pestaña en el Catálogo Maestro.', head: ['Producto', 'Pestaña', 'Error'],
    rows: kerr.map(function (s) { return { href: '/stock?codigo=' + encodeURIComponent(s.codigo), c: [s.desc, s.hoja, s.error] }; }) });

  return { leido: cfg_('kardexLeido') || '', alertas: A };
}

function dias_(d) { return d === null || d === undefined ? '—' : d === 0 ? 'hoy' : d === 1 ? '1 día' : d + ' días'; }


/* ---------------- recibido sin ingresar ---------------- */

function sinIngresar_(stock, buscar) {
  var recs = {}; leer_('Recepciones').forEach(function (r) { recs[r.numero] = r; });
  return leer_('Recepcion_Items').filter(function (it) {
    var r = recs[it.numero];
    return r && r.estado !== 'Anulada' && !it.kardex && num_(it.cant) > 0 && buscar(it.codigo, it.desc);
  }).map(function (it) {
    var r = recs[it.numero];
    return { numero: it.numero, fecha: r.fecha, proveedor: r.proveedor, codigo: it.codigo, desc: it.desc, lote: it.lote, cant: num_(it.cant) };
  });
}

/** Vuelve a intentar escribir en el kardex lo recibido que quedó sin ingresar */
function reingresarKardex(numero) {
  verificar_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { return ingresarRecepcionKardex_(numero); } finally { lock.releaseLock(); }
}

/* ---------------- movimientos de un producto ---------------- */

/** Ingresos y egresos de un producto con el saldo que va quedando (lee la planilla en el momento) */
function getMovimientos(codigo) {
  verificar_();
  var s = leerStock_().filter(function (x) { return ncode_(x.codigo) === ncode_(codigo); })[0];
  if (!s) throw new Error('No encuentro ' + codigo + ' en el stock.');
  var units = leerUnidades_(s.sid, s.hoja).units;
  var ev = {};
  var clave = function (tipo, f, lote, doc) { return tipo + '|' + (f ? f.getTime() : 0) + '|' + lote + '|' + doc; };
  units.forEach(function (u) {
    var k = clave('in', u.ingreso, u.lote, u.remito);
    var e = ev[k] || (ev[k] = { tipo: 'Ingreso', fecha: u.ingreso, lote: u.lote, vto: u.vto, doc: u.remito ? 'Remito ' + u.remito : '', detalle: u.factura ? 'Factura ' + u.factura : '', cant: 0 });
    e.cant += u.cant;
    if (u.rcc) {
      var k2 = clave('out', u.egreso, u.lote, u.rcc);
      var o = ev[k2] || (ev[k2] = { tipo: 'Egreso', fecha: u.egreso, lote: u.lote, vto: u.vto, doc: 'RCC ' + u.rcc, detalle: u.mp, cant: 0 });
      o.cant += u.cant;
    }
  });
  var lista = Object.keys(ev).map(function (k) { return ev[k]; }).sort(function (a, b) {
    var ta = a.fecha ? a.fecha.getTime() : 0, tb = b.fecha ? b.fecha.getTime() : 0;
    return ta - tb || (a.tipo === 'Ingreso' ? -1 : 1);
  });
  var saldo = 0, porLote = {};
  lista.forEach(function (e) {
    var d = e.tipo === 'Ingreso' ? e.cant : -e.cant;
    saldo += d; porLote[e.lote] = (porLote[e.lote] || 0) + d;
    e.saldo = saldo; e.saldoLote = porLote[e.lote];
    e.fecha = e.fecha ? fmtFecha_(e.fecha) : '';
  });
  return { codigo: s.codigo, desc: s.desc, hoja: s.hoja, sid: s.sid, movimientos: lista.reverse(), disp: units.filter(function (u) { return u.disp; }).length };
}

/* ---------------- tablero de gestión ---------------- */

/**
 * Totales para el tablero de Gestión. desde/hasta = 'dd/MM/yyyy' (período de consumo).
 * Montos: costo de lista (Productos) en su moneda, y total en pesos con el TC de Config.
 */
function getGestion(desde, hasta) {
  verificar_();
  var tc = num_(cfg_('tcUSD')) || 1;
  var dDesde = aFecha_(desde) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  var dHasta = aFecha_(hasta) || new Date();
  dHasta = new Date(dHasta.getFullYear(), dHasta.getMonth(), dHasta.getDate(), 23, 59);
  var prods = {}; leer_('Productos').forEach(function (p) { prods[ncode_(p.codigo)] = p; });
  var stock = leerStock_(), buscar = indiceStock_(stock);
  var precio = function (codigo, desc, s) {
    var p = prods[ncode_(codigo)] || (s && prods[ncode_(s.codigo)]) || {};
    var c = num_(p.costo) || (s ? num_(s.precioOC) : 0);
    var m = p.moneda || 'ARS';
    return { costo: c, moneda: m, ars: c * (m === 'USD' ? tc : 1) };
  };

  // stock
  var stockFilas = stock.map(function (s) {
    var pr = precio(s.codigo, s.desc, s);
    return { codigo: s.codigo, desc: s.desc, proveedor: s.proveedor, disp: s.disp, minimo: s.minimo, valorArs: s.disp * pr.ars, moneda: pr.moneda, costo: pr.costo,
      lotes: Object.keys(s.lotes).length, error: s.error };
  });
  var stockProv = {};
  stockFilas.forEach(function (x) {
    var g = stockProv[x.proveedor || 'Sin proveedor'] || (stockProv[x.proveedor || 'Sin proveedor'] = { proveedor: x.proveedor || 'Sin proveedor', productos: 0, unidades: 0, valorArs: 0, bajoMin: 0 });
    g.productos++; g.unidades += x.disp; g.valorArs += x.valorArs; if (x.minimo > 0 && x.disp < x.minimo) g.bajoMin++;
  });

  // en camino: OC enviadas o recibidas en parte
  var ocs = leer_('OC').filter(function (o) { return serieDe_('oc', o) === 'oc'; });
  var ocIdx = {}; ocs.forEach(function (o) { ocIdx[o.numero] = o; });
  var enCamino = [];
  leer_('OC_Items').forEach(function (it) {
    var o = ocIdx[it.numero];
    if (!o || ['Enviada', 'Recibida parcial', 'Llegó'].indexOf(o.estado) < 0) return;
    var falta = Math.max(0, num_(it.cant) - num_(it.recibido));
    if (!falta) return;
    var m = o.moneda || 'ARS', v = falta * num_(it.costo) * (m === 'USD' ? (num_(o.tc) || tc) : 1);
    enCamino.push({ oc: o.numero, fecha: o.fecha, dias: diasDesde_(o.fecha), estado: o.estado, proveedor: o.proveedor, codigo: it.codigo, desc: it.desc,
      pedido: num_(it.cant), recibido: num_(it.recibido), falta: falta, valorArs: v });
  });

  // recibido sin ingresar
  var sinIng = sinIngresar_(stock, buscar);

  // consumo del período
  var consumos = leer_('Consumos').filter(function (c) { var d = aFecha_(c.fechaCx) || aFecha_(c.fecha); return d && d >= dDesde && d <= dHasta; });
  var cIdx = {}; consumos.forEach(function (c) { cIdx[c.numero] = c; });
  var porProd = {}, porMed = {}, porInst = {}, porMes = {}, totU = 0, totArs = 0;
  leer_('Consumo_Items').forEach(function (it) {
    var c = cIdx[it.numero]; if (!c) return;
    var cant = num_(it.cant); if (!cant) return;
    var pr = precio(it.codigo, it.desc, buscar(it.codigo, it.desc));
    var ars = num_(it.costoArs) || cant * pr.ars;
    totU += cant; totArs += ars;
    var kP = it.codigo || it.desc;
    var gp = porProd[kP] || (porProd[kP] = { codigo: it.codigo, desc: it.desc, proveedor: it.proveedor, unidades: 0, ars: 0, cirugias: {} });
    gp.unidades += cant; gp.ars += ars; gp.cirugias[c.numero] = true;
    var med = c.medico || 'Sin médico', inst = c.institucion || 'Sin institución';
    var gm = porMed[med] || (porMed[med] = { nombre: med, cirugias: {}, unidades: 0, ars: 0 }); gm.cirugias[c.numero] = true; gm.unidades += cant; gm.ars += ars;
    var gi = porInst[inst] || (porInst[inst] = { nombre: inst, cirugias: {}, unidades: 0, ars: 0 }); gi.cirugias[c.numero] = true; gi.unidades += cant; gi.ars += ars;
    var dc = aFecha_(c.fechaCx) || aFecha_(c.fecha), km = Utilities.formatDate(dc, TZ, 'yyyy-MM');
    var gx = porMes[km] || (porMes[km] = { mes: km, cirugias: {}, unidades: 0, ars: 0 }); gx.cirugias[c.numero] = true; gx.unidades += cant; gx.ars += ars;
  });
  var aLista = function (o, orden) {
    return Object.keys(o).map(function (k) { var x = o[k]; x.cirugias = Object.keys(x.cirugias).length; return x; })
      .sort(orden || function (a, b) { return b.ars - a.ars || b.unidades - a.unidades; });
  };

  // pendiente de reponer
  var pend = pendientesRCC_(leer_('Consumos'), leer_('Consumo_Items'), leer_('Productos'));
  var rep = {};
  pend.forEach(function (x) {
    var g = rep[x.proveedor] || (rep[x.proveedor] = { proveedor: x.proveedor, items: 0, unidades: 0, ars: 0, rcc: {}, masViejo: 0 });
    var m = x.moneda || 'ARS';
    g.items++; g.unidades += x.cant; g.ars += x.cant * x.costo * (m === 'USD' ? tc : 1); g.rcc[x.numero] = true;
    g.masViejo = Math.max(g.masViejo, diasDesde_(x.fechaCx) || 0);
  });
  var reponer = Object.keys(rep).map(function (k) { var g = rep[k]; g.rcc = Object.keys(g.rcc).length; return g; }).sort(function (a, b) { return b.ars - a.ars; });

  var suma = function (l, f) { return l.reduce(function (s, x) { return s + (num_(x[f]) || 0); }, 0); };
  return {
    tc: tc, desde: fmtFecha_(dDesde), hasta: fmtFecha_(dHasta), kardexLeido: cfg_('kardexLeido') || '',
    kpis: {
      stockUnidades: suma(stockFilas, 'disp'), stockArs: suma(stockFilas, 'valorArs'), productos: stockFilas.length,
      bajoMin: stockFilas.filter(function (x) { return x.minimo > 0 && x.disp < x.minimo; }).length,
      sinStock: stockFilas.filter(function (x) { return x.disp === 0; }).length,
      enCaminoUnidades: suma(enCamino, 'falta'), enCaminoArs: suma(enCamino, 'valorArs'),
      ocAbiertas: ocs.filter(function (o) { return ['Emitida', 'Enviada', 'Llegó', 'Recibida parcial'].indexOf(o.estado) >= 0; }).length,
      sinIngresar: sinIng.length, llego: ocs.filter(function (o) { return o.estado === 'Llegó'; }).length,
      consumoUnidades: totU, consumoArs: totArs, cirugias: consumos.length,
      reponerUnidades: suma(reponer, 'unidades'), reponerArs: suma(reponer, 'ars')
    },
    stockProv: Object.keys(stockProv).map(function (k) { return stockProv[k]; }).sort(function (a, b) { return b.valorArs - a.valorArs; }),
    stock: stockFilas.sort(function (a, b) { return b.valorArs - a.valorArs; }),
    enCamino: enCamino.sort(function (a, b) { return (b.dias || 0) - (a.dias || 0); }),
    sinIngresar: sinIng,
    consumo: {
      productos: aLista(porProd), medicos: aLista(porMed), instituciones: aLista(porInst),
      meses: aLista(porMes, function (a, b) { return a.mes.localeCompare(b.mes); })
    },
    reponer: reponer
  };
}
