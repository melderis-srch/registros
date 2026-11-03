'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CopyPlus, Eye, FileText, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { blobABase64, crearPdf, nombreArchivo } from '@/lib/pdf';
import { Boton, Cargando, Estado, Selector } from '@/components/ui';

/**
 * Marco común de los editores de documentos.
 * - tipo: consumo | remito | oc | recepcion
 * - cargar(): Promise<{cab, items, cirugia?, extra?}>  (documento existente o nuevo prefijado)
 * - validar(cab, items): string[] con lo que falta
 * - preparar(cab, items): {cab, items} listos para guardar (cálculos)
 * - children({cab, setCab, items, setItems, extra, numero, guardado}) → formulario
 * - acciones({...}) → botones extra en la barra
 * - volver: ruta de "volver"
 */
export default function Documento({ tipo, titulo, cargar, validar, preparar, estados, volver, acciones, children }) {
  const router = useRouter();
  const { inicio, actualizar, avisar } = useApp();
  const [estado, setEstado] = useState({ cargando: true });
  const [cab, setCabRaw] = useState({});
  const [items, setItemsRaw] = useState([]);
  const [numero, setNumero] = useState('');
  const [cirugia, setCirugia] = useState(null);
  const [extra, setExtra] = useState(null);
  const [ocupado, setOcupado] = useState('');
  const [sucio, setSucio] = useState(false);

  useEffect(() => {
    let vivo = true;
    cargar()
      .then((d) => {
        if (!vivo) return;
        setCabRaw(d.cab || {});
        setItemsRaw(d.items || []);
        setNumero(d.numero || '');
        setCirugia(d.cirugia || null);
        setExtra(d.extra || null);
        setEstado({});
      })
      .catch((e) => vivo && setEstado({ error: e.message }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const f = (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [sucio]);

  const setCab = (f) => { setCabRaw((c) => (typeof f === 'function' ? f(c) : { ...c, ...f })); setSucio(true); };
  const setItems = (f) => { setItemsRaw((x) => (typeof f === 'function' ? f(x) : f)); setSucio(true); };

  const esSolicitud = tipo === 'oc' && cab.tipo === 'Solicitud de presupuesto';
  const serie = esSolicitud ? 'solicitud' : tipo;
  const provisional = inicio?.proximos?.[serie];

  async function generar(c, its) {
    return crearPdf(tipo, { cab: c, items: its }, { config: inicio.config, logo: inicio.logo });
  }

  async function vistaPrevia() {
    const w = window.open('', '_blank');
    setOcupado('previa');
    try {
      const p = preparar ? preparar(cab, items) : { cab, items };
      const blob = await generar({ ...p.cab, numero: numero || provisional }, p.items);
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url;
      else window.open(url, '_blank');
    } catch (e) {
      if (w) w.close();
      avisar('No se pudo armar la vista previa: ' + e.message, 'err');
    }
    setOcupado('');
  }

  async function guardar(comoNuevo) {
    const faltan = validar ? validar(cab, items) : [];
    if (faltan.length) return avisar('Falta completar: ' + faltan.join(', ') + '.', 'err');
    const editar = comoNuevo ? '' : numero;
    setOcupado(comoNuevo ? 'nuevo' : 'guardar');
    let n = editar;
    try {
      const p = preparar ? preparar(cab, items) : { cab, items };
      const r = await api('guardarDocumento', tipo, { editar, cab: p.cab, items: p.items, cirugia });
      n = r.numero;
      setNumero(n);
      setSucio(false);
      actualizar({ proximos: r.proximos, ...(r.lotes ? { lotes: r.lotes } : {}) });
      if (n !== editar) router.replace(location.pathname + '?numero=' + encodeURIComponent(n), { scroll: false });
      const c2 = { ...p.cab, numero: n };
      setCabRaw(c2);
      setItemsRaw(p.items);
      const blob = await generar(c2, p.items);
      const up = await api('subirPdf', tipo, n, await blobABase64(blob), nombreArchivo(tipo, c2));
      setCabRaw((c) => ({ ...c, pdf: up.url }));
      avisar(`N° ${n} guardado y PDF en Drive.`, 'ok', up.url);
    } catch (e) {
      avisar('No se pudo terminar: ' + e.message + (n ? ` (el N° ${n} quedó guardado; tocá Guardar para reintentar el PDF)` : ''), 'err');
    }
    setOcupado('');
  }

  async function cambiarEstado(v) {
    setCabRaw((c) => ({ ...c, estado: v }));
    if (!numero) return;
    try {
      await api('cambiarEstado', tipo, numero, v);
      avisar('Estado: ' + v);
    } catch (e) {
      avisar(e.message, 'err');
    }
  }

  if (estado.cargando) return <Cargando />;
  if (estado.error) return <div className="max-w-lg mx-auto mt-16 bg-white border border-err/30 rounded-xl p-6 text-center text-err">{estado.error}</div>;

  const ctx = { cab, setCab, items, setItems, extra, setExtra, numero, cirugia, guardar, ocupado, setOcupado, avisar, sucio, setSucio };

  return (
    <div className="pb-24">
      <div className="sticky top-0 lg:top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-5 bg-fondo/90 backdrop-blur border-b border-linea">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => (sucio && !confirm('Hay cambios sin guardar. ¿Salir igual?') ? null : router.push(volver))} className="p-2 rounded-lg text-gris hover:bg-white hover:text-azul" aria-label="Volver">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 mr-auto">
            <div className="text-[11px] font-bold tracking-[.14em] uppercase text-azul">{esSolicitud ? 'Solicitud de presupuesto' : titulo}</div>
            <div className="flex items-center gap-2.5">
              <span className="text-[20px] font-extrabold tracking-tight tnum">N° {numero || provisional}</span>
              {!numero && <span className="text-[12px] text-gris">se confirma al guardar</span>}
              {sucio && numero && <span className="text-[12px] text-alerta font-semibold">cambios sin guardar</span>}
            </div>
          </div>
          {estados && (numero ? (
            <Selector value={cab.estado} onChange={cambiarEstado} opciones={estados} className="!w-auto !py-1.5" />
          ) : <Estado valor={cab.estado} />)}
          {cab.pdf && (
            <a href={cab.pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-azul hover:underline px-2"><FileText size={15} /> PDF</a>
          )}
          {acciones?.(ctx)}
          <Boton icono={Eye} onClick={vistaPrevia} cargando={ocupado === 'previa'}>Vista previa</Boton>
          {numero && <Boton icono={CopyPlus} onClick={() => guardar(true)} cargando={ocupado === 'nuevo'} disabled={!!ocupado}>Guardar como nuevo</Boton>}
          <Boton variante="prim" icono={Save} onClick={() => guardar(false)} cargando={ocupado === 'guardar'} disabled={!!ocupado}>
            {numero ? 'Guardar cambios y PDF' : 'Guardar y generar PDF'}
          </Boton>
        </div>
      </div>
      {children(ctx)}
    </div>
  );
}
