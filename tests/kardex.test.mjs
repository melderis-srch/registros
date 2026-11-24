// Pruebas de Kardex.gs (stock, bajas por lote, ingreso desde recepción, reposición y pendientes)
// con un Sheet y planillas de kardex simuladas en memoria. Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pad = (n) => String(n).padStart(2, '0');

class Rango {
  constructor(hoja, r, c, nr = 1, nc = 1) { Object.assign(this, { hoja, r, c, nr, nc }); }
  getValues() { return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.hoja.celda(this.r + i, this.c + j))); }
  getDisplayValues() { return this.getValues().map((f) => f.map((v) => (v instanceof Date ? `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()}` : String(v ?? '')))); }
  getDisplayValue() { return this.getDisplayValues()[0][0]; }
  setValues(v) { v.forEach((f, i) => f.forEach((x, j) => this.hoja.poner(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.hoja.poner(this.r, this.c, x); return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.hoja.poner(this.r + i, this.c + j, ''); return this; }
  setNumberFormat() { return this; }
  insertCheckboxes() { return this; }
  setBackground() { return this; }
  setFontWeight() { return this; }
  setFontColor() { return this; }
  setDataValidation() { return this; }
  copyTo() { return this; }
}

class Hoja {
  constructor(nombre, filas = []) { this.nombre = nombre; this.filas = filas.map((f) => [...f]); }
  celda(r, c) { return (this.filas[r - 1] || [])[c - 1] ?? ''; }
  poner(r, c, v) { while (this.filas.length < r) this.filas.push([]); this.filas[r - 1][c - 1] = v; }
  getName() { return this.nombre; }
  clear() { this.filas = []; return this; }
  setFrozenRows() {}
  getRange(r, c, nr, nc) {
    if (typeof r === 'string') { const m = r.match(/^([A-Z])(\d+)?:([A-Z])(\d+)?$/); const c1 = m[1].charCodeAt(0) - 64; return new Rango(this, +(m[2] || 1), c1, 1000, m[3].charCodeAt(0) - 64 - c1 + 1); }
    return new Rango(this, r, c, nr, nc);
  }
  getLastRow() { for (let i = this.filas.length; i > 0; i--) if ((this.filas[i - 1] || []).some((v) => v !== '' && v !== undefined && v !== false && v !== null)) return i; return 0; }
  getLastColumn() { return Math.max(...this.filas.map((f) => { let n = f.length; while (n && (f[n - 1] === '' || f[n - 1] === undefined)) n--; return n; }), 0); }
  getMaxColumns() { return 40; }
  getMaxRows() { return Math.max(this.filas.length, 1000); }
  insertColumnsAfter() {}
  insertRowAfter(r) { this.filas.splice(r, 0, []); }
  insertRowsAfter() {}
  insertRowsBefore(r, n) { for (let i = 0; i < n; i++) this.filas.splice(r - 1, 0, []); }
  deleteRow(r) { this.filas.splice(r - 1, 1); }
  deleteRows(r, n) { this.filas.splice(r - 1, n); }
}

const F = (d, m, y = 2026) => new Date(y, m - 1, d, 12);
const hace = (dias) => { const d = new Date(); d.setDate(d.getDate() - dias); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); };
const dmy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** Pestaña de kardex: 5 filas de título/encabezado y después las unidades */
function kardex(nombre, unidades) {
  const filas = [['', '', '', 'INGRESO'], [], ['PRODUCTO: ' + nombre], ['2026'],
    ['Total Ingresado', 'Fecha Ingreso', 'Cantidad', 'Nº Lote', 'Vencimiento', 'Remito Nº', 'Fecha Egreso', 'Nº RCC', 'Médico/ Paciente', 'Factura']];
  unidades.forEach((u) => filas.push(u));
  return new Hoja(nombre, filas);
}
const U = (lote, vto, rcc = '') => ['', F(1, 1), 1, lote, vto, 'R1', rcc ? F(1, 2) : '', rcc, rcc ? 'X/Y' : '', ''];

function entorno() {
  const tabs = {};
  const ss = { getSheetByName: (n) => tabs[n] || null, insertSheet: (n) => (tabs[n] = new Hoja(n)), getSheets: () => Object.values(tabs), setSpreadsheetTimeZone() {}, toast() {} };
  const k1 = kardex('6x40', [[3, '', '', '', '', '', '', '-'], U('L-A', F(1, 1, 2027)), U('L-B', F(1, 6, 2029)), U('L-B', F(1, 6, 2029)), U('L-B', F(1, 6, 2029))]);
  const k2 = kardex('10cc', [[2, '', '', '', '', '', '', '-'], U('HA1', 'dic-27'), U('HA2', 'jul-27', '004-100')]);
  const catalogo = new Hoja('catalogo', [['CATÁLOGO'], ['Código', 'Descripción', 'Proveedor', 'Marca', 'URL', 'Hoja', 'Precio OC', 'Precio CX', 'Mínimo', 'Stock', 'Activo'],
    ['SPP 59-40S', 'Tornillo pedi poli std 6x40mm', 'NOVAX', 'Quimera', 'https://docs.google.com/spreadsheets/d/S1aaaaaaaaaaaaaaaaaaaaaa/edit', '6x40', 54.26, '', 10, '', 'SI'],
    ['bd_10', 'Sustituto óseo BIODESIS 10cc', 'LABORATORIO BIOXEN', 'Biodesis', 'https://docs.google.com/spreadsheets/d/S2bbbbbbbbbbbbbbbbbbbbbb/edit', '10cc', 124000, '', 5, '', 'SI'],
    ['sin_k', 'Producto sin kardex', 'NOVAX', '', '', '', '', '', '', '', '']]);
  const seg = new Hoja('Cirugias', [['N° RCC', 'FECHA', 'MÉDICO', 'PACIENTE', 'INSTITUCIÓN', 'CIRUGÍA', 'OS', 'N° REMITO'], [],
    ['NOVIEMBRE'],
    ['', hace(10), 'Med A', 'Sin Rcc', 'Inst', 'Proc', 'OS', '', '', false, false, false],
    ['', hace(-2), 'Med B', 'Sin Remito', 'Inst', 'Proc', 'OS', '', '', false, false, false]]);
  const externos = { S1aaaaaaaaaaaaaaaaaaaaaa: { '6x40': k1 }, S2bbbbbbbbbbbbbbbbbbbbbb: { '10cc': k2 }, M: { catalogo }, X: { Cirugias: seg } };
  const cfg = { seguimientoId: 'X', seguimientoHoja: 'Cirugias', puntoVenta: '0001', ultimoRCC: '4472', ultimaOC: '3700', ultimaRecepcion: '0', maestroId: 'M', maestroHoja: 'catalogo', tcUSD: '1500', lugarEntrega: 'San Martín 4041' };
  const ctx = {
    SpreadsheetApp: {
      openById: (id) => ({ getSheetByName: (n) => (externos[id] || {})[n] || null, getName: () => 'Planilla ' + id, getSpreadsheetTimeZone: () => 'America/Argentina/Buenos_Aires', getSheets: () => Object.values(externos[id] || {}) }),
      getActive: () => ss,
      getUi: () => { throw new Error('sin UI'); },
      CopyPasteType: { PASTE_FORMAT: 'f' },
      newDataValidation: () => ({ requireValueInList: () => ({ setAllowInvalid: () => ({ build: () => ({}) }) }) }),
      flush() {},
    },
    CacheService: { getScriptCache: () => ({ get: (k) => (k === 'cfg' ? JSON.stringify(cfg) : null), put() {}, remove() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      formatDate: (d, _tz, f) => (f === 'yyyy-MM' ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}` : f === 'yyyy-MM-dd' ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : f.includes('HH') ? `${dmy(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : dmy(d)),
      getUuid: () => crypto.randomUUID(),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'tok' }) },
    ContentService: {},
    Logger: { log() {} },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ after: () => ({ create() {} }), everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) },
  };
  Object.assign(globalThis, ctx);
  vm.runInThisContext(fs.readFileSync(new URL('../gas/Codigo.gs', import.meta.url), 'utf8'));
  for (const f of ['Kardex.gs', 'KardexLectura.gs', 'Diag.gs']) vm.runInThisContext(fs.readFileSync(new URL('../gas/' + f, import.meta.url), 'utf8'));
  cfg.kardexEscritura = 'SI';
  // setCfg_ escribe en Config y actualiza la copia en memoria
  globalThis.setCfg_ = (k, v) => { cfg[k] = String(v); };
  for (const [nombre, cols] of Object.entries(globalThis.TABS)) tabs[nombre] = new Hoja(nombre, [cols.map((c) => c[1])]);
  agregar_('Productos', [
    { codigo: 'SPP 59 40S', desc: 'Tornillo pedi poli std 6x40mm', proveedor: 'NOVAX', costo: 54.26, moneda: 'USD', alicuota: '10,5' },
    { codigo: 'bd_10', desc: 'Sustituto oseo 10cc', proveedor: 'LABORATORIO BIOXEN', costo: 124000, moneda: 'ARS' },
    { codigo: 'DRILL', desc: 'Drill', proveedor: 'NSK', costo: 10 },
  ]);
  agregar_('Proveedores', [{ codigo: 'NOVAX', razon: 'NOVAX', moneda: 'USD' }, { codigo: 'BIOXEN', razon: 'LABORATORIO BIOXEN', moneda: 'ARS' }]);
  return { g: globalThis, tabs, k1, k2, cfg };
}

