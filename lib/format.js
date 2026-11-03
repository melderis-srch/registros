// Formatos argentinos y fechas (dd/mm/aaaa)

export const fmt = (n) =>
  (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function num(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  else if (/\.\d{3}$/.test(s)) s = s.replace('.', '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export const pad = (n, l = 2) => String(n).padStart(l, '0');

/** 'dd/mm/aaaa' → Date (12:00) */
export function aDate(s) {
  if (s instanceof Date) return s;
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1], 12);
  const i = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (i) return new Date(+i[1], +i[2] - 1, +i[3], 12);
  return null;
}
export const dmy = (d) => (d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '');
export const iso = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '');
export const hoy = () => dmy(new Date());
export const dmyAIso = (s) => iso(aDate(s));
export const isoADmy = (s) => dmy(aDate(s));

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
export const mismoDia = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/* ---------- total en letras ---------- */
const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
function m1000(n) {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100), r = n % 100;
  let s = C[c];
  if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : ''));
  return s;
}
function letras(n) {
  if (n === 0) return 'CERO';
  const mill = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), rest = n % 1000, out = [];
  if (mill) out.push(mill === 1 ? 'UN MILLÓN' : m1000(mill).replace(/UNO$/, 'UN') + ' MILLONES');
  if (miles) out.push(miles === 1 ? 'MIL' : m1000(miles).replace(/UNO$/, 'UN') + ' MIL');
  if (rest) out.push(m1000(rest));
  return out.join(' ');
}
export function enLetras(total, moneda = 'ARS') {
  const ent = Math.floor(total + 1e-9), cts = Math.round((total - ent) * 100);
  let s = 'SON ' + letras(ent).replace(/UNO$/, 'UN') + (moneda === 'USD' ? ' DÓLARES ESTADOUNIDENSES' : ' PESOS');
  if (cts) s += ' CON ' + pad(cts) + '/100';
  return s;
}

/* ---------- cálculos de OC (IVA hacia adelante) ---------- */
export function tasa(alicuota) {
  const a = String(alicuota ?? '21').replace(',', '.');
  if (a === 'Exento') return 0;
  return (parseFloat(a) || 0) / 100;
}
export function calcularOC(items, descuento = 0) {
  let subtotal = 0, iva21 = 0, iva105 = 0, exento = 0;
  const filas = items.map((x) => {
    const neto = Math.round(num(x.cant) * num(x.costo) * 100) / 100;
    const r = tasa(x.alicuota);
    const iva = Math.round(neto * r * 100) / 100;
    subtotal += neto;
    if (r === 0.21) iva21 += iva;
    else if (r === 0.105) iva105 += iva;
    else exento += neto;
    return { ...x, neto, iva, total: neto + iva };
  });
  const total = Math.round((subtotal + iva21 + iva105 - num(descuento)) * 100) / 100;
  return { filas, subtotal, iva21, iva105, exento, total };
}
