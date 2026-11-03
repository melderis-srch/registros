import { NextResponse } from 'next/server';
import { COOKIE, firmar, opcionesCookie, usuarios } from '@/lib/session';

export async function POST(req) {
  const { email, clave } = await req.json().catch(() => ({}));
  const lista = usuarios();
  const u = lista.find((x) => x.email === String(email || '').trim().toLowerCase());
  const demo = process.env.DEMO === '1' && !lista.length;
  if (!demo && (!u || !u.clave || u.clave !== clave)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, error: 'Email o contraseña incorrectos.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await firmar(u ? u.email : String(email || 'demo').toLowerCase()), opcionesCookie);
  return res;
}
