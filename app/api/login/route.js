import { NextResponse } from 'next/server';
import { COOKIE, firmar, opcionesCookie, usuarios } from '@/lib/session';

const demo = () => process.env.DEMO === '1' && !process.env.GOOGLE_CLIENT_ID;

/** Datos públicos para el botón de Google */
export async function GET() {
  return NextResponse.json({ clientId: process.env.GOOGLE_CLIENT_ID || '', demo: demo() });
}

/** Recibe el token de "Ingresar con Google", lo valida con Google y abre la sesión si el mail está habilitado */
export async function POST(req) {
  const { credential, email: emailDemo } = await req.json().catch(() => ({}));
  let email = '';
  if (demo()) {
    email = String(emailDemo || 'demo@surcherie').trim().toLowerCase();
  } else {
    if (!process.env.GOOGLE_CLIENT_ID) return NextResponse.json({ ok: false, error: 'Falta configurar GOOGLE_CLIENT_ID en Vercel.' }, { status: 500 });
    if (!credential) return NextResponse.json({ ok: false, error: 'Falta el ingreso con Google.' }, { status: 400 });
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), { cache: 'no-store' });
    const t = await r.json().catch(() => ({}));
    const valido = r.ok && t.aud === process.env.GOOGLE_CLIENT_ID && String(t.email_verified) === 'true' &&
      ['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) && Number(t.exp) * 1000 > Date.now();
    if (!valido) return NextResponse.json({ ok: false, error: 'Google no pudo confirmar tu cuenta. Probá de nuevo.' }, { status: 401 });
    email = String(t.email).toLowerCase();
    if (!usuarios().includes(email)) {
      return NextResponse.json({ ok: false, error: `${email} no está habilitado. Pedile a Dirección Técnica que lo agregue.` }, { status: 403 });
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await firmar(email), opcionesCookie);
  return res;
}
