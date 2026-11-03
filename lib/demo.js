// Backend de demostración en memoria (DEMO=1). Imita la API de Apps Script para probar la app
// sin tocar las planillas. Los datos se pierden al reiniciar el servidor.
import { aDate, calcularOC, dmy, norm, num, pad } from '@/lib/format';

const LISTAS = {
  iva: ['Responsable Inscripto', 'Consumidor Final', 'Exento', 'Monotributo'],
  moneda: ['ARS', 'USD'],
  alicuota: ['21', '10,5', '0', 'Exento'],
  estadoConsumo: ['Registrado', 'Facturado'],
  estadoRemito: ['Emitido', 'Entregado', 'Retornado', 'Anulado'],
  estadoOC: ['Emitida', 'Enviada', 'Recibida parcial', 'Recibida', 'Anulada'],
  tipoOC: ['Orden de compra', 'Solicitud de presupuesto'],
  seccion: ['Implantado', 'Descartable'],
  inspeccion: ['Conforme', 'No conforme'],
  estadoCirugia: ['Programada', 'Realizada', 'Suspendida', 'Dada de baja', 'Facturada'],
};

const CONFIG = {
  razonSocial: 'Surchérie', subtitulo: 'Implantes quirúrgicos', domicilio: 'San Martín 4041 · 3000 Santa Fe',
  telefono: 'Tel/Fax (0342) 456 3173', email: 'ventas@surcherie.com.ar', emailTecnica: 'direcciontecnicasurcherie@gmail.com',
  condIva: 'IVA Responsable Inscripto', cuit: '30-70932838-3', iibb: 'CM 921-554855-1', inicioAct: '01/09/2005',
  gln: '7798275210004', anmat: 'Establecimiento habilitado por ANMAT, Disposición N.° 9212/15',
  confecciono: 'Bioing. Melisa Deris', aprobo: 'Ing. Gustavo Cobelli', formConsumo: 'FORM POE 14-01 REV 2',
  formRemito: 'FORM PG 19-01 REV 3', formRecepcion: 'FORM POE 15-01 REV 3',
  leyendaOC: 'La presente Orden de Compra está sujeta a las condiciones particulares establecidas más arriba, las cuales no podrán ser alteradas bajo ningún concepto sin antes obtener la conformidad escrita de SURCHERIE.',
  leyendaSolicitud: 'La presente Solicitud de Presupuesto está sujeta a las condiciones particulares establecidas más arriba, las cuales no podrán ser alteradas bajo ningún concepto sin antes obtener la conformidad escrita de SURCHERIE.',
  lugarEntrega: 'San Martín 4041 - Santa Fe', tcUSD: '1545,25', esterilizacionPorCaja: '25000',
};

