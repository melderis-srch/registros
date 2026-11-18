// Backend de demostración en memoria (DEMO=1). Imita la API de Apps Script para probar la app
// sin tocar las planillas. Los datos se pierden al reiniciar el servidor.
import { aDate, calcularOC, dmy, iso, norm, num, pad } from '@/lib/format';

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
  const lote = (vto, disp, total = disp) => ({ vto, vtoIso: iso(aDate(vto)), disp, total });
  const stock = [
    { codigo: 'SPP 59 40S', desc: 'Tornillo pedicular poliaxial estándar diam 5.9x40mm', proveedor: 'NOVAX', marca: 'Quimera', sid: 'demo1', hoja: '5.9x40', precioOC: 65.6, minimo: 10, lotes: { 'L2401': lote('01/06/2029', 3, 6), 'L2312': lote('01/02/2027', 1, 4) }, error: '' },
    { codigo: 'CP-6-P', desc: 'Celda cervical de 12.4x14x6mm – PEEK', proveedor: 'NOVAX', marca: '', sid: 'demo2', hoja: '6mm', precioOC: 267, minimo: 2, lotes: { 'C881': lote('01/03/2030', 4) }, error: '' },
    { codigo: 'bd_10', desc: 'Sustituto óseo biológico BIODESIS 10cc', proveedor: 'LABORATORIO BIOXEN', marca: 'Biodesis', sid: 'demo3', hoja: '10cc', precioOC: 150040, minimo: 5, lotes: { 'HA1': lote('01/12/2026', 2, 3), 'HA7': lote('01/07/2027', 1) }, error: '' },
    { codigo: '880832', desc: 'Cemento para cifoplastia. Marca: IPM', proveedor: 'IPMAGNA', marca: 'IPM', sid: 'demo4', hoja: 'Cemento', precioOC: 289256.2, minimo: 3, lotes: { 'IP55': lote('01/01/2028', 6) }, error: '' },
    { codigo: 'KIMP 410 L', desc: 'Inserto tibial 4x10 IZQUIERDO', proveedor: 'CROSMED', marca: 'Microport', sid: 'demo5', hoja: '4x10 IZQ', precioOC: 250, minimo: 0, lotes: {}, error: 'No existe la pestaña "4x10 IZQ"' },
  ].map((s) => ({ ...s, disp: Object.values(s.lotes).reduce((a, l) => a + l.disp, 0), leido: dmy(new Date()) }));
  const cons = (numero, idCirugia, fechaCx, paciente, medico, items, extra = {}) => {
    docs.consumo[numero] = { cab: { numero, fecha: fechaCx, estado: 'Registrado', idCirugia, fechaCx, paciente, medico, institucion: 'Clínica Modelo', obraSocial: 'OSDE', procedimiento: '', revisar: '', ...extra },
      items: items.map((x, i) => ({ renglon: i + 1, seccion: 'Implantado', marca: '', costo: '', moneda: 'ARS', lote: '', baja: '', oc: '', ...x })) };
  };
  cons('004-375', '', d(-45), 'Rosa Ibarra', 'Muestra, Laura', [{ codigo: 'bd_10', desc: 'Sustituto óseo biológico BIODESIS 10cc', cant: 1, proveedor: 'LABORATORIO BIOXEN' }]);
  cons('004-376', 'C1', d(-6), 'Juan Pérez', 'Prueba, Diego', [
    { codigo: 'SPP 59 40S', desc: 'Tornillo pedicular poliaxial estándar diam 5.9x40mm', cant: 4, proveedor: 'NOVAX', lote: 'L2401' },
    { codigo: 'bd_10', desc: 'Sustituto óseo biológico BIODESIS 10cc', cant: 1, proveedor: 'LABORATORIO BIOXEN', lote: 'HA1' },
    { seccion: 'Descartable', codigo: 'p_iodado', desc: 'Paño iodado', cant: 1, proveedor: 'SURGICAL SUPPLY' },
  ]);
  return { maestros, cirugias, docs, stock, kardexLeido: '', ult: { consumo: 4376, remito: 3611, oc: 3684, solicitud: 3, recepcion: 1 } };
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
    let kardex = null;
    if (tipo === 'recepcion') { recalcOC(cab.oc); if (previo && previo.cab.oc !== cab.oc) recalcOC(previo.cab.oc); kardex = ingresoKardex(st.docs.recepcion[numero]); }
    if (tipo === 'oc') recalcOC(numero);
    return { numero, proximos: proximos(), lotes: tipo === 'recepcion' ? lotes() : null, kardex };
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

