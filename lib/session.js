// Sesión firmada con HMAC (Web Crypto: funciona en middleware y en rutas de API).
const enc = new TextEncoder();
export const COOKIE = 'reg_sesion';
const DURACION = 60 * 60 * 24 * 14; // 14 días

function b64url(buf) {
  let s = typeof buf === 'string' ? buf : String.fromCharCode(...new Uint8Array(buf));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function desdeB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}
async function clave() {
  const secreto = process.env.SESSION_SECRET || 'solo-para-desarrollo';
  return crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function firmar(email) {
  const datos = b64url(unescape(encodeURIComponent(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + DURACION }))));
  const firma = b64url(await crypto.subtle.sign('HMAC', await clave(), enc.encode(datos)));
  return datos + '.' + firma;
}

export async function leerSesion(valor) {
  if (!valor || !valor.includes('.')) return null;
  const [datos, firma] = valor.split('.');
  const esperada = b64url(await crypto.subtle.sign('HMAC', await clave(), enc.encode(datos)));
  if (esperada !== firma) return null;
  try {
    const o = JSON.parse(decodeURIComponent(escape(desdeB64url(datos))));
    if (!o.exp || o.exp < Date.now() / 1000) return null;
    return o;
  } catch {
    return null;
  }
}

export const opcionesCookie = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: DURACION };

/** USUARIOS="mail1:clave1,mail2:clave2" */
export function usuarios() {
  return String(process.env.USUARIOS || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(':');
      return { email: p.slice(0, i).trim().toLowerCase(), clave: p.slice(i + 1) };
    });
}
