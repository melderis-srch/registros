/**
 * Surchérie · Registros — Lectura del kardex (FORM POE 14-02).
 *
 * Reglas (verificadas contra las planillas reales):
 *  - Las columnas se ubican por el texto del encabezado (fila de "Nº Lote" y "Nº RCC"), nunca por posición.
 *  - Cada planilla se abre una sola vez y se leen todas las pestañas que el Catálogo Maestro le asigna.
 *  - Las fechas tipo Date se pasan a texto con la zona horaria de la planilla de origen (hay planillas
 *    en Los Ángeles y en Madrid); las de texto se interpretan como d/m/aaaa.
 *  - Fila de grupo: sólo tiene "Total ingresado". Fila de unidad: tiene lote, fecha de ingreso o N° RCC.
 *    Si la cantidad está vacía se toma 1 y se marca.
 *  - Una unidad está egresada si tiene N° RCC o fecha de egreso. Disponible = no egresada.
 */

var KX_CAMPOS = [
  ['total', /total/],
  ['ingreso', /fecha\s*(de\s*)?ingreso|^ingreso/],
  ['cant', /cantidad|^cant/],
  ['lote', /lote/],
  ['vto', /venc/],
  ['remito', /remito/],
  ['egreso', /fecha\s*(de\s*)?egreso|^egreso/],
  ['rcc', /rcc/],
  ['mp', /medico|paciente/],
  ['saldo', /saldo/],
  ['factura', /factura/]
];

function kxNorm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Busca la fila de encabezados en las primeras 12 filas y devuelve { fila (1-based), cols: {campo: índice 0-based} } */
function kxEncabezados_(disp) {
  for (var i = 0; i < Math.min(12, disp.length); i++) {
    var fila = disp[i].map(kxNorm_);
    var cols = {};
    fila.forEach(function (t, j) {
      if (!t) return;
      for (var k = 0; k < KX_CAMPOS.length; k++) {
        var c = KX_CAMPOS[k];
        if (cols[c[0]] === undefined && c[1].test(t)) { cols[c[0]] = j; break; }
      }
    });
    if (cols.lote !== undefined && cols.rcc !== undefined) return { fila: i + 1, cols: cols };
  }
  return null;
}

/** Fecha (Date o texto d/m/aaaa) → Date a las 12:00 del día que se ve en la planilla de origen */
function kxFecha_(v, d, tz) {
  if (v instanceof Date && !isNaN(v)) {
    var p = Utilities.formatDate(v, tz, 'yyyy-MM-dd').split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], 12);
  }
  var s = String(d || v || '').trim(), m;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) {
    var y = +m[3]; if (y < 100) y += 2000;
    if (+m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return new Date(y, +m[2] - 1, +m[1], 12);
  }
  return null;
}

/** Vencimiento en cualquiera de los formatos del kardex → { d: Date|null, txt } */
function kxVto_(v, d, tz) {
  var txt = String(d || '').trim();
  if (v instanceof Date && !isNaN(v)) { var f = kxFecha_(v, d, tz); return { d: f, txt: txt || fmtFecha_(f) }; }
  return { d: parseVto_(txt), txt: txt };
}

function kxIso_(d) { return d ? Utilities.formatDate(d, TZ, 'yyyy-MM-dd') : ''; }

/**
 * Lee una pestaña de kardex.
 * Devuelve { cols, filaEnc, units, ultima, saldoKardex, avisos }
 */
