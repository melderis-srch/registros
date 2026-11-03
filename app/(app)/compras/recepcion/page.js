'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, ClipboardCheck, FileText, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp, useMaestros } from '@/lib/store';
import { hoy, num } from '@/lib/format';
import { EtiquetaProducto, textoProducto } from '@/lib/maestros';
import { AreaTexto, Buscador, Campo, Cargando, Fecha, Tarjeta, Texto } from '@/components/ui';
import Documento from '@/components/Documento';
import TablaItems from '@/components/TablaItems';

export default function Pagina() {
  return <Suspense fallback={<Cargando />}><Recepcion /></Suspense>;
}

const filaNueva = () => ({ codigo: '', desc: '', lote: '', vto: '', cant: 1, empaque: 'Conforme', rotulo: 'Conforme', obs: '', renglonOc: '' });

function itemsPendientes(oc) {
  return (oc.items || [])
    .map((it) => ({ ...it, pend: it.pendiente !== '' && it.pendiente !== undefined ? num(it.pendiente) : num(it.cant) - num(it.recibido) }))
    .filter((it) => it.pend > 0)
    .map((it) => ({ ...filaNueva(), renglonOc: it.renglon, codigo: it.codigo, desc: it.desc, cant: it.pend }));
}

function Recepcion() {
  const sp = useSearchParams();
  const numeroParam = sp.get('numero');
  const { inicio } = useApp();
  const m = useMaestros();
  const [ocs, setOcs] = useState([]);

  useEffect(() => {
    api('getCompras').then((d) => setOcs(d.ocs.filter((o) => o.tipo !== 'Solicitud de presupuesto'))).catch(() => {});
  }, []);

  function datosDeOC(oc) {
    const p = m.productos.find((x) => x.codigo === oc.items?.[0]?.codigo);
    return { oc: oc.numero, proveedor: oc.proveedor, descripcion: oc.pedido || '', marca: p?.marca || '', origen: p?.origen || '' };
  }

  async function cargar() {
    if (numeroParam) {
      const d = await api('getDocumento', 'recepcion', numeroParam);
      return { cab: d.cab, items: d.items, numero: numeroParam };
    }
    const cab = { fecha: hoy(), reviso: inicio.config.confecciono };
    if (sp.get('oc')) {
      const d = await api('getDocumento', 'oc', sp.get('oc'));
      const oc = { ...d.cab, items: d.items };
      Object.assign(cab, datosDeOC(oc));
      const its = itemsPendientes(oc);
      return { cab, items: its.length ? its : [filaNueva()] };
    }
    return { cab, items: [filaNueva()] };
  }

  function validar(cab, items) {
    const f = [];
    if (!cab.oc && !cab.proveedor) f.push('OC o proveedor');
    if (!items.length) f.push('al menos un ítem');
    items.forEach((x, i) => {
      if (!x.lote || !x.vto || !x.empaque || !x.rotulo) f.push(`lote, vencimiento e inspección en el renglón ${i + 1}`);
    });
    return f;
  }

  return (
    <Documento tipo="recepcion" titulo="Recepción · inspección de productos médicos" cargar={cargar} validar={validar} volver="/compras">
      {({ cab, setCab, items, setItems, numero }) => {
        const set = (k) => (v) => setCab({ [k]: v });
        const lotes = inicio.lotes || {};
        return (
          <div className="grid gap-5">
            <div className="grid lg:grid-cols-3 gap-5">
              <Tarjeta titulo="Orden de compra" icono={ShoppingCart}>
                <div className="grid gap-3.5">
                  <Campo label="N° de OC" hint={numero ? '' : 'Al elegirla se cargan los ítems pendientes'}>
                    <Buscador
                      value={cab.oc}
                      onChange={set('oc')}
                      opciones={ocs}
                      texto={(o) => `${o.numero} ${o.proveedor} ${o.pedido} ${o.estado}`}
                      etiqueta={(o) => (<span className="flex gap-2"><b>{o.numero}</b><span>{o.proveedor}</span><span className="text-gris">{o.pedido}</span><span className="ml-auto text-gris-claro">{o.estado}</span></span>)}
                      onElegir={(o) => {
                        setCab(datosDeOC(o));
                        if (!numero) {
                          const its = itemsPendientes(o);
                          if (its.length) setItems(its);
                        }
                      }}
                    />
                  </Campo>
                  <Campo label="Descripción"><Texto value={cab.descripcion} onChange={set('descripcion')} /></Campo>
                  <Campo label="Fecha de recepción"><Fecha value={cab.fecha} onChange={set('fecha')} /></Campo>
                </div>
              </Tarjeta>
              <Tarjeta titulo="Proveedor" icono={Building2}>
                <div className="grid gap-3.5">
                  <Campo label="Proveedor">
                    <Buscador value={cab.proveedor} onChange={set('proveedor')} opciones={m.proveedores} texto={(p) => p.razon} onElegir={(p) => set('proveedor')(p.razon)} />
                  </Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Marca"><Texto value={cab.marca} onChange={set('marca')} /></Campo>
                    <Campo label="Origen"><Texto value={cab.origen} onChange={set('origen')} placeholder="Nacional / Importado" /></Campo>
                  </div>
                </div>
              </Tarjeta>
              <Tarjeta titulo="Documentos del proveedor" icono={FileText}>
                <div className="grid gap-3.5">
                  <Campo label="Remito N°"><Texto value={cab.remitoProv} onChange={set('remitoProv')} placeholder="0001-00024131" /></Campo>
                  <Campo label="Factura N°"><Texto value={cab.factura} onChange={set('factura')} placeholder="00003-00018509" /></Campo>
                  <Campo label="Valor factura"><Texto value={cab.valorFactura} onChange={set('valorFactura')} inputMode="decimal" /></Campo>
                </div>
              </Tarjeta>
            </div>

            <Tarjeta titulo="Productos recibidos" icono={ClipboardCheck} acciones={<span className="text-[12px] text-gris">Total: <b className="text-tinta tnum">{items.reduce((s, x) => s + num(x.cant), 0)}</b> unidades</span>}>
              <TablaItems
                cols={[
                  {
                    k: 'codigo', h: 'Código', w: 140, tipo: 'buscador', placeholder: 'Buscar…',
                    buscador: { opciones: m.productos, texto: textoProducto, etiqueta: EtiquetaProducto, elegir: (p) => ({ codigo: p.codigo, desc: p.desc }) },
                  },
                  { k: 'desc', h: 'Producto', tipo: 'area', min: 220 },
                  {
                    k: 'lote', h: 'Lote', w: 120, tipo: 'buscador', placeholder: 'Lote', falta: (x) => !x.lote,
                    buscador: {
                      opciones: (f) => lotes[String(f.codigo || '').toUpperCase()] || [],
                      texto: (l) => l.lote,
                      etiqueta: (l) => (<span className="flex gap-3"><b>{l.lote}</b><span className="text-gris">vto {l.vto}</span></span>),
                      elegir: (l) => ({ lote: l.lote, vto: l.vto }),
                    },
                  },
                  { k: 'vto', h: 'Vencimiento', w: 140, tipo: 'fecha', falta: (x) => !x.vto },
                  { k: 'cant', h: 'Cant.', w: 64, tipo: 'num', al: 'c' },
                  { k: 'empaque', h: 'Empaque', w: 120, tipo: 'select', opciones: ['Conforme', 'No conforme'] },
                  { k: 'rotulo', h: 'Rótulo', w: 120, tipo: 'select', opciones: ['Conforme', 'No conforme'] },
                  { k: 'obs', h: 'Obs.', w: 130 },
                ]}
                filas={items}
                setFilas={setItems}
                nueva={filaNueva}
                textoAgregar="Agregar producto"
              />
            </Tarjeta>

            <Tarjeta titulo="Cierre">
              <div className="grid md:grid-cols-3 gap-3.5">
                <Campo label="Revisó"><Texto value={cab.reviso} onChange={set('reviso')} /></Campo>
                <Campo label="Observaciones" className="md:col-span-2"><AreaTexto value={cab.obs} onChange={set('obs')} rows={2} /></Campo>
              </div>
            </Tarjeta>
          </div>
        );
      }}
    </Documento>
  );
}
