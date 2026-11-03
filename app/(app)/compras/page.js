'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight, ClipboardList, FileText, Inbox, PackageCheck, PackagePlus, Plus, Search, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { aDate, fmt, norm, num } from '@/lib/format';
import { Boton, Cargando, Estado, Selector, Vacio, cx } from '@/components/ui';

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><Compras /></Suspense>;
}

const ABIERTAS = ['Emitida', 'Enviada', 'Recibida parcial'];

function Compras() {
  const router = useRouter();
  const sp = useSearchParams();
  const { avisar } = useApp();
  const [datos, setDatos] = useState(null);
  const [abiertas, setAbiertas] = useState(() => new Set(sp.get('abrir') ? [sp.get('abrir')] : []));
  const [f, setF] = useState({ texto: '', estado: 'abiertas', tipo: 'oc' });

  useEffect(() => {
    api('getCompras').then(setDatos).catch((e) => { avisar(e.message, 'err'); setDatos({ ocs: [], sueltas: [] }); });
  }, [avisar]);

  const lista = useMemo(() => {
    if (!datos) return [];
    const q = norm(f.texto).split(' ').filter(Boolean);
    return datos.ocs.filter((o) => {
      const sol = o.tipo === 'Solicitud de presupuesto';
      if (f.tipo === 'oc' && sol) return false;
      if (f.tipo === 'solicitud' && !sol) return false;
      if (f.estado === 'abiertas' && !sol && !ABIERTAS.includes(o.estado)) return false;
      if (f.estado !== 'abiertas' && f.estado !== 'todas' && o.estado !== f.estado) return false;
      if (q.length) {
        const t = norm([o.numero, o.proveedor, o.pedido, o.paciente, o.facturas, ...o.items.map((i) => i.codigo + ' ' + i.desc)].join(' '));
        if (!q.every((w) => t.includes(w))) return false;
      }
      return true;
    });
  }, [datos, f]);

  const ocs = datos?.ocs.filter((o) => o.tipo !== 'Solicitud de presupuesto') || [];
  const mes = new Date();
  const kpis = [
    { l: 'OC abiertas', v: ocs.filter((o) => ABIERTAS.includes(o.estado)).length, i: ShoppingCart },
    { l: 'Con ítems pendientes', v: ocs.filter((o) => o.estado !== 'Anulada' && o.items.some((x) => num(x.pendiente) > 0) && o.estado !== 'Emitida').length, i: Inbox, hint: 'enviadas' },
    { l: 'Recepciones del mes', v: ocs.flatMap((o) => o.recepciones).concat(datos?.sueltas || []).filter((r) => { const d = aDate(r.fecha); return d && d.getMonth() === mes.getMonth() && d.getFullYear() === mes.getFullYear(); }).length, i: PackageCheck },
    { l: 'Solicitudes de presupuesto', v: (datos?.ocs.length || 0) - ocs.length, i: ClipboardList },
  ];

  const alternar = (n) => setAbiertas((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">Compras</h1>
          <p className="text-gris mt-0.5">Órdenes de compra y lo que se fue recibiendo de cada una.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton icono={PackagePlus} onClick={() => router.push('/compras/recepcion')}>Recepción sin OC</Boton>
          <Boton icono={ClipboardList} onClick={() => router.push('/compras/oc?tipo=solicitud')}>Solicitud de presupuesto</Boton>
          <Boton variante="prim" icono={Plus} onClick={() => router.push('/compras/oc')}>Nueva OC</Boton>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {kpis.map((k) => (
          <div key={k.l} className="bg-white rounded-xl border border-linea shadow-card px-4 py-3.5 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-azul-claro text-azul grid place-items-center"><k.i size={19} /></div>
            <div>
              <div className="text-[22px] font-extrabold leading-none tnum">{datos ? k.v : '–'}</div>
              <div className="text-gris text-[12px] mt-1">{k.l}{k.hint ? <span className="text-gris-claro"> · {k.hint}</span> : null}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-linea shadow-card">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-linea">
          <div className="flex rounded-lg border border-linea p-0.5 bg-azul-50">
            {[['oc', 'Órdenes de compra'], ['solicitud', 'Solicitudes'], ['todas', 'Todo']].map(([v, l]) => (
              <button key={v} onClick={() => setF({ ...f, tipo: v })} className={cx('px-3 py-1 rounded-md text-[12.5px] font-semibold', f.tipo === v ? 'bg-white shadow-sm text-azul-osc' : 'text-gris')}>{l}</button>
            ))}
          </div>
          <Selector className="!w-auto !py-1.5" value={f.estado} onChange={(v) => setF({ ...f, estado: v })} opciones={[{ value: 'abiertas', label: 'Abiertas' }, { value: 'todas', label: 'Todos los estados' }, ...['Emitida', 'Enviada', 'Recibida parcial', 'Recibida', 'Anulada'].map((e) => ({ value: e, label: e }))]} />
          <div className="relative ml-auto">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gris-claro" />
            <input className="campo !pl-8 !py-1.5 w-[260px]" placeholder="N°, proveedor, producto, factura…" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} />
          </div>
        </div>

        {!datos ? <Cargando /> : !lista.length ? (
          <Vacio icono={ShoppingCart} titulo="No hay órdenes con estos filtros">Probá con “Todos los estados”.</Vacio>
        ) : (
          <ul>
            {lista.map((o) => <FilaOC key={o.numero} o={o} abierta={abiertas.has(o.numero)} onAlternar={() => alternar(o.numero)} router={router} />)}
          </ul>
        )}

        {datos?.sueltas?.length > 0 && f.tipo !== 'solicitud' && (
          <div className="border-t border-linea px-4 py-4">
            <h3 className="font-bold text-[13px] mb-2">Recepciones sin OC</h3>
            <div className="flex flex-wrap gap-2">
              {datos.sueltas.map((r) => (
                <button key={r.numero} onClick={() => router.push('/compras/recepcion?numero=' + encodeURIComponent(r.numero))} className="rounded-lg border border-linea px-3 py-2 text-left hover:border-azul/40">
                  <div className="font-semibold text-[13px]">Recepción {r.numero}</div>
                  <div className="text-[12px] text-gris">{r.fecha} · {r.proveedor}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilaOC({ o, abierta, onAlternar, router }) {
  const sol = o.tipo === 'Solicitud de presupuesto';
  const pedido = o.items.reduce((s, x) => s + num(x.cant), 0);
  const recibido = o.items.reduce((s, x) => s + Math.min(num(x.recibido), num(x.cant)), 0);
  const pct = pedido ? Math.round((recibido / pedido) * 100) : 0;
  return (
    <li className="border-b border-linea last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-azul-50/60 cursor-pointer" onClick={onAlternar}>
        <span className="text-gris-claro">{abierta ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</span>
        <div className="min-w-[150px]">
          <div className="font-bold tnum">{sol ? 'Solicitud ' : 'OC '}{o.numero}</div>
          <div className="text-[12px] text-gris">{o.fecha}</div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="font-semibold">{o.proveedor}</div>
          <div className="text-[12px] text-gris truncate">{o.pedido || o.items.map((i) => i.desc).slice(0, 2).join(' · ')}</div>
        </div>
        {!sol && (
          <div className="w-[150px]">
            <div className="flex justify-between text-[11.5px] text-gris mb-1"><span>Recibido</span><span className="tnum">{recibido}/{pedido}</span></div>
            <div className="h-1.5 rounded-full bg-[#EEF0F4] overflow-hidden"><div className={cx('h-full rounded-full', pct >= 100 ? 'bg-ok' : 'bg-azul')} style={{ width: pct + '%' }} /></div>
          </div>
        )}
        {!sol && <div className="w-[130px] text-right font-bold tnum">{o.moneda === 'USD' ? 'USD ' : '$ '}{fmt(o.total)}</div>}
        <div className="w-[120px] flex justify-end"><Estado valor={o.estado} /></div>
      </div>

      {abierta && (
        <div className="px-4 pb-4 pl-11">
          <div className="grid xl:grid-cols-[1.4fr_1fr] gap-4">
            <div className="rounded-lg border border-linea overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead className="bg-azul-50 text-[10.5px] uppercase tracking-wider text-azul-osc">
                  <tr><th className="text-left px-3 py-2">Código</th><th className="text-left px-3 py-2">Descripción</th><th className="px-3 py-2">Pedido</th>{!sol && <><th className="px-3 py-2">Recibido</th><th className="px-3 py-2">Pendiente</th></>}</tr>
                </thead>
                <tbody>
                  {o.items.map((x) => (
                    <tr key={x.renglon} className="border-t border-linea">
                      <td className="px-3 py-1.5 font-semibold whitespace-nowrap">{x.codigo}</td>
                      <td className="px-3 py-1.5">{x.desc}</td>
                      <td className="px-3 py-1.5 text-center tnum">{x.cant}</td>
                      {!sol && <td className="px-3 py-1.5 text-center tnum">{num(x.recibido)}</td>}
                      {!sol && <td className={cx('px-3 py-1.5 text-center tnum font-semibold', num(x.pendiente) > 0 ? 'text-alerta' : 'text-ok')}>{num(x.pendiente) > 0 ? num(x.pendiente) : '✓'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2">
              {!sol && (
                <>
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-gris-claro">Recepciones</div>
                  {o.recepciones.map((r) => (
                    <div key={r.numero} className="flex items-center gap-3 rounded-lg border border-linea px-3 py-2 bg-white">
                      <PackageCheck size={16} className="text-ok shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[13px]">Recepción {r.numero} · {r.fecha}</div>
                        <div className="text-[12px] text-gris truncate">{[r.remitoProv && 'Rto ' + r.remitoProv, r.factura && 'Fact ' + r.factura, (r.items?.length || 0) + ' renglones'].filter(Boolean).join(' · ')}</div>
                      </div>
                      {r.pdf && <a href={r.pdf} target="_blank" rel="noreferrer" className="p-1.5 text-gris hover:text-azul" title="PDF"><FileText size={15} /></a>}
                      <Boton tam="sm" variante="ghost" onClick={() => router.push('/compras/recepcion?numero=' + encodeURIComponent(r.numero))}>Abrir</Boton>
                    </div>
                  ))}
                  {!o.recepciones.length && <div className="text-[13px] text-gris">Sin recepciones todavía.</div>}
                </>
              )}
              <div className="flex flex-wrap gap-2 mt-1">
                <Boton tam="sm" onClick={() => router.push('/compras/oc?numero=' + encodeURIComponent(o.numero))}>Abrir {sol ? 'solicitud' : 'OC'}</Boton>
                {o.pdf && <a href={o.pdf} target="_blank" rel="noreferrer"><Boton tam="sm" icono={FileText}>PDF</Boton></a>}
                {!sol && o.estado !== 'Recibida' && o.estado !== 'Anulada' && (
                  <Boton tam="sm" variante="suave" icono={PackagePlus} onClick={() => router.push('/compras/recepcion?oc=' + encodeURIComponent(o.numero))}>Nueva recepción</Boton>
                )}
              </div>
              {(o.paciente || o.rcc) && <div className="text-[12px] text-gris mt-1">Cirugía: {[o.paciente, o.fechaCx, o.rcc && 'RCC ' + o.rcc].filter(Boolean).join(' · ')}</div>}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
