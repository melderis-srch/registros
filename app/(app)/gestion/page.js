'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Boxes, PackageOpen, RefreshCw, ShoppingCart, Stethoscope, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { MESES, dmy, dmyAIso, isoADmy, norm } from '@/lib/format';
import { Boton, Cargando, cx } from '@/components/ui';

const pesos = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const ent = (n) => (Number(n) || 0).toLocaleString('es-AR');
const mesTxt = (k) => { const [y, m] = k.split('-'); return `${MESES[+m - 1].slice(0, 3)} ${y.slice(2)}`; };

function periodo(clave) {
  const h = new Date(), y = h.getFullYear(), m = h.getMonth();
  if (clave === 'mes') return [new Date(y, m, 1), h];
  if (clave === 'pasado') return [new Date(y, m - 1, 1), new Date(y, m, 0)];
  if (clave === 'tres') return [new Date(y, m - 2, 1), h];
  if (clave === 'anio') return [new Date(y, 0, 1), h];
  return null;
}
const PERIODOS = [['mes', 'Este mes'], ['pasado', 'Mes pasado'], ['tres', 'Últimos 3 meses'], ['anio', 'Este año']];

export default function Gestion() {
  const router = useRouter();
  const { avisar } = useApp();
  const [per, setPer] = useState('tres');
  const [rango, setRango] = useState(() => periodo('tres').map(dmy));
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [tab, setTab] = useState('stock');

  const cargar = useCallback(async (desde, hasta) => {
    setCargando(true);
    try { setD(await api('getGestion', desde, hasta)); } catch (e) { avisar(e.message, 'err'); }
    setCargando(false);
  }, [avisar]);
  useEffect(() => { cargar(rango[0], rango[1]); }, [rango, cargar]);

  const elegir = (k) => { setPer(k); setRango(periodo(k).map(dmy)); };
  const k = d?.kpis;

  const KPIS = k ? [
    { id: 'stock', icono: Boxes, tit: 'Stock', valor: ent(k.stockUnidades) + ' u.', sub: `${pesos(k.stockArs)} · ${k.productos} productos`, alerta: k.sinStock ? `${k.sinStock} sin stock · ${k.bajoMin} bajo mínimo` : k.bajoMin ? `${k.bajoMin} bajo mínimo` : '' },
    { id: 'camino', icono: Truck, tit: 'En camino', valor: ent(k.enCaminoUnidades) + ' u.', sub: `${pesos(k.enCaminoArs)} · ${k.ocAbiertas} OC abiertas`, alerta: k.llego ? `${k.llego} OC llegaron sin recepción` : '' },
    { id: 'sinIngresar', icono: PackageOpen, tit: 'Recibido sin ingresar', valor: ent(k.sinIngresar), sub: 'renglones de recepción que no están en el kardex', alerta: k.sinIngresar ? 'Revisar' : '' },
    { id: 'consumo', icono: Stethoscope, tit: 'Consumido en el período', valor: ent(k.consumoUnidades) + ' u.', sub: `${pesos(k.consumoArs)} · ${k.cirugias} cirugías` },
    { id: 'reponer', icono: ShoppingCart, tit: 'Pendiente de reponer', valor: ent(k.reponerUnidades) + ' u.', sub: `${pesos(k.reponerArs)} · consumido sin OC` },
  ] : [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">Gestión</h1>
          <p className="text-gris mt-0.5">Qué tenemos, qué viene en camino, qué se consumió y qué falta reponer. {d && <>Montos a costo de lista, USD a {pesos(d.tc)}.{d.kardexLeido ? ` Kardex leído ${d.kardexLeido}.` : ''}</>}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-linea p-0.5 bg-azul-50">
            {PERIODOS.map(([v, l]) => (
              <button key={v} onClick={() => elegir(v)} className={cx('px-2.5 py-1 rounded-md text-[12.5px] font-semibold', per === v ? 'bg-white shadow-sm text-azul-osc' : 'text-gris')}>{l}</button>
            ))}
          </div>
          <input type="date" className="campo !w-auto !py-1" value={dmyAIso(rango[0])} onChange={(e) => { setPer(''); setRango([isoADmy(e.target.value), rango[1]]); }} aria-label="Desde" />
          <input type="date" className="campo !w-auto !py-1" value={dmyAIso(rango[1])} onChange={(e) => { setPer(''); setRango([rango[0], isoADmy(e.target.value)]); }} aria-label="Hasta" />
          <Boton icono={RefreshCw} onClick={() => cargar(rango[0], rango[1])} cargando={cargando}>Actualizar</Boton>
        </div>
      </div>

      {!d ? <Cargando texto="Calculando totales…" /> : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
            {KPIS.map((x) => (
              <button key={x.id} onClick={() => setTab(x.id)} className={cx('text-left bg-white rounded-xl border shadow-card p-4 transition', tab === x.id ? 'border-azul ring-2 ring-azul/15' : 'border-linea hover:border-azul/40')}>
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-gris"><x.icono size={15} /> {x.tit}</div>
                <div className="text-[26px] font-extrabold tnum mt-1 leading-none">{x.valor}</div>
                <div className="text-[12.5px] text-gris mt-1.5">{x.sub}</div>
                {x.alerta && <div className="text-[12px] text-err font-semibold mt-1 flex items-center gap-1"><AlertTriangle size={13} /> {x.alerta}</div>}
              </button>
            ))}
          </div>

          <section className="bg-white rounded-xl border border-linea shadow-card">
            {tab === 'stock' && <Stock d={d} router={router} />}
            {tab === 'camino' && <EnCamino d={d} router={router} />}
            {tab === 'sinIngresar' && <SinIngresar d={d} router={router} recargar={() => cargar(rango[0], rango[1])} avisar={avisar} />}
            {tab === 'consumo' && <Consumo d={d} />}
            {tab === 'reponer' && <Reponer d={d} router={router} />}
          </section>
        </>
      )}
    </div>
  );
}

