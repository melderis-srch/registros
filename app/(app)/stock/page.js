'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Boxes, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { norm } from '@/lib/format';
import { Boton, Cargando, Etiqueta, Vacio, cx } from '@/components/ui';

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><Stock /></Suspense>;
}

const FILTROS = [['todos', 'Todos'], ['bajo', 'Bajo mínimo'], ['vence', 'Vence < 6 meses'], ['error', 'Con error']];

function Stock() {
  const sp = useSearchParams();
  const { avisar, cargarPendientes } = useApp();
  const [datos, setDatos] = useState(null);
  const [sel, setSel] = useState(sp.get('codigo') || '');
  const [f, setF] = useState({ texto: '', filtro: 'todos' });
  const [leyendo, setLeyendo] = useState(null);
  const auto = useRef(false);

  const cargar = useCallback(() => api('getStock').then(setDatos).catch((e) => { avisar(e.message, 'err'); setDatos({ productos: [] }); }), [avisar]);
  useEffect(() => { cargar(); }, [cargar]);

  const leer = useCallback(async () => {
    setLeyendo({ hechos: 0, total: 0 });
    let desde = 0, errores = 0, r;
    try {
      do {
        r = await api('kardexSync', desde, 20);
        errores += r.errores;
        setLeyendo({ hechos: r.hechos, total: r.total });
        desde = r.siguiente;
      } while (desde !== null);
      avisar(`Kardex leído: ${r.total} productos${errores ? `, ${errores} con error (filtro “Con error”)` : ''}.`, errores ? 'err' : 'ok');
    } catch (e) {
      avisar('No se pudo leer el kardex: ' + e.message, 'err');
    }
    setLeyendo(null);
    cargar();
    cargarPendientes();
  }, [avisar, cargar, cargarPendientes]);

  useEffect(() => {
    if (sp.get('leer') === '1' && !auto.current) { auto.current = true; leer(); }
  }, [sp, leer]);

  const lista = useMemo(() => {
    if (!datos) return [];
    const q = norm(f.texto).split(' ').filter(Boolean);
    return datos.productos.filter((p) => {
      if (f.filtro === 'bajo' && !p.bajoMin) return false;
      if (f.filtro === 'vence' && !p.vence) return false;
      if (f.filtro === 'error' && !p.error) return false;
      const t = norm([p.codigo, p.desc, p.proveedor, p.marca, p.hoja].join(' '));
      return q.every((w) => t.includes(w));
    });
  }, [datos, f]);

  const grupos = useMemo(() => {
    const m = new Map();
    lista.forEach((p) => { const g = p.proveedor || 'Sin proveedor'; if (!m.has(g)) m.set(g, []); m.get(g).push(p); });
    return [...m];
  }, [lista]);

  const p = datos?.productos.find((x) => x.codigo === sel) || lista[0];
  const conteo = (k) => datos?.productos.filter((x) => (k === 'bajo' ? x.bajoMin : k === 'vence' ? x.vence : k === 'error' ? x.error : true)).length ?? '–';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">Stock</h1>
          <p className="text-gris mt-0.5">Lo que hay en el kardex de cada producto, por lote. {datos?.leido ? `Leído ${datos.leido}.` : ''}</p>
        </div>
        <Boton variante="prim" icono={RefreshCw} onClick={leer} cargando={!!leyendo}>
          {leyendo ? (leyendo.total ? `Leyendo ${leyendo.hechos} de ${leyendo.total}…` : 'Leyendo catálogo…') : 'Leer kardex'}
        </Boton>
      </div>

      {!datos ? <Cargando /> : !datos.productos.length ? (
        <div className="bg-white rounded-xl border border-linea shadow-card">
          <Vacio icono={Boxes} titulo="Todavía no se leyó el kardex">Tocá “Leer kardex”: lee el Catálogo Maestro y la pestaña de cada producto (tarda un par de minutos).</Vacio>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(320px,420px)_1fr] gap-5 items-start">
          <div className="bg-white rounded-xl border border-linea shadow-card overflow-hidden">
            <div className="p-3 border-b border-linea grid gap-2">
              <div className="relative">
                <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gris-claro" />
                <input className="campo !pl-8 !py-1.5" placeholder="Código, producto, proveedor…" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-1">
                {FILTROS.map(([k, l]) => (
                  <button key={k} onClick={() => setF({ ...f, filtro: k })} className={cx('px-2.5 py-1 rounded-md text-[12px] font-semibold border', f.filtro === k ? 'bg-azul text-white border-azul' : 'border-linea text-gris hover:text-azul-osc')}>
                    {l} <span className="opacity-70 tnum">{conteo(k)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto scroll-fino">
              {grupos.map(([g, ps]) => (
                <div key={g}>
                  <div className="sticky top-0 bg-white/95 px-4 pt-3 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-gris-claro border-b border-linea">{g}</div>
                  {ps.map((x) => (
                    <button key={x.codigo} onClick={() => setSel(x.codigo)} className={cx('w-full flex items-center gap-3 px-4 py-2 text-left border-b border-linea border-l-[3px]', p?.codigo === x.codigo ? 'bg-azul-50 border-l-azul' : 'border-l-transparent hover:bg-azul-50/60')}>
                      <span className={cx('text-[17px] font-extrabold tnum w-9 text-right shrink-0', x.bajoMin ? 'text-err' : 'text-tinta')}>{x.disp}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold truncate">{x.desc}</span>
                        <span className="block text-[11.5px] text-gris truncate">{x.codigo} · {x.hoja}</span>
                      </span>
                      {x.error ? <Etiqueta tono="rojo">Error</Etiqueta> : x.vencido ? <Etiqueta tono="rojo">Vencido</Etiqueta> : x.bajoMin ? <Etiqueta tono="ambar">Mín {x.minimo}</Etiqueta> : x.vence ? <Etiqueta tono="ambar">Vence</Etiqueta> : null}
                    </button>
                  ))}
                </div>
              ))}
              {!grupos.length && <div className="p-6 text-center text-gris text-[13px]">Nada con este filtro.</div>}
            </div>
          </div>

          {p && <Detalle p={p} />}
        </div>
      )}
    </div>
  );
}

function Detalle({ p }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const lotes = Object.entries(p.lotes || {}).sort((a, b) => (a[1].vtoIso || '9').localeCompare(b[1].vtoIso || '9'));
  return (
    <section className="bg-white rounded-xl border border-linea shadow-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-[17px]">{p.desc}</h2>
          <p className="text-[13px] text-gris mt-0.5">{[p.codigo, p.proveedor, p.marca, 'pestaña ' + p.hoja, p.leido && 'leído ' + p.leido].filter(Boolean).join(' · ')}</p>
        </div>
        {p.sid && (
          <a href={`https://docs.google.com/spreadsheets/d/${p.sid}/edit`} target="_blank" rel="noreferrer">
            <Boton tam="sm" icono={ExternalLink}>Abrir planilla</Boton>
          </a>
        )}
      </div>
      {p.error && <div className="mt-3 text-[13px] text-err bg-err-claro rounded-lg px-3 py-2">{p.error}</div>}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[['Disponibles', p.disp, p.bajoMin ? 'text-err' : ''], ['Mínimo', p.minimo || '—', ''], ['Falta para el mínimo', p.bajoMin ? p.minimo - p.disp : 0, p.bajoMin ? 'text-err' : 'text-ok']].map(([l, v, c]) => (
          <div key={l} className="rounded-lg border border-linea px-3 py-2.5">
            <div className={cx('text-[22px] font-extrabold tnum leading-none', c)}>{v}</div>
            <div className="text-[12px] text-gris mt-1">{l}</div>
          </div>
        ))}
      </div>
      <table className="w-full text-[13px] mt-4">
        <thead className="bg-azul-50 text-[10.5px] uppercase tracking-wider text-azul-osc">
          <tr><th className="text-left px-3 py-2">Lote</th><th className="text-left px-3 py-2">Vencimiento</th><th className="text-right px-3 py-2">Disponibles</th><th className="text-right px-3 py-2">Ingresadas</th></tr>
        </thead>
        <tbody>
          {lotes.map(([l, v]) => (
            <tr key={l} className={cx('border-t border-linea', !v.disp && 'text-gris-claro')}>
              <td className="px-3 py-1.5 font-semibold">{l}</td>
              <td className="px-3 py-1.5">{v.vto}{v.disp > 0 && v.vtoIso && v.vtoIso < hoy && <span className="ml-2 text-err font-semibold">vencido</span>}</td>
              <td className="px-3 py-1.5 text-right tnum font-semibold">{v.disp}</td>
              <td className="px-3 py-1.5 text-right tnum">{v.total}</td>
            </tr>
          ))}
          {!lotes.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-gris">Sin unidades cargadas.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