function semilla() {
  const maestros = {
    Clientes: ['OSDE', 'IAPOS', 'PAMI', 'Jerárquicos', 'OSECAC', 'Avalian', 'Swiss Medical', 'Sancor', 'Ospac', 'Camioneros']
      .map((r) => ({ codigo: '', razon: r, cuit: '', domicilio: '', localidad: '', iva: '' })),
    Proveedores: [
      { codigo: 'NOVAX', razon: 'NOVAX', cuit: '30-66114620-2', iva: 'Responsable Inscripto', domicilio: 'Manuel Fraga 923', localidad: 'CABA', contacto: '', email: '', telefono: '', moneda: 'USD', pago: '0/30/60/90/120' },
      { codigo: 'CROSMED', razon: 'CROSMED', cuit: '30-70842959-3', iva: 'Responsable Inscripto', domicilio: 'Aguirre 545', localidad: 'CABA', contacto: '', email: '', telefono: '', moneda: 'USD', pago: '' },
      { codigo: 'IPMAGNA', razon: 'IPMAGNA', cuit: '30-70802391-0', iva: 'Responsable Inscripto', domicilio: 'Sanchez de Bustamante 485', localidad: 'Buenos Aires', contacto: '', email: '', telefono: '', moneda: 'ARS', pago: '' },
      { codigo: 'LAB_BIOXEN', razon: 'LABORATORIO BIOXEN', cuit: '30-71055038-3', iva: 'Responsable Inscripto', domicilio: 'Salta 1733', localidad: 'Rosario', contacto: '', email: '', telefono: '', moneda: 'ARS', pago: '' },
      { codigo: 'SURGICAL', razon: 'SURGICAL SUPPLY', cuit: '30-71047872-0', iva: 'Responsable Inscripto', domicilio: 'Pasteur 3489', localidad: 'BS AS', contacto: '', email: '', telefono: '', moneda: 'ARS', pago: '' },
    ],
    Medicos: [
      { nombre: 'Ejemplo, Martín', cuit: '', localidad: 'Santa Fe', matProv: '4055', matNac: '', especialidad: 'Neurocirujano', telefono: '', sellos: false },
      { nombre: 'Muestra, Laura', cuit: '', localidad: 'Paraná', matProv: '12943', matNac: '', especialidad: 'Traumatología - Columna', telefono: '', sellos: false },
      { nombre: 'Prueba, Diego', cuit: '', localidad: 'Santa Fe', matProv: '8284', matNac: '', especialidad: 'Ortopedia y traumatología', telefono: '', sellos: true },
    ],
    Instituciones: [
      { nombre: 'Hospital Cullen', gln: '', cuit: '33-67836114-9', direccion: 'Av. Freyre 2150', localidad: 'Santa Fe - Santa Fe', contacto: '', km: 3.952, logistica: 8400 },
      { nombre: 'Sanatorio Adventista del Plata', gln: '9960110130015', cuit: '30-70735360-7', direccion: '25 de Mayo 255', localidad: 'Lib. San Martin - ER', contacto: '', km: 90, logistica: 212670 },
      { nombre: 'Clínica Modelo', gln: '996013041005', cuit: '30-54585993-5', direccion: 'Gral Jose de San Martin 1238', localidad: 'Paraná - Entre Ríos', contacto: '', km: 22, logistica: 42800 },
      { nombre: 'Sanatorio Santa Fe', gln: '', cuit: '', direccion: '', localidad: 'Santa Fe', contacto: '', km: 3.952, logistica: 8400 },
    ],
    Sistemas: [
      { codigo: 'quim', desc: 'Sistema de Fijación dorsolumbar Modelo: QUIMERA. Compuesto por tornillos pediculares poliaxiales en todas sus medidas y barras de titanio. Set instrumental y Cizalla', marca: 'NOVAX', esteril: false, listado: 'quimera1' },
      { codigo: 'cage', desc: 'Juego de Cage bloqueados de peek/titanio con sus correspondientes tornillos e instrumental de colocación. Alternativas de medidas', marca: 'NOVAX', esteril: false, listado: 'cage + trim' },
      { codigo: 'vtp', desc: 'Set VTP. Contiene agujas y dosis de cemento', marca: 'SUBITON', esteril: true, listado: '' },
      { codigo: 'drill', desc: 'Equipo de drill con fresas y accesorios', marca: 'NSK', esteril: false, listado: '' },
    ],
    Sistemas_Contenido: [
      { listado: 'quimera1', seccion: 'INSTRUMENTAL BANDEJA 1', cant: 1, codigo: '7480104', desc: 'PUNTA REDONDA' },
      { listado: 'quimera1', seccion: 'INSTRUMENTAL BANDEJA 1', cant: 1, codigo: '11002600', desc: 'PUNTA CUADRADA' },
      { listado: 'quimera1', seccion: 'INSTRUMENTAL BANDEJA 1', cant: 1, codigo: '7480112', desc: 'SONDA PEDICULAR CURVA' },
      { listado: 'quimera1', seccion: 'INSTRUMENTAL BANDEJA 2', cant: 1, codigo: '110 014 00', desc: 'DOBLADORA DE BARRA' },
      { listado: 'cage + trim', seccion: 'INSTRUMENTAL', cant: 1, codigo: '060 008 32', desc: 'ATORNILLADOR HEX. 2.5 P/ACOPLE RÁPIDO' },
      { listado: 'cage + trim', seccion: 'IMPLANTES', cant: 3, codigo: 'CP-5-P', desc: 'Celda cervical bloqueada 5mm' },
    ],
    Productos: [
      { codigo: 'SPP 59 40S', desc: 'Tornillo pedicular poliaxial estándar diam 5.9x40mm', marca: 'NOVAX', modelo: 'Quimera', detalle: '', origen: 'Nacional', proveedor: 'NOVAX', costo: 65.6, moneda: 'USD', alicuota: '21', activo: true },
      { codigo: '61-1001', desc: 'Tapón', marca: 'NOVAX', modelo: 'Quimera', detalle: '', origen: 'Nacional', proveedor: 'NOVAX', costo: 10.4, moneda: 'USD', alicuota: '21', activo: true },
      { codigo: 'CP-6-P', desc: 'Celda cervical de 12.4x14x6mm – PEEK', marca: 'NOVAX', modelo: '', detalle: '', origen: 'Nacional', proveedor: 'NOVAX', costo: 267, moneda: 'USD', alicuota: '21', activo: true },
      { codigo: 'bd_10', desc: 'Sustituto óseo biológico BIODESIS 10cc', marca: 'Biodesis', modelo: '', detalle: '', origen: 'Nacional', proveedor: 'LABORATORIO BIOXEN', costo: 150040, moneda: 'ARS', alicuota: '10,5', activo: true },
      { codigo: 'KIMP 410 L', desc: 'Inserto tibial 4x10 IZQUIERDO', marca: 'Microport', modelo: 'Advance', detalle: '', origen: 'Importado', proveedor: 'CROSMED', costo: 250, moneda: 'USD', alicuota: '21', activo: true },
      { codigo: '880832', desc: 'Cemento para cifoplastia. Marca: IPM', marca: 'IPM', modelo: '', detalle: '', origen: '', proveedor: 'IPMAGNA', costo: 289256.2, moneda: 'ARS', alicuota: '21', activo: true },
      { codigo: 'p_iodado', desc: 'Paño iodado', marca: '', modelo: '', detalle: '', origen: '', proveedor: 'SURGICAL SUPPLY', costo: 7714.17, moneda: 'ARS', alicuota: '21', activo: true },
    ],
  };
  const base = new Date();
  const d = (delta) => dmy(new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta, 12));
  const cir = (id, fecha, medico, paciente, institucion, procedimiento, obraSocial, extra = {}) => ({
    id, fila: 0, rcc: '', fecha, medico, paciente, institucion, procedimiento, obraSocial, remito: '', obs: '',
    instrumentador: '', presupuesto: '', pendiente: !fecha, estado: 'Programada',
    checklist: { firma: false, sello: false, protocolo: false, certificado: false, rx: false, epicrisis: false }, ...extra,
  });
  const cirugias = [
    cir('C1', d(-6), 'Prueba, Diego', 'Juan Pérez', 'Clínica Modelo', 'Fij 4 niv + sustituto', 'OSDE', { estado: 'Realizada', rcc: '004-376', remito: '3611' }),
    cir('C2', d(-3), 'Ejemplo, Martín', 'Ana Gómez', 'Hospital Cullen', '2 cage bloq n°5 + drill', 'IAPOS'),
    cir('C3', d(-1), 'Muestra, Laura', 'Carlos Ruiz', 'Sanatorio Santa Fe', '1 VTP', 'PAMI', { estado: 'Suspendida' }),
    cir('C4', d(0), 'Prueba, Diego', 'María López', 'Sanatorio Adventista del Plata', 'Fij 2 niv + drill + haemocer', 'Avalian'),
    cir('C5', d(0), 'Ejemplo, Martín', 'Lucía Fernández', 'Clínica Modelo', 'Cráneo 3D + cierres', 'Jerárquicos'),
    cir('C6', d(2), 'Muestra, Laura', 'Pedro Sánchez', 'Hospital Cullen', 'Expansible cervical + placa', 'Sancor'),
    cir('C7', d(5), 'Prueba, Diego', 'Sofía Díaz', 'Sanatorio Santa Fe', 'RTR izquierda', 'OSECAC'),
    cir('C8', d(9), 'Ejemplo, Martín', 'Jorge Romero', 'Clínica Modelo', '2 cifoplastias', 'Swiss Medical'),
    cir('C9', '', 'Muestra, Laura', 'Elena Castro', 'Hospital Cullen', 'Escoliosis', ''),
    cir('C10', '', 'Prueba, Diego', 'Raúl Medina', 'Clínica Modelo', 'Fij 3 niv + 2 cage lumbar', 'Ospac'),
  ];
  const docs = { consumo: {}, remito: {}, oc: {}, recepcion: {} };
  docs.remito['0001-00003611'] = {
    cab: { numero: '0001-00003611', fecha: d(-7), estado: 'Retornado', idCirugia: 'C1', rcc: '004-376', institucion: 'Clínica Modelo', gln: '996013041005', cuit: '30-54585993-5', direccion: 'Gral Jose de San Martin 1238', localidad: 'Paraná - Entre Ríos', fechaCx: d(-6), medico: 'Prueba, Diego', paciente: 'Juan Pérez', transportista: 'Noelia', obs: '', cajasEnviadas: 5, cajasVueltas: 5, anexo: true, pdf: '' },
    items: [{ renglon: 1, codigo: 'quim', desc: maestros.Sistemas[0].desc, marca: 'NOVAX', cant: 5, esteril: false, vueltas: 5, obsRetorno: '', contenido: null }],
  };
  docs.oc['0001-00003684'] = {
    cab: { numero: '0001-00003684', tipo: 'Orden de compra', fecha: d(-2), estado: 'Recibida parcial', pedido: 'repo inserto', proveedor: 'CROSMED', cuit: '30-70842959-3', domicilio: 'Aguirre 545', localidad: 'CABA', formaEnvio: 'Encomienda', fechaEnvio: '', pago: '', plazo: '', lugar: 'San Martín 4041 - Santa Fe', moneda: 'USD', tc: 1545.25, descuento: 0, idCirugia: '', rcc: '', fechaCx: '', medico: '', institucion: '', paciente: '', facturas: '00003-00018509', obs: '', pdf: '' },
    items: [
      { renglon: 1, codigo: 'KIMP 410 L', desc: 'Inserto tibial 4x10 IZQUIERDO', cant: 1, costo: 250, alicuota: '21', recibido: 1, pendiente: 0 },
      { renglon: 2, codigo: 'KIMP 412 L', desc: 'Inserto tibial 4x12 IZQUIERDO', cant: 1, costo: 250, alicuota: '21', recibido: 0, pendiente: 1 },
    ],
  };
  docs.recepcion['00001'] = {
    cab: { numero: '00001', fecha: d(-1), oc: '0001-00003684', proveedor: 'CROSMED', marca: 'Microport', origen: 'Importado', remitoProv: '0001-00024131', factura: '00003-00018509', valorFactura: 302.5, descripcion: 'repo inserto', cantTotal: 1, reviso: 'Bioing. Melisa Deris', obs: '', pdf: '' },
    items: [{ renglon: 1, oc: '0001-00003684', renglonOc: 1, codigo: 'KIMP 410 L', desc: 'Inserto tibial 4x10 IZQUIERDO', lote: 'AC5849', vto: '30/09/2030', cant: 1, empaque: 'Conforme', rotulo: 'Conforme', obs: '' }],
  };
  docs.oc['0001-00003684'].items.forEach((x) => Object.assign(x, calcularOC([x]).filas[0]));
  Object.assign(docs.oc['0001-00003684'].cab, (({ subtotal, iva21, iva105, exento, total }) => ({ subtotal, iva21, iva105, exento, total }))(calcularOC(docs.oc['0001-00003684'].items)));
  return { maestros, cirugias, docs, ult: { consumo: 4376, remito: 3611, oc: 3684, solicitud: 3, recepcion: 1 } };
}

