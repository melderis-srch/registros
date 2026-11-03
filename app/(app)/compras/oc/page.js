'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, ClipboardCheck, FileText, PackagePlus, ShoppingCart, Stethoscope, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp, useMaestros } from '@/lib/store';
import { calcularOC, enLetras, fmt, hoy, norm, num } from '@/lib/format';
import { EtiquetaProducto, textoProducto } from '@/lib/maestros';
import { AreaTexto, Boton, Buscador, Campo, Cargando, Fecha, Selector, Tarjeta, Texto, cx } from '@/components/ui';
import Documento from '@/components/Documento';
import TablaItems from '@/components/TablaItems';

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><OC /></Suspense>;
}

const filaNueva = () => ({ codigo: '', desc: '', cant: 1, costo: '', alicuota: '21' });

function OC() {
  const sp = useSearchParams();
  const router = useRouter();
  const numeroParam = sp.get('numero');
  const { inicio } = useApp();
  const m = useMaestros();
  const cfg = inicio.config;

  async function cargar() {
    if (numeroParam) {
      const d = await api('getDocumento', 'oc', numeroParam);
      return { cab: d.cab, items: d.items, numero: numeroParam, extra: { recepciones: d.recepciones || [] } };
    }
    const cab = {
      tipo: sp.get('tipo') === 'solicitud' ? 'Solicitud de presupuesto' : 'Orden de compra',
      fecha: hoy(), estado: 'Emitida', lugar: cfg.lugarEntrega, moneda: 'ARS', tc: '', descuento: '',
    };
    if (sp.get('cirugia')) {
      const c = await api('getCirugia', sp.get('cirugia'));
      Object.assign(cab, { idCirugia: c.id, rcc: c.rcc, fechaCx: c.fecha, medico: c.medico, institucion: c.institucion, paciente: c.paciente });
    }
    return { cab, items: [filaNueva()], extra: { recepciones: [] } };
  }

  function validar(cab, items) {
    const f = [];
    if (!cab.proveedor) f.push('proveedor');
    if (!items.some((x) => x.desc && num(x.cant) > 0)) f.push('al menos un ítem con cantidad');
    if (cab.tipo !== 'Solicitud de presupuesto' && items.some((x) => x.desc && !num(x.costo))) f.push('costo en todos los ítems');
    if (cab.moneda === 'USD' && !num(cab.tc) && cab.tipo !== 'Solicitud de presupuesto') f.push('tipo de cambio');
    return f;
  }

  function preparar(cab, items) {
    const its = items.filter((x) => x.desc || x.codigo);
    const r = calcularOC(its, cab.descuento);
    return {
      cab: { ...cab, subtotal: r.subtotal, iva21: r.iva21, iva105: r.iva105, exento: r.exento, total: r.total },
      items: r.filas,
    };
  }

  return (
    <Documento tipo="oc" titulo="Orden de compra" cargar={cargar} validar={validar} preparar={preparar} estados={['Emitida', 'Enviada', 'Recibida parcial', 'Recibida', 'Anulada']} volver="/compras">
      {({ cab, setCab, items, setItems, numero, extra }) => {
        const set = (k) => (v) => setCab({ [k]: v });
        const sol = cab.tipo === 'Solicitud de presupuesto';
        const r = calcularOC(items, cab.descuento);
        const mon = cab.moneda === 'USD' ? 'USD ' : '$ ';
        // productos del proveedor primero
        const prov = norm(cab.proveedor);
        const productos = prov ? [...m.productos].sort((a, b) => (norm(b.proveedor) === prov) - (norm(a.proveedor) === prov)) : m.productos;
        const cols = [
          {
            k: 'codigo', h: 'Código', w: 150, tipo: 'buscador', placeholder: 'Buscar…',
            buscador: {
              opciones: productos, texto: textoProducto, etiqueta: EtiquetaProducto,
              elegir: (p) => ({ codigo: p.codigo, desc: p.desc, costo: p.costo, alicuota: p.alicuota || '21' }),
            },
          },
          { k: 'desc', h: 'Descripción', tipo: 'area', min: 260 },
          { k: 'cant', h: 'Cant.', w: 70, tipo: 'num', al: 'c' },
        ];
        if (!sol) cols.push(
          { k: 'costo', h: 'Unit. neto', w: 120, tipo: 'num', al: 'r', falta: (x) => x.desc && !num(x.costo) },
          { k: 'alicuota', h: 'IVA', w: 92, tipo: 'select', opciones: ['21', '10,5', '0', 'Exento'] },
          { k: 'neto', h: 'Total neto', w: 120, tipo: 'calc', al: 'r', valor: (x) => fmt(num(x.cant) * num(x.costo)) },
        );
        if (numero && !sol) cols.push({ k: 'pendiente', h: 'Recibido', w: 90, tipo: 'calc', al: 'c', valor: (x) => `${num(x.recibido)} / ${num(x.cant)}` });

        return (
          <div className="grid gap-5">
            <div className="flex rounded-lg border border-linea p-0.5 bg-white w-max shadow-card">
              {['Orden de compra', 'Solicitud de presupuesto'].map((t) => (
                <button key={t} onClick={() => { if (numero && t !== cab.tipo && !confirm('Cambiar el tipo le asigna un número nuevo al guardar. ¿Seguir?')) return; set('tipo')(t); }} className={cx('px-3.5 py-1.5 rounded-md text-[13px] font-semibold', cab.tipo === t ? 'bg-azul text-white' : 'text-gris hover:text-tinta')}>
                  {t}
                </button>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <Tarjeta titulo="Proveedor" icono={Building2} className="lg:col-span-2">
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <Campo label="Proveedor" className="sm:col-span-2">
                    <Buscador
                      value={cab.proveedor}
                      onChange={set('proveedor')}
                      opciones={m.proveedores}
                      texto={(p) => p.razon + ' ' + p.cuit}
                      etiqueta={(p) => (<><b>{p.razon}</b> <span className="text-gris">{p.localidad} · {p.moneda}</span></>)}
                      onElegir={(p) => setCab({ proveedor: p.razon, cuit: p.cuit, domicilio: p.domicilio, localidad: p.localidad, pago: p.pago || cab.pago, moneda: p.moneda || 'ARS', tc: p.moneda === 'USD' ? cab.tc || num(cfg.tcUSD) : '' })}
                    />
                  </Campo>
                  <Campo label="Dirección"><Texto value={cab.domicilio} onChange={set('domicilio')} /></Campo>
                  <Campo label="Localidad"><Texto value={cab.localidad} onChange={set('localidad')} /></Campo>
                  <Campo label="CUIT"><Texto value={cab.cuit} onChange={set('cuit')} /></Campo>
                  <Campo label="Pedido (referencia corta)" hint="Ej.: repo inserto, cerv post"><Texto value={cab.pedido} onChange={set('pedido')} /></Campo>
                </div>
              </Tarjeta>
              <Tarjeta titulo="Pago" icono={ShoppingCart}>
                <div className="grid grid-cols-2 gap-3.5">
                  <Campo label="Fecha"><Fecha value={cab.fecha} onChange={set('fecha')} /></Campo>
                  <Campo label="Moneda"><Selector value={cab.moneda} onChange={(v) => setCab({ moneda: v, tc: v === 'USD' ? cab.tc || num(cfg.tcUSD) : '' })} opciones={['ARS', 'USD']} /></Campo>
                  {cab.moneda === 'USD' && <Campo label="Tipo de cambio" className="col-span-2"><Texto value={cab.tc} onChange={set('tc')} inputMode="decimal" /></Campo>}
                  <Campo label="Condiciones de pago" className="col-span-2"><Texto value={cab.pago} onChange={set('pago')} placeholder="0/30/60/90/120" /></Campo>
                </div>
              </Tarjeta>
            </div>

            <Tarjeta titulo="Entrega" icono={Truck}>
              <div className="grid sm:grid-cols-4 gap-3.5">
                <Campo label="Forma de envío"><Texto value={cab.formaEnvio} onChange={set('formaEnvio')} placeholder="Encomienda, retira…" /></Campo>
                <Campo label="Fecha de envío"><Fecha value={cab.fechaEnvio} onChange={set('fechaEnvio')} /></Campo>
                <Campo label="Plazo de entrega"><Texto value={cab.plazo} onChange={set('plazo')} /></Campo>
                <Campo label="Lugar de entrega"><Texto value={cab.lugar} onChange={set('lugar')} /></Campo>
              </div>
            </Tarjeta>

            <Tarjeta titulo="Ítems" icono={ClipboardCheck} acciones={!sol && <span className="text-[12px] text-gris">Costo neto + IVA = total</span>}>
              <TablaItems cols={cols} filas={items} setFilas={setItems} nueva={filaNueva} />
              {!sol && (
                <div className="flex flex-col-reverse md:flex-row justify-between gap-5 mt-5">
                  <div className="flex-1 grid gap-3 content-start">
                    <div className="rounded-lg border border-linea bg-azul-50 px-4 py-3 text-[12px] font-bold uppercase tracking-wide">{enLetras(r.total, cab.moneda)}</div>
                    <Campo label="Observaciones"><AreaTexto value={cab.obs} onChange={set('obs')} rows={2} /></Campo>
                  </div>
                  <div className="w-full md:w-[320px] border border-linea rounded-xl overflow-hidden text-[13px] self-start">
                    {[['Subtotal neto', r.subtotal], ['IVA 21%', r.iva21], ['IVA 10,5%', r.iva105], ['No gravado / Exento', r.exento]].map(([k, v]) => (
                      (k === 'Subtotal neto' || v) ? <div key={k} className="flex justify-between px-4 py-2 border-b border-linea"><span className="text-gris">{k}</span><span className="font-semibold tnum">{fmt(v)}</span></div> : null
                    ))}
                    <div className="flex justify-between items-center px-4 py-1.5 border-b border-linea">
                      <span className="text-gris">Descuento</span>
                      <input className="campo campo-celda !w-28 text-right tnum" inputMode="decimal" value={cab.descuento ?? ''} onChange={(e) => set('descuento')(e.target.value)} placeholder="0,00" />
                    </div>
                    <div className="flex justify-between items-center px-4 py-3 bg-azul text-white">
                      <span className="font-bold text-[11.5px] tracking-[.16em]">TOTAL</span>
                      <span className="text-[19px] font-extrabold tnum">{mon}{fmt(r.total)}</span>
                    </div>
                  </div>
                </div>
              )}
              {sol && <Campo label="Observaciones" className="mt-4"><AreaTexto value={cab.obs} onChange={set('obs')} rows={2} /></Campo>}
            </Tarjeta>

            <div className="grid lg:grid-cols-2 gap-5">
              <Tarjeta titulo="Datos de cirugía (opcional)" icono={Stethoscope}>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <Campo label="Paciente"><Texto value={cab.paciente} onChange={set('paciente')} /></Campo>
                  <Campo label="Fecha de cirugía"><Fecha value={cab.fechaCx} onChange={set('fechaCx')} /></Campo>
                  <Campo label="Médico"><Texto value={cab.medico} onChange={set('medico')} /></Campo>
                  <Campo label="Institución"><Texto value={cab.institucion} onChange={set('institucion')} /></Campo>
                  {cab.rcc && <div className="text-[12.5px] text-gris sm:col-span-2">Vinculada al registro de consumo <b className="text-tinta">{cab.rcc}</b></div>}
                </div>
              </Tarjeta>
              {numero && !sol && (
                <Tarjeta titulo="Recepciones" icono={PackagePlus} acciones={<Boton tam="sm" variante="suave" icono={PackagePlus} onClick={() => router.push('/compras/recepcion?oc=' + encodeURIComponent(numero))}>Nueva recepción</Boton>}>
                  {cab.facturas && <div className="text-[12.5px] text-gris mb-2">Facturas: <b className="text-tinta">{cab.facturas}</b></div>}
                  <div className="flex flex-col gap-2">
                    {(extra?.recepciones || []).map((rc) => (
                      <button key={rc.numero} onClick={() => router.push('/compras/recepcion?numero=' + encodeURIComponent(rc.numero))} className="flex items-center gap-3 text-left rounded-lg border border-linea px-3 py-2 hover:border-azul/40">
                        <FileText size={16} className="text-azul" />
                        <span className="font-semibold">Recepción {rc.numero}</span>
                        <span className="text-gris text-[12.5px]">{rc.fecha}{rc.factura ? ' · Fact. ' + rc.factura : ''}</span>
                      </button>
                    ))}
                    {!extra?.recepciones?.length && <div className="text-[13px] text-gris">Todavía no se recibió nada de esta OC.</div>}
                  </div>
                </Tarjeta>
              )}
            </div>
          </div>
        );
      }}
    </Documento>
  );
}