// ---- Kardex, stock, reposición y pendientes (imita gas/Kardex.gs) ----
const nc = (s) => String(s || '').toLowerCase().replace(/[\s\-_.]/g, '');
const buscarStock = (codigo, desc) => S().stock.find((s) => codigo && nc(s.codigo) === nc(codigo)) || S().stock.find((s) => desc && norm(s.desc) === norm(desc)) || null;
const diasDesde = (f) => { const d = aDate(f); if (!d) return null; const h = new Date(); return Math.round((new Date(h.getFullYear(), h.getMonth(), h.getDate(), 12) - d) / 864e5); };
const diasTxt = (d) => (d == null ? '—' : d === 0 ? 'hoy' : d === 1 ? '1 día' : d + ' días');
const recalcStock = (s) => { s.disp = Object.values(s.lotes).reduce((a, l) => a + l.disp, 0); s.leido = dmy(new Date()); };
const flags = (s) => {
  const lim = new Date(); lim.setMonth(lim.getMonth() + 6);
  const L = iso(lim), H = iso(new Date());
  const ls = Object.values(s.lotes);
  return { bajoMin: s.minimo > 0 && s.disp < s.minimo, vence: ls.some((l) => l.disp > 0 && l.vtoIso && l.vtoIso < L), vencido: ls.some((l) => l.disp > 0 && l.vtoIso && l.vtoIso < H) };
};
function pendRCC() {
  const out = [];
  Object.values(S().docs.consumo).forEach(({ cab, items }) => {
    if (String(cab.revisar || '').trim()) return;
    items.forEach((it) => {
      if (it.oc || !(it.desc || it.codigo) || !num(it.cant)) return;
      const p = S().maestros.Productos.find((x) => nc(x.codigo) === nc(it.codigo)) || {};
      const proveedor = it.proveedor || p.proveedor;
      if (proveedor) out.push({ numero: cab.numero, renglon: it.renglon, fechaCx: cab.fechaCx, paciente: cab.paciente, codigo: it.codigo, desc: it.desc, cant: num(it.cant), proveedor, costo: num(p.costo) || num(it.costo), alicuota: p.alicuota || '21' });
    });
  });
  return out;
}
function faltantes(pend) {
  const pedido = {};
  Object.values(S().docs.oc).forEach((o) => {
    if (serie('oc', o.cab) !== 'oc' || ['Recibida', 'Anulada'].includes(o.cab.estado)) return;
    o.items.forEach((it) => { const s = buscarStock(it.codigo, it.desc); if (s) pedido[s.codigo] = (pedido[s.codigo] || 0) + Math.max(0, num(it.cant) - num(it.recibido)); });
  });
  pend.forEach((x) => { const s = buscarStock(x.codigo, x.desc); if (s) pedido[s.codigo] = (pedido[s.codigo] || 0) + x.cant; });
  return S().stock.filter((s) => s.minimo > 0 && s.disp < s.minimo)
    .map((s) => ({ codigo: s.codigo, desc: s.desc, proveedor: s.proveedor, disp: s.disp, minimo: s.minimo, pedido: pedido[s.codigo] || 0, falta: Math.max(0, s.minimo - s.disp - (pedido[s.codigo] || 0)), costo: s.precioOC }))
    .filter((x) => x.falta > 0);
}
function ingresoKardex(rec) {
  const out = { ok: 0, sinKardex: [], errores: [] };
  rec.items.forEach((it) => {
    if (it.kardex) return;
    const s = buscarStock(it.codigo, it.desc);
    if (!s) { out.sinKardex.push(it.desc || it.codigo); it.kardex = 'Sin planilla de kardex'; return; }
    const l = s.lotes[it.lote] || (s.lotes[it.lote] = { vto: it.vto, vtoIso: iso(aDate(it.vto)), disp: 0, total: 0 });
    l.disp += num(it.cant); l.total += num(it.cant); recalcStock(s);
    it.kardex = 'Cargado ' + dmy(new Date()) + ' · ' + s.hoja; out.ok++;
  });
  return out;
}

