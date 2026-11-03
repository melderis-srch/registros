import { NextResponse } from 'next/server';
import { COOKIE, leerSesion } from '@/lib/session';

export async function middleware(req) {
  const ses = await leerSesion(req.cookies.get(COOKIE)?.value);
  if (ses) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Sesión vencida. Volvé a ingresar.' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|api/login|_next/static|_next/image|favicon.ico|icon.png|logo.jpg).*)'],
};
