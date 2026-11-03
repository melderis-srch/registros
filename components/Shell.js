'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Database, LogOut, PackageCheck, AlertTriangle } from 'lucide-react';
import { AppProvider, useApp } from '@/lib/store';
import { Cargando, cx } from '@/components/ui';

const NAV = [
  { href: '/cirugias', label: 'Cirugías', icono: CalendarDays },
  { href: '/compras', label: 'Compras', icono: PackageCheck },
  { href: '/datos', label: 'Datos', icono: Database },
];

function Marco({ children }) {
  const path = usePathname();
  const { inicio, error, recargar } = useApp();
  async function salir() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return (
    <div className="min-h-screen lg:pl-[220px]">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[220px] flex-col bg-white border-r border-linea">
        <div className="px-5 pt-6 pb-5">
          {inicio?.logo ? (
            <img src={inicio.logo} alt="Surchérie" className="h-10 w-auto object-contain" />
          ) : (
            <div className="text-[20px] font-extrabold tracking-tight text-azul-osc">Surch<span className="text-naranja">é</span>rie</div>
          )}
          <div className="text-[11px] font-semibold tracking-[.14em] uppercase text-gris-claro mt-2">Registros</div>
        </div>
        <nav className="px-3 flex flex-col gap-1">
          {NAV.map((n) => {
            const act = path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={cx('flex items-center gap-2.5 rounded-lg px-3 py-2 font-semibold text-[13.5px]', act ? 'bg-azul-claro text-azul-osc' : 'text-gris hover:bg-azul-50 hover:text-tinta')}>
                <n.icono size={17} /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-5 py-4 border-t border-linea text-[12px] text-gris">
          <div className="truncate" title={inicio?.usuario}>{inicio?.usuario}</div>
          <button onClick={salir} className="mt-2 inline-flex items-center gap-1.5 text-gris hover:text-err"><LogOut size={14} /> Salir</button>
        </div>
      </aside>

      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-linea px-4 py-2.5 flex items-center gap-2">
        <div className="font-extrabold text-azul-osc mr-auto">Surch<span className="text-naranja">é</span>rie</div>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={cx('p-2 rounded-lg', path.startsWith(n.href) ? 'bg-azul-claro text-azul-osc' : 'text-gris')} aria-label={n.label}>
            <n.icono size={18} />
          </Link>
        ))}
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1500px]">
        {error ? (
          <div className="max-w-lg mx-auto mt-16 bg-white border border-err/30 rounded-xl p-6 text-center">
            <AlertTriangle className="mx-auto text-err mb-2" />
            <div className="font-semibold">No se pudo conectar con las planillas</div>
            <div className="text-gris text-[13px] mt-1">{error}</div>
            <button onClick={recargar} className="mt-4 text-azul font-semibold">Reintentar</button>
          </div>
        ) : !inicio ? (
          <Cargando texto="Cargando datos de las planillas…" />
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function Shell({ children }) {
  return (
    <AppProvider>
      <Marco>{children}</Marco>
    </AppProvider>
  );
}