Object.assign(acciones, {
  getStock: () => ({ leido: S().kardexLeido, productos: S().stock.map((s) => ({ ...clonar(s), ...flags(s) })) }),
  kardexSync: ([desde = 0, cuantos = 25]) => {
    const total = S().stock.length, hechos = Math.min(desde + cuantos, total);
    if (hechos >= total) { const n = new Date(); S().kardexLeido = dmy(n) + ' ' + pad(n.getHours()) + ':' + pad(n.getMinutes()); }
    return { total, hechos, siguiente: hechos >= total ? null : hechos, errores: S().stock.filter((s) => s.error).length };
  },
  guardarLotes: ([numero, lotes]) => {
    const c = S().docs.consumo[numero];
    (lotes || []).forEach((x) => { const it = c.items.find((i) => +i.renglon === +x.renglon); if (it && !it.baja && (!x.desc || norm(x.desc) === norm(it.desc))) it.lote = String(x.lote || '').trim(); });
    return true;
  },
  darBajaConsumo: ([numero]) => {
    const c = S().docs.consumo[numero];
    if (!c) throw new Error('No existe el registro ' + numero);
    const r = { ok: 0, errores: [], sinKardex: [] };
    c.items.forEach((it) => {
      if (it.baja) return;
      const s = buscarStock(it.codigo, it.desc);
      if (!s) { r.sinKardex.push(it.desc); return; }
      const cant = num(it.cant) || 1;
      const lote = it.lote || Object.keys(s.lotes).filter((l) => s.lotes[l].disp > 0).sort((a, b) => s.lotes[a].vtoIso.localeCompare(s.lotes[b].vtoIso))[0];
      if (!lote || !s.lotes[lote] || s.lotes[lote].disp < cant) { r.errores.push(`${it.desc}: ${it.lote ? `el lote ${it.lote} tiene ${s.lotes[it.lote]?.disp || 0} disponibles` : 'no hay stock disponible'} en ${s.hoja}`); return; }
      s.lotes[lote].disp -= cant; recalcStock(s);
      it.baja = `${dmy(new Date())} · lote ${lote} · filas 12${cant > 1 ? '–' + (11 + cant) : ''}${it.lote ? '' : ' · lote asumido'}`;
      it.lote = lote; r.ok++;
    });
    return r;
  },
  getReposicion: () => {
    const rcc = pendRCC();
    return { rcc, stock: faltantes(rcc), emitidas: Object.values(S().docs.oc).filter((o) => serie('oc', o.cab) === 'oc' && o.cab.estado === 'Emitida').map((o) => ({ numero: o.cab.numero, proveedor: o.cab.proveedor, fecha: o.cab.fecha })) };
  },
  pasarAOC: ([destino, proveedor, refs, extras], email) => {
    const elegidos = (refs || []).map((r) => S().docs.consumo[r.numero]?.items.find((i) => +i.renglon === +r.renglon && !i.oc)).filter(Boolean);
    const nuevos = elegidos.map((it) => { const p = S().maestros.Productos.find((x) => nc(x.codigo) === nc(it.codigo)) || {}; return { codigo: it.codigo, desc: it.desc, cant: num(it.cant), costo: num(p.costo) || num(it.costo), alicuota: p.alicuota || '21' }; })
      .concat((extras || []).map((x) => ({ codigo: x.codigo, desc: x.desc, cant: num(x.cant), costo: num(x.costo), alicuota: '21' })));
    if (!nuevos.length) throw new Error('No hay ítems para pasar (¿ya estaban en otra OC?).');
    let cab, items;
    if (destino) {
      const o = S().docs.oc[destino];
      if (!o) throw new Error('No existe la OC ' + destino);
      if (o.cab.estado !== 'Emitida') throw new Error(`La OC ${destino} ya no está Emitida (${o.cab.estado}): armá una nueva.`);
      cab = clonar(o.cab); items = clonar(o.items).map(({ codigo, desc, cant, costo, alicuota }) => ({ codigo, desc, cant, costo, alicuota }));
    } else {
      const pv = S().maestros.Proveedores.find((p) => norm(p.razon) === norm(proveedor)) || {};
      cab = { tipo: 'Orden de compra', fecha: dmy(new Date()), estado: 'Emitida', pedido: 'Reposición', proveedor: pv.razon || proveedor, cuit: pv.cuit || '', domicilio: pv.domicilio || '', localidad: pv.localidad || '', pago: pv.pago || '', lugar: CONFIG.lugarEntrega, moneda: pv.moneda || 'ARS', tc: pv.moneda === 'USD' ? num(CONFIG.tcUSD) : '', descuento: 0, obs: '' };
      items = [];
    }
    nuevos.forEach((x) => { const y = items.find((i) => (x.codigo && nc(i.codigo) === nc(x.codigo)) || norm(i.desc) === norm(x.desc)); if (y) y.cant = num(y.cant) + x.cant; else items.push(x); });
    const rccs = [...new Set((refs || []).map((r) => r.numero))];
    if (rccs.length) cab.obs = [cab.obs, 'Reposición RCC ' + rccs.join(', ')].filter(Boolean).join(' · ');
    const r = acciones.guardarDocumento(['oc', { editar: destino || '', cab, items }], email);
    elegidos.forEach((it) => { it.oc = r.numero; });
    rccs.forEach((n) => { const c = S().docs.consumo[n].cab; const prev = c.ocs ? c.ocs.split(' · ') : []; if (!prev.includes(r.numero)) c.ocs = [...prev, r.numero].join(' · '); });
    return { numero: r.numero, items: items.length, sumados: nuevos.length, nueva: !destino };
  },
  getPendientes: () => {
    const A = [];
    const href = (n) => '/cirugias/consumo?numero=' + encodeURIComponent(n);
    const cons = Object.values(S().docs.consumo);
    const st = [], li = [];
    cons.forEach(({ cab, items }) => {
      const its = items.filter((it) => !it.baja && buscarStock(it.codigo, it.desc));
      if (!its.length) return;
      const sin = its.filter((it) => !String(it.lote || '').trim()), d = diasDesde(cab.fechaCx);
      (sin.length ? st : li).push({ c: cab, d, its: sin.length ? sin : its });
    });
    const viejos = st.filter((x) => x.d > 30).length;
    A.push({ key: 'stickers', tit: 'Esperando stickers (falta lote)', nivel: viejos ? 'rojo' : 'ambar', n: st.length, urg: viejos, sub: viejos ? `${viejos} con más de 30 días desde la cirugía.` : 'Cirugías con productos de kardex sin lote cargado.', head: ['RCC', 'Cirugía', 'Hace', 'Paciente / Médico', 'Productos sin lote'],
      rows: st.map((x) => ({ href: href(x.c.numero), bad: x.d > 30, c: [x.c.numero, x.c.fechaCx, diasTxt(x.d), `${x.c.paciente} · ${x.c.medico.split(',')[0]}`, x.its.map((i) => i.desc).join(', ')] })) });
    A.push({ key: 'bajas', tit: 'Listas para dar de baja', nivel: 'azul', n: li.length, urg: li.filter((x) => x.d > 15).length, sub: 'Tienen todos los lotes: falta escribirlas en el kardex.', head: ['RCC', 'Cirugía', 'Hace', 'Paciente', 'Productos'],
      rows: li.map((x) => ({ href: href(x.c.numero), c: [x.c.numero, x.c.fechaCx, diasTxt(x.d), x.c.paciente, String(x.its.length)] })), accion: { label: 'Dar de baja en tanda', accion: 'bajaTanda', refs: li.map((x) => x.c.numero) } });
    const rev = cons.filter(({ cab }) => String(cab.revisar || '').trim());
    A.push({ key: 'revisar', tit: 'RCC a revisar', nivel: 'ambar', n: rev.length, sub: 'Tienen una observación pendiente; no se reponen hasta resolverla.', head: ['RCC', 'Cirugía', 'Paciente', 'Qué revisar'], rows: rev.map(({ cab }) => ({ href: href(cab.numero), c: [cab.numero, cab.fechaCx, cab.paciente, cab.revisar] })) });
    const sinRcc = S().cirugias.filter((c) => c.fecha && !c.rcc && !['Suspendida', 'Dada de baja'].includes(c.estado) && diasDesde(c.fecha) > 0).map((c) => ({ c, d: diasDesde(c.fecha) }));
    A.push({ key: 'sinRcc', tit: 'Cirugías hechas sin RCC', nivel: 'ambar', n: sinRcc.length, urg: sinRcc.filter((x) => x.d > 7).length, sub: 'Ya pasó la fecha y no tienen registro de consumo. Tocá una para emitirlo.', head: ['Fecha', 'Hace', 'Paciente', 'Médico', 'Institución'],
      rows: sinRcc.map((x) => ({ href: '/cirugias/consumo?cirugia=' + x.c.id, bad: x.d > 7, c: [x.c.fecha, diasTxt(x.d), x.c.paciente, x.c.medico, x.c.institucion] })) });
    const sinRem = S().cirugias.filter((c) => c.fecha && !c.remito && !['Suspendida', 'Dada de baja'].includes(c.estado) && diasDesde(c.fecha) <= 0 && diasDesde(c.fecha) >= -7).map((c) => ({ c, d: diasDesde(c.fecha) }));
    A.push({ key: 'sinRemito', tit: 'Próximas cirugías sin remito', nivel: 'rojo', n: sinRem.length, urg: sinRem.filter((x) => x.d >= -2).length, sub: 'En los próximos 7 días y sin remito de transporte. Tocá una para hacerlo.', head: ['Fecha', 'Falta', 'Paciente', 'Médico', 'Institución'],
      rows: sinRem.map((x) => ({ href: '/cirugias/remito?cirugia=' + x.c.id, bad: x.d >= -2, c: [x.c.fecha, x.d === 0 ? 'hoy' : -x.d + ' días', x.c.paciente, x.c.medico, x.c.institucion] })) });
    const pend = pendRCC(), gr = {};
    pend.forEach((x) => { const g2 = gr[x.proveedor] || (gr[x.proveedor] = { n: 0, u: 0, rcc: new Set(), d: 0 }); g2.n++; g2.u += x.cant; g2.rcc.add(x.numero); g2.d = Math.max(g2.d, diasDesde(x.fechaCx) || 0); });
    A.push({ key: 'reponer', tit: 'Consumo sin pasar a OC', nivel: 'azul', n: pend.length, sub: 'Lo usado en cirugías que todavía no está en ninguna OC. Lo mandás cuando quieras.', head: ['Proveedor', 'Ítems', 'Unidades', 'Más viejo', 'RCC'],
      rows: Object.entries(gr).sort((a, b) => b[1].d - a[1].d).map(([p, x]) => ({ href: '/compras/reponer?proveedor=' + encodeURIComponent(p), c: [p, String(x.n), String(x.u), diasTxt(x.d), [...x.rcc].join(', ')] })), accion: { label: 'Reponer pendientes', href: '/compras/reponer' } });
    const f = faltantes(pend);
    A.push({ key: 'minimo', tit: 'Stock bajo mínimo', nivel: 'rojo', n: f.length, urg: f.filter((x) => x.disp === 0).length, sub: 'Ya descuenta lo pedido en OC abiertas y lo consumido pendiente de pedir.', head: ['Producto', 'Proveedor', 'Disp.', 'Mín.', 'Falta pedir'],
      rows: f.map((x) => ({ href: '/stock?codigo=' + encodeURIComponent(x.codigo), bad: x.disp === 0, c: [x.desc, x.proveedor, String(x.disp), String(x.minimo), String(x.falta)] })), accion: { label: 'Reponer pendientes', href: '/compras/reponer' } });
    const ocs = Object.values(S().docs.oc).map((o) => o.cab).filter((o) => serie('oc', o) === 'oc');
    const emit = ocs.filter((o) => o.estado === 'Emitida'), esp = ocs.filter((o) => ['Enviada', 'Recibida parcial'].includes(o.estado));
    A.push({ key: 'ocEmit', tit: 'OC armadas sin enviar', nivel: 'ambar', n: emit.length, sub: 'Cuando la mandes, pasala a “Enviada”.', head: ['OC', 'Fecha', 'Hace', 'Proveedor', 'Total'], rows: emit.map((o) => ({ href: '/compras/oc?numero=' + o.numero, c: [o.numero, o.fecha, diasTxt(diasDesde(o.fecha)), o.proveedor, (o.moneda === 'USD' ? 'USD ' : '$ ') + num(o.total).toFixed(2)] })) });
    A.push({ key: 'ocEsp', tit: 'OC esperando mercadería', nivel: 'azul', n: esp.length, urg: esp.filter((o) => diasDesde(o.fecha) > 15).length, sub: 'Enviadas o recibidas en parte. Cuando llegue: “Nueva recepción”.', head: ['OC', 'Fecha', 'Hace', 'Proveedor', 'Estado'], rows: esp.map((o) => ({ href: '/compras/oc?numero=' + o.numero, bad: diasDesde(o.fecha) > 15, c: [o.numero, o.fecha, diasTxt(diasDesde(o.fecha)), o.proveedor, o.estado] })) });
    const rems = Object.values(S().docs.remito).map((r) => r.cab).filter((r) => ['Emitido', 'Entregado'].includes(r.estado) && num(r.cajasVueltas) < num(r.cajasEnviadas));
    A.push({ key: 'remitos', tit: 'Remitos sin retorno', nivel: 'ambar', n: rems.length, sub: 'Material que salió y no volvió completo.', head: ['Remito', 'Cirugía', 'Hace', 'Institución', 'Cajas'], rows: rems.map((r) => ({ href: '/cirugias/remito?numero=' + r.numero, c: [r.numero, r.fechaCx, diasTxt(diasDesde(r.fechaCx)), r.institucion, `${num(r.cajasVueltas)}/${num(r.cajasEnviadas)}`] })) });
    const lim = new Date(); lim.setMonth(lim.getMonth() + 6); const L = iso(lim), H = iso(new Date()), ven = [];
    S().stock.forEach((s) => Object.entries(s.lotes).forEach(([l, x]) => { if (x.disp > 0 && x.vtoIso && x.vtoIso < L) ven.push({ s, l, x, venc: x.vtoIso < H }); }));
    A.push({ key: 'vence', tit: 'Vencidos o por vencer (6 meses)', nivel: ven.some((v) => v.venc) ? 'rojo' : 'ambar', n: ven.length, urg: ven.filter((v) => v.venc).length, sub: 'Lotes con unidades disponibles.', head: ['Producto', 'Lote', 'Vence', 'Disp.'], rows: ven.map((v) => ({ href: '/stock?codigo=' + encodeURIComponent(v.s.codigo), bad: v.venc, c: [v.s.desc, v.l, v.x.vto, String(v.x.disp)] })) });
    const kerr = S().stock.filter((s) => s.error);
    A.push({ key: 'kerr', tit: 'Planillas de kardex con error', nivel: 'rojo', n: kerr.length, sub: 'No se pudieron leer: revisá link y pestaña en el Catálogo Maestro.', head: ['Producto', 'Pestaña', 'Error'], rows: kerr.map((s) => ({ href: '/stock?codigo=' + encodeURIComponent(s.codigo), c: [s.desc, s.hoja, s.error] })) });
    return { leido: S().kardexLeido, alertas: A };
  },
});

export async function demo(accion, args, email) {
  const f = acciones[accion];
  if (!f) throw new Error('Acción desconocida en demo: ' + accion);
  await new Promise((r) => setTimeout(r, 150));
  return f(args, email);
}