const g = globalThis;
g.__demo = g.__demo || semilla();
const S = () => g.__demo;

const fmtNum = {
  consumo: (n) => pad(Math.floor(n / 1000), 3) + '-' + pad(n % 1000, 3),
  remito: (n) => '0001-' + pad(n, 8),
  oc: (n) => '0001-' + pad(n, 8),
  solicitud: (n) => '0000-' + pad(n, 4),
  recepcion: (n) => pad(n, 5),
};
const serie = (tipo, cab) => (tipo === 'oc' && cab?.tipo === 'Solicitud de presupuesto' ? 'solicitud' : tipo);
const proximos = () => Object.fromEntries(Object.keys(fmtNum).map((k) => [k, fmtNum[k](S().ult[k] + 1)]));
const clonar = (o) => JSON.parse(JSON.stringify(o));

function lotes() {
  const o = {};
  Object.values(S().docs.recepcion).forEach((r) => r.items.forEach((it) => {
    if (!it.lote) return;
    const k = String(it.codigo).toUpperCase();
    (o[k] = o[k] || []).some((x) => x.lote === it.lote) || o[k].push({ lote: it.lote, vto: it.vto });
  }));
  return o;
}

function docsDe(c) {
  const { docs } = S();
  return {
    ...c,
    docs: {
      consumos: Object.values(docs.consumo).filter((x) => x.cab.idCirugia === c.id).map((x) => ({ numero: x.cab.numero, estado: x.cab.estado, pdf: x.cab.pdf })),
      remitos: Object.values(docs.remito).filter((x) => x.cab.idCirugia === c.id).map((x) => ({ numero: x.cab.numero, estado: x.cab.estado, pdf: x.cab.pdf, cajas: x.cab.cajasEnviadas, vueltas: x.cab.cajasVueltas })),
      ocs: Object.values(docs.oc).filter((x) => x.cab.idCirugia === c.id).map((x) => ({ numero: x.cab.numero, tipo: x.cab.tipo, estado: x.cab.estado, proveedor: x.cab.proveedor, pdf: x.cab.pdf })),
    },
  };
}

