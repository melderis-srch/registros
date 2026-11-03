'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calculator, ClipboardList, PackageCheck, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp, useMaestros } from '@/lib/store';
import { fmt, hoy, num } from '@/lib/format';
import { EtiquetaProducto, buscarInstitucion, buscarMedico, textoProducto } from '@/lib/maestros';
import { AreaTexto, Boton, Buscador, Campo, Cargando, Fecha, Modal, Selector, Tarjeta, Texto } from '@/components/ui';
import Documento from '@/components/Documento';
import TablaItems from '@/components/TablaItems';

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><Consumo /></Suspense>;
}

const filaNueva = (seccion = 'Implantado') => ({ seccion, codigo: '', desc: '', marca: '', proveedor: '', cant: 1, costo: '', moneda: 'ARS' });

function Consumo() {
  const sp = useSearchParams();
  const router = useRouter();
  const numeroParam = sp.get('numero');
  const idCir = sp.get('cirugia');
  const { inicio, avisar } = useApp();
  const m = useMaestros();
  const cfg = inicio.config;
  const [reponer, setReponer] = useState(sp.get('reponer') === '1');
  const [generando, setGenerando] = useState(false);

  async function cargar() {
    if (numeroParam) {
      const d = await api('getDocumento', 'consumo', numeroParam);
      return { cab: d.cab, items: d.items, numero: numeroParam, cirugia: d.cab.idCirugia ? { id: d.cab.idCirugia } : null };
    }
    if (!idCir) throw new Error('El registro de consumo se emite desde una cirugía del calendario.');
    const c = await api('getCirugia', idCir);
    const med = buscarMedico(m.medicos, c.medico);
    const inst = buscarInstitucion(m.instituciones, c.institucion);
    const cajas = (c.docs?.remitos || []).reduce((s, r) => s + num(r.cajas), 0);
    const cab = {
      fecha: hoy(), estado: 'Registrado', idCirugia: c.id, fechaCx: c.fecha, paciente: c.paciente, obraSocial: c.obraSocial,
      institucion: inst?.nombre || c.institucion, medico: c.medico, matricula: med?.matProv || med?.matNac || '',
      instrumentador: c.instrumentador, procedimiento: c.procedimiento, presupuesto: c.presupuesto,
      remitoTr: (c.docs?.remitos || []).map((r) => r.numero).join(' / ') || c.remito || '',
      cajas: cajas || '', tc: num(cfg.tcUSD), costoLogistica: inst?.logistica || '',
      costoEsterilizacion: cajas ? cajas * num(cfg.esterilizacionPorCaja) : '', costoOtros: '',
    };
    return { cab, items: [filaNueva()], cirugia: { id: c.id, fila: c.fila, paciente: c.paciente, fecha: c.fecha, estado: c.estado } };
  }

  function validar(cab, items) {
    const f = [];
    if (!cab.paciente) f.push('paciente');
    if (!cab.fechaCx) f.push('fecha de cirugía');
    if (!cab.medico) f.push('médico');
    if (!cab.institucion) f.push('institución');
    if (!items.some((x) => x.desc && num(x.cant) > 0)) f.push('al menos un producto con cantidad');
    return f;
  }

  async function generarOCs(numero) {
    setGenerando(true);
    try {
      const r = await api('generarOCsReposicion', numero);
      setReponer(false);
      if (!r.creadas.length) return avisar('No hay ítems con proveedor para reponer.', 'err');
      avisar(`Se generaron ${r.creadas.length} OC: ${r.creadas.map((c) => `${c.numero} (${c.proveedor})`).join(', ')}. Completá precios y generá el PDF.` + (r.sinProveedor.length ? ` Sin proveedor: ${r.sinProveedor.join(', ')}.` : ''));
      router.push('/compras?abrir=' + encodeURIComponent(r.creadas[0].numero));
    } catch (e) {
      avisar(e.message, 'err');
    }
    setGenerando(false);
  }

  return (
    <Documento
      tipo="consumo"
      titulo="Registro de consumo de cirugía"
      cargar={cargar}
      validar={validar}
      estados={['Registrado', 'Facturado']}
      volver="/cirugias"
      acciones={({ numero, sucio }) => numero ? (
        <Boton variante="suave" icono={PackageCheck} onClick={() => (sucio ? avisar('Guardá los cambios antes de generar la reposición.', 'err') : setReponer(true))}>OC de reposición</Boton>
      ) : null}
    >
      {({ cab, setCab, items, setItems, numero }) => {
        const set = (k) => (v) => setCab({ [k]: v });
        const tc = num(cab.tc) || 1;
        const ars = (x) => num(x.cant) * num(x.costo) * (x.moneda === 'USD' ? tc : 1);
        const imp = items.filter((x) => x.seccion !== 'Descartable').reduce((s, x) => s + ars(x), 0);
        const des = items.filter((x) => x.seccion === 'Descartable').reduce((s, x) => s + ars(x), 0);
        const total = imp + des + num(cab.costoLogistica) + num(cab.costoEsterilizacion) + num(cab.costoOtros);
        const proveedores = [...new Set(items.map((x) => x.proveedor).filter(Boolean))];
        return (
          <div className="grid gap-5">
            <div className="grid lg:grid-cols-3 gap-5">
              <Tarjeta titulo="Cirugía" icono={Stethoscope} className="lg:col-span-2">
                <div className="grid sm:grid-cols-3 gap-3.5">
                  <Campo label="Paciente" className="sm:col-span-2"><Texto value={cab.paciente} onChange={set('paciente')} /></Campo>
                  <Campo label="Fecha de cirugía"><Fecha value={cab.fechaCx} onChange={set('fechaCx')} /></Campo>
                  <Campo label="Obra social">
                    <Buscador value={cab.obraSocial} onChange={set('obraSocial')} opciones={m.clientes} texto={(o) => o.razon} onElegir={(o) => set('obraSocial')(o.razon)} />
                  </Campo>
                  <Campo label="Médico">
                    <Buscador value={cab.medico} onChange={set('medico')} opciones={m.medicos} texto={(o) => o.nombre} onElegir={(o) => setCab({ medico: o.nombre, matricula: o.matProv || o.matNac })} />
                  </Campo>
                  <Campo label="M.P. médico"><Texto value={cab.matricula} onChange={set('matricula')} /></Campo>
                  <Campo label="Institución" className="sm:col-span-2">
                    <Buscador value={cab.institucion} onChange={set('institucion')} opciones={m.instituciones} texto={(o) => o.nombre} onElegir={(o) => setCab({ institucion: o.nombre, costoLogistica: o.logistica || cab.costoLogistica })} />
                  </Campo>
                  <Campo label="N° presupuesto"><Texto value={cab.presupuesto} onChange={set('presupuesto')} /></Campo>
                  <Campo label="Instrumentador"><Texto value={cab.instrumentador} onChange={set('instrumentador')} /></Campo>
                  <Campo label="M.P. instrumentador"><Texto value={cab.matInstr} onChange={set('matInstr')} /></Campo>
                  <Campo label="Fecha del registro"><Fecha value={cab.fecha} onChange={set('fecha')} /></Campo>
                  <Campo label="Remito Surchérie"><Texto value={cab.remitoSur} onChange={set('remitoSur')} placeholder="0001-0000…" /></Campo>
                  <Campo label="Remito de transporte" className="sm:col-span-2"><Texto value={cab.remitoTr} onChange={set('remitoTr')} /></Campo>
                </div>
              </Tarjeta>
              <Tarjeta titulo="Costos de la cirugía" icono={Calculator} acciones={<span className="text-[11px] text-gris-claro">uso interno · no sale en el PDF</span>}>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="TC (USD)"><Texto value={cab.tc} onChange={set('tc')} inputMode="decimal" /></Campo>
                  <Campo label="Cajas"><Texto value={cab.cajas} inputMode="numeric" onChange={(v) => setCab({ cajas: v, costoEsterilizacion: num(v) * num(cfg.esterilizacionPorCaja) || '' })} /></Campo>
                  <Campo label="Logística"><Texto value={cab.costoLogistica} onChange={set('costoLogistica')} inputMode="decimal" /></Campo>
                  <Campo label="Esterilización"><Texto value={cab.costoEsterilizacion} onChange={set('costoEsterilizacion')} inputMode="decimal" /></Campo>
                  <Campo label="Otros" className="col-span-2"><Texto value={cab.costoOtros} onChange={set('costoOtros')} inputMode="decimal" /></Campo>
                </div>
                <dl className="mt-4 text-[13px] divide-y divide-linea border border-linea rounded-lg">
                  {[['Implantes', imp], ['Descartables', des], ['Logística + esteril. + otros', num(cab.costoLogistica) + num(cab.costoEsterilizacion) + num(cab.costoOtros)]].map(([k, v]) => (
                    <div key={k} className="flex justify-between px-3 py-2"><dt className="text-gris">{k}</dt><dd className="font-semibold tnum">$ {fmt(v)}</dd></div>
                  ))}
                  <div className="flex justify-between px-3 py-2.5 bg-azul text-white rounded-b-lg"><dt className="font-bold text-[12px] tracking-wider">TOTAL CX</dt><dd className="font-extrabold tnum">$ {fmt(total)}</dd></div>
                </dl>
              </Tarjeta>
            </div>

            <Tarjeta titulo="Material consumido" icono={ClipboardList} acciones={<span className="text-[12px] text-gris">Lote y vencimiento se registran en Recepción · el PDF deja espacio para stickers</span>}>
              <TablaItems
                cols={[
                  { k: 'seccion', h: 'Sección', w: 120, tipo: 'select', opciones: ['Implantado', 'Descartable'] },
                  {
                    k: 'codigo', h: 'Código', w: 140, tipo: 'buscador', placeholder: 'Buscar…',
                    buscador: {
                      opciones: m.productos, texto: textoProducto, etiqueta: EtiquetaProducto,
                      elegir: (p) => ({ codigo: p.codigo, desc: p.desc, marca: [p.modelo, p.marca].filter(Boolean).join('/'), proveedor: p.proveedor, costo: p.costo, moneda: p.moneda || 'ARS' }),
                    },
                  },
                  { k: 'desc', h: 'Descripción', tipo: 'area', min: 240 },
                  { k: 'marca', h: 'Marca / Modelo', w: 140 },
                  { k: 'proveedor', h: 'Proveedor', w: 130, tipo: 'buscador', buscador: { opciones: m.proveedores, texto: (p) => p.razon, elegir: (p) => ({ proveedor: p.razon }) } },
                  { k: 'cant', h: 'Cant.', w: 64, tipo: 'num', al: 'c' },
                  { k: 'costo', h: 'Costo unit.', w: 105, tipo: 'num', al: 'r' },
                  { k: 'moneda', h: 'Mon.', w: 72, tipo: 'select', opciones: ['ARS', 'USD'] },
                  { k: 'costoArs', h: 'Costo $', w: 115, tipo: 'calc', al: 'r', valor: (x) => fmt(ars(x)) },
                ]}
                filas={items}
                setFilas={setItems}
                nueva={() => filaNueva(items.at(-1)?.seccion || 'Implantado')}
                textoAgregar="Agregar producto"
              />
            </Tarjeta>

            <Tarjeta titulo="Procedimiento y observaciones">
              <div className="grid md:grid-cols-3 gap-3.5">
                <Campo label="Procedimiento" className="md:col-span-2"><Texto value={cab.procedimiento} onChange={set('procedimiento')} /></Campo>
                <Campo label="Resumen de consumo" hint="Ej.: 4N+1SBD (para el seguimiento interno)"><Texto value={cab.resumen} onChange={set('resumen')} /></Campo>
                <Campo label="Observaciones" className="md:col-span-3"><AreaTexto value={cab.obs} onChange={set('obs')} rows={2} /></Campo>
              </div>
              {cab.ocs ? <div className="mt-3 text-[13px] text-gris">OC de reposición: <b className="text-tinta">{cab.ocs}</b></div> : null}
            </Tarjeta>

            <Modal
              abierto={reponer && !!numero}
              onCerrar={() => setReponer(false)}
              titulo="Generar OC de reposición"
              ancho="max-w-lg"
              pie={<><Boton variante="ghost" onClick={() => setReponer(false)}>Cancelar</Boton><Boton variante="prim" icono={PackageCheck} cargando={generando} onClick={() => generarOCs(numero)}>Generar {proveedores.length || ''} OC</Boton></>}
            >
              <p className="text-[13.5px]">Se arma <b>una orden de compra por proveedor</b> con lo consumido en el registro {numero}, con los costos de referencia de Productos. Quedan en estado Emitida para revisar precios y generar el PDF.</p>
              <ul className="mt-3 text-[13px] list-disc pl-5 text-gris">
                {proveedores.map((p) => <li key={p}><b className="text-tinta">{p}</b>: {items.filter((x) => x.proveedor === p).length} ítems</li>)}
                {items.some((x) => x.desc && !x.proveedor) && <li className="text-alerta">Hay ítems sin proveedor: no se incluyen.</li>}
              </ul>
            </Modal>
          </div>
        );
      }}
    </Documento>
  );
}