function consumo(numero, fechaCx, items, extra = {}) {
  agregar_('Consumos', [{ numero, fecha: fechaCx, fechaCx, paciente: 'Juan Perez', medico: 'Gomez, Ana', institucion: 'Inst', estado: 'Registrado', ...extra }]);
  agregar_('Consumo_Items', items.map((it, i) => ({ numero, renglon: i + 1, seccion: 'Implantado', ...it })));
}

test('lee el kardex del Catálogo Maestro y guarda el stock', () => {
  const { g } = entorno();
  const r = g.kardexSync(0, 25);
  assert.equal(r.total, 2, 'solo productos con planilla');
  assert.equal(r.siguiente, null);
  const s = g.getStock().productos;
  const t = s.find((x) => x.codigo === 'SPP 59-40S');
  assert.equal(t.disp, 4);
  assert.equal(t.lotes['L-B'].disp, 3);
  assert.equal(t.bajoMin, true);
  const b = s.find((x) => x.codigo === 'bd_10');
  assert.equal(b.disp, 1, 'la unidad con RCC no está disponible');
  assert.equal(b.lotes.HA1.vtoIso, '2027-12-01', 'entiende "dic-27"');
});

test('lee de a tandas sin perder lo anterior', () => {
  const { g } = entorno();
  assert.equal(g.kardexSync(0, 60, 1).siguiente, 1, 'una planilla por tanda con presupuesto mínimo');
  assert.equal(g.kardexSync(1, 60, 1).siguiente, null);
  assert.equal(g.getStock().productos.length, 2);
});