function recalcOC(numero) {
  const oc = S().docs.oc[numero];
  if (!oc) return;
  const recs = Object.values(S().docs.recepcion).filter((r) => r.cab.oc === numero);
  let todo = true, algo = false;
  oc.items.forEach((it) => {
    const rec = recs.flatMap((r) => r.items).filter((ri) => (ri.renglonOc ? +ri.renglonOc === +it.renglon : norm(ri.codigo) === norm(it.codigo))).reduce((s, ri) => s + num(ri.cant), 0);
    it.recibido = rec;
    it.pendiente = Math.max(num(it.cant) - rec, 0);
    if (it.pendiente > 0) todo = false;
    if (rec > 0) algo = true;
  });
  oc.cab.facturas = [...new Set(recs.map((r) => r.cab.factura).filter(Boolean))].join(' · ');
  if (oc.cab.estado !== 'Anulada' && serie('oc', oc.cab) === 'oc') {
    if (oc.items.length && todo && algo) oc.cab.estado = 'Recibida';
    else if (algo) oc.cab.estado = 'Recibida parcial';
  }
}

function calcular(tipo, c, items) {
  if (tipo === 'oc') {
    const r = calcularOC(items, c.descuento);
    r.filas.forEach((f, i) => Object.assign(items[i], f, { recibido: items[i].recibido || 0, pendiente: num(items[i].cant) - num(items[i].recibido) }));
    Object.assign(c, { subtotal: r.subtotal, iva21: r.iva21, iva105: r.iva105, exento: r.exento, total: r.total });
    c.estado = c.estado || 'Emitida';
  }
  if (tipo === 'consumo') {
    const tc = num(c.tc) || num(CONFIG.tcUSD);
    let imp = 0, des = 0;
    items.forEach((x) => {
      x.costoArs = Math.round(num(x.cant) * num(x.costo) * (x.moneda === 'USD' ? tc : 1) * 100) / 100;
      x.seccion === 'Descartable' ? (des += x.costoArs) : (imp += x.costoArs);
    });
    Object.assign(c, { tc, costoImplantes: imp, costoDescartables: des, costoTotal: imp + des + num(c.costoLogistica) + num(c.costoEsterilizacion) + num(c.costoOtros) });
    c.estado = c.estado || 'Registrado';
  }
  if (tipo === 'remito') {
    c.cajasEnviadas = items.reduce((s, x) => s + num(x.cant), 0);
    c.cajasVueltas = items.reduce((s, x) => s + num(x.vueltas), 0);
    c.estado = c.estado || 'Emitido';
  }
  if (tipo === 'recepcion') c.cantTotal = items.reduce((s, x) => s + num(x.cant), 0);
}

