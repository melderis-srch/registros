'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { dmyAIso, isoADmy, norm } from '@/lib/format';

export function cx(...a) {
  return a.filter(Boolean).join(' ');
}

export function Boton({ variante = 'sec', tam = 'md', icono: Icono, cargando, className, children, ...p }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:opacity-55 disabled:cursor-not-allowed whitespace-nowrap';
  const v = {
    prim: 'bg-azul text-white hover:bg-azul-osc shadow-sm',
    sec: 'bg-white text-tinta border border-linea hover:border-azul/50 hover:text-azul-osc',
    ghost: 'text-gris hover:text-azul-osc hover:bg-azul-claro',
    suave: 'bg-azul-claro text-azul-osc hover:bg-[#E2E9F7]',
    peligro: 'text-err hover:bg-err-claro',
  }[variante];
  const t = { sm: 'text-xs px-2.5 py-1.5', md: 'text-[13px] px-3.5 py-2', lg: 'text-sm px-4 py-2.5' }[tam];
  return (
    <button type="button" className={cx(base, v, t, className)} disabled={cargando || p.disabled} {...p}>
      {cargando ? <Loader2 size={15} className="animate-spin" /> : Icono ? <Icono size={15} strokeWidth={2.2} /> : null}
      {children}
    </button>
  );
}

export function Campo({ label, hint, className, children, ancho }) {
  return (
    <label className={cx('block min-w-0', ancho, className)}>
      {label && <span className="block text-[11.5px] font-semibold text-gris mb-1">{label}</span>}
      {children}
      {hint && <span className="block text-[11px] text-gris-claro mt-1">{hint}</span>}
    </label>
  );
}

export function Texto({ value, onChange, className, ...p }) {
  return <input className={cx('campo', className)} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} {...p} />;
}

export function AreaTexto({ value, onChange, className, ...p }) {
  return <textarea className={cx('campo min-h-[70px] resize-y', className)} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} {...p} />;
}

export function Fecha({ value, onChange, className, ...p }) {
  return <input type="date" className={cx('campo', className)} value={dmyAIso(value)} onChange={(e) => onChange?.(isoADmy(e.target.value))} {...p} />;
}

