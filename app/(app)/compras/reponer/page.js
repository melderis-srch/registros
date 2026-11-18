'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, PackagePlus, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { norm } from '@/lib/format';
import { Boton, Cargando, Selector, Vacio, cx } from '@/components/ui';

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><Reponer /></Suspense>;
}

const clave = (x) => `${x.numero}|${x.renglon}`;

function Reponer() {
  const router = useRouter();
  const sp = useSearchParams();
  const { avisar, cargarPendientes } = useApp();
  const [datos, setDatos] = useState(null);
  const [marcados, setMarcados] = useState(() => new Set());
  const [cant, setCant] = useState({});
  const [destino, setDestino] = useState({});
  const [pasando, setPasando] = useState('');

  const cargar = useCallback(() => api('getReposicion').then((d) => {
    setDatos(d);
    setMarcados(new Set([...d.rcc.map(clave)]));
    setCant(Object.fromEntries(d.stock.map((s) => [s.codigo, s.falta])));
  }).catch((e) => { avisar(e.message, 'err'); setDatos({ rcc: [], stock: [], emitidas: [] }); }), [avisar]);
  useEffect(() => { cargar(); }, [cargar]);

  const grupos = useMemo(() => {
    if (!datos) return [];
    const m = new Map();
    const g = (p) => { const k = norm(p); if (!m.has(k)) m.set(k, { prov: p, rcc: [], stock: [] }); return m.get(k); };
    datos.rcc.forEach((x) => g(x.proveedor).rcc.push(x));
    datos.stock.forEach((x) => g(x.proveedor || 'Sin proveedor').stock.push(x));
    const solo = sp.get('proveedor');
    return [...m.values()].sort((a, b) => (solo && norm(a.prov) === norm(solo) ? -1 : solo && norm(b.prov) === norm(solo) ? 1 : a.prov.localeCompare(b.prov)));
  }, [datos, sp]);

  const alternar = (k) => setMarcados((s) => { const x = new Set(s); x.has(k) ? x.delete(k) : x.add(k); return x; });

  async function pasar(gr) {
    const refs = gr.rcc.filter((x) => marcados.has(clave(x))).map((x) => ({ numero: x.numero, renglon: x.renglon }));
    const extras = gr.stock.filter((x) => marcados.has('s|' + x.codigo) && Number(cant[x.codigo]) > 0)
      .map((x) => ({ codigo: x.codigo, desc: x.desc, cant: Number(cant[x.codigo]), costo: x.costo }));
    if (!refs.length && !extras.length) return avisar('Marcá al menos un ítem.', 'err');
    setPasando(gr.prov);
    try {
      const r = await api('pasarAOC', destino[gr.prov] || '', gr.prov, refs, extras);
      avisar(`${r.sumados} ítems ${r.nueva ? 'en la OC nueva' : 'sumados a la OC'} ${r.numero}. Revisá precios y generá el PDF.`);
      cargarPendientes();
      router.push('/compras/oc?numero=' + encodeURIComponent(r.numero));
    } catch (e) {
      avisar(e.message, 'err');
      setPasando('');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button onClick={() => router.push('/compras')} className="p-2 rounded-lg text-gris hover:bg-white hover:text-azul" aria-label="Volver"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">Reponer pendientes</h1>
          <p className="text-gris mt-0.5">Lo consumido en cirugías que todavía no está en ninguna OC, y lo que quedó bajo el mínimo. Elegí qué mandar y a qué OC.</p>
        </div>
      </div>

      {!datos ? <Cargando /> : !grupos.length ? (
        <div className="bg-white rounded-xl border border-linea shadow-card"><Vacio icono={ShoppingCart} titulo="No hay nada para reponer">Todo lo consumido ya está en alguna OC y no hay productos bajo el mínimo.</Vacio></div>
      ) : (
        <div className="grid gap-4">
          {grupos.map((gr) => {
            const emitidas = datos.emitidas.filter((o) => norm(o.proveedor) === norm(gr.prov));
            const n = gr.rcc.filter((x) => marcados.has(clave(x))).length + gr.stock.filter((x) => marcados.has('s|' + x.codigo)).length;
            return (
              <section key={gr.prov} className="bg-white rounded-xl border border-linea shadow-card">
                <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-linea">
                  <h2 className="font-bold text-[15px] mr-auto">{gr.prov}</h2>
                  <Selector className="!w-auto !py-1.5" value={destino[gr.prov] || ''} onChange={(v) => setDestino({ ...destino, [gr.prov]: v })}
                    opciones={[{ value: '', label: 'OC nueva' }, ...emitidas.map((o) => ({ value: o.numero, label: `Sumar a OC ${o.numero} (${o.fecha})` }))]} />
                  <Boton variante="prim" icono={PackagePlus} onClick={() => pasar(gr)} cargando={pasando === gr.prov} disabled={!n || !!pasando}>Pasar {n || ''} a OC</Boton>
                </header>
                <table className="w-full text-[13px]">
                  <tbody>
                    {gr.rcc.map((x) => (
                      <tr key={clave(x)} className="border-b border-linea last:border-b-0 hover:bg-azul-50/50">
                        <td className="w-10 pl-5"><input type="checkbox" className="size-4 accent-[#2F55B0]" checked={marcados.has(clave(x))} onChange={() => alternar(clave(x))} aria-label="Incluir" /></td>
                        <td className="py-2 pr-3"><div className="font-semibold">{x.desc}</div><div className="text-[12px] text-gris">{x.codigo}</div></td>
                        <td className="py-2 pr-3 text-[12.5px] text-gris whitespace-nowrap">RCC <b className="text-tinta">{x.numero}</b> · {x.fechaCx} · {x.paciente}</td>
                        <td className="py-2 pr-5 text-right tnum font-bold w-16">{x.cant}</td>
                      </tr>
                    ))}
                    {gr.stock.map((x) => (
                      <tr key={'s' + x.codigo} className={cx('border-b border-linea last:border-b-0', marcados.has('s|' + x.codigo) ? 'bg-alerta-claro/40' : 'hover:bg-azul-50/50')}>
                        <td className="w-10 pl-5"><input type="checkbox" className="size-4 accent-[#2F55B0]" checked={marcados.has('s|' + x.codigo)} onChange={() => alternar('s|' + x.codigo)} aria-label="Incluir" /></td>
                        <td className="py-2 pr-3"><div className="font-semibold">{x.desc}</div><div className="text-[12px] text-gris">{x.codigo}</div></td>
                        <td className="py-2 pr-3 text-[12.5px] text-alerta whitespace-nowrap">Bajo mínimo: hay {x.disp}, mínimo {x.minimo}{x.pedido ? ` · ${x.pedido} ya en OC o por reponer` : ''}</td>
                        <td className="py-2 pr-5 text-right w-24"><input className="campo !py-1 text-right tnum" inputMode="numeric" value={cant[x.codigo] ?? ''} onChange={(e) => setCant({ ...cant, [x.codigo]: e.target.value })} aria-label="Cantidad" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