const acciones = {
  getInicio: (_a, email) => ({ usuario: email, config: CONFIG, logo: '', listas: LISTAS, proximos: proximos(), maestros: clonar(S().maestros), lotes: lotes() }),

  getCirugias: ([desde, hasta]) => {
    const a = aDate(desde), b = aDate(hasta);
    return clonar(S().cirugias.filter((c) => c.pendiente || (!c.fecha ? false : aDate(c.fecha) >= a && aDate(c.fecha) <= b)).map(docsDe));
  },
  getCirugia: ([id]) => {
    const c = S().cirugias.find((x) => x.id === id);
    if (!c) throw new Error('No encontré la cirugía.');
    return clonar(docsDe(c));
  },
  guardarCirugia: ([c]) => {
    const l = S().cirugias;
    let x = c.id && l.find((y) => y.id === c.id);
    if (!x) {
      x = { id: 'C' + Math.random().toString(36).slice(2, 8), rcc: '', remito: '' };
      l.push(x);
    }
    Object.assign(x, clonar(c), { id: x.id, rcc: x.rcc, remito: x.remito, pendiente: !c.fecha });
    if (!x.estado) x.estado = 'Programada';
    return clonar(x);
  },

  getDocumento: ([tipo, numero]) => {
    const d = S().docs[tipo][numero];
    if (!d) throw new Error('No existe el documento ' + numero);
    const out = clonar({ tipo, cab: d.cab, items: d.items });
    if (tipo === 'oc') out.recepciones = Object.values(S().docs.recepcion).filter((r) => r.cab.oc === numero).map((r) => r.cab);
    return out;
  },
  guardarDocumento: ([tipo, d]) => {
    const st = S(), cab = clonar(d.cab), items = clonar(d.items || []);
    let numero = d.editar;
    const previo = numero && st.docs[tipo][numero];
    if (previo && tipo === 'oc' && serie('oc', previo.cab) !== serie('oc', cab)) numero = '';
    if (!numero) {
      const s = serie(tipo, cab);
      st.ult[s] += 1;
      numero = fmtNum[s](st.ult[s]);
    }
    if (previo && numero !== d.editar) delete st.docs[tipo][d.editar];
    cab.numero = numero;
    cab.pdf = previo ? previo.cab.pdf || '' : '';
    items.forEach((it, i) => { it.renglon = i + 1; if (tipo === 'recepcion') it.oc = cab.oc; });
    calcular(tipo, cab, items);
    st.docs[tipo][numero] = { cab, items };
    const c = d.cirugia && st.cirugias.find((x) => x.id === d.cirugia.id);
    if (c && tipo === 'consumo') { c.rcc = numero; if (c.estado === 'Programada') c.estado = 'Realizada'; }
    if (c && tipo === 'remito') { const n = String(+numero.split('-')[1]); c.remito = c.remito ? (c.remito.split(' / ').includes(n) ? c.remito : c.remito + ' / ' + n) : n; }
    if (tipo === 'recepcion') { recalcOC(cab.oc); if (previo && previo.cab.oc !== cab.oc) recalcOC(previo.cab.oc); }
    if (tipo === 'oc') recalcOC(numero);
    return { numero, proximos: proximos(), lotes: tipo === 'recepcion' ? lotes() : null };
  },
  guardarRetorno: ([numero, items, estado]) => {
    const r = S().docs.remito[numero];
    items.forEach((it) => { const x = r.items.find((y) => +y.renglon === +it.renglon); if (x) Object.assign(x, { vueltas: num(it.vueltas), obsRetorno: it.obsRetorno }); });
    const vueltas = r.items.reduce((s, x) => s + num(x.vueltas), 0), enviadas = r.items.reduce((s, x) => s + num(x.cant), 0);
    r.cab.cajasVueltas = vueltas;
    r.cab.estado = estado || (vueltas >= enviadas && enviadas ? 'Retornado' : r.cab.estado);
    return { vueltas, enviadas, estado: r.cab.estado };
  },
  cambiarEstado: ([tipo, numero, estado]) => { S().docs[tipo][numero].cab.estado = estado; return estado; },
  subirPdf: async ([tipo, numero, b64, nombre]) => {
    if (process.env.DEMO_PDF_DIR) {
      const fs = await import('node:fs');
      fs.mkdirSync(process.env.DEMO_PDF_DIR, { recursive: true });
      fs.writeFileSync(process.env.DEMO_PDF_DIR + '/' + nombre, Buffer.from(b64, 'base64'));
    }
    const url = 'https://drive.google.com/demo/' + tipo + '/' + numero;
    S().docs[tipo][numero].cab.pdf = url;
    return { url };
  },
  getCompras: () => {
    const { docs } = S();
    const ocs = Object.values(docs.oc).map((o) => ({ ...clonar(o.cab), items: clonar(o.items), recepciones: Object.values(docs.recepcion).filter((r) => r.cab.oc === o.cab.numero).map((r) => ({ ...clonar(r.cab), items: clonar(r.items) })) }));
    ocs.sort((a, b) => (serie('oc', a) !== serie('oc', b) ? (serie('oc', a) === 'oc' ? -1 : 1) : b.numero.localeCompare(a.numero)));
    const sueltas = Object.values(docs.recepcion).filter((r) => !r.cab.oc || !docs.oc[r.cab.oc]).map((r) => ({ ...clonar(r.cab), items: clonar(r.items) }));
    return { ocs, sueltas };
  },
  generarOCsReposicion: ([rcc], email) => {
    const cons = S().docs.consumo[rcc];
    if (!cons) throw new Error('No existe el registro ' + rcc);
    const grupos = {}, sinProveedor = [];
    cons.items.forEach((it) => {
      const p = S().maestros.Productos.find((x) => norm(x.codigo) === norm(it.codigo)) || {};
      const prov = it.proveedor || p.proveedor;
      if (!prov) return sinProveedor.push(it.desc);
      (grupos[norm(prov)] = grupos[norm(prov)] || { nombre: prov, items: [] }).items.push({ codigo: it.codigo, desc: it.desc, cant: it.cant, costo: p.costo || it.costo || 0, alicuota: p.alicuota || '21' });
    });
    const creadas = Object.values(grupos).map((gr) => {
      const pv = S().maestros.Proveedores.find((p) => norm(p.razon) === norm(gr.nombre)) || {};
      const r = acciones.guardarDocumento(['oc', {
        cab: { tipo: 'Orden de compra', fecha: dmy(new Date()), estado: 'Emitida', pedido: 'Repo ' + cons.cab.paciente + ' (RCC ' + rcc + ')', proveedor: pv.razon || gr.nombre, cuit: pv.cuit || '', domicilio: pv.domicilio || '', localidad: pv.localidad || '', pago: pv.pago || '', lugar: CONFIG.lugarEntrega, moneda: pv.moneda || 'ARS', tc: pv.moneda === 'USD' ? num(CONFIG.tcUSD) : '', descuento: 0, idCirugia: cons.cab.idCirugia, rcc, fechaCx: cons.cab.fechaCx, medico: cons.cab.medico, institucion: cons.cab.institucion, paciente: cons.cab.paciente },
        items: gr.items,
      }], email);
      return { numero: r.numero, proveedor: pv.razon || gr.nombre, items: gr.items.length };
    });
    cons.cab.ocs = [cons.cab.ocs, ...creadas.map((c) => c.numero)].filter(Boolean).join(' · ');
    return { creadas, sinProveedor };
  },
  getTabla: ([tab]) => ({ filas: clonar(S().maestros[tab] || []) }),
  guardarTabla: ([tab, filas]) => { S().maestros[tab] = clonar(filas); return clonar(S().maestros); },
  agregarMaestro: ([tab, obj]) => { S().maestros[tab].push(clonar(obj)); return clonar(S().maestros); },
};

export async function demo(accion, args, email) {
  const f = acciones[accion];
  if (!f) throw new Error('Acción desconocida en demo: ' + accion);
  await new Promise((r) => setTimeout(r, 150));
  return f(args, email);
}