test('baja por lote del sticker y, sin lote, la que vence primero', () => {
  const { g, k1, k2 } = entorno();
  g.kardexSync(0, 25);
  consumo('004-473', '10/11/2026', [
    { codigo: 'SPP 59 40S', desc: 'Tornillo pedi poli std 6x40mm', cant: 2, proveedor: 'NOVAX' },
    { codigo: 'bd_10', desc: 'Sustituto oseo 10cc', cant: 1, proveedor: 'LABORATORIO BIOXEN' },
    { codigo: 'DRILL', desc: 'Drill', cant: 1, proveedor: 'NSK' },
  ]);
  g.guardarLotes('004-473', [{ renglon: 1, lote: 'L-B' }]);
  const r = g.darBajaConsumo('004-473');
  assert.equal(r.ok, 2);
  assert.deepEqual(r.sinKardex, ['Drill']);
  // tornillos: dos unidades del lote L-B (filas 8 y 9)
  assert.equal(k1.celda(8, 8), '004-473');
  assert.equal(k1.celda(9, 8), '004-473');
  assert.equal(k1.celda(10, 8), '');
  assert.equal(k1.celda(8, 9), 'Gomez/Juan');
  assert.equal(k1.celda(8, 7).getDate(), 10, 'fecha de egreso = fecha de la cirugía');
  assert.equal(k1.celda(7, 8), '', 'no toca el lote L-A');
  // sustituto sin lote: el único disponible (HA1), marcado como asumido
  assert.equal(k2.celda(7, 8), '004-473');
  const its = g.leer_('Consumo_Items');
  assert.match(its[0].baja, /lote L-B · filas 8, 9$/);
  assert.match(its[1].baja, /lote asumido/);
  assert.equal(its[1].lote, 'HA1');
  // el stock se actualiza solo
  assert.equal(g.getStock().productos.find((x) => x.codigo === 'SPP 59-40S').disp, 2);
  // repetir no vuelve a bajar
  assert.equal(g.darBajaConsumo('004-473').ok, 0);
});

