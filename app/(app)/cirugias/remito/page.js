'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListChecks, MapPin, RotateCcw, Stethoscope, Truck, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp, useMaestros } from '@/lib/store';
import { hoy, num } from '@/lib/format';
import { EtiquetaSistema, buscarInstitucion, contenidoDe, textoSistema } from '@/lib/maestros';
import { AreaTexto, Boton, Buscador, Campo, Cargando, Casilla, Fecha, Modal, Tarjeta, Texto } from '@/components/ui';
import Documento from '@/components/Documento';
import TablaItems from '@/components/TablaItems';

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><Remito /></Suspense>;
}

const filaNueva = () => ({ codigo: '', desc: '', marca: '', cant: 1, esteril: false, vueltas: '', obsRetorno: '', contenido: null });

function Remito() {
  const sp = useSearchParams();
  const numeroParam = sp.get('numero');
  const idCir = sp.get('cirugia');
  const m = useMaestros();
  const { avisar } = useApp();
  const [contenidoDe_, setContenidoDe] = useState(null);

  async function cargar() {
    if (numeroParam) {
      const d = await api('getDocumento', 'remito', numeroParam);
      return { cab: d.cab, items: d.items, numero: numeroParam, cirugia: d.cab.idCirugia ? { id: d.cab.idCirugia } : null };
    }
    const cab = { fecha: hoy(), anexo: true, estado: 'Emitido' };
    let cirugia = null;
    if (idCir) {
      const c = await api('getCirugia', idCir);
      cirugia = { id: c.id, fila: c.fila, paciente: c.paciente, fecha: c.fecha, estado: c.estado };
      Object.assign(cab, { idCirugia: c.id, rcc: c.rcc, fechaCx: c.fecha, medico: c.medico, paciente: c.paciente, institucion: c.institucion });
      const inst = buscarInstitucion(m.instituciones, c.institucion);
      if (inst) Object.assign(cab, { institucion: inst.nombre, gln: inst.gln, cuit: inst.cuit, direccion: inst.direccion, localidad: inst.localidad });
    }
    return { cab, items: [filaNueva()], cirugia };
  }

  function validar(cab, items) {
    const f = [];
    if (!cab.institucion) f.push('institución de destino');
    if (!items.some((x) => x.desc && num(x.cant) > 0)) f.push('al menos un sistema con cantidad de cajas');
    return f;
  }

  return (
    <Documento
      tipo="remito"
      titulo="Remito de transporte"
      cargar={cargar}
      validar={validar}
      estados={['Emitido', 'Entregado', 'Retornado', 'Anulado']}
      volver="/cirugias"
      acciones={({ numero, items, setCab, setSucio }) => numero ? (
        <Boton icono={Undo2} onClick={async () => {
          try {
            const r = await api('guardarRetorno', numero, items.map((x, i) => ({ renglon: i + 1, vueltas: x.vueltas, obsRetorno: x.obsRetorno })));
            setCab((c) => ({ ...c, cajasVueltas: r.vueltas, estado: r.estado }));
            setSucio(false);
            avisar(`Retorno guardado: volvieron ${r.vueltas} de ${r.enviadas} cajas.`);
          } catch (e) { avisar(e.message, 'err'); }
        }}>Guardar retorno</Boton>
      ) : null}
    >
      {({ cab, setCab, items, setItems, numero }) => {
        const set = (k) => (v) => setCab({ [k]: v });
        const total = items.reduce((s, x) => s + num(x.cant), 0);
        const vueltas = items.reduce((s, x) => s + num(x.vueltas), 0);
        const cols = [
          {
            k: 'codigo', h: 'Sistema', w: 150, tipo: 'buscador', placeholder: 'Buscar…',
            buscador: {
              opciones: m.sistemas, texto: textoSistema, etiqueta: EtiquetaSistema,
              elegir: (s) => ({ codigo: s.codigo, desc: s.desc, marca: s.marca, esteril: !!s.esteril, contenido: contenidoDe(m.contenido, s.listado) }),
            },
          },
          { k: 'desc', h: 'Descripción del material', tipo: 'area', min: 300 },
          { k: 'marca', h: 'Marca', w: 110 },
          { k: 'cant', h: 'Cajas', w: 70, tipo: 'num', al: 'c' },
          { k: 'esteril', h: 'Estéril', w: 60, tipo: 'check', al: 'c' },
          {
            k: 'contenido', h: 'Contenido', w: 110,
            render: (f, i) => (
              <button onClick={() => setContenidoDe(i)} className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-azul hover:underline">
                <ListChecks size={14} /> {f.contenido?.length ? `${f.contenido.length} ítems` : 'Agregar'}
              </button>
            ),
          },
        ];
        if (numero) cols.push(
          { k: 'vueltas', h: 'Volvieron', w: 80, tipo: 'num', al: 'c', placeholder: '0' },
          { k: 'obsRetorno', h: 'Obs. retorno', w: 150 },
        );
        const fila = contenidoDe_ !== null ? items[contenidoDe_] : null;
        return (
          <div className="grid gap-5">
            <div className="grid lg:grid-cols-3 gap-5">
              <Tarjeta titulo="Destino" icono={MapPin} className="lg:col-span-2">
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <Campo label="Institución" className="sm:col-span-2">
                    <Buscador
                      value={cab.institucion}
                      onChange={set('institucion')}
                      opciones={m.instituciones}
                      texto={(o) => o.nombre + ' ' + o.localidad}
                      etiqueta={(o) => (<><b>{o.nombre}</b> <span className="text-gris">{o.localidad}</span></>)}
                      onElegir={(o) => setCab({ institucion: o.nombre, gln: o.gln, cuit: o.cuit, direccion: o.direccion, localidad: o.localidad })}
                    />
                  </Campo>
                  <Campo label="Dirección"><Texto value={cab.direccion} onChange={set('direccion')} /></Campo>
                  <Campo label="Localidad"><Texto value={cab.localidad} onChange={set('localidad')} /></Campo>
                  <Campo label="CUIT"><Texto value={cab.cuit} onChange={set('cuit')} /></Campo>
                  <Campo label="GLN / CUFF"><Texto value={cab.gln} onChange={set('gln')} /></Campo>
                </div>
              </Tarjeta>
              <Tarjeta titulo="Cirugía" icono={Stethoscope}>
                <div className="grid gap-3.5">
                  <Campo label="Paciente"><Texto value={cab.paciente} onChange={set('paciente')} /></Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Fecha de cirugía"><Fecha value={cab.fechaCx} onChange={set('fechaCx')} /></Campo>
                    <Campo label="N° RCC"><Texto value={cab.rcc} onChange={set('rcc')} /></Campo>
                  </div>
                  <Campo label="Médico">
                    <Buscador value={cab.medico} onChange={set('medico')} opciones={m.medicos} texto={(o) => o.nombre} onElegir={(o) => set('medico')(o.nombre)} />
                  </Campo>
                  {!cab.idCirugia && <div className="text-[12px] text-gris-claro">Remito suelto: no está vinculado a una cirugía del calendario.</div>}
                </div>
              </Tarjeta>
            </div>

            <Tarjeta titulo="Sistemas y cajas que viajan" icono={Truck}>
              <TablaItems
                cols={cols}
                filas={items}
                setFilas={setItems}
                nueva={filaNueva}
                textoAgregar="Agregar sistema"
                pie={
                  <div className="text-[13px] text-gris">
                    Total de cajas: <b className="text-tinta tnum">{total}</b>
                    {numero ? <> · Volvieron: <b className={vueltas >= total && total ? 'text-ok' : 'text-alerta'}>{vueltas}</b></> : null}
                  </div>
                }
              />
              <Casilla className="mt-4 text-[13px]" label="Incluir en el PDF el listado de contenido de cada caja" checked={cab.anexo !== false} onChange={set('anexo')} />
            </Tarjeta>

            <div className="grid lg:grid-cols-2 gap-5">
              <Tarjeta titulo="Transporte">
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <Campo label="Fecha del remito"><Fecha value={cab.fecha} onChange={set('fecha')} /></Campo>
                  <Campo label="Transportista / quién lo lleva"><Texto value={cab.transportista} onChange={set('transportista')} /></Campo>
                  <Campo label="Observaciones" className="sm:col-span-2"><AreaTexto value={cab.obs} onChange={set('obs')} rows={2} /></Campo>
                </div>
              </Tarjeta>
              <Tarjeta titulo="Recibió en destino" acciones={<span className="text-[11.5px] text-gris-claro">Opcional · si se completa a mano, dejalo vacío</span>}>
                <div className="grid sm:grid-cols-3 gap-3.5">
                  <Campo label="Aclaración"><Texto value={cab.recibio} onChange={set('recibio')} /></Campo>
                  <Campo label="DNI"><Texto value={cab.dni} onChange={set('dni')} /></Campo>
                  <Campo label="Fecha de entrega"><Fecha value={cab.fechaEntrega} onChange={set('fechaEntrega')} /></Campo>
                </div>
              </Tarjeta>
            </div>

            <Modal
              abierto={!!fila}
              onCerrar={() => setContenidoDe(null)}
              titulo={fila ? `Contenido · ${fila.codigo || fila.desc?.slice(0, 40) || 'caja'}` : ''}
              ancho="max-w-3xl"
              pie={<Boton variante="prim" onClick={() => setContenidoDe(null)}>Listo</Boton>}
            >
              {fila && (
                <>
                  <p className="text-[13px] text-gris mb-3">Lo que cambies acá vale solo para este remito; la lista general se edita en Datos → Contenido de cajas.</p>
                  <TablaItems
                    cols={[{ k: 'seccion', h: 'Sección', w: 170 }, { k: 'cant', h: 'Cant.', w: 70, tipo: 'num', al: 'c' }, { k: 'codigo', h: 'Código', w: 130 }, { k: 'desc', h: 'Descripción' }]}
                    filas={fila.contenido || []}
                    setFilas={(f) => setItems((its) => its.map((x, j) => (j === contenidoDe_ ? { ...x, contenido: typeof f === 'function' ? f(x.contenido || []) : f } : x)))}
                    nueva={() => ({ seccion: fila.contenido?.at(-1)?.seccion || '', cant: 1, codigo: '', desc: '' })}
                    vacio="Esta caja no tiene listado. Agregá renglones o restaurá el de la lista general."
                  />
                  {(() => {
                    const s = m.sistemas.find((x) => x.codigo === fila.codigo);
                    return s?.listado ? (
                      <Boton className="mt-2" tam="sm" variante="ghost" icono={RotateCcw} onClick={() => setItems((its) => its.map((x, j) => (j === contenidoDe_ ? { ...x, contenido: contenidoDe(m.contenido, s.listado) } : x)))}>
                        Restaurar desde la lista general ({s.listado})
                      </Boton>
                    ) : null;
                  })()}
                </>
              )}
            </Modal>
          </div>
        );
      }}
    </Documento>
  );
}