export function Selector({ value, onChange, opciones = [], className, vacio, ...p }) {
  return (
    <select className={cx('campo pr-8', className)} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} {...p}>
      {vacio !== undefined && <option value="">{vacio}</option>}
      {opciones.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

export function Casilla({ checked, onChange, label, className }) {
  return (
    <label className={cx('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
      <input type="checkbox" className="size-4 accent-[#2F55B0]" checked={!!checked} onChange={(e) => onChange?.(e.target.checked)} />
      {label && <span>{label}</span>}
    </label>
  );
}

const TONOS = {
  azul: 'bg-azul-claro text-azul-osc',
  verde: 'bg-ok-claro text-ok',
  ambar: 'bg-alerta-claro text-alerta',
  rojo: 'bg-err-claro text-err',
  gris: 'bg-[#EEF0F4] text-gris',
};
export function Etiqueta({ tono = 'gris', children, className }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', TONOS[tono], className)}>{children}</span>;
}

export const TONO_ESTADO = {
  Programada: 'azul', Realizada: 'verde', Suspendida: 'gris', 'Dada de baja': 'gris', Facturada: 'ambar',
  Registrado: 'verde', Facturado: 'ambar',
  Emitido: 'azul', Entregado: 'ambar', Retornado: 'verde', Anulado: 'rojo',
  Emitida: 'azul', Enviada: 'ambar', 'Recibida parcial': 'ambar', Recibida: 'verde', Anulada: 'rojo',
};
export function Estado({ valor }) {
  if (!valor) return null;
  return <Etiqueta tono={TONO_ESTADO[valor] || 'gris'}>{valor}</Etiqueta>;
}

export function Tarjeta({ titulo, icono: Icono, acciones, className, children, sinPadding }) {
  return (
    <section className={cx('bg-white rounded-xl border border-linea shadow-card', className)}>
      {(titulo || acciones) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
          <h3 className="flex items-center gap-2 text-[13px] font-bold text-tinta tracking-tight">
            {Icono && <Icono size={16} className="text-azul" />} {titulo}
          </h3>
          <div className="flex items-center gap-2">{acciones}</div>
        </header>
      )}
      <div className={sinPadding ? '' : 'px-5 pb-5 pt-3'}>{children}</div>
    </section>
  );
}

export function Panel({ abierto, onCerrar, titulo, subtitulo, ancho = 'max-w-xl', pie, children }) {
  useEffect(() => {
    if (!abierto) return;
    const f = (e) => e.key === 'Escape' && onCerrar?.();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-[#1B1F2A]/25 backdrop-blur-[1px]" onClick={onCerrar} />
      <aside className={cx('relative h-full w-full bg-white shadow-2xl flex flex-col', ancho)}>
        <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-linea">
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold tracking-tight truncate">{titulo}</h2>
            {subtitulo && <div className="text-gris text-[13px] mt-0.5">{subtitulo}</div>}
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-lg text-gris hover:bg-azul-claro" aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-fino px-6 py-5">{children}</div>
        {pie && <footer className="px-6 py-3.5 border-t border-linea bg-azul-50 flex items-center justify-end gap-2">{pie}</footer>}
      </aside>
    </div>
  );
}

export function Modal({ abierto, onCerrar, titulo, ancho = 'max-w-2xl', pie, children }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-[#1B1F2A]/30" onClick={onCerrar} />
      <div className={cx('relative w-full bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]', ancho)}>
        <header className="flex items-center justify-between px-6 py-4 border-b border-linea">
          <h2 className="text-[16px] font-bold">{titulo}</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-lg text-gris hover:bg-azul-claro" aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="overflow-y-auto scroll-fino px-6 py-5">{children}</div>
        {pie && <footer className="px-6 py-3.5 border-t border-linea flex justify-end gap-2">{pie}</footer>}
      </div>
    </div>
  );
}

/**
 * Buscador con lista desplegable.
 * opciones: array de objetos · texto(o): string a buscar · etiqueta(o): nodo a mostrar
 * value/onChange: el texto del input (se puede escribir libre) · onElegir(o): al elegir de la lista
 */
export function Buscador({ value, onChange, onElegir, opciones = [], texto, etiqueta, placeholder, className, celda, autoFocus, max = 40 }) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const ref = useRef(null);
  const indice = useMemo(() => opciones.map((o) => [norm(texto(o)), o]), [opciones, texto]);
  const res = useMemo(() => {
    const q = norm(value).split(' ').filter(Boolean);
    if (!q.length) return indice.slice(0, max).map((x) => x[1]);
    const out = [];
    for (const [t, o] of indice) {
      if (q.every((w) => t.includes(w))) out.push(o);
      if (out.length >= max) break;
    }
    return out;
  }, [value, indice, max]);

  useEffect(() => {
    const f = (e) => ref.current && !ref.current.contains(e.target) && setAbierto(false);
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);

  function elegir(o) {
    onElegir?.(o);
    setAbierto(false);
  }
  return (
    <div ref={ref} className={cx('relative', className)}>
      <input
        className={cx('campo', celda && 'campo-celda')}
        value={value ?? ''}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setAbierto(true)}
        onChange={(e) => { onChange?.(e.target.value); setAbierto(true); setActivo(0); }}
        onKeyDown={(e) => {
          if (!abierto) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(a + 1, res.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && res[activo]) { e.preventDefault(); elegir(res[activo]); }
          if (e.key === 'Escape') setAbierto(false);
        }}
      />
      {abierto && res.length > 0 && (
        <ul className="absolute z-30 mt-1 left-0 min-w-full w-max max-w-[min(560px,90vw)] max-h-72 overflow-auto scroll-fino bg-white border border-linea rounded-lg shadow-xl py-1">
          {res.map((o, i) => (
            <li
              key={i}
              onMouseDown={(e) => { e.preventDefault(); elegir(o); }}
              onMouseEnter={() => setActivo(i)}
              className={cx('px-3 py-1.5 cursor-pointer text-[13px]', i === activo && 'bg-azul-claro')}
            >
              {etiqueta ? etiqueta(o) : texto(o)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 text-gris py-16">
      <Loader2 size={18} className="animate-spin text-azul" /> {texto}
    </div>
  );
}

export function Vacio({ icono: Icono, titulo, children }) {
  return (
    <div className="text-center py-14 text-gris">
      {Icono && <Icono size={28} className="mx-auto text-gris-claro mb-3" />}
      <div className="font-semibold text-tinta">{titulo}</div>
      {children && <div className="mt-1 text-[13px]">{children}</div>}
    </div>
  );
}
