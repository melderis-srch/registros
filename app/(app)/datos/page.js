'use client';
import { useEffect, useMemo, useState } from 'react';
import { Boxes, Building2, Contact, HeartPulse, ListTree, Package, Save, Search, Stethoscope, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { norm } from '@/lib/format';
import { Boton, Selector, cx } from '@/components/ui';
import TablaItems from '@/components/TablaItems';

const IVA = ['Responsable Inscripto', 'Consumidor Final', 'Exento', 'Monotributo'];
const TABLAS = [
  { tab: 'Medicos', label: 'Médicos', icono: Stethoscope, cols: [{ k: 'nombre', h: 'Nombre (Apellido, Nombre)', min: 200 }, { k: 'especialidad', h: 'Especialidad', w: 180 }, { k: 'matProv', h: 'Mat. prov.', w: 90 }, { k: 'matNac', h: 'Mat. nac.', w: 90 }, { k: 'cuit', h: 'CUIT', w: 130 }, { k: 'localidad', h: 'Localidad', w: 140 }, { k: 'telefono', h: 'Teléfono', w: 120 }, { k: 'sellos', h: 'Sellos', w: 60, tipo: 'check', al: 'c' }] },
  { tab: 'Instituciones', label: 'Instituciones', icono: Building2, cols: [{ k: 'nombre', h: 'Nombre', min: 200 }, { k: 'direccion', h: 'Dirección', w: 180 }, { k: 'localidad', h: 'Localidad', w: 160 }, { k: 'cuit', h: 'CUIT', w: 130 }, { k: 'gln', h: 'GLN/CUFF', w: 130 }, { k: 'contacto', h: 'Contacto', w: 130 }, { k: 'km', h: 'Km', w: 70, tipo: 'num', al: 'r' }, { k: 'logistica', h: 'Costo logística', w: 120, tipo: 'num', al: 'r' }] },
  { tab: 'Clientes', label: 'Obras sociales', icono: HeartPulse, cols: [{ k: 'codigo', h: 'Código', w: 90 }, { k: 'razon', h: 'Razón social', min: 220 }, { k: 'cuit', h: 'CUIT', w: 130 }, { k: 'iva', h: 'Condición IVA', w: 180, tipo: 'select', opciones: IVA, vacio: '' }, { k: 'domicilio', h: 'Domicilio', w: 180 }, { k: 'localidad', h: 'Localidad', w: 140 }] },
  { tab: 'Proveedores', label: 'Proveedores', icono: Contact, cols: [{ k: 'razon', h: 'Razón social', min: 180 }, { k: 'cuit', h: 'CUIT', w: 130 }, { k: 'iva', h: 'Condición IVA', w: 170, tipo: 'select', opciones: IVA, vacio: '' }, { k: 'moneda', h: 'Moneda', w: 80, tipo: 'select', opciones: ['ARS', 'USD'] }, { k: 'domicilio', h: 'Domicilio', w: 170 }, { k: 'localidad', h: 'Localidad', w: 120 }, { k: 'contacto', h: 'Contacto', w: 120 }, { k: 'email', h: 'Email', w: 170 }, { k: 'telefono', h: 'Teléfono', w: 120 }, { k: 'pago', h: 'Cond. de pago', w: 130 }] },
  { tab: 'Productos', label: 'Productos', icono: Package, cols: [{ k: 'codigo', h: 'Código', w: 120 }, { k: 'desc', h: 'Descripción', min: 240, tipo: 'area' }, { k: 'marca', h: 'Marca', w: 110 }, { k: 'modelo', h: 'Modelo', w: 110 }, { k: 'origen', h: 'Origen', w: 100 }, { k: 'proveedor', h: 'Proveedor habitual', w: 140 }, { k: 'costo', h: 'Costo ref.', w: 105, tipo: 'num', al: 'r' }, { k: 'moneda', h: 'Mon.', w: 72, tipo: 'select', opciones: ['ARS', 'USD'] }, { k: 'alicuota', h: 'IVA', w: 82, tipo: 'select', opciones: ['21', '10,5', '0', 'Exento'] }, { k: 'detalle', h: 'Detalle', w: 160 }] },
  { tab: 'Sistemas', label: 'Sistemas / cajas', icono: Boxes, cols: [{ k: 'codigo', h: 'Código', w: 130 }, { k: 'desc', h: 'Descripción', min: 280, tipo: 'area' }, { k: 'marca', h: 'Marca', w: 120 }, { k: 'esteril', h: 'Estéril', w: 60, tipo: 'check', al: 'c' }, { k: 'listado', h: 'Listado de contenido', w: 160 }] },
  { tab: 'Sistemas_Contenido', label: 'Contenido de cajas', icono: ListTree, cols: [{ k: 'listado', h: 'Listado', w: 140 }, { k: 'seccion', h: 'Sección', w: 200 }, { k: 'cant', h: 'Cant.', w: 70, tipo: 'num', al: 'c' }, { k: 'codigo', h: 'Código', w: 130 }, { k: 'desc', h: 'Descripción', min: 240 }] },
];
const POR_PAGINA = 80;

export default function Datos() {
  const { inicio, actualizar, avisar } = useApp();
  const [tabla, setTabla] = useState(TABLAS[0]);
  const [filas, setFilas] = useState([]);
  const [texto, setTexto] = useState('');
  const [listado, setListado] = useState('');
  const [pagina, setPagina] = useState(0);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setFilas((inicio.maestros[tabla.tab] || []).map((f, i) => ({ ...f, _k: 'f' + i })));
    setSucio(false);
    setPagina(0);
    setTexto('');
    setListado('');
  }, [tabla, inicio.maestros]);

  const listados = useMemo(() => [...new Set((inicio.maestros.Sistemas_Contenido || []).map((r) => r.listado))].filter(Boolean).sort(), [inicio.maestros]);

  const visibles = useMemo(() => {
    const q = norm(texto).split(' ').filter(Boolean);
    return filas.filter((f) => {
      if (tabla.tab === 'Sistemas_Contenido' && listado && f.listado !== listado) return false;
      if (!q.length) return true;
      const t = norm(tabla.cols.map((c) => f[c.k]).join(' '));
      return q.every((w) => t.includes(w));
    });
  }, [filas, texto, listado, tabla]);
  const pag = visibles.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const paginas = Math.ceil(visibles.length / POR_PAGINA);

  // La tabla edita solo la página visible: se mezclan los cambios en el total por _k
  function setPag(fn) {
    setFilas((todas) => {
      const nuevas = typeof fn === 'function' ? fn(pag) : fn;
      const keys = new Set(pag.map((f) => f._k));
      const porK = new Map(nuevas.map((f) => [f._k, f]));
      const out = [];
      todas.forEach((f) => {
        if (!keys.has(f._k)) out.push(f);
        else if (porK.has(f._k)) out.push(porK.get(f._k));
      });
      nuevas.filter((f) => !keys.has(f._k)).forEach((f) => out.push(f));
      return out;
    });
    setSucio(true);
  }

  async function guardar() {
    setGuardando(true);
    try {
      const limpias = filas.map(({ _k, ...r }) => r);
      const m = await api('guardarTabla', tabla.tab, limpias);
      actualizar({ maestros: m });
      setSucio(false);
      avisar(`${tabla.label}: ${limpias.length} registros guardados.`);
    } catch (e) {
      avisar(e.message, 'err');
    }
    setGuardando(false);
  }

  function elegir(t) {
    if (sucio && !confirm('Hay cambios sin guardar en ' + tabla.label + '. ¿Descartarlos?')) return;
    setTabla(t);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[24px] font-extrabold tracking-tight">Datos</h1>
        <p className="text-gris mt-0.5">Médicos, instituciones, obras sociales, proveedores, productos y cajas. Lo que guardes acá se usa en los buscadores de todos los documentos.</p>
      </div>
      <div className="grid lg:grid-cols-[220px_1fr] gap-5">
        <nav className="bg-white rounded-xl border border-linea shadow-card p-2 h-max flex lg:flex-col gap-1 overflow-x-auto">
          {TABLAS.map((t) => (
            <button key={t.tab} onClick={() => elegir(t)} className={cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-left whitespace-nowrap', tabla.tab === t.tab ? 'bg-azul-claro text-azul-osc' : 'text-gris hover:bg-azul-50')}>
              <t.icono size={16} /> <span className="flex-1">{t.label}</span>
              <span className="text-[11px] text-gris-claro tnum">{(inicio.maestros[t.tab] || []).length}</span>
            </button>
          ))}
        </nav>

        <section className="bg-white rounded-xl border border-linea shadow-card min-w-0">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-linea">
            <h2 className="font-bold text-[15px] mr-2">{tabla.label}</h2>
            {tabla.tab === 'Sistemas_Contenido' && (
              <Selector className="!w-auto !py-1.5" value={listado} onChange={(v) => { setListado(v); setPagina(0); }} vacio="Todos los listados" opciones={listados} />
            )}
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gris-claro" />
              <input className="campo !pl-8 !py-1.5 w-[240px]" placeholder="Buscar…" value={texto} onChange={(e) => { setTexto(e.target.value); setPagina(0); }} />
            </div>
            <span className="text-[12px] text-gris">{visibles.length} de {filas.length}</span>
            <div className="ml-auto flex gap-2">
              {sucio && <Boton variante="ghost" icono={Undo2} onClick={() => setTabla({ ...tabla })}>Descartar</Boton>}
              <Boton variante="prim" icono={Save} cargando={guardando} disabled={!sucio} onClick={guardar}>Guardar {tabla.label.toLowerCase()}</Boton>
            </div>
          </div>
          <div className="p-4">
            <TablaItems
              cols={tabla.cols}
              filas={pag}
              setFilas={setPag}
              nueva={() => ({ ...(tabla.tab === 'Sistemas_Contenido' && listado ? { listado } : {}), ...(tabla.tab === 'Productos' ? { moneda: 'ARS', alicuota: '21', activo: true } : {}), _k: 'n' + Math.random().toString(36).slice(2) })}
              textoAgregar="Agregar registro"
              vacio="No hay registros con este filtro."
              pie={paginas > 1 ? (
                <div className="flex items-center gap-2 text-[12.5px]">
                  <Boton tam="sm" variante="ghost" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Boton>
                  <span className="text-gris tnum">Página {pagina + 1} de {paginas}</span>
                  <Boton tam="sm" variante="ghost" disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)}>Siguiente</Boton>
                </div>
              ) : null}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