function Tabla({ head, rows, total, onRow, alinear = [] }) {
  return (
    <div className="overflow-x-auto scroll-fino">
      <table className="w-full text-[13px]">
        <thead className="bg-azul-50 text-[10.5px] uppercase tracking-wider text-azul-osc">
          <tr>{head.map((h, i) => <th key={h} className={cx('px-4 py-2 font-bold whitespace-nowrap', alinear[i] === 'r' ? 'text-right' : 'text-left')}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} onClick={() => onRow?.(i)} className={cx('border-t border-linea', onRow && 'cursor-pointer hover:bg-azul-50/70')}>
              {r.map((c, j) => <td key={j} className={cx('px-4 py-1.5 align-top', alinear[j] === 'r' && 'text-right tnum whitespace-nowrap', j === 0 && 'font-semibold')}>{c}</td>)}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={head.length} className="px-4 py-8 text-center text-gris">Nada para mostrar.</td></tr>}
        </tbody>
        {total && rows.length > 0 && (
          <tfoot><tr className="border-t-2 border-tinta/20 bg-azul-50/60 font-bold">{total.map((c, j) => <td key={j} className={cx('px-4 py-2', alinear[j] === 'r' && 'text-right tnum whitespace-nowrap')}>{c}</td>)}</tr></tfoot>
        )}
      </table>
    </div>
  );
}

function Cab({ titulo, sub, children }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-linea">
      <div><h2 className="font-bold text-[16px]">{titulo}</h2>{sub && <p className="text-[13px] text-gris mt-0.5">{sub}</p>}</div>
      {children}
    </header>
  );
}

const sum = (l, f) => l.reduce((s, x) => s + (Number(x[f]) || 0), 0);

