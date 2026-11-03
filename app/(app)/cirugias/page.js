'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, List, Plus, Rows3, Search, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { DIAS, MESES, aDate, dmy, mismoDia, norm } from '@/lib/format';
import { Boton, Cargando, Casilla, Estado, cx } from '@/components/ui';
import FichaCirugia from '@/components/FichaCirugia';

const COLOR = {
  Programada: 'border-l-azul',
  Realizada: 'border-l-ok',
  Facturada: 'border-l-alerta',
  Suspendida: 'border-l-gris-claro opacity-60',
  'Dada de baja': 'border-l-gris-claro opacity-60',
};

function inicioSemana(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function sumarDias(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function Cirugias() {
  const { avisar } = useApp();
  const [cursor, setCursor] = useState(() => new Date());
  const [vista, setVista] = useState('mes');
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState({ texto: '', sinRemito: false, sinRegistro: false, ocultarSusp: false });
  const [ficha, setFicha] = useState(null);
  const [arrastrando, setArrastrando] = useState(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem('reg_vista');
      if (v) setVista(v);
      else if (window.innerWidth < 768) setVista('lista');
    } catch {}
  }, []);
  const cambiarVista = (v) => { setVista(v); try { localStorage.setItem('reg_vista', v); } catch {} };

  const dias = useMemo(() => {
    if (vista === 'semana') {
      const a = inicioSemana(cursor);
      return Array.from({ length: 7 }, (_, i) => sumarDias(a, i));
    }
    const primero = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
    const a = inicioSemana(primero);
    const ultimo = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12);
    const n = Math.ceil(((ultimo - a) / 864e5 + 1) / 7) * 7;
    return Array.from({ length: n }, (_, i) => sumarDias(a, i));
  }, [cursor, vista]);

  const cargar = useCallback(async () => {
    setLista(null);
    try {
      setLista(await api('getCirugias', dmy(dias[0]), dmy(dias[dias.length - 1])));
    } catch (e) {
      avisar(e.message, 'err');
      setLista([]);
    }
  }, [dias, avisar]);
  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    const q = norm(filtro.texto).split(' ').filter(Boolean);
    return (lista || []).filter((c) => {
      if (filtro.ocultarSusp && (c.estado === 'Suspendida' || c.estado === 'Dada de baja')) return false;
      if (filtro.sinRemito && (c.remito || c.docs?.remitos?.length)) return false;
      if (filtro.sinRegistro && (c.rcc || c.docs?.consumos?.length)) return false;
      if (q.length) {
        const t = norm([c.paciente, c.medico, c.institucion, c.obraSocial, c.procedimiento, c.rcc].join(' '));
        if (!q.every((w) => t.includes(w))) return false;
      }
      return true;
    });
  }, [lista, filtro]);

  const fechadas = visibles.filter((c) => !c.pendiente && c.fecha);
  const pendientes = visibles.filter((c) => c.pendiente || !c.fecha);
  const delMes = fechadas.filter((c) => { const d = aDate(c.fecha); return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear(); });
  const activas = delMes.filter((c) => c.estado !== 'Suspendida' && c.estado !== 'Dada de baja');

  const kpis = [
    { label: vista === 'semana' ? 'Cirugías en la semana' : 'Cirugías en el mes', valor: vista === 'semana' ? fechadas.length : activas.length, icono: CalendarDays },
    { label: 'Sin remito', valor: activas.filter((c) => !c.remito && !c.docs?.remitos?.length && aDate(c.fecha) >= sumarDias(new Date(), -1)).length, icono: Truck, hint: 'desde hoy' },
    { label: 'Realizadas sin registro', valor: activas.filter((c) => aDate(c.fecha) < new Date() && !c.rcc && !c.docs?.consumos?.length).length, icono: ClipboardList },
    { label: 'Pendientes sin fecha', valor: pendientes.length, icono: CalendarClock },
  ];

  function mover(dir) {
    const d = new Date(cursor);
    if (vista === 'semana') d.setDate(d.getDate() + 7 * dir);
    else d.setMonth(d.getMonth() + dir, 1);
    setCursor(d);
  }

  async function soltar(dia) {
    const c = arrastrando;
    setArrastrando(null);
    if (!c) return;
    const fecha = dia ? dmy(dia) : '';
    if (fecha === c.fecha) return;
    setLista((l) => l.map((x) => (x.id === c.id ? { ...x, fecha, pendiente: !fecha } : x)));
    try {
      await api('guardarCirugia', { ...c, fecha });
      avisar(fecha ? `${c.paciente} pasó al ${fecha}.` : `${c.paciente} quedó sin fecha.`);
    } catch (e) {
      avisar(e.message, 'err');
      cargar();
    }
  }

  function guardada(g) {
    setLista((l) => {
      const ex = l.find((x) => x.id === g.id);
      return ex ? l.map((x) => (x.id === g.id ? { ...x, ...g } : x)) : [...l, { ...g, docs: { consumos: [], remitos: [], ocs: [] } }];
    });
    setFicha((f) => (f ? { ...f, ...g } : f));
  }

  const titulo = vista === 'semana'
    ? `${dias[0].getDate()} ${MESES[dias[0].getMonth()].slice(0, 3)} – ${dias[6].getDate()} ${MESES[dias[6].getMonth()].slice(0, 3)} ${dias[6].getFullYear()}`
    : `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const porDia = (d) => fechadas.filter((c) => mismoDia(aDate(c.fecha), d));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">Cirugías</h1>
          <p className="text-gris mt-0.5">Desde el Seguimiento de cirugías. Tocá una para ver su ficha y emitir remito o registro.</p>
        </div>
        <Boton variante="prim" icono={Plus} onClick={() => setFicha({ fecha: '' })}>Nueva cirugía</Boton>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-linea shadow-card px-4 py-3.5 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-azul-claro text-azul grid place-items-center"><k.icono size={19} /></div>
            <div>
              <div className="text-[22px] font-extrabold leading-none tnum">{lista ? k.valor : '–'}</div>
              <div className="text-gris text-[12px] mt-1">{k.label}{k.hint ? <span className="text-gris-claro"> · {k.hint}</span> : null}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-linea shadow-card">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-linea">
          <div className="flex items-center gap-1">
            <button onClick={() => mover(-1)} className="p-1.5 rounded-lg hover:bg-azul-claro text-gris" aria-label="Anterior"><ChevronLeft size={18} /></button>
            <button onClick={() => mover(1)} className="p-1.5 rounded-lg hover:bg-azul-claro text-gris" aria-label="Siguiente"><ChevronRight size={18} /></button>
          </div>
          <h2 className="text-[16px] font-bold capitalize min-w-[150px]">{titulo}</h2>
          <Boton tam="sm" variante="ghost" onClick={() => setCursor(new Date())}>Hoy</Boton>
          <div className="relative ml-auto">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gris-claro" />
            <input className="campo !pl-8 !py-1.5 w-[220px]" placeholder="Buscar paciente, médico…" value={filtro.texto} onChange={(e) => setFiltro({ ...filtro, texto: e.target.value })} />
          </div>
          <div className="flex rounded-lg border border-linea p-0.5 bg-azul-50">
            {[['mes', 'Mes', CalendarDays], ['semana', 'Semana', Rows3], ['lista', 'Lista', List]].map(([v, l, I]) => (
              <button key={v} onClick={() => cambiarVista(v)} className={cx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12.5px] font-semibold', vista === v ? 'bg-white shadow-sm text-azul-osc' : 'text-gris')}>
                <I size={14} /> {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2 border-b border-linea text-[12.5px] text-gris">
          <Casilla label="Sin remito" checked={filtro.sinRemito} onChange={(v) => setFiltro({ ...filtro, sinRemito: v })} />
          <Casilla label="Sin registro de consumo" checked={filtro.sinRegistro} onChange={(v) => setFiltro({ ...filtro, sinRegistro: v })} />
          <Casilla label="Ocultar suspendidas" checked={filtro.ocultarSusp} onChange={(v) => setFiltro({ ...filtro, ocultarSusp: v })} />
          <span className="ml-auto hidden md:flex items-center gap-3">
            <Leyenda c="bg-azul" t="Programada" /><Leyenda c="bg-ok" t="Realizada" /><Leyenda c="bg-alerta" t="Facturada" /><Leyenda c="bg-gris-claro" t="Suspendida" />
          </span>
        </div>

        {!lista ? (
          <Cargando texto="Leyendo el Seguimiento de cirugías…" />
        ) : (
          <div className="flex flex-col xl:flex-row">
            <div className="flex-1 min-w-0">
              {vista === 'lista' ? (
                <VistaLista lista={fechadas.filter((c) => vista !== 'lista' || delMes.includes(c))} onAbrir={setFicha} />
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-7 border-b border-linea">
                      {DIAS.map((d) => <div key={d} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gris-claro">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7">
                      {dias.map((d, i) => {
                        const fuera = vista === 'mes' && d.getMonth() !== cursor.getMonth();
                        const esHoy = mismoDia(d, new Date());
                        const cs = porDia(d);
                        return (
                          <div
                            key={i}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => soltar(d)}
                            onDoubleClick={() => setFicha({ fecha: dmy(d) })}
                            className={cx('border-b border-r border-linea p-1.5 flex flex-col gap-1', vista === 'semana' ? 'min-h-[420px]' : 'min-h-[128px]', fuera && 'bg-[#FAFBFD]', (i + 1) % 7 === 0 && 'border-r-0')}
                          >
                            <div className="flex items-center justify-between px-1">
                              <span className={cx('text-[12px] font-bold tnum', esHoy ? 'bg-azul text-white rounded-full size-6 grid place-items-center' : fuera ? 'text-gris-claro' : 'text-gris')}>{d.getDate()}</span>
                              <button onClick={() => setFicha({ fecha: dmy(d) })} className="opacity-0 hover:opacity-100 focus:opacity-100 text-gris-claro hover:text-azul p-0.5" aria-label="Agregar"><Plus size={14} /></button>
                            </div>
                            <div className={cx('flex flex-col gap-1 overflow-y-auto scroll-fino', vista === 'mes' && 'max-h-[150px]')}>
                              {cs.map((c) => <TarjetaCx key={c.id} c={c} onAbrir={() => setFicha(c)} onArrastrar={() => setArrastrando(c)} completa={vista === 'semana'} />)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <aside
              className="xl:w-[270px] border-t xl:border-t-0 xl:border-l border-linea bg-azul-50/60"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltar(null)}
            >
              <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
                <h3 className="font-bold text-[13px]">Sin fecha <span className="text-gris font-semibold">({pendientes.length})</span></h3>
              </div>
              <p className="px-4 text-[12px] text-gris-claro mb-2">Arrastrá una al calendario para programarla.</p>
              <div className="px-3 pb-4 flex flex-col gap-1.5 max-h-[560px] overflow-y-auto scroll-fino">
                {pendientes.map((c) => <TarjetaCx key={c.id} c={c} completa onAbrir={() => setFicha(c)} onArrastrar={() => setArrastrando(c)} />)}
                {!pendientes.length && <div className="text-[12.5px] text-gris px-1">No hay cirugías sin fecha.</div>}
              </div>
            </aside>
          </div>
        )}
      </div>

      <FichaCirugia cirugia={ficha} onCerrar={() => setFicha(null)} onGuardada={guardada} />
    </div>
  );
}

function Leyenda({ c, t }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cx('size-2 rounded-full', c)} />{t}</span>;
}

function TarjetaCx({ c, onAbrir, onArrastrar, completa }) {
  const remito = !!(c.remito || c.docs?.remitos?.length);
  const registro = !!(c.rcc || c.docs?.consumos?.length);
  return (
    <button
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onArrastrar(); }}
      onClick={onAbrir}
      className={cx('text-left w-full bg-white border border-linea border-l-[3px] rounded-md px-2 py-1.5 hover:shadow-md hover:border-azul/30 transition cursor-pointer', COLOR[c.estado] || 'border-l-azul')}
    >
      <div className="text-[12px] font-bold truncate">{c.paciente || '(sin paciente)'}</div>
      <div className="text-[11px] text-gris truncate">{c.medico}</div>
      {completa && <div className="text-[11px] text-gris truncate">{c.procedimiento}</div>}
      {completa && c.institucion && <div className="text-[11px] text-gris-claro truncate">{c.institucion}</div>}
      <div className="flex items-center gap-1 mt-1">
        <Chip ok={remito} t="R" titulo={remito ? 'Remito emitido' : 'Sin remito'} />
        <Chip ok={registro} t="C" titulo={registro ? 'Registro de consumo emitido' : 'Sin registro de consumo'} />
        {c.estado === 'Suspendida' && <span className="text-[10px] font-semibold text-gris ml-1">Suspendida</span>}
      </div>
    </button>
  );
}

function Chip({ ok, t, titulo }) {
  return (
    <span title={titulo} className={cx('inline-grid place-items-center size-[18px] rounded text-[10px] font-extrabold', ok ? 'bg-ok-claro text-ok' : 'bg-[#EEF0F4] text-gris-claro')}>{t}</span>
  );
}

function VistaLista({ lista, onAbrir }) {
  const orden = [...lista].sort((a, b) => aDate(a.fecha) - aDate(b.fecha));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-gris-claro border-b border-linea">
            {['Fecha', 'Paciente', 'Médico', 'Institución', 'Procedimiento', 'Obra social', 'Docs', 'Estado'].map((h) => <th key={h} className="px-4 py-2.5 font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {orden.map((c) => (
            <tr key={c.id} onClick={() => onAbrir(c)} className="border-b border-linea hover:bg-azul-50 cursor-pointer">
              <td className="px-4 py-2.5 tnum whitespace-nowrap">{c.fecha}</td>
              <td className="px-4 py-2.5 font-semibold">{c.paciente}</td>
              <td className="px-4 py-2.5">{c.medico}</td>
              <td className="px-4 py-2.5">{c.institucion}</td>
              <td className="px-4 py-2.5 max-w-[260px] truncate">{c.procedimiento}</td>
              <td className="px-4 py-2.5">{c.obraSocial}</td>
              <td className="px-4 py-2.5"><div className="flex gap-1"><Chip ok={!!(c.remito || c.docs?.remitos?.length)} t="R" /><Chip ok={!!(c.rcc || c.docs?.consumos?.length)} t="C" /></div></td>
              <td className="px-4 py-2.5"><Estado valor={c.estado} /></td>
            </tr>
          ))}
          {!orden.length && <tr><td colSpan={8} className="text-center text-gris py-10">No hay cirugías en este mes.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