test('si el lote no alcanza no escribe nada de ese producto', () => {
  const { g, k1 } = entorno();
  g.kardexSync(0, 25);
  consumo('004-474', '10/11/2026', [{ codigo: 'SPP 59 40S', desc: 'Tornillo', cant: 2, lote: 'L-A' }]);
  const r = g.darBajaConsumo('004-474');
  assert.equal(r.ok, 0);
  assert.match(r.errores[0], /el lote L-A tiene 1 disponibles/);
  assert.equal(k1.celda(7, 8), '');
});

test('la recepción carga las unidades en el kardex una sola vez', () => {
  const { g, k1 } = entorno();
  g.kardexSync(0, 25);
  const doc = {
    editar: '', cab: { fecha: '15/11/2026', proveedor: 'NOVAX', remitoProv: '0001-123', factura: 'A-9' },
    items: [{ codigo: 'SPP 59 40S', desc: 'Tornillo pedi poli std 6x40mm', lote: 'NUEVO', vto: '01/01/2031', cant: 3, empaque: 'Conforme', rotulo: 'Conforme' },
      { codigo: 'DRILL', desc: 'Drill', lote: 'D1', vto: '01/01/2031', cant: 1, empaque: 'Conforme', rotulo: 'Conforme' }],
  };
  const r = g.guardarDocumento('recepcion', doc);
  assert.equal(r.kardex.ok, 1);
  assert.deepEqual(r.kardex.sinKardex, ['Drill']);
  assert.equal(k1.filas[10][0], 3, 'fila de grupo con el total');
  assert.ok(!k1.filas[10][7], 'la fila de grupo ya no lleva "-" en Nº RCC');
  assert.equal(k1.filas[11][3], 'NUEVO');
  assert.equal(k1.filas[13][9], 'A-9');
  assert.equal(k1.filas.length, 14);
  assert.equal(g.getStock().productos.find((x) => x.codigo === 'SPP 59-40S').disp, 7);
  // editar la recepción (mismos ítems) no duplica
  const items2 = g.getDocumento('recepcion', r.numero).items;
  g.guardarDocumento('recepcion', { editar: r.numero, cab: doc.cab, items: items2 });
  assert.equal(k1.filas.length, 14);
});

