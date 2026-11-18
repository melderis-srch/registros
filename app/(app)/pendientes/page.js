'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { Boton, Cargando, cx } from '@/components/ui';

const NUM = { rojo: 'text-err', ambar: 'text-alerta', azul: 'text-azul' };

export default function Pendientes() {
  const router = useRouter();
  const { pendientes, cargarPendientes, avisar } = useApp();
  const [sel, setSel] = useState(null);
  const [soloUrg, setSoloUrg] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [progreso, setProgreso] = useState(null);

  const alertas = pendientes?.alertas || [];
  const abiertas = useMemo(() => alertas.filter((a) => a.n && (!soloUrg || a.urg || (a.nivel === 'rojo' && a.n))), [alertas, soloUrg]);
  const al = abiertas.find((a) => a.key === sel) || abiertas[0];
  const urgentes = alertas.reduce((s, a) => s + (a.urg || 0), 0);

  async function actualizar() {
    setActualizando(true);
    await cargarPendientes();
    setActualizando(false);
  }

  async function ejecutar(acc) {
    if (acc.href) return router.push(acc.href);
    if (acc.accion === 'reingresar') {
      let ok = 0; const errs = [];
      for (let i = 0; i < acc.refs.length; i++) {
        setProgreso({ i: i + 1, n: acc.refs.length });
        try { const r = await api('reingresarKardex', acc.refs[i]); ok += r?.ok || 0; (r?.errores || []).forEach((e) => errs.push(e)); } catch (e) { errs.push(acc.refs[i] + ' · ' + e.message); }
      }
      setProgreso(null);
      avisar(errs.length ? `Ingresé ${ok}. Revisá: ${errs.slice(0, 3).join(' | ')}` : `Listo: ${ok} renglones ingresados al kardex.`, errs.length ? 'err' : 'ok');
      return cargarPendientes();
    }
    if (acc.accion === 'bajaTanda') {
      let ok = 0; const errs = [];
      for (let i = 0; i < acc.refs.length; i++) {
        setProgreso({ i: i + 1, n: acc.refs.length });
        try {
          const r = await api('darBajaConsumo', acc.refs[i]);
          ok += r.ok;
          r.errores.forEach((e) => errs.push(acc.refs[i] + ' · ' + e));
        } catch (e) { errs.push(acc.refs[i] + ' · ' + e.message); }
      }
      setProgreso(null);
      avisar(errs.length ? `Di de baja ${ok} productos. Revisá: ${errs.slice(0, 4).join(' | ')}${errs.length > 4 ? ` y ${errs.length - 4} más` : ''}` : `Listo: ${ok} productos dados de baja en el kardex.`, errs.length ? 'err' : 'ok');
      cargarPendientes();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">Pendientes</h1>
          <p className="text-gris mt-0.5">
            {pendientes ? <>{abiertas.length} temas abiertos{urgentes ? <> · <b className="text-err">{urgentes} urgentes</b></> : null}{pendientes.leido ? <> · kardex leído {pendientes.leido}</> : null}</> : 'Revisando las planillas…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-lg border border-linea p-0.5 bg-azul-50">
            {[[false, 'Todo'], [true, 'Urgente']].map(([v, l]) => (
              <button key={l} onClick={() => setSoloUrg(v)} className={cx('px-3 py-1 rounded-md text-[12.5px] font-semibold', soloUrg === v ? 'bg-white shadow-sm text-azul-osc' : 'text-gris')}>{l}</button>
            ))}
          </div>
          <Boton icono={RefreshCw} onClick={actualizar} cargando={actualizando}>Actualizar</Boton>
        </div>
      </div>

      {!pendientes ? <Cargando texto="Revisando cirugías, compras y kardex…" /> : pendientes.error ? (
        <div className="bg-white border border-err/30 rounded-xl p-6 text-err">{pendientes.error}</div>
      ) : !abiertas.length ? (
        <div className="bg-white rounded-xl border border-linea shadow-card p-10 text-center">
          <CheckCircle2 className="mx-auto text-ok mb-2" size={28} />
          <div className="font-semibold">{soloUrg ? 'Nada urgente.' : 'Todo al día. No hay nada pendiente.'}</div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[330px_1fr] gap-5 items-start">
          <div className="bg-white rounded-xl border border-linea shadow-card overflow-hidden">
            {abiertas.map((a) => (
              <button key={a.key} onClick={() => setSel(a.key)} className={cx('w-full flex items-center gap-3 px-4 py-3 text-left border-b border-linea last:border-b-0 border-l-[3px]', a.key === al.key ? 'bg-azul-50 border-l-azul' : 'border-l-transparent hover:bg-azul-50/60')}>
                <span className={cx('text-[22px] font-extrabold tnum w-10 text-right shrink-0', NUM[a.nivel])}>{a.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[13.5px] leading-tight">{a.tit}</span>
                  <span className={cx('block text-[12px] mt-0.5 truncate', a.urg ? 'text-err font-semibold' : 'text-gris')}>{a.urg ? `${a.urg} urgente${a.urg > 1 ? 's' : ''}` : a.sub}</span>
                </span>
                <ChevronRight size={16} className="text-gris-claro shrink-0" />
              </button>
            ))}
            {!soloUrg && alertas.some((a) => !a.n) && (
              <div className="px-4 py-3 bg-azul-50/50 text-[12px] text-gris">
                <span className="font-semibold text-ok">Al día: </span>{alertas.filter((a) => !a.n).map((a) => a.tit).join(' · ')}
              </div>
            )}
          </div>

          <section className="bg-white rounded-xl border border-linea shadow-card">
            <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-linea">
              <div>
                <h2 className="font-bold text-[16px]">{al.tit} · {al.n}</h2>
                <p className="text-[13px] text-gris mt-0.5">{al.sub}{al.rows.some((r) => r.href) ? ' Tocá una fila para ir.' : ''}</p>
              </div>
              {al.accion && (
                <Boton variante="prim" onClick={() => ejecutar(al.accion)} cargando={!!progreso} disabled={al.accion.refs && !al.accion.refs.length}>
                  {progreso ? `${progreso.i} de ${progreso.n}…` : al.accion.label}
                </Boton>
              )}
            </header>
            {al.rows.length > 0 && (
              <div className="overflow-x-auto scroll-fino">
                <table className="w-full text-[13px]">
                  <thead className="bg-azul-50 text-[10.5px] uppercase tracking-wider text-azul-osc">
                    <tr>{al.head.map((h) => <th key={h} className="text-left px-4 py-2 font-bold whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {al.rows.map((r, i) => (
                      <tr key={i} onClick={() => r.href && router.push(r.href)} className={cx('border-t border-linea', r.href && 'cursor-pointer hover:bg-azul-50/70')}>
                        {r.c.map((c, j) => <td key={j} className={cx('px-4 py-2 align-top', j === 0 && 'font-semibold whitespace-nowrap', r.bad && j < 3 && 'text-err', j > 0 && j < 3 && 'whitespace-nowrap')}>{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
