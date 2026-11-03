import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE, leerSesion } from '@/lib/session';

export const maxDuration = 60;

const PERMITIDAS = new Set([
  'getInicio', 'getCirugias', 'getCirugia', 'guardarCirugia', 'getDocumento', 'guardarDocumento', 'guardarRetorno',
  'cambiarEstado', 'subirPdf', 'getCompras', 'generarOCsReposicion', 'getTabla', 'guardarTabla', 'agregarMaestro',
]);

export async function POST(req) {
  const ses = await leerSesion((await cookies()).get(COOKIE)?.value);
  if (!ses) return NextResponse.json({ ok: false, error: 'Sesión vencida. Volvé a ingresar.' }, { status: 401 });
  const { accion, args = [] } = await req.json();
  if (!PERMITIDAS.has(accion)) return NextResponse.json({ ok: false, error: 'Acción no permitida' }, { status: 400 });

  if (process.env.DEMO === '1') {
    const { demo } = await import('@/lib/demo');
    try {
      return NextResponse.json({ ok: true, data: await demo(accion, args, ses.email) });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e.message });
    }
  }

  if (!process.env.GAS_URL || !process.env.GAS_TOKEN) {
    return NextResponse.json({ ok: false, error: 'Falta configurar GAS_URL y GAS_TOKEN en Vercel.' }, { status: 500 });
  }
  try {
    const r = await fetch(process.env.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: process.env.GAS_TOKEN, usuario: ses.email, accion, args }),
      redirect: 'follow',
      cache: 'no-store',
    });
    const txt = await r.text();
    try {
      return NextResponse.json(JSON.parse(txt));
    } catch {
      return NextResponse.json({ ok: false, error: 'Respuesta inesperada de Apps Script (¿la implementación es pública?).' }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'No se pudo conectar con Apps Script: ' + e.message }, { status: 502 });
  }
}