test('reposición: pendientes por RCC + faltantes de stock, a OC nueva y sumando a una emitida', () => {
  const { g } = entorno();
  g.kardexSync(0, 25);
  consumo('004-475', '01/11/2026', [{ codigo: 'SPP 59 40S', desc: 'Tornillo pedi poli std 6x40mm', cant: 2, proveedor: 'NOVAX' }]);
  consumo('004-476', '02/11/2026', [{ codigo: 'SPP 59 40S', desc: 'Tornillo pedi poli std 6x40mm', cant: 1, proveedor: 'NOVAX' }]);
  consumo('004-477', '03/11/2026', [{ codigo: 'bd_10', desc: 'Sustituto oseo 10cc', cant: 1 }], { revisar: '¿se usó?' });
  let rep = g.getReposicion();
  assert.equal(rep.rcc.length, 2, 'el RCC a revisar no se repone');
  assert.equal(rep.rcc[0].costo, 54.26);
  const t = rep.stock.find((x) => x.codigo === 'SPP 59-40S');
  assert.equal(t.falta, 10 - 4 - 3, 'mínimo − disponible − consumo pendiente');

  const a = g.pasarAOC('', 'NOVAX', [{ numero: '004-475', renglon: 1 }], [{ codigo: 'SPP 59-40S', desc: 'Tornillo pedi poli std 6x40mm', cant: 3, costo: 54.26 }]);
  assert.equal(a.numero, '0001-00003701');
  let oc = g.getDocumento('oc', a.numero);
  assert.equal(oc.items.length, 1, 'mismo producto en un renglón');
  assert.equal(oc.items[0].cant, 5);
  assert.equal(oc.cab.moneda, 'USD');
  assert.match(oc.cab.obs, /004-475/);

  const b = g.pasarAOC(a.numero, 'NOVAX', [{ numero: '004-476', renglon: 1 }], []);
  assert.equal(b.nueva, false);
  oc = g.getDocumento('oc', a.numero);
  assert.equal(oc.items[0].cant, 6);
  assert.equal(g.leer_('Consumo_Items').filter((x) => x.oc === a.numero).length, 2);
  assert.match(g.leer_('Consumos').find((c) => c.numero === '004-476').ocs, /3701/);

  rep = g.getReposicion();
  assert.equal(rep.rcc.length, 0);
  assert.equal(rep.stock.find((x) => x.codigo === 'SPP 59-40S'), undefined, 'lo pedido en la OC abierta cubre el faltante');
  assert.deepEqual(rep.emitidas.map((o) => o.numero), ['0001-00003701']);
  assert.throws(() => g.pasarAOC(a.numero, 'NOVAX', [{ numero: '004-475', renglon: 1 }], []), /No hay ítems/);
  g.cambiarEstado('oc', a.numero, 'Enviada');
  consumo('004-478', '04/11/2026', [{ codigo: 'SPP 59 40S', desc: 'Tornillo', cant: 1, proveedor: 'NOVAX' }]);
  assert.throws(() => g.pasarAOC(a.numero, 'NOVAX', [{ numero: '004-478', renglon: 1 }], []), /ya no está Emitida/);
});

test('editar un RCC conserva lote, baja y OC de cada ítem', () => {
  const { g } = entorno();
  g.kardexSync(0, 25);
  consumo('004-479', '01/11/2026', [{ codigo: 'SPP 59 40S', desc: 'Tornillo pedi poli std 6x40mm', cant: 1, proveedor: 'NOVAX', lote: 'L-A' }]);
  g.darBajaConsumo('004-479');
  g.pasarAOC('', 'NOVAX', [{ numero: '004-479', renglon: 1 }], []);
  const d = g.getDocumento('consumo', '004-479');
  const items = d.items.map(({ lote, baja, oc, ...x }) => x); // la pantalla vieja no los manda
  g.guardarDocumento('consumo', { editar: '004-479', cab: d.cab, items: items.concat([{ seccion: 'Descartable', desc: 'Paño', cant: 1 }]) });
  const its = g.leer_('Consumo_Items').filter((x) => x.numero === '004-479');
  assert.equal(its[0].lote, 'L-A');
  assert.match(its[0].baja, /lote L-A/);
  assert.equal(its[0].oc, '0001-00003701');
  assert.equal(its[1].oc, '');
});

