// Pruebas de la lógica de Apps Script (gas/Codigo.gs) con una planilla simulada en memoria.
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pad = (n) => String(n).padStart(2, '0');

class Rango {
  constructor(hoja, r, c, nr = 1, nc = 1) { Object.assign(this, { hoja, r, c, nr, nc }); }
  getValues() { return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.hoja.celda(this.r + i, this.c + j))); }
  getDisplayValues() { return this.getValues().map((f) => f.map((v) => (v instanceof Date ? `${v.getDate()}/${v.getMonth() + 1}/${v.getFullYear()}` : String(v ?? '')))); }
  getDisplayValue() { return this.getDisplayValues()[0][0]; }
  setValues(v) { v.forEach((f, i) => f.forEach((x, j) => this.hoja.poner(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.hoja.poner(this.r, this.c, x); return this; }
  setNumberFormat() { return this; }
  insertCheckboxes() { return this; }
  setBackground() { return this; }
  setFontWeight() { return this; }
  copyTo() { return this; }
}

class Hoja {
  constructor(nombre, filas) { this.nombre = nombre; this.filas = filas.map((f) => [...f]); }
  celda(r, c) { return (this.filas[r - 1] || [])[c - 1] ?? ''; }
  poner(r, c, v) { while (this.filas.length < r) this.filas.push([]); this.filas[r - 1][c - 1] = v; }
  getName() { return this.nombre; }
  getRange(r, c, nr, nc) { return new Rango(this, r, c, nr, nc); }
  getLastRow() { for (let i = this.filas.length; i > 0; i--) if ((this.filas[i - 1] || []).some((v) => v !== '' && v !== undefined && v !== false)) return i; return 0; }
  getLastColumn() { return Math.max(...this.filas.map((f) => f.length), 0); }
  getMaxColumns() { return 30; }
  insertColumnsAfter() {}
  insertRowAfter(r) { this.filas.splice(r, 0, []); }
  insertRowsAfter(r, n) { for (let i = 0; i < n; i++) this.filas.splice(r, 0, []); }
  insertRowsBefore(r, n) { for (let i = 0; i < n; i++) this.filas.splice(r - 1, 0, []); }
  deleteRow(r) { this.filas.splice(r - 1, 1); }
  // ayuda para las pruebas
  texto() { return this.filas.map((f) => [f[0] || '', f[1] instanceof Date ? `${pad(f[1].getDate())}/${pad(f[1].getMonth() + 1)}` : '', f[3] || ''].join('|')); }
}

const F = (d, m, y = 2026) => new Date(y, m - 1, d, 12);
const fila = (rcc, fecha, medico, paciente, extra = []) => [rcc, fecha, medico, paciente, 'Inst', 'Proc', 'OS', '', '', false, false, false, ...extra];

function seguimiento() {
  return new Hoja('Cirugias', [
    ['', '', '', '', '', '', '', '', '', 'Dada de baja', 'Suspendida', 'Otro'],
    [],
    ['N° RCC', 'FECHA', 'MÉDICO', 'PACIENTE', 'INSTITUCIÓN', 'CIRUGÍA', 'OBRA SOCiAL', 'N° REMITO', 'OBSERVACIONES'],
    [],
    ['OCTUBRE'],
    fila('004-370', F(1, 10), 'Med A', 'Paciente Uno'),
    fila('', F(15, 10), 'Med B', 'Paciente Dos'),
    fila('', F(31, 10), 'Med C', 'Paciente Tres'),
    ['', '', '', '', '', '', '', '', '', false, false, false],
    ['NOVIEMBRE'],
    fila('', F(3, 11), 'Med A', 'Paciente Cuatro'),
    fila('', F(10, 11), 'Med B', 'Paciente Cinco'),
    [],
    ['SIN FECHA (pendientes)'],
    fila('', '', 'Med C', 'Pendiente Uno'),
  ]);
}

function cargarGas(hojaSeg) {
  const cfg = { seguimientoId: 'X', seguimientoHoja: 'Cirugias', puntoVenta: '0001', ultimoRCC: '4376' };
  const ctx = {
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: (n) => (n === 'Cirugias' ? hojaSeg : null) }),
      getActive: () => ({ getSheetByName: () => null }),
      CopyPasteType: { PASTE_FORMAT: 'f' },
      newDataValidation: () => ({}),
      flush() {},
    },
    CacheService: { getScriptCache: () => ({ get: (k) => (k === 'cfg' ? JSON.stringify(cfg) : null), put() {}, remove() {} }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      formatDate: (d, _tz, f) => (f.includes('HH') ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`),
      getUuid: () => crypto.randomUUID(),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'tok' }) },
    ContentService: {},
  };
  // Mismo "realm" que la prueba, para que las fechas sean instanceof Date
  Object.assign(globalThis, ctx);
  vm.runInThisContext(fs.readFileSync(new URL('../gas/Codigo.gs', import.meta.url), 'utf8'));
  // getCirugias/getCirugia leen pestañas del Sheet de la app: acá no hay documentos
  globalThis.leer_ = () => [];
  return globalThis;
}

test('lee el Seguimiento: meses, pendientes y asigna ID', () => {
  const h = seguimiento();
  const g = cargarGas(h);
  const seg = g.leerSeguimiento_();
  assert.equal(seg.hr, 3);
  assert.equal(seg.filas.length, 6);
  assert.deepEqual(seg.secciones.map((s) => [s.mes, s.anio]), [[9, 2026], [10, 2026]]);
  const pend = seg.filas.filter((c) => c.pendiente);
  assert.deepEqual(pend.map((c) => c.paciente), ['Pendiente Uno']);
  assert.ok(seg.filas.every((c) => c.id.startsWith('C')));
  assert.equal(h.celda(6, 22).length > 1, true, 'escribe el ID en la columna V');
  assert.equal(seg.filas[0].estado, 'Realizada', 'con RCC y sin estado → Realizada');
});

test('getCirugias filtra por rango y suma las pendientes', () => {
  const g = cargarGas(seguimiento());
  const l = g.getCirugias('01/11/2026', '30/11/2026');
  assert.deepEqual(l.map((c) => c.paciente).sort(), ['Paciente Cinco', 'Paciente Cuatro', 'Pendiente Uno']);
});

test('alta en un mes existente queda en orden cronológico', () => {
  const h = seguimiento();
  const g = cargarGas(h);
  const c = g.guardarCirugia({ fecha: '05/11/2026', medico: 'Med Z', paciente: 'Nuevo Nov', institucion: 'I', procedimiento: 'P', obraSocial: 'OS' });
  const t = h.texto();
  const iNov = t.findIndex((x) => x.startsWith('NOVIEMBRE'));
  assert.deepEqual(t.slice(iNov, iNov + 4).map((x) => x.split('|')[2]), ['', 'Paciente Cuatro', 'Nuevo Nov', 'Paciente Cinco']);
  assert.equal(c.paciente, 'Nuevo Nov');
  assert.equal(c.fecha, '05/11/2026');
  assert.equal(c.estado, 'Programada');
});

test('alta en un mes nuevo crea el título antes de SIN FECHA', () => {
  const h = seguimiento();
  const g = cargarGas(h);
  g.guardarCirugia({ fecha: '02/12/2026', medico: 'Med Z', paciente: 'Nuevo Dic', estado: 'Programada' });
  const t = h.texto();
  const iDic = t.findIndex((x) => x.startsWith('DICIEMBRE'));
  const iSin = t.findIndex((x) => x.startsWith('SIN FECHA'));
  assert.ok(iDic > 0 && iDic < iSin, 'DICIEMBRE va antes de SIN FECHA');
  assert.equal(t[iDic + 1].split('|')[2], 'Nuevo Dic');
  // y se lee como sección de 2026
  const seg = g.leerSeguimiento_();
  assert.ok(seg.secciones.some((s) => s.mes === 11 && s.anio === 2026));
});

test('programar una pendiente la mueve a su mes', () => {
  const h = seguimiento();
  const g = cargarGas(h);
  const p = g.leerSeguimiento_().filas.find((c) => c.paciente === 'Pendiente Uno');
  g.guardarCirugia({ ...p, fecha: '20/11/2026' });
  const seg = g.leerSeguimiento_();
  const movida = seg.filas.find((c) => c.paciente === 'Pendiente Uno');
  assert.equal(movida.id, p.id, 'conserva el ID');
  assert.equal(movida.pendiente, false);
  assert.equal(movida.fecha, '20/11/2026');
  const t = h.texto();
  assert.ok(t.findIndex((x) => x.includes('Pendiente Uno')) < t.findIndex((x) => x.startsWith('SIN FECHA')));
});

test('cambio de fecha dentro del mismo mes actualiza en el lugar y sincroniza Suspendida', () => {
  const h = seguimiento();
  const g = cargarGas(h);
  const c = g.leerSeguimiento_().filas.find((x) => x.paciente === 'Paciente Dos');
  const filaAntes = c.fila;
  g.guardarCirugia({ ...c, fecha: '16/10/2026', estado: 'Suspendida' });
  assert.equal(h.celda(filaAntes, 4), 'Paciente Dos');
  assert.equal(h.celda(filaAntes, 11), true, 'columna Suspendida');
  assert.equal(h.celda(filaAntes, 13), 'Suspendida', 'columna Estado');
});

test('el número de remito se agrega sin pisar el anterior', () => {
  const h = seguimiento();
  const g = cargarGas(h);
  const c = g.leerSeguimiento_().filas.find((x) => x.paciente === 'Paciente Cuatro');
  g.escribirEnSeguimiento_({ id: c.id }, { remito: '3612' });
  g.escribirEnSeguimiento_({ id: c.id }, { remito: '3613' });
  g.escribirEnSeguimiento_({ id: c.id }, { remito: '3613' });
  assert.equal(h.celda(c.fila, 8), '3612 / 3613');
  g.escribirEnSeguimiento_({ id: c.id }, { rcc: '004-377' });
  assert.equal(h.celda(c.fila, 1), '004-377');
});

test('formatos de numeración', () => {
  const g = cargarGas(seguimiento());
  assert.equal(g.NUMERACION.consumo.fmt(4377), '004-377');
  assert.equal(g.NUMERACION.remito.fmt(3612), '0001-00003612');
  assert.equal(g.NUMERACION.solicitud.fmt(4), '0000-0004');
  assert.equal(g.numEntero_('consumo', '004-377'), 4377);
  assert.equal(g.numEntero_('remito', '0001-00003612'), 3612);
  assert.equal(g.numEntero_('recepcion', '00012'), 12);
});

test('fechas y números argentinos', () => {
  const g = cargarGas(seguimiento());
  assert.equal(g.num_('4.420.000,00'), 4420000);
  assert.equal(g.num_('$289.256,20'), 289256.2);
  assert.equal(g.num_('1545,25'), 1545.25);
  const d = g.aFecha_('3/11/26');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getHours(), 12);
  assert.equal(g.enLetras(302.5, 'USD'), 'SON TRESCIENTOS DOS DÓLARES ESTADOUNIDENSES CON 50/100');
  assert.equal(g.enLetras(1001, 'ARS'), 'SON MIL UN PESOS');
});
