// Pruebas de gas/AppDB.gs (base del sistema web) con una planilla simulada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Rango {
  constructor(h, r, c, nr = 1, nc = 1) { Object.assign(this, { h, r, c, nr, nc }); }
  getValues() { return Array.from({ length: this.nr }, (_, i) => Array.from({ length: this.nc }, (_, j) => this.h.celda(this.r + i, this.c + j))); }
  getDisplayValues() { return this.getValues().map((f) => f.map((v) => String(v ?? ''))); }
  getValue() { return this.h.celda(this.r, this.c); }
  setValues(v) { v.forEach((f, i) => f.forEach((x, j) => this.h.poner(this.r + i, this.c + j, x))); return this; }
  getRow() { return this.r; } getColumn() { return this.c; } getSheet() { return this.h; }
  setFontWeight() { return this; } setWrap() { return this; } setNumberFormat() { return this; }
  createTextFinder(t) { const h = this.h, r0 = this.r, c = this.c, nr = this.nr; return { matchEntireCell() { return this; }, findAll() { const out = []; for (let i = 0; i < nr; i++) if (String(h.celda(r0 + i, c)) === t) out.push({ getRow: () => r0 + i }); return out; } }; }
}
class Hoja {
  constructor(n, filas = []) { this.n = n; this.filas = filas.map((f) => [...f]); }
  celda(r, c) { return (this.filas[r - 1] || [])[c - 1] ?? ''; }
  poner(r, c, v) { while (this.filas.length < r) this.filas.push([]); this.filas[r - 1][c - 1] = v; }
  getName() { return this.n; }
  getRange(a, b, c, d) { if (typeof a === 'string') return this.a1(a); return new Rango(this, a, b, c, d); }
  a1(s) { const m = s.match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/); const col = (x) => [...x].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
    const c1 = col(m[1]), r1 = +m[2] || 1, c2 = m[3] ? col(m[3]) : c1, r2 = m[4] ? +m[4] : (m[3] ? Math.max(this.getLastRow(), r1) : r1); return new Rango(this, r1, c1, r2 - r1 + 1, c2 - c1 + 1); }
  getLastRow() { for (let i = this.filas.length; i > 0; i--) if ((this.filas[i - 1] || []).some((v) => v !== '' && v !== undefined)) return i; return 0; }
  setFrozenRows() {}
}
function entorno({ catalogo = [] } = {}) {
  const hojas = { Config: new Hoja('Config', [['clave', 'valor'], ['maestroId', 'MAESTRO'], ['seguimientoId', 'SEG']]) };
  const libros = {
    REG: { hojas, id: 'REG' },
    MAESTRO: { id: 'MAESTRO', hojas: { catalogo: new Hoja('catalogo', [[], [], ...catalogo]) } },
    KX1: { id: 'KX1', hojas: { 'Tornillos': new Hoja('Tornillos', [['a', 'b'], ['1', '2']]) } },
    OTRA: { id: 'OTRA', hojas: { x: new Hoja('x', [['secreto']]) } },
  };
  const libro = (L) => ({
    getId: () => L.id, getName: () => L.id,
    getSheetByName: (n) => L.hojas[n] || null,
    insertSheet: (n) => (L.hojas[n] = new Hoja(n)),
    getRange: (a1) => { const m = a1.match(/^(?:'((?:[^']|'')+)'|([^!]+))!(.+)$/); const n = (m[1] || m[2]).replace(/''/g, "'"); const sh = L.hojas[n]; if (!sh) throw new Error('No existe ' + n); return sh.a1(m[3]); },
  });
  const cache = {};
  const ctx = {
    console, JSON, Date, Math, String, Number, Object, Array,
    SpreadsheetApp: { getActive: () => libro(libros.REG), openById: (id) => { if (!libros[id]) throw new Error('no existe'); return libro(libros[id]); }, flush() {} },
    LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    USUARIO: 'mel@x.com',
  };
  vm.createContext(ctx);
  const cfg = `function cfg_(k){ var f=SpreadsheetApp.getActive().getSheetByName('Config').filas; for(var i=0;i<f.length;i++) if(f[i][0]===k) return f[i][1]; return ''; }`;
  vm.runInContext(cfg + '\n' + fs.readFileSync(new URL('../gas/AppDB.gs', import.meta.url), 'utf8'), ctx);
  // getRichTextValues no existe en el simulador: lo agrego al rango
  Rango.prototype.getRichTextValues = function () { return this.getValues().map((f) => f.map(() => null)); };
  return { ctx, hojas, libros };
}

