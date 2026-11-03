'use client';
import { Plus, Trash2 } from 'lucide-react';
import { Buscador, cx } from '@/components/ui';
import { dmyAIso, fmt, isoADmy } from '@/lib/format';

/**
 * Tabla editable de ítems.
 * cols: [{ k, h, w, tipo: 'texto'|'num'|'select'|'check'|'fecha'|'buscador'|'calc', opciones, al, render(fila,i),
 *          buscador: { opciones, texto, etiqueta, elegir(o, fila) → cambios } , placeholder, falta(fila) }]
 */
export default function TablaItems({ cols, filas, setFilas, nueva, textoAgregar = 'Agregar ítem', pie, vacio }) {
  const cambiar = (i, cambios) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  const quitar = (i) => setFilas((fs) => fs.filter((_, j) => j !== i));

  return (
    <div>
      <div className="overflow-x-auto scroll-fino">
        <table className="w-full text-[13px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-8 bg-azul-50 border-y border-linea first:rounded-l-lg" />
              {cols.map((c) => (
                <th key={c.k} style={{ width: c.w, minWidth: c.min }} className={cx('bg-azul-50 border-y border-linea px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider text-azul-osc', c.al === 'r' ? 'text-right' : c.al === 'c' ? 'text-center' : 'text-left')}>
                  {c.h}
                </th>
              ))}
              <th className="w-9 bg-azul-50 border-y border-linea last:rounded-r-lg" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f._k || i} className="group">
                <td className="border-b border-linea text-center text-gris-claro text-[11px] tnum align-top pt-3">{i + 1}</td>
                {cols.map((c) => (
                  <td key={c.k} className={cx('border-b border-linea px-0.5 py-1 align-top', c.al === 'r' && 'text-right', c.al === 'c' && 'text-center')}>
                    <Celda c={c} f={f} i={i} cambiar={cambiar} />
                  </td>
                ))}
                <td className="border-b border-linea align-top pt-1.5">
                  <button onClick={() => quitar(i)} className="p-1.5 rounded-md text-gris-claro hover:text-err hover:bg-err-claro opacity-60 group-hover:opacity-100" aria-label="Quitar"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {!filas.length && (
              <tr><td colSpan={cols.length + 2} className="text-center text-gris py-8 border-b border-linea">{vacio || 'Sin ítems todavía.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-3">
        {nueva ? (
          <button onClick={() => setFilas((fs) => [...fs, { ...nueva(), _k: Math.random().toString(36).slice(2) }])} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-azul hover:text-azul-osc px-2 py-1.5 rounded-lg hover:bg-azul-claro">
            <Plus size={16} /> {textoAgregar}
          </button>
        ) : <span />}
        {pie}
      </div>
    </div>
  );
}

function Celda({ c, f, i, cambiar }) {
  const v = f[c.k];
  const falta = c.falta?.(f);
  const cls = cx('campo campo-celda', falta && 'falta', c.al === 'r' && 'text-right', c.al === 'c' && 'text-center');
  if (c.render) return c.render(f, i, (cambios) => cambiar(i, cambios));
  switch (c.tipo) {
    case 'calc':
      return <div className={cx('px-2 py-1.5 tnum font-semibold', c.al === 'r' && 'text-right')}>{c.valor ? c.valor(f) : fmt(v)}</div>;
    case 'num':
      return <input className={cx(cls, 'tnum')} inputMode="decimal" value={v ?? ''} placeholder={c.placeholder} onChange={(e) => cambiar(i, { [c.k]: e.target.value })} />;
    case 'select':
      return (
        <select className={cls} value={v ?? ''} onChange={(e) => cambiar(i, { [c.k]: e.target.value })}>
          {c.vacio !== undefined && <option value="">{c.vacio}</option>}
          {c.opciones.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    case 'check':
      return <input type="checkbox" className="size-4 mt-2 accent-[#2F55B0]" checked={!!v} onChange={(e) => cambiar(i, { [c.k]: e.target.checked })} />;
    case 'fecha':
      return <input type="date" className={cls} value={dmyAIso(v)} onChange={(e) => cambiar(i, { [c.k]: isoADmy(e.target.value) })} />;
    case 'buscador':
      return (
        <Buscador
          celda
          value={v}
          placeholder={c.placeholder}
          onChange={(t) => cambiar(i, { [c.k]: t })}
          onElegir={(o) => cambiar(i, c.buscador.elegir(o, f))}
          opciones={typeof c.buscador.opciones === 'function' ? c.buscador.opciones(f) : c.buscador.opciones}
          texto={c.buscador.texto}
          etiqueta={c.buscador.etiqueta}
          className={falta ? '[&_input]:!border-err' : ''}
        />
      );
    case 'area':
      return <textarea rows={1} className={cx(cls, 'resize-y min-h-[34px]')} value={v ?? ''} placeholder={c.placeholder} onChange={(e) => cambiar(i, { [c.k]: e.target.value })} />;
    default:
      return <input className={cls} value={v ?? ''} placeholder={c.placeholder} onChange={(e) => cambiar(i, { [c.k]: e.target.value })} />;
  }
}