test('pendientes: stickers, bajas listas, cirugías sin RCC o sin remito, reposición y stock', () => {
  const { g } = entorno();
  let p = g.getPendientes();
  assert.equal(p.alertas[0].key, 'kardex', 'sin kardex leído avisa primero');
  g.kardexSync(0, 25);
  consumo('004-480', dmy(hace(40)), [{ codigo: 'SPP 59 40S', desc: 'Tornillo pedi poli std 6x40mm', cant: 1, proveedor: 'NOVAX' }]);
  consumo('004-481', dmy(hace(5)), [{ codigo: 'bd_10', desc: 'Sustituto oseo 10cc', cant: 1, lote: 'HA1', proveedor: 'LABORATORIO BIOXEN' }]);
  p = g.getPendientes();
  const A = Object.fromEntries(p.alertas.map((a) => [a.key, a]));
  assert.equal(A.kardex, undefined);
  assert.equal(A.stickers.n, 1);
  assert.equal(A.stickers.urg, 1, 'más de 30 días');
  assert.equal(A.stickers.rows[0].href, '/cirugias/consumo?numero=004-480');
  assert.equal(A.bajas.n, 1);
  assert.deepEqual(A.bajas.accion.refs, ['004-481']);
  assert.equal(A.sinRcc.n, 1);
  assert.match(A.sinRcc.rows[0].href, /^\/cirugias\/consumo\?cirugia=C/);
  assert.equal(A.sinRemito.n, 1);
  assert.equal(A.reponer.n, 2);
  assert.equal(A.minimo.n, 2);
  assert.equal(A.vence.n, 1, 'el lote L-A vence el 01/01/2027');
  assert.equal(A.vence.rows[0].c[1], 'L-A');
});

test('movimientos: ingresos y egresos con saldo que se va restando', () => {
  const { g } = entorno();
  g.kardexSync(0, 25);
  consumo('004-482', '10/11/2026', [{ codigo: 'SPP 59 40S', desc: 'Tornillo', cant: 2, lote: 'L-B' }]);
  g.darBajaConsumo('004-482');
  const m = g.getMovimientos('SPP 59-40S');
  assert.equal(m.disp, 2);
  const [ultimo] = m.movimientos; // el más nuevo primero
  assert.equal(ultimo.tipo, 'Egreso');
  assert.equal(ultimo.doc, 'RCC 004-482');
  assert.equal(ultimo.cant, 2);
  assert.equal(ultimo.saldo, 2);
  assert.equal(ultimo.saldoLote, 1, 'quedó 1 del lote L-B');
  const ingresos = m.movimientos.filter((x) => x.tipo === 'Ingreso');
  assert.equal(ingresos.reduce((s, x) => s + x.cant, 0), 4);
});