function Stock({ d, router }) {
  const [q, setQ] = useState('');
  const [prov, setProv] = useState('');
  const lista = useMemo(() => d.stock.filter((x) => (!prov || x.proveedor === prov) && norm(x.desc + ' ' + x.codigo).includes(norm(q))), [d, q, prov]);
  return (
    <>
      <Cab titulo="Stock por proveedor" sub="Unidades disponibles en el kardex y su valor a costo. Tocá un proveedor para ver sus productos." />
      <Tabla head={['Proveedor', 'Productos', 'Unidades', 'Valor', 'Bajo mínimo']} alinear={['', 'r', 'r', 'r', 'r']}
        rows={d.stockProv.map((g) => [g.proveedor, ent(g.productos), ent(g.unidades), pesos(g.valorArs), g.bajoMin ? <span className="text-err font-semibold">{g.bajoMin}</span> : '—'])}
        total={['Total', ent(sum(d.stockProv, 'productos')), ent(sum(d.stockProv, 'unidades')), pesos(sum(d.stockProv, 'valorArs')), ent(sum(d.stockProv, 'bajoMin'))]}
        onRow={(i) => setProv(d.stockProv[i].proveedor === prov ? '' : d.stockProv[i].proveedor)} />
      <Cab titulo={`Productos${prov ? ' · ' + prov : ''}`} sub="Tocá un producto para ver sus lotes y movimientos.">
        <input className="campo !w-64 !py-1.5" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
      </Cab>
      <Tabla head={['Producto', 'Proveedor', 'Disp.', 'Mín.', 'Lotes', 'Valor']} alinear={['', '', 'r', 'r', 'r', 'r']}
        rows={lista.map((x) => [<span key="d">{x.desc}<span className="block text-[11.5px] text-gris font-normal">{x.codigo}</span></span>, x.proveedor,
          <span key="u" className={x.minimo > 0 && x.disp < x.minimo ? 'text-err font-bold' : ''}>{ent(x.disp)}</span>, x.minimo || '—', x.lotes, pesos(x.valorArs)])}
        total={['Total', '', ent(sum(lista, 'disp')), '', '', pesos(sum(lista, 'valorArs'))]}
        onRow={(i) => router.push('/stock?codigo=' + encodeURIComponent(lista[i].codigo))} />
    </>
  );
}

function EnCamino({ d, router }) {
  return (
    <>
      <Cab titulo="Pendiente de llegar" sub="Renglones de OC enviadas (o que llegaron en parte) que todavía no se recibieron. Tocá para abrir la OC." />
      <Tabla head={['OC', 'Fecha', 'Hace', 'Proveedor', 'Producto', 'Pedido', 'Recibido', 'Falta', 'Valor']} alinear={['', '', 'r', '', '', 'r', 'r', 'r', 'r']}
        rows={d.enCamino.map((x) => [x.oc, x.fecha, <span key="d" className={x.dias > 15 ? 'text-err font-semibold' : ''}>{x.dias} d</span>, x.proveedor + (x.estado === 'Llegó' ? ' · llegó' : ''), x.desc, ent(x.pedido), ent(x.recibido), <b key="f">{ent(x.falta)}</b>, pesos(x.valorArs)])}
        total={['Total', '', '', '', '', ent(sum(d.enCamino, 'pedido')), ent(sum(d.enCamino, 'recibido')), ent(sum(d.enCamino, 'falta')), pesos(sum(d.enCamino, 'valorArs'))]}
        onRow={(i) => router.push('/compras/oc?numero=' + encodeURIComponent(d.enCamino[i].oc))} />
    </>
  );
}

