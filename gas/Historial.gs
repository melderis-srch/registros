/* =====================================================================
 * Historial: trae a la app las OC, recepciones y remitos que ya existen
 * en las planillas viejas. Se puede correr más de una vez: lo que ya
 * está cargado (mismo número) no se duplica.
 *   - OC ............ "Orden de compra" › control_oc  (+ ítems de "RECEPCIÓN DE STOCK" › pendientes)
 *   - Recepciones ... "RECEPCIÓN DE STOCK" › Facturas
 *   - Remitos ....... Seguimiento de cirugías (columna N° REMITO)
 * ===================================================================== */
var HIST = {
  ocId: '1sJu7Lvi35Pfac642cb_P_TXXeTnlMty4nQQhJiPZtcM', ocHoja: 'control_oc',
  recId: '1LJ3ykZ1Qsgns8QWM1y5PD4c5blwhbPQ82qfuFxRzC38', facHoja: 'Facturas', pendHoja: 'pendientes',
  diasAbierta: 60   // OC sin factura más nuevas que esto quedan "Enviada" (esperando mercadería)
};

function importarHistorial() {
  var r1 = importarOCHist_();
  var r2 = importarRecepcionesHist_();
  var r3 = importarRemitosHist_();
  var msg = 'Historial importado:\n' +
    '· OC: ' + r1.oc + ' nuevas (' + r1.abiertas + ' quedan esperando mercadería), ' + r1.items + ' renglones\n' +
    '· Recepciones: ' + r2 + ' nuevas\n' +
    '· Remitos: ' + r3 + ' nuevos';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { }
  return msg;
}

function factValida_(s) { s = String(s || '').trim(); return s && s.charAt(0) !== '#' ? s : ''; }

function importarOCHist_() {
  var ya = {}; leer_('OC').forEach(function (o) { ya[String(o.numero)] = true; });
  var src = SpreadsheetApp.openById(HIST.ocId).getSheetByName(HIST.ocHoja);
  var vals = src.getRange(3, 1, Math.max(src.getLastRow() - 2, 1), 10).getValues();

  // Facturas cargadas en la planilla de recepción (OC -> factura)
  var fac = {};
  var fsh = SpreadsheetApp.openById(HIST.recId).getSheetByName(HIST.facHoja);
  fsh.getRange(3, 1, Math.max(fsh.getLastRow() - 2, 1), 5).getValues().forEach(function (r) {
    var n = String(r[0]).trim(); if (n && factValida_(r[3])) fac[n] = (fac[n] ? fac[n] + ' / ' : '') + factValida_(r[3]);
  });

  // Ítems: pestaña "pendientes" (Fecha, OC, Proveedor, Cod, Descripción, Cantidad, Recibido)
  var items = {}, pendAbierto = {};
  var psh = SpreadsheetApp.openById(HIST.recId).getSheetByName(HIST.pendHoja);
  var pv = psh.getRange(6, 1, Math.max(psh.getLastRow() - 5, 1), 7).getValues();
  var oc = '', prov = '';
  pv.forEach(function (r) {
    if (r[0] !== '' || r[1] !== '') { oc = String(r[1]).trim(); prov = String(r[2] || '').trim(); }
    else if (r[2]) prov = String(r[2]).trim();
    if (!oc || (!r[3] && !r[4])) return;
    var cant = num_(r[5]) || 0, rec = r[6] === true || String(r[6]).toUpperCase() === 'TRUE';
    (items[oc] = items[oc] || []).push({ codigo: String(r[3] || ''), desc: String(r[4] || ''), cant: cant,
      recibido: rec ? cant : 0, pendiente: rec ? 0 : cant });
    if (!rec) pendAbierto[oc] = true;
  });

  var hoy = new Date(), nuevas = [], nuevosIt = [], abiertas = 0, ultFecha = null;
  vals.forEach(function (r) {
    var n = String(r[1]).trim();
    if (!/^\d+$/.test(n) || ya[n]) return;
    var pedido = String(r[2] || '').trim(), prov = String(r[3] || '').trim();
    if (!pedido && !prov) return;                       // número reservado sin usar
    var f = aFecha_(r[0]) || ultFecha; if (aFecha_(r[0])) ultFecha = aFecha_(r[0]);
    var factura = factValida_(r[4]) || fac[n] || '';
    var enviada = r[6] === true || String(r[6]).toUpperCase() === 'TRUE';
    var recibida = r[8] === true || String(r[8]).toUpperCase() === 'TRUE';
    var dias = f ? (hoy - f) / 864e5 : 999;
    var estado;
    if (pendAbierto[n]) estado = 'Enviada';
    else if (factura || recibida) estado = 'Recibida';
    else if (!enviada) estado = 'Emitida';
    else estado = dias <= HIST.diasAbierta || !f ? 'Enviada' : 'Recibida';
    if (estado === 'Enviada' || estado === 'Emitida') abiertas++;
    nuevas.push({ numero: n, tipo: 'Orden de compra', fecha: f ? fmtFecha_(f) : '', estado: estado, pedido: pedido,
      proveedor: prov, facturas: factura, moneda: 'ARS', tc: 1,
      obs: 'Importada de la planilla vieja' + (estado === 'Recibida' && !factura && !recibida ? ' (se asume recibida)' : ''),
      creado: new Date(), modificado: new Date(), usuario: 'historial' });
    (items[n] || []).forEach(function (it, i) {
      nuevosIt.push({ numero: n, renglon: i + 1, codigo: it.codigo, desc: it.desc, cant: it.cant,
        recibido: estado === 'Recibida' ? it.cant : it.recibido, pendiente: estado === 'Recibida' ? 0 : it.pendiente });
    });
  });
  agregar_('OC', nuevas);
  agregar_('OC_Items', nuevosIt);
  var max = 0; leer_('OC').forEach(function (o) { var k = parseInt(o.numero, 10) || 0; if (k > max) max = k; });
  if (max > (parseInt(cfg_('ultimaOC'), 10) || 0)) setCfg_('ultimaOC', max);
  return { oc: nuevas.length, abiertas: abiertas, items: nuevosIt.length };
}

