'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, ExternalLink, FileText, PackageCheck, Save, ShoppingCart, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp, useMaestros } from '@/lib/store';
import { AreaTexto, Boton, Buscador, Campo, Casilla, Estado, Fecha, Panel, Texto, cx } from '@/components/ui';

const CHECK = [['firma', 'Firma'], ['sello', 'Sello'], ['protocolo', 'Protocolo'], ['certificado', 'Certificado'], ['rx', 'RX'], ['epicrisis', 'Epicrisis']];
const ESTADOS = ['Programada', 'Realizada', 'Suspendida', 'Dada de baja', 'Facturada'];
const VACIA = { fecha: '', medico: '', paciente: '', institucion: '', procedimiento: '', obraSocial: '', obs: '', instrumentador: '', presupuesto: '', estado: 'Programada', checklist: {} };

export default function FichaCirugia({ cirugia, onCerrar, onGuardada }) {
  const router = useRouter();
  const { avisar } = useApp();
  const m = useMaestros();
  const [c, setC] = useState(VACIA);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);

  useEffect(() => {
    setC(cirugia ? { ...VACIA, ...cirugia, checklist: { ...(cirugia.checklist || {}) } } : VACIA);
    setCambios(false);
  }, [cirugia]);

  const set = (k) => (v) => { setC((x) => ({ ...x, [k]: v })); setCambios(true); };
  const nueva = !c.id;

  async function guardar(despues) {
    if (!c.paciente.trim()) return avisar('Falta el paciente.', 'err');
    setGuardando(true);
    try {
      const g = await api('guardarCirugia', c);
      setC((x) => ({ ...x, ...g }));
      setCambios(false);
      onGuardada?.(g);
      if (!despues) avisar(nueva ? 'Cirugía agregada al Seguimiento.' : 'Cambios guardados en el Seguimiento.');
      return g;
    } catch (e) {
      avisar(e.message, 'err');
    } finally {
      setGuardando(false);
    }
  }

  async function ir(ruta) {
    let id = c.id;
    if (!id || cambios) {
      const g = await guardar(true);
      if (!g) return;
      id = g.id;
    }
    router.push(ruta.replace('{id}', id));
  }

  const docs = c.docs || { consumos: [], remitos: [], ocs: [] };
  const registro = docs.consumos[0];

  return (
    <Panel
      abierto={!!cirugia}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      titulo={nueva ? 'Nueva cirugía' : c.paciente || 'Cirugía'}
      subtitulo={nueva ? 'Se agrega al Seguimiento de cirugías' : [c.fecha || 'Sin fecha', c.institucion].filter(Boolean).join(' · ')}
      pie={
        <>
          <Boton variante="ghost" onClick={onCerrar}>Cerrar</Boton>
          <Boton variante="prim" icono={Save} cargando={guardando} onClick={() => guardar()} disabled={!cambios && !nueva}>
            {nueva ? 'Agregar cirugía' : 'Guardar cambios'}
          </Boton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <Campo label="Paciente (Nombre Apellido)" className="col-span-2">
          <Texto value={c.paciente} onChange={set('paciente')} autoFocus={nueva} />
        </Campo>
        <Campo label="Fecha de cirugía" hint="Vacía = queda en pendientes">
          <Fecha value={c.fecha} onChange={set('fecha')} />
        </Campo>
        <Campo label="Obra social">
          <Buscador value={c.obraSocial} onChange={set('obraSocial')} onElegir={(o) => set('obraSocial')(o.razon)} opciones={m.clientes} texto={(o) => o.razon} />
        </Campo>
        <Campo label="Médico">
          <Buscador
            value={c.medico}
            onChange={set('medico')}
            onElegir={(o) => set('medico')(o.nombre)}
            opciones={m.medicos}
            texto={(o) => o.nombre + ' ' + (o.especialidad || '')}
            etiqueta={(o) => (<><b>{o.nombre}</b> <span className="text-gris">{o.especialidad}{o.matProv ? ' · M.P. ' + o.matProv : ''}</span></>)}
          />
        </Campo>
        <Campo label="Institución">
          <Buscador value={c.institucion} onChange={set('institucion')} onElegir={(o) => set('institucion')(o.nombre)} opciones={m.instituciones} texto={(o) => o.nombre + ' ' + o.localidad} etiqueta={(o) => (<><b>{o.nombre}</b> <span className="text-gris">{o.localidad}</span></>)} />
        </Campo>
        <Campo label="Procedimiento / material" className="col-span-2">
          <Texto value={c.procedimiento} onChange={set('procedimiento')} placeholder="Ej.: Fij 2 niv + drill + haemocer" />
        </Campo>
        <Campo label="Instrumentador">
          <Texto value={c.instrumentador} onChange={set('instrumentador')} />
        </Campo>
        <Campo label="N° de presupuesto">
          <Texto value={c.presupuesto} onChange={set('presupuesto')} />
        </Campo>
        <Campo label="Observaciones" className="col-span-2">
          <AreaTexto value={c.obs} onChange={set('obs')} rows={2} />
        </Campo>
      </div>

      <div className="mt-5">
        <div className="text-[11.5px] font-semibold text-gris mb-1.5">Estado</div>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => set('estado')(e)}
              className={cx('px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition', c.estado === e ? 'bg-azul text-white border-azul' : 'bg-white border-linea text-gris hover:border-azul/50')}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[11.5px] font-semibold text-gris mb-1.5">Documentación para facturar</div>
        <div className="grid grid-cols-3 gap-2">
          {CHECK.map(([k, l]) => (
            <Casilla key={k} label={l} checked={c.checklist?.[k]} onChange={(v) => { setC((x) => ({ ...x, checklist: { ...x.checklist, [k]: v } })); setCambios(true); }} className="bg-azul-50 rounded-lg px-3 py-2 text-[13px]" />
          ))}
        </div>
      </div>

      <div className="mt-6 border-t border-linea pt-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-[13.5px]">Documentos</h4>
          {c.rcc && !registro && <span className="text-[12px] text-gris">RCC {c.rcc} (planilla anterior)</span>}
        </div>
        <div className="flex flex-col gap-2">
          {docs.remitos.map((r) => (
            <FilaDoc key={r.numero} icono={Truck} titulo={'Remito ' + r.numero} detalle={`${r.cajas || 0} cajas · volvieron ${r.vueltas || 0}`} estado={r.estado} pdf={r.pdf} onAbrir={() => router.push('/cirugias/remito?numero=' + encodeURIComponent(r.numero))} />
          ))}
          {registro ? (
            <FilaDoc icono={ClipboardList} titulo={'Registro de consumo ' + registro.numero} estado={registro.estado} pdf={registro.pdf} onAbrir={() => router.push('/cirugias/consumo?numero=' + encodeURIComponent(registro.numero))} />
          ) : null}
          {docs.ocs.map((o) => (
            <FilaDoc key={o.numero} icono={ShoppingCart} titulo={(o.tipo === 'Solicitud de presupuesto' ? 'Solicitud ' : 'OC ') + o.numero} detalle={o.proveedor} estado={o.estado} pdf={o.pdf} onAbrir={() => router.push('/compras/oc?numero=' + encodeURIComponent(o.numero))} />
          ))}
          {!docs.remitos.length && !registro && !docs.ocs.length && <div className="text-gris text-[13px]">Todavía no tiene documentos.</div>}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Boton variante="suave" icono={Truck} onClick={() => ir('/cirugias/remito?cirugia={id}')}>{docs.remitos.length ? 'Otro remito' : 'Emitir remito'}</Boton>
          {!registro && <Boton variante="suave" icono={ClipboardList} onClick={() => ir('/cirugias/consumo?cirugia={id}')}>Emitir registro de consumo</Boton>}
          {registro && <Boton variante="suave" icono={PackageCheck} onClick={() => router.push('/cirugias/consumo?numero=' + encodeURIComponent(registro.numero) + '&reponer=1')}>OC de reposición</Boton>}
        </div>
      </div>
    </Panel>
  );
}

function FilaDoc({ icono: Icono, titulo, detalle, estado, pdf, onAbrir }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-linea px-3 py-2.5 hover:border-azul/40 bg-white">
      <div className="size-8 rounded-lg bg-azul-claro text-azul grid place-items-center shrink-0"><Icono size={16} /></div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-[13px] truncate">{titulo}</div>
        {detalle && <div className="text-gris text-[12px] truncate">{detalle}</div>}
      </div>
      <Estado valor={estado} />
      {pdf && (
        <a href={pdf} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-gris hover:text-azul hover:bg-azul-claro" title="Ver PDF"><FileText size={16} /></a>
      )}
      <button onClick={onAbrir} className="p-1.5 rounded-lg text-gris hover:text-azul hover:bg-azul-claro" title="Abrir"><ExternalLink size={16} /></button>
    </div>
  );
}