function SinIngresar({ d, router, recargar, avisar }) {
  const [ocupado, setOcupado] = useState(false);
  const recs = [...new Set(d.sinIngresar.map((x) => x.numero))];
  async function reintentar() {
    setOcupado(true);
    let ok = 0; const errs = [];
    for (const n of recs) { try { const r = await api('reingresarKardex', n); ok += r?.ok || 0; (r?.errores || []).forEach((e) => errs.push(e)); } catch (e) { errs.push(n + ': ' + e.message); } }
    avisar(errs.length ? `Ingresé ${ok}. Revisá: ${errs.slice(0, 3).join(' · ')}` : `Listo: ${ok} renglones ingresados al kardex.`, errs.length ? 'err' : 'ok');
    setOcupado(false); recargar();
  }
  return (
    <>
      <Cab titulo="Recibido sin ingresar al kardex" sub="Tiene recepción cargada pero no se pudo escribir en la planilla del producto (pestaña inexistente, planilla sin permiso…).">
        {recs.length > 0 && <Boton variante="prim" onClick={reintentar} cargando={ocupado}>Reintentar ingreso</Boton>}
      </Cab>
      <Tabla head={['Recepción', 'Fecha', 'Proveedor', 'Producto', 'Lote', 'Cant.']} alinear={['', '', '', '', '', 'r']}
        rows={d.sinIngresar.map((x) => [x.numero, x.fecha, x.proveedor, x.desc, x.lote, ent(x.cant)])}
        onRow={(i) => router.push('/compras/recepcion?numero=' + encodeURIComponent(d.sinIngresar[i].numero))} />
    </>
  );
}

function Consumo({ d }) {
  const [vista, setVista] = useState('productos');
  const VISTAS = [['productos', 'Por producto'], ['medicos', 'Por médico'], ['instituciones', 'Por institución'], ['meses', 'Por mes']];
  const l = d.consumo[vista];
  const max = Math.max(1, ...l.map((x) => x.ars));
  return (
    <>
      <Cab titulo={`Consumido del ${d.desde} al ${d.hasta}`} sub="Lo cargado en los registros de consumo (RCC) de las cirugías del período.">
        <div className="flex rounded-lg border border-linea p-0.5 bg-azul-50">
          {VISTAS.map(([v, t]) => <button key={v} onClick={() => setVista(v)} className={cx('px-2.5 py-1 rounded-md text-[12.5px] font-semibold', vista === v ? 'bg-white shadow-sm text-azul-osc' : 'text-gris')}>{t}</button>)}
        </div>
      </Cab>
      <Tabla head={[vista === 'productos' ? 'Producto' : vista === 'medicos' ? 'Médico' : vista === 'instituciones' ? 'Institución' : 'Mes', vista === 'productos' ? 'Proveedor' : '', 'Cirugías', 'Unidades', 'Costo', '']}
        alinear={['', '', 'r', 'r', 'r', '']}
        rows={l.map((x) => [vista === 'productos' ? x.desc : vista === 'meses' ? mesTxt(x.mes) : x.nombre, vista === 'productos' ? x.proveedor || '' : '', ent(x.cirugias), ent(x.unidades), pesos(x.ars),
          <div key="b" className="w-32 h-2 rounded bg-azul-50"><div className="h-2 rounded bg-azul" style={{ width: `${(x.ars / max) * 100}%` }} /></div>])}
        total={['Total', '', ent(d.kpis.cirugias), ent(sum(l, 'unidades')), pesos(sum(l, 'ars')), '']} />
    </>
  );
}

function Reponer({ d, router }) {
  return (
    <>
      <Cab titulo="Pendiente de reponer" sub="Consumido en cirugías que todavía no está en ninguna OC, por proveedor. Tocá para armar la OC.">
        <Boton variante="prim" icono={ShoppingCart} onClick={() => router.push('/compras/reponer')}>Reponer pendientes</Boton>
      </Cab>
      <Tabla head={['Proveedor', 'Renglones', 'Unidades', 'RCC', 'Más viejo', 'Valor']} alinear={['', 'r', 'r', 'r', 'r', 'r']}
        rows={d.reponer.map((x) => [x.proveedor, ent(x.items), ent(x.unidades), ent(x.rcc), `${x.masViejo} d`, pesos(x.ars)])}
        total={['Total', ent(sum(d.reponer, 'items')), ent(sum(d.reponer, 'unidades')), '', '', pesos(sum(d.reponer, 'ars'))]}
        onRow={(i) => router.push('/compras/reponer?proveedor=' + encodeURIComponent(d.reponer[i].proveedor))} />
    </>
  );
}