test('guardar, leer, actualizar y borrar documentos', () => {
  const { ctx, hojas } = entorno();
  ctx.dbSet('rcc', 'r470', { rcc: '004-470', productos: [{ p: 'Bloqueos', cant: '2' }] });
  ctx.dbSet('sgc', 'a1', { tipo: 'T11', rango: 'Sí' });
  let t = ctx.dbTodo();
  assert.equal(t.docs.length, 2);
  assert.deepEqual(t.docs.find((d) => d.id === 'r470').d.productos[0], { p: 'Bloqueos', cant: '2' });
  const desde = t.ts;
  // el mismo id en otra colección no se pisa
  ctx.dbSet('oc', 'r470', { numero: 1 });
  ctx.dbSet('rcc', 'r470', { rcc: '004-470', productos: [] });
  assert.equal(hojas.AppDB.getLastRow(), 4, 'una fila por documento (+ encabezado)');
  ctx.dbDelete('sgc', 'a1');
  const ch = ctx.dbCambios(desde - 1);
  assert.ok(ch.docs.some((d) => d.c === 'sgc' && d.id === 'a1' && d.d === null), 'el borrado viaja como null');
  t = ctx.dbTodo();
  assert.deepEqual(JSON.parse(JSON.stringify(t.docs.map((d) => d.c + '/' + d.id).sort())), ['oc/r470', 'rcc/r470']);
  assert.equal(t.docs.find((d) => d.c === 'rcc').d.productos.length, 0);
  assert.equal(hojas.AppDB.celda(2, 5), 'mel@x.com', 'queda quién guardó');
});

test('rechaza ids raros y registros enormes', () => {
  const { ctx } = entorno();
  assert.throws(() => ctx.dbSet('rcc', '../x', {}), /inválido/);
  assert.throws(() => ctx.dbSet('rcc', 'r1', { x: 'a'.repeat(60000) }), /demasiado grande/);
});

test('planillas: solo las del sistema y las del kardex del catálogo', () => {
  const { ctx, libros } = entorno({ catalogo: [['P1', 'Tornillo', 'NOVAX', '', 'https://docs.google.com/spreadsheets/d/KX1_______________________/edit', 'Tornillos']] });
  libros['KX1_______________________'] = libros.KX1; libros.KX1.id = 'KX1_______________________';
  const r = ctx.sheetsProxy('get_values', { spreadsheetId: 'KX1_______________________', range: "'Tornillos'!A1:B" });
  assert.deepEqual(JSON.parse(JSON.stringify(r.values)), [['a', 'b'], ['1', '2']]);
  assert.throws(() => ctx.sheetsProxy('get_values', { spreadsheetId: 'OTRA', range: 'x!A1' }), /no tiene permiso/);
  ctx.sheetsProxy('append_values', { spreadsheetId: 'KX1_______________________', range: "'Tornillos'!A1", values: [['3', '4', '5']] });
  ctx.sheetsProxy('update_values', { spreadsheetId: 'KX1_______________________', range: "'Tornillos'!B2", values: [['X']] });
  const v = ctx.sheetsProxy('get_values', { spreadsheetId: 'KX1_______________________', range: "'Tornillos'!A1:C" }).values;
  assert.deepEqual(JSON.parse(JSON.stringify(v)), [['a', 'b'], ['1', 'X'], ['3', '4', '5']]);
});