test('gestión: stock valorizado, en camino, consumo del período y pendiente de reponer', () => {
  const { g } = entorno();
  g.kardexSync(0, 25);
  consumo('004-483', '05/11/2026', [{ codigo: 'SPP 59 40S', desc: 'Tornillo pedi poli std 6x40mm', cant: 2, proveedor: 'NOVAX' }], { medico: 'Gomez, Ana', institucion: 'Sanatorio X' });
  consumo('004-484', '05/10/2026', [{ codigo: 'bd_10', desc: 'Sustituto oseo 10cc', cant: 1, proveedor: 'LABORATORIO BIOXEN' }]);
  const oc = g.pasarAOC('', 'NOVAX', [{ numero: '004-483', renglon: 1 }], []);
  g.cambiarEstado('oc', oc.numero, 'Enviada');
  const r = g.getGestion('01/11/2026', '30/11/2026');
  assert.equal(r.kpis.stockUnidades, 5);
  assert.equal(r.kpis.stockArs, 4 * 54.26 * 1500 + 1 * 124000);
  assert.equal(r.kpis.enCaminoUnidades, 2);
  assert.equal(r.enCamino[0].falta, 2);
  assert.equal(r.kpis.cirugias, 1, 'solo noviembre');
  assert.equal(r.kpis.consumoUnidades, 2);
  assert.equal(r.consumo.medicos[0].nombre, 'Gomez, Ana');
  assert.equal(r.consumo.meses[0].mes, '2026-11');
  assert.equal(r.reponer.length, 1, 'el tornillo ya está en OC; queda el sustituto');
  assert.equal(r.reponer[0].proveedor, 'LABORATORIO BIOXEN');
  assert.equal(r.kpis.reponerArs, 124000);
});

test('OC que llegó sin recepción aparece en pendientes', () => {
  const { g } = entorno();
  g.kardexSync(0, 25);
  consumo('004-485', '05/11/2026', [{ codigo: 'SPP 59 40S', desc: 'Tornillo', cant: 1, proveedor: 'NOVAX' }]);
  const oc = g.pasarAOC('', 'NOVAX', [{ numero: '004-485', renglon: 1 }], []);
  g.cambiarEstado('oc', oc.numero, 'Llegó');
  const A = Object.fromEntries(g.getPendientes().alertas.map((a) => [a.key, a]));
  assert.equal(A.llego.n, 1);
  assert.match(A.llego.rows[0].href, /^\/compras\/recepcion\?oc=/);
  assert.equal(A.ocEsp.n, 0);
});

test('kardex real: series, encabezado repetido, marcas y vto sin codificar', () => {
  const { g } = entorno();
  const enc = ['Total Ingresado', 'Fecha Ingreso', 'Cantidad', 'Nº Lote', 'Vencimiento', 'Remito nº', 'Fecha Egreso', 'Nº RCC', 'Médico/ Paciente', 'Saldo', 'Factura'];
  const sh = new Hoja('x', [['', '', '', 'INGRESO'], [], ['PRODUCTO'], ['2015'], enc,
    [1, '', '', '', '', '', '', '-', '', 1],
    ['', '21/3/2015', '1', '15810021', 'dic-22', '153262', '26/3/2015', '000-507', 'Larroca/Hernandez', 0],
    ['010779901500654321cth3ciraps$101648128$17240331'],
    ['2016'], enc,
    [2],
    ['', '14/01/2026', '', 'WW2068604', '15/10/2033', 'R', '', '', '', '', 'F-1'],
    ['', 'tm9nb2omb6'],
    ['', '14/01/2026', '1', 'B5745-1', 'S/C', 'R', '', '-', '', '', 'F-1'],
    ['', '14/01/2026', '1', 'C1', '30//09/2031', 'R', '', '', '', '', 'F-1'],
  ]);
  const k = g.leerPestanaKardex_(sh, 'America/Los_Angeles');
  assert.equal(k.units.length, 4, 'grupo, año, encabezado y series no son unidades');
  assert.equal(k.units[0].serie, '010779901500654321cth3ciraps$101648128$17240331');
  assert.equal(k.units[0].estado, 'Egresada');
  assert.equal(k.units[1].estado, 'Disponible');
  assert.equal(k.units[1].serie, 'tm9nb2omb6');
  assert.ok(k.units[1].flags.includes('sin cantidad'));
  assert.equal(k.units[2].estado, 'Marcada', '"-" en Nº RCC sin egreso queda aparte');
  assert.ok(k.units[2].flags.some((f) => f.startsWith('vto sin codificar')));
  assert.equal(k.units[3].vtoIso, '2031-09-30', 'barra doble');
  assert.equal(k.cols.factura, 10, 'Factura es K, no J');
});