function importarRecepcionesHist_() {
  var ya = {}; leer_('Recepciones').forEach(function (o) { ya[String(o.oc) + '|' + String(o.factura)] = true; });
  var fsh = SpreadsheetApp.openById(HIST.recId).getSheetByName(HIST.facHoja);
  var vals = fsh.getRange(3, 1, Math.max(fsh.getLastRow() - 2, 1), 5).getValues();
  var n = parseInt(cfg_('ultimaRecepcion'), 10) || 0, nuevas = [];
  vals.forEach(function (r) {
    var oc = String(r[0]).trim(), fact = factValida_(r[3]);
    if (!oc && !fact) return;
    if (ya[oc + '|' + fact]) return; ya[oc + '|' + fact] = true;
    n++;
    nuevas.push({ numero: String(n), fecha: fmtFecha_(aFecha_(r[1])), oc: oc, proveedor: String(r[2] || ''),
      factura: fact, valorFactura: r[4] === '' ? '' : num_(r[4]),
      obs: 'Importada de la planilla vieja (ya ingresada al kardex)', creado: new Date(), modificado: new Date(), usuario: 'historial' });
  });
  agregar_('Recepciones', nuevas);
  if (nuevas.length) setCfg_('ultimaRecepcion', n);
  return nuevas.length;
}

function importarRemitosHist_() {
  var ya = {}; leer_('Remitos').forEach(function (o) { ya[String(o.numero)] = true; });
  var nuevos = [];
  leerSeguimiento_().filas.forEach(function (c) {
    String(c.remito || '').split(/[\/,;y\s]+/).forEach(function (num) {
      num = num.replace(/\D/g, '');
      if (!num || num.length < 3 || ya[num]) return; ya[num] = true;
      nuevos.push({ numero: num, fecha: c.fecha, estado: 'Emitido', idCirugia: c.id, rcc: c.rcc,
        institucion: c.institucion, fechaCx: c.fecha, medico: c.medico, paciente: c.paciente,
        obs: 'Importado del Seguimiento (sin detalle de cajas)', creado: new Date(), modificado: new Date(), usuario: 'historial' });
    });
  });
  agregar_('Remitos', nuevos);
  var max = 0; leer_('Remitos').forEach(function (o) { var k = parseInt(o.numero, 10) || 0; if (k > max) max = k; });
  if (max > (parseInt(cfg_('ultimoRemito'), 10) || 0)) setCfg_('ultimoRemito', max);
  return nuevos.length;
}