function leerPestanaKardex_(sh, tz) {
  var lr = sh.getLastRow(), lc = Math.min(Math.max(sh.getLastColumn(), 11), 16);
  if (lr < 1) throw new Error('Pestaña vacía');
  var rg = sh.getRange(1, 1, lr, lc);
  var vals = rg.getValues(), disp = rg.getDisplayValues();
  var enc = kxEncabezados_(disp);
  if (!enc) throw new Error('No encuentro los encabezados (Nº Lote / Nº RCC) en las primeras 12 filas');
  var c = enc.cols, avisos = {}, ejemplos = {};
  var aviso = function (k, ej) {
    avisos[k] = (avisos[k] || 0) + 1;
    if (ej !== undefined) { var e = ejemplos[k] || (ejemplos[k] = []); if (e.length < 4 && e.indexOf(ej) < 0) e.push(ej); }
  };
  ['ingreso', 'cant', 'vto', 'egreso', 'mp'].forEach(function (k) { if (c[k] === undefined) aviso('falta columna ' + k); });
  var txt = function (r, k) { return c[k] === undefined ? '' : String(disp[r][c[k]] || '').trim(); };
  var units = [], ultima = enc.fila, saldoKardex = null, anterior = null;

  for (var r = enc.fila; r < disp.length; r++) {
    var algo = disp[r].slice(0, 12).join('').trim();
    if (!algo) continue;
    ultima = r + 1;
    // encabezado repetido (uno por año): se vuelve a mapear por si cambiaron las columnas
    var re = kxEncabezados_([disp[r]]);
    if (re) { c = re.cols; continue; }
    var lote = txt(r, 'lote'), rcc = txt(r, 'rcc'), ingTxt = txt(r, 'ingreso'), egrTxt = txt(r, 'egreso');
    var cantTxt = txt(r, 'cant');
    var sTxt = txt(r, 'saldo');
    if (/^-?\d+$/.test(sTxt)) saldoKardex = Number(sTxt);
    var ingreso = c.ingreso === undefined ? null : kxFecha_(vals[r][c.ingreso], ingTxt, tz);

    // Fila con sólo un texto (en A o B) y sin lote/RCC/cantidad: código de trazabilidad de la unidad anterior,
    // fila de grupo (número en A), año o título de sección.
    var marca = /^[-*x`´'.]+$/i.test(rcc);
    if (!lote && !ingreso && !egrTxt && (!rcc || marca) && !/^\d+$/.test(cantTxt)) {
      var unico = disp[r].map(function (x) { return String(x).trim(); }).filter(String);
      var cod = unico.length === 1 ? unico[0] : '';
      if (anterior && cod.length >= 8 && !/^\d{1,4}$/.test(cod) && !/^(comienza|ingreso|egreso)/i.test(cod)) {
        anterior.serie = anterior.serie ? anterior.serie + ' ' + cod : cod;
      }
      continue;
    }

    var flags = [];
    var cant;
    if (cantTxt === '') { cant = 1; flags.push(['sin cantidad']); }
    else {
      var m = cantTxt.match(/^(\d+)/);
      cant = m ? Number(m[1]) : NaN;
      if (!(cant > 0) || cant > 50) { cant = 1; flags.push(['cantidad inválida', cantTxt]); }
      else if (!/^\d+$/.test(cantTxt)) flags.push(['cantidad con texto', cantTxt]);
      else if (cant !== 1) flags.push(['cantidad distinta de 1', cantTxt]);
    }
    if (!lote) flags.push(['sin lote']);
    var vtoTxt = txt(r, 'vto');
    var vto = kxVto_(c.vto === undefined ? '' : vals[r][c.vto], vtoTxt, tz);
    var sinCod = /^(s\/?c|sin c[a-z]*|-+|n\/?a)$/i.test(vtoTxt);
    if (sinCod) flags.push(['vto sin codificar', vtoTxt]);
    else if (vtoTxt && !vto.d) flags.push(['vto ilegible', vtoTxt]);
    if (!vtoTxt) flags.push(['sin vto']);
    var egreso = c.egreso === undefined ? null : kxFecha_(vals[r][c.egreso], egrTxt, tz);
    if (ingTxt && !ingreso) flags.push(['fecha ingreso ilegible', ingTxt]);
    if (egrTxt && !egreso) flags.push(['fecha egreso ilegible', egrTxt]);
    var egresada = !!((rcc && !marca) || egrTxt);
    var estado = egresada ? 'Egresada' : (marca ? 'Marcada' : 'Disponible');
    if (marca && !egrTxt) flags.push(['marca en RCC sin egreso', rcc]);
    if (egrTxt && !rcc) flags.push(['egreso sin RCC', egrTxt]);
    if (rcc && !marca && !egrTxt) flags.push(['RCC sin fecha de egreso', rcc]);
    flags.forEach(function (f) { aviso(f[0], f[1]); });

    anterior = {
      fila: r + 1, lote: lote, vto: vto.txt, vtoD: vto.d, vtoIso: kxIso_(vto.d), cant: cant, rcc: rcc, disp: estado === 'Disponible', estado: estado,
      ingreso: ingreso, egreso: egreso, remito: txt(r, 'remito'), mp: txt(r, 'mp'), factura: txt(r, 'factura'),
      serie: '', flags: flags.map(function (f) { return f[0] + (f[1] ? ' "' + f[1] + '"' : ''); })
    };
    units.push(anterior);
  }
  return { cols: c, filaEnc: enc.fila, units: units, ultima: ultima, saldoKardex: saldoKardex, avisos: avisos, ejemplos: ejemplos };
}

/** Productos del Catálogo Maestro (todos, con o sin kardex) leídos como texto visible */
function catalogoCompleto_() {
  var sh = SpreadsheetApp.openById(cfg_('maestroId')).getSheetByName(cfg_('maestroHoja') || 'catalogo');
  if (!sh) throw new Error('No encuentro la pestaña del Catálogo Maestro');
  var lr = sh.getLastRow();
  if (lr < 3) return [];
  var vistos = {};
  return sh.getRange(3, 1, lr - 2, 11).getDisplayValues()
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) {
      var p = {
        codigo: String(r[0]).trim(), desc: r[1], proveedor: r[2], marca: r[3], sid: sheetIdDe_(r[4]), hoja: String(r[5] || '').trim(),
        precioOC: num_(r[6]), minimo: num_(r[8]), activo: r[10]
      };
      var k = ncode_(p.codigo);
      p.duplicado = !!vistos[k]; vistos[k] = true;
      return p;
    });
}

/** Agrupa los productos con kardex por planilla, en orden estable */
function planillasKardex_(cat) {
  var orden = [], por = {};
  cat.forEach(function (p) {
    if (!p.sid || !p.hoja) return;
    if (!por[p.sid]) { por[p.sid] = []; orden.push(p.sid); }
    por[p.sid].push(p);
  });
  return orden.map(function (sid) { return { sid: sid, productos: por[sid] }; });
}

/** Lee una planilla completa (una apertura) y devuelve el resultado por producto */
function leerPlanillaKardex_(pl) {
  var res = [], ss, tz;
  try { ss = SpreadsheetApp.openById(pl.sid); tz = ss.getSpreadsheetTimeZone(); }
  catch (e) {
    return pl.productos.map(function (p) { return { p: p, error: 'No se puede abrir la planilla: ' + (e.message || e) }; });
  }
  var cache = {};
  pl.productos.forEach(function (p) {
    try {
      if (!cache[p.hoja]) {
        var sh = ss.getSheetByName(p.hoja);
        if (!sh) throw new Error('No existe la pestaña "' + p.hoja + '" en "' + ss.getName() + '". Pestañas: ' +
          ss.getSheets().map(function (x) { return x.getName(); }).join(', '));
        cache[p.hoja] = leerPestanaKardex_(sh, tz);
      }
      res.push({ p: p, k: cache[p.hoja], planilla: ss.getName(), tz: tz });
    } catch (e) { res.push({ p: p, error: String(e.message || e), planilla: ss.getName(), tz: tz }); }
  });
  return res;
}

/** Resumen de un producto leído */
function resumenKardex_(x) {
  var lotes = {}, disp = 0, total = 0, egr = 0, marc = 0;
  (x.k ? x.k.units : []).forEach(function (u) {
    var l = lotes[u.lote || '(sin lote)'] || (lotes[u.lote || '(sin lote)'] = { vto: u.vto, vtoIso: u.vtoIso, disp: 0, total: 0, marcadas: 0 });
    l.total += u.cant; total += u.cant;
    if (u.estado === 'Disponible') { l.disp += u.cant; disp += u.cant; }
    else if (u.estado === 'Marcada') { l.marcadas += u.cant; marc += u.cant; }
    else egr += u.cant;
  });
  var prox = Object.keys(lotes).map(function (k) { return lotes[k]; }).filter(function (l) { return l.disp > 0 && l.vtoIso; })
    .sort(function (a, b) { return a.vtoIso < b.vtoIso ? -1 : 1; })[0];
  return { lotes: lotes, disp: disp, total: total, egresadas: egr, marcadas: marc, proxVto: prox ? prox.vtoIso : '' };
}

/**
 * Relevamiento sin escribir nada: lee planillas desde el índice `desde` hasta agotar `segundos`.
 * Devuelve conteos por producto, diferencias con el Saldo del kardex y avisos.
 */
function kardexEncuesta(desde, segundos, detalle) {
  var t0 = Date.now(), lim = (Number(segundos) || 240) * 1000;
  var cat = catalogoCompleto_(), pls = planillasKardex_(cat);
  var i = Number(desde) || 0, out = [];
  while (i < pls.length && Date.now() - t0 < lim) {
    leerPlanillaKardex_(pls[i]).forEach(function (x) {
      var o = { codigo: x.p.codigo, hoja: x.p.hoja, planilla: x.planilla, tz: x.tz };
      if (x.error) { o.error = x.error; out.push(o); return; }
      var r = resumenKardex_(x);
      o.filaEnc = x.k.filaEnc; o.cols = x.k.cols; o.unidades = r.total; o.disp = r.disp; o.egresadas = r.egresadas; o.marcadas = r.marcadas;
      o.lotes = Object.keys(r.lotes).length; o.saldoKardex = x.k.saldoKardex; o.avisos = x.k.avisos; o.ejemplos = x.k.ejemplos; o.proxVto = r.proxVto;
      o.conSerie = x.k.units.filter(function (u) { return u.serie; }).length;
      if (detalle) o.units = x.k.units.map(function (u) { return [u.fila, u.lote, u.vto, u.vtoIso, u.cant, u.rcc, u.disp, u.serie, u.flags.join('; ')]; });
      out.push(o);
    });
    i++;
  }
  return { planillas: pls.length, desde: Number(desde) || 0, siguiente: i < pls.length ? i : null, productos: out, ms: Date.now() - t0 };
}

/* =====================================================================
 * Copia del kardex en la base: Stock (producto), Stock_Lotes (lote), Kardex_Unidades (unidad)
 * ===================================================================== */

var KX_TABS = {
  Stock: ['Código', 'Descripción', 'Proveedor', 'Marca', 'Planilla', 'ID planilla', 'Pestaña', 'Precio OC', 'Mínimo',
    'Disponible', 'Marcadas', 'Egresadas', 'Unidades', 'Lotes', 'Próximo vto', 'Saldo kardex', 'Avisos', 'Error', 'Leído'],
  Stock_Lotes: ['Código', 'Lote', 'Vencimiento', 'Vto ISO', 'Disponible', 'Marcadas', 'Total'],
  Kardex_Unidades: ['Código', 'Pestaña', 'Fila', 'Estado', 'Lote', 'Vencimiento', 'Vto ISO', 'Cantidad', 'Fecha ingreso',
    'Remito', 'Factura', 'Fecha egreso', 'Nº RCC', 'Médico/Paciente', 'Serie', 'Avisos']
};

function kxHoja_(nombre) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(nombre), h = KX_TABS[nombre];
  if (!sh) sh = ss.insertSheet(nombre);
  var actual = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  if (actual.join('|') !== h.join('|')) {
    sh.clear();
    if (sh.getMaxColumns() < h.length) sh.insertColumnsAfter(sh.getMaxColumns(), h.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#EEF2FA').setFontColor('#24448F');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Reemplaza en la pestaña las filas de los códigos dados por las nuevas (todo como texto) */
function kxReemplazar_(nombre, codigos, nuevas) {
  var sh = kxHoja_(nombre), n = KX_TABS[nombre].length;
  var ult = ultimaConDato_(sh, 1);
  var viejas = ult > 1 ? sh.getRange(2, 1, ult - 1, n).getValues() : [];
  var quitar = {}; codigos.forEach(function (c) { quitar[ncode_(c)] = true; });
  var filas = viejas.filter(function (r) { return !quitar[ncode_(r[0])]; }).concat(nuevas);
  filas.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])) || (Number(a[2]) || 0) - (Number(b[2]) || 0); });
  var total = Math.max(filas.length, viejas.length);
  if (sh.getMaxRows() < total + 1) sh.insertRowsAfter(sh.getMaxRows(), total + 1 - sh.getMaxRows());
  if (viejas.length) sh.getRange(2, 1, viejas.length, n).clearContent();
  if (filas.length) {
    var rg = sh.getRange(2, 1, filas.length, n);
    rg.setNumberFormat('@');
    rg.setValues(filas.map(function (r) { return r.map(function (v) { return v === null || v === undefined ? '' : String(v); }); }));
  }
  return filas.length;
}

/** Filas para las tres pestañas a partir de los resultados de leerPlanillaKardex_ */
function kxFilas_(resultados) {
  var ahora = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm');
  var stock = [], lotes = [], unidades = [], codigos = [];
  resultados.forEach(function (x) {
    var p = x.p; codigos.push(p.codigo);
    if (x.error) {
      stock.push([p.codigo, p.desc, p.proveedor, p.marca, x.planilla || '', p.sid, p.hoja, p.precioOC, p.minimo, 0, 0, 0, 0, 0, '', '', '', x.error, ahora]);
      return;
    }
    var r = resumenKardex_(x), av = x.k.avisos;
    var avTxt = Object.keys(av).sort(function (a, b) { return av[b] - av[a]; }).map(function (k) { return k + ': ' + av[k]; }).join(' · ');
    stock.push([p.codigo, p.desc, p.proveedor, p.marca, x.planilla, p.sid, p.hoja, p.precioOC, p.minimo,
      r.disp, r.marcadas, r.egresadas, r.total, Object.keys(r.lotes).length, r.proxVto ? fmtFecha_(new Date(r.proxVto + 'T12:00:00')) : '',
      x.k.saldoKardex === null ? '' : x.k.saldoKardex, avTxt, '', ahora]);
    Object.keys(r.lotes).forEach(function (l) {
      var o = r.lotes[l];
      if (o.disp > 0 || o.marcadas > 0) lotes.push([p.codigo, l, o.vto, o.vtoIso, o.disp, o.marcadas, o.total]);
    });
    x.k.units.forEach(function (u) {
      unidades.push([p.codigo, p.hoja, u.fila, u.estado, u.lote, u.vto, u.vtoIso, u.cant, fmtFecha_(u.ingreso), u.remito, u.factura,
        fmtFecha_(u.egreso), u.rcc, u.mp, u.serie, u.flags.join('; ')]);
    });
  });
  return { codigos: codigos, stock: stock, lotes: lotes, unidades: unidades };
}

function kxGuardar_(resultados) {
  var f = kxFilas_(resultados);
  var lock = LockService.getScriptLock(); lock.waitLock(60000);
  try {
    return {
      stock: kxReemplazar_('Stock', f.codigos, f.stock),
      lotes: kxReemplazar_('Stock_Lotes', f.codigos, f.lotes),
      unidades: kxReemplazar_('Kardex_Unidades', f.codigos, f.unidades)
    };
  } finally { lock.releaseLock(); }
}

/**
 * Lee el kardex de a planillas y guarda en Stock / Stock_Lotes / Kardex_Unidades.
 * desde = índice de planilla (0 = empieza de nuevo). segundos = presupuesto de tiempo de esta llamada.
 * Devuelve { total, hechos, siguiente (null si terminó), productos, errores, unidades, disponibles }.
 * La app llama de a tandas (presupuesto corto); el disparador nocturno y el menú, con presupuesto largo.
 */
function kardexSync(desde, segundos, maxPlanillas) {
  verificar_();
  var t0 = Date.now(), lim = Math.min(Number(segundos) || 45, 300) * 1000;
  var cat = catalogoCompleto_(), pls = planillasKardex_(cat);
  var i = Number(desde) || 0, res = [];
  log_('Kardex: planillas ' + pls.length + ', desde ' + i);
  var tope = Number(maxPlanillas) || pls.length, leidas = 0;
  while (i < pls.length && leidas < tope && (res.length === 0 || Date.now() - t0 < lim)) {
    leidas++;
    var r = leerPlanillaKardex_(pls[i]);
    res = res.concat(r);
    i++;
  }
  var g = kxGuardar_(res);
  var termino = i >= pls.length;
  if (termino) {
    // productos que ya no están en el catálogo con kardex: se sacan de la copia
    var validos = {}; cat.forEach(function (p) { if (p.sid && p.hoja) validos[ncode_(p.codigo)] = true; });
    ['Stock', 'Stock_Lotes', 'Kardex_Unidades'].forEach(function (t) {
      var sh = kxHoja_(t), ult = ultimaConDato_(sh, 1);
      if (ult < 2) return;
      var cods = sh.getRange(2, 1, ult - 1, 1).getValues().map(function (r) { return String(r[0]); });
      var sobran = cods.filter(function (c, j) { return !validos[ncode_(c)] && cods.indexOf(c) === j; });
      if (sobran.length) kxReemplazar_(t, sobran, []);
    });
    setCfg_('kardexLeido', Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'));
  }
  var errores = res.filter(function (x) { return x.error; });
  errores.forEach(function (x) { log_('ERROR ' + x.p.codigo + ' (' + x.p.hoja + '): ' + x.error); });
  var disp = 0; res.forEach(function (x) { if (!x.error) disp += resumenKardex_(x).disp; });
  log_('Tanda: planillas ' + (Number(desde) || 0) + '–' + (i - 1) + ', productos ' + res.length + ', errores ' + errores.length +
    ', disponibles ' + disp + ' · filas escritas: ' + JSON.stringify(g));
  return {
    total: pls.length, hechos: i, siguiente: termino ? null : i, productos: res.length, errores: errores.length,
    disponibles: disp, escritas: g, ms: Date.now() - t0, log: LOG_
  };
}

/** Lee todo el kardex (menú o disparador nocturno). Si no alcanza el tiempo, se reprograma para seguir. */
function kardexSyncTodo() {
  var props = PropertiesService.getScriptProperties();
  var desde = Number(props.getProperty('kardexCursor')) || 0, t0 = Date.now(), r;
  do { r = kardexSync(desde, 240); desde = r.siguiente; } while (desde !== null && Date.now() - t0 < 240000);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'kardexSyncSigue_') ScriptApp.deleteTrigger(t); });
  if (desde !== null) {
    props.setProperty('kardexCursor', String(desde));
    ScriptApp.newTrigger('kardexSyncSigue_').timeBased().after(60000).create();
  } else props.deleteProperty('kardexCursor');
  try { SpreadsheetApp.getActive().toast('Kardex leído: ' + r.hechos + ' de ' + r.total + ' planillas.'); } catch (e) { }
  return r;
}
function kardexSyncSigue_() { kardexSyncTodo(); }

/** Relee un producto (después de una baja o un ingreso) */
function refrescarProducto_(s) {
  var p = catalogoCompleto_().filter(function (x) { return ncode_(x.codigo) === ncode_(s.codigo); })[0] || s;
  kxGuardar_(leerPlanillaKardex_({ sid: p.sid, productos: [p] }));
}

/** Unidades de una pestaña de kardex (para bajas, ingresos y movimientos) */
function leerUnidades_(sid, hoja) {
  var ss = SpreadsheetApp.openById(sid), sh = ss.getSheetByName(hoja);
  if (!sh) throw new Error('No existe la pestaña "' + hoja + '"');
  var k = leerPestanaKardex_(sh, ss.getSpreadsheetTimeZone());
  if (k.cols.egreso === undefined || k.cols.rcc === undefined) throw new Error('La pestaña "' + hoja + '" no tiene columnas de egreso/RCC');
  return { sh: sh, units: k.units, ultima: k.ultima, cols: k.cols };
}

/** Stock por producto con sus lotes (lo que usa el resto de la app) */
function leerStock_() {
  var lotes = {};
  var shL = kxHoja_('Stock_Lotes'), uL = ultimaConDato_(shL, 1);
  if (uL > 1) shL.getRange(2, 1, uL - 1, 7).getDisplayValues().forEach(function (r) {
    var m = lotes[ncode_(r[0])] || (lotes[ncode_(r[0])] = {});
    m[r[1]] = { vto: r[2], vtoIso: r[3], disp: num_(r[4]), marcadas: num_(r[5]), total: num_(r[6]) };
  });
  var sh = kxHoja_('Stock'), u = ultimaConDato_(sh, 1);
  if (u < 2) return [];
  return sh.getRange(2, 1, u - 1, KX_TABS.Stock.length).getDisplayValues().map(function (r, i) {
    return {
      _fila: i + 2, codigo: r[0], desc: r[1], proveedor: r[2], marca: r[3], planilla: r[4], sid: r[5], hoja: r[6],
      precioOC: num_(r[7]), minimo: num_(r[8]), disp: num_(r[9]), marcadas: num_(r[10]), egresadas: num_(r[11]),
      unidades: num_(r[12]), proxVto: r[14], avisos: r[16], error: r[17], leido: r[18], lotes: lotes[ncode_(r[0])] || {}
    };
  });
}

/** Las escrituras en los kardex reales quedan apagadas hasta aprobar la carga masiva con simulación (Config kardexEscritura = SI) */
function exigirEscrituraKardex_() {
  if (String(cfg_('kardexEscritura') || '').toUpperCase() !== 'SI')
    throw new Error('La escritura en los kardex está desactivada hasta aprobar la carga con simulación (Config → kardexEscritura).');
}
