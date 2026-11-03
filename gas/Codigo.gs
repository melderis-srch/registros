/**
 * Surchérie · Registros
 * API de datos (Apps Script) para la web app de Next.js: lee y escribe "Seguimiento de cirugías",
 * registros de consumo, remitos de transporte, órdenes de compra y recepciones; guarda PDF en Drive.
 *
 * Proyecto vinculado al Sheet "Surchérie Registros" (base de datos).
 * Primera vez: setup() → importarMaestros() → generarToken() → Implementar como aplicación web.
 */

/* =====================================================================
 * Esquema de pestañas
 * Cada columna: [clave interna, encabezado visible, tipo]
 * Tipos: t texto · f fecha · n número · m importe · b casilla · d fecha y hora
 * ===================================================================== */
var TABS = {
  Config: [['clave', 'Clave'], ['valor', 'Valor'], ['desc', 'Descripción']],

  Clientes: [['codigo', 'Código'], ['razon', 'Razón social'], ['cuit', 'CUIT'], ['domicilio', 'Domicilio'],
    ['localidad', 'Localidad'], ['iva', 'Condición IVA']],
  Productos: [['codigo', 'Código'], ['desc', 'Descripción'], ['marca', 'Marca'], ['modelo', 'Modelo'],
    ['detalle', 'Detalle'], ['origen', 'Origen'], ['proveedor', 'Proveedor'], ['costo', 'Costo ref.', 'm'],
    ['moneda', 'Moneda'], ['alicuota', 'Alícuota IVA'], ['activo', 'Activo', 'b']],
  Proveedores: [['codigo', 'Código'], ['razon', 'Razón social'], ['cuit', 'CUIT'], ['iva', 'Condición IVA'],
    ['domicilio', 'Domicilio'], ['localidad', 'Localidad'], ['contacto', 'Contacto'], ['email', 'Email'],
    ['telefono', 'Teléfono'], ['moneda', 'Moneda'], ['pago', 'Condiciones de pago']],
  Medicos: [['nombre', 'Nombre'], ['cuit', 'CUIT'], ['localidad', 'Localidad'], ['matProv', 'Mat. provincial'],
    ['matNac', 'Mat. nacional'], ['especialidad', 'Especialidad'], ['telefono', 'Teléfono'], ['sellos', 'Sellos', 'b']],
  Instituciones: [['nombre', 'Nombre'], ['gln', 'GLN/CUFF'], ['cuit', 'CUIT'], ['direccion', 'Dirección'],
    ['localidad', 'Localidad'], ['contacto', 'Contacto'], ['km', 'Km', 'n'], ['logistica', 'Costo logística', 'm']],
  Sistemas: [['codigo', 'Código'], ['desc', 'Descripción'], ['marca', 'Marca'], ['esteril', 'Estéril', 'b'],
    ['listado', 'Listado de contenido']],
  Sistemas_Contenido: [['listado', 'Listado'], ['seccion', 'Sección'], ['cant', 'Cantidad', 'n'],
    ['codigo', 'Código'], ['desc', 'Descripción']],

  Consumos: [['numero', 'N° RCC'], ['fecha', 'Fecha', 'f'], ['estado', 'Estado'], ['idCirugia', 'ID cirugía'],
    ['fechaCx', 'Fecha cx', 'f'], ['paciente', 'Paciente'], ['obraSocial', 'Obra social'],
    ['institucion', 'Institución'], ['medico', 'Médico'], ['matricula', 'Matrícula'],
    ['instrumentador', 'Instrumentador'], ['matInstr', 'Mat. instrumentador'], ['procedimiento', 'Procedimiento'],
    ['remitoSur', 'Remito Surchérie'], ['remitoTr', 'Remito transporte'], ['presupuesto', 'N° presupuesto'],
    ['cajas', 'Cant. cajas', 'n'], ['resumen', 'Resumen consumo'], ['costoImplantes', 'Costo implantes', 'm'],
    ['costoDescartables', 'Costo descartables', 'm'], ['costoLogistica', 'Logística', 'm'],
    ['costoEsterilizacion', 'Esterilización', 'm'], ['costoOtros', 'Otros', 'm'], ['costoTotal', 'Costo total', 'm'],
    ['tc', 'TC', 'n'], ['ocs', 'OC de reposición'], ['obs', 'Observaciones'], ['pdf', 'PDF'],
    ['creado', 'Creado', 'd'], ['modificado', 'Modificado', 'd'], ['usuario', 'Usuario']],
  Consumo_Items: [['numero', 'N° RCC'], ['renglon', 'Renglón', 'n'], ['seccion', 'Sección'], ['codigo', 'Código'],
    ['desc', 'Descripción'], ['marca', 'Marca/Modelo'], ['proveedor', 'Proveedor'], ['cant', 'Cant.', 'n'],
    ['costo', 'Costo unit.', 'm'], ['moneda', 'Moneda'], ['costoArs', 'Costo ARS', 'm']],

  Remitos: [['numero', 'N°'], ['fecha', 'Fecha', 'f'], ['estado', 'Estado'], ['idCirugia', 'ID cirugía'],
    ['rcc', 'N° RCC'], ['institucion', 'Institución'], ['gln', 'GLN/CUFF'], ['cuit', 'CUIT'],
    ['direccion', 'Dirección'], ['localidad', 'Localidad'], ['fechaCx', 'Fecha cx', 'f'], ['medico', 'Médico'],
    ['paciente', 'Paciente'], ['transportista', 'Transportista'], ['obs', 'Observaciones'],
    ['recibio', 'Recibió'], ['dni', 'DNI'], ['fechaEntrega', 'Fecha entrega', 'f'],
    ['cajasEnviadas', 'Cajas enviadas', 'n'], ['cajasVueltas', 'Cajas vueltas', 'n'], ['anexo', 'Con listado', 'b'],
    ['pdf', 'PDF'], ['creado', 'Creado', 'd'], ['modificado', 'Modificado', 'd'], ['usuario', 'Usuario']],
  Remito_Items: [['numero', 'N° remito'], ['renglon', 'Renglón', 'n'], ['codigo', 'Código sistema'],
    ['desc', 'Descripción'], ['marca', 'Marca'], ['cant', 'Cajas', 'n'], ['esteril', 'Estéril', 'b'],
    ['vueltas', 'Cajas vueltas', 'n'], ['obsRetorno', 'Obs. retorno'], ['contenido', 'Contenido (ajustado)']],

  OC: [['numero', 'N°'], ['tipo', 'Tipo'], ['fecha', 'Fecha', 'f'], ['estado', 'Estado'], ['pedido', 'Pedido'],
    ['proveedor', 'Proveedor'], ['cuit', 'CUIT'], ['domicilio', 'Dirección'], ['localidad', 'Localidad'],
    ['formaEnvio', 'Forma de envío'], ['fechaEnvio', 'Fecha de envío', 'f'], ['pago', 'Condiciones de pago'],
    ['plazo', 'Plazo de entrega'], ['lugar', 'Lugar de entrega'], ['moneda', 'Moneda'], ['tc', 'TC', 'n'],
    ['subtotal', 'Subtotal neto', 'm'], ['iva21', 'IVA 21%', 'm'], ['iva105', 'IVA 10,5%', 'm'],
    ['exento', 'No gravado/Exento', 'm'], ['descuento', 'Descuento', 'm'], ['total', 'Total', 'm'],
    ['idCirugia', 'ID cirugía'], ['rcc', 'N° RCC'], ['fechaCx', 'Fecha cx', 'f'], ['medico', 'Médico'],
    ['institucion', 'Institución'], ['paciente', 'Paciente'], ['facturas', 'Facturas proveedor'],
    ['obs', 'Observaciones'], ['pdf', 'PDF'], ['creado', 'Creado', 'd'], ['modificado', 'Modificado', 'd'],
    ['usuario', 'Usuario']],
  OC_Items: [['numero', 'N° OC'], ['renglon', 'Renglón', 'n'], ['codigo', 'Código'], ['desc', 'Descripción'],
    ['cant', 'Cant.', 'n'], ['costo', 'Costo unit. neto', 'm'], ['alicuota', 'Alícuota'], ['neto', 'Neto', 'm'],
    ['iva', 'IVA', 'm'], ['total', 'Total', 'm'], ['recibido', 'Cant. recibida', 'n'], ['pendiente', 'Pendiente', 'n']],

  Recepciones: [['numero', 'N°'], ['fecha', 'Fecha recepción', 'f'], ['oc', 'N° OC'], ['proveedor', 'Proveedor'],
    ['marca', 'Marca'], ['origen', 'Origen'], ['remitoProv', 'Remito proveedor'], ['factura', 'Factura proveedor'],
    ['valorFactura', 'Valor factura', 'm'], ['descripcion', 'Descripción'], ['cantTotal', 'Cantidad total', 'n'],
    ['reviso', 'Revisó'], ['obs', 'Observaciones'], ['pdf', 'PDF'], ['creado', 'Creado', 'd'],
    ['modificado', 'Modificado', 'd'], ['usuario', 'Usuario']],
  Recepcion_Items: [['numero', 'N° recepción'], ['renglon', 'Renglón', 'n'], ['oc', 'N° OC'],
    ['renglonOc', 'Renglón OC', 'n'], ['codigo', 'Código'], ['desc', 'Producto'], ['lote', 'Lote'],
    ['vto', 'Vto', 'f'], ['cant', 'Cant.', 'n'], ['empaque', 'Empaque'], ['rotulo', 'Rótulo'], ['obs', 'Observaciones']]
};

/* Pestañas de datos maestros editables desde la app */
var MAESTROS = ['Clientes', 'Productos', 'Proveedores', 'Medicos', 'Instituciones', 'Sistemas', 'Sistemas_Contenido'];

/* Desplegables por columna */
var LISTAS = {
  iva: ['Responsable Inscripto', 'Consumidor Final', 'Exento', 'Monotributo'],
  moneda: ['ARS', 'USD'],
  alicuota: ['21', '10,5', '0', 'Exento'],
  estadoConsumo: ['Registrado', 'Facturado'],
  estadoRemito: ['Emitido', 'Entregado', 'Retornado', 'Anulado'],
  estadoOC: ['Emitida', 'Enviada', 'Recibida parcial', 'Recibida', 'Anulada'],
  tipoOC: ['Orden de compra', 'Solicitud de presupuesto'],
  seccion: ['Implantado', 'Descartable'],
  inspeccion: ['Conforme', 'No conforme'],
  estadoCirugia: ['Programada', 'Realizada', 'Suspendida', 'Dada de baja', 'Facturada']
};

/* Valores iniciales de Config: [clave, valor, descripción] */
var CONFIG_INICIAL = [
  ['razonSocial', 'Surchérie', 'Razón social en los documentos'],
  ['subtitulo', 'Implantes quirúrgicos', ''],
  ['domicilio', 'San Martín 4041 · 3000 Santa Fe', ''],
  ['telefono', 'Tel/Fax (0342) 456 3173', ''],
  ['email', 'ventas@surcherie.com.ar', ''],
  ['emailTecnica', 'direcciontecnicasurcherie@gmail.com', ''],
  ['condIva', 'IVA Responsable Inscripto', ''],
  ['cuit', '30-70932838-3', ''],
  ['iibb', 'CM 921-554855-1', ''],
  ['inicioAct', '01/09/2005', ''],
  ['gln', '7798275210004', 'GLN de Surchérie (remito)'],
  ['anmat', 'Establecimiento habilitado por ANMAT, Disposición N.° 9212/15', 'Pie de los documentos'],
  ['confecciono', 'Bioing. Melisa Deris', 'Evaluó y confeccionó'],
  ['aprobo', 'Ing. Gustavo Cobelli', 'Aprobó'],
  ['formConsumo', 'FORM POE 14-01 REV 2', ''],
  ['formRemito', 'FORM PG 19-01 REV 3', ''],
  ['formRecepcion', 'FORM POE 15-01 REV 3', ''],
  ['leyendaOC', 'La presente Orden de Compra está sujeta a las condiciones particulares establecidas más arriba, ' +
    'las cuales no podrán ser alteradas bajo ningún concepto sin antes obtener la conformidad escrita de SURCHERIE.', ''],
  ['leyendaSolicitud', 'La presente Solicitud de Presupuesto está sujeta a las condiciones particulares establecidas ' +
    'más arriba, las cuales no podrán ser alteradas bajo ningún concepto sin antes obtener la conformidad escrita de SURCHERIE.', ''],
  ['lugarEntrega', 'San Martín 4041 - Santa Fe', 'Lugar de entrega por defecto en la OC'],
  ['puntoVenta', '0001', 'Prefijo de remito y OC'],
  ['ultimoRCC', '4376', 'Último registro de consumo emitido (4376 = 004-376)'],
  ['ultimoRemito', '3611', 'Último remito de transporte emitido'],
  ['ultimaOC', '3684', 'Última orden de compra emitida'],
  ['ultimaSolicitud', '3', 'Última solicitud de presupuesto emitida'],
  ['ultimaRecepcion', '0', 'Última recepción registrada'],
  ['tcUSD', '1545,25', 'Tipo de cambio por defecto (dólar BNA)'],
  ['esterilizacionPorCaja', '25000', 'Costo de esterilización por caja'],
  ['seguimientoId', '15HI2_nU6Tc6mFxRdDuJRSCmNgTH3gKQFq1ATwhab63M', 'Planilla "Seguimiento de cirugías"'],
  ['seguimientoHoja', 'Cirugias', 'Pestaña de cirugías dentro del Seguimiento'],
  ['logoId', '1ebSm-eoKgtI0pzK4D_JozPw6C-LmyJlU', 'ID del logo en Drive (JPG o PNG)'],
  ['carpetaRaiz', '', 'Carpeta de Drive de los PDF (la crea setup)'],
  ['carpetaConsumo', '', ''], ['carpetaRemito', '', ''], ['carpetaOC', '', ''], ['carpetaRecepcion', '', ''],
  ['fuenteOC', '1sJu7Lvi35Pfac642cb_P_TXXeTnlMty4nQQhJiPZtcM', 'Planilla vieja de OC (para importar)'],
  ['fuenteCirugia', '1cQ3kTl8MlBCt8tZbZHKkt8OHHbiqXp7Wsa8Xg7WjloM', 'Planilla vieja de registro de cirugía'],
  ['fuenteRemito', '1tJ5PSNfFqeABv239uwYuduhNiUz625mQP2XIYmZezaM', 'Planilla vieja de remito de transporte'],
  ['fuenteRecepcion', '1LJ3ykZ1Qsgns8QWM1y5PD4c5blwhbPQ82qfuFxRzC38', 'Planilla vieja de recepción de stock']
];

/* Documentos */
var DOCS = {
  consumo: { tab: 'Consumos', items: 'Consumo_Items', carpeta: 'carpetaConsumo', nombre: 'Registro de consumo' },
  remito: { tab: 'Remitos', items: 'Remito_Items', carpeta: 'carpetaRemito', nombre: 'Remito de transporte' },
  oc: { tab: 'OC', items: 'OC_Items', carpeta: 'carpetaOC', nombre: 'Orden de compra' },
  recepcion: { tab: 'Recepciones', items: 'Recepcion_Items', carpeta: 'carpetaRecepcion', nombre: 'Recepción' }
};

/* Columnas del Seguimiento (1 = A). Las de M en adelante las agrega setup(). */
var SEG = {
  rcc: 1, fecha: 2, medico: 3, paciente: 4, institucion: 5, procedimiento: 6, obraSocial: 7, remito: 8, obs: 9,
  baja: 10, susp: 11, otro: 12, estado: 13, instrumentador: 14, presupuesto: 15,
  firma: 16, sello: 17, protocolo: 18, certificado: 19, rx: 20, epicrisis: 21, id: 22
};
var SEG_ANCHO = 22;
var SEG_EXTRA = ['Estado', 'Instrumentador', 'N° presupuesto', 'Firma', 'Sello', 'Protocolo', 'Certificado', 'RX',
  'Epicrisis', 'ID app'];
var CHECKLIST = ['firma', 'sello', 'protocolo', 'certificado', 'rx', 'epicrisis'];
var MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE',
  'NOVIEMBRE', 'DICIEMBRE'];
var TZ = 'America/Argentina/Buenos_Aires';

/* =====================================================================
 * API para la web app (Next.js). Todo entra por doPost con un token.
 * ===================================================================== */
var USUARIO = '';

var ACCIONES = {
  getInicio: getInicio, getCirugias: getCirugias, getCirugia: getCirugia, guardarCirugia: guardarCirugia,
  getDocumento: getDocumento, guardarDocumento: guardarDocumento, guardarRetorno: guardarRetorno,
  cambiarEstado: cambiarEstado, subirPdf: subirPdf, getCompras: getCompras,
  generarOCsReposicion: generarOCsReposicion, getTabla: getTabla, guardarTabla: guardarTabla,
  agregarMaestro: agregarMaestro
};

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (!token || req.token !== token) throw new Error('No autorizado');
    USUARIO = String(req.usuario || '');
    var fn = ACCIONES[req.accion];
    if (!fn) throw new Error('Acción desconocida: ' + req.accion);
    out = { ok: true, data: fn.apply(null, req.args || []) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'Surchérie Registros API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Genera (o muestra) el token que va en la variable GAS_TOKEN de Vercel. */
function generarToken() {
  var props = PropertiesService.getScriptProperties();
  var t = props.getProperty('API_TOKEN');
  if (!t) { t = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, ''); props.setProperty('API_TOKEN', t); }
  Logger.log('GAS_TOKEN = ' + t);
  try { SpreadsheetApp.getUi().alert('Token para Vercel (GAS_TOKEN):\n\n' + t); } catch (e) { }
  return t;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Registros')
    .addItem('1. Preparar pestañas (setup)', 'setup')
    .addItem('2. Importar datos maestros de las planillas viejas', 'importarMaestros')
    .addItem('3. Ver token para Vercel', 'generarToken')
    .addToUi();
}

/** La identidad la valida la web app (login); acá solo se registra quién hizo cada cambio. */
function verificar_() { return USUARIO; }

/* =====================================================================
 * Setup
 * ===================================================================== */
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  try { ss.setSpreadsheetLocale('es_AR'); } catch (e) { }

  Object.keys(TABS).forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    var cols = TABS[nombre];
    var actuales = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    // Agrega encabezados que falten, sin mover los existentes
    cols.forEach(function (c) {
      if (actuales.indexOf(c[1]) < 0) {
        actuales.push(c[1]);
        sh.getRange(1, actuales.length).setValue(c[1]);
      }
    });
    if (sh.getMaxColumns() > actuales.length) sh.deleteColumns(actuales.length + 1, sh.getMaxColumns() - actuales.length);
    var head = sh.getRange(1, 1, 1, actuales.length);
    head.setFontWeight('bold').setBackground('#EEF2FA').setFontColor('#24448F');
    sh.setFrozenRows(1);
    formatearTab_(sh, nombre);
  });

  // Config: completa claves que falten
  var cfgSh = ss.getSheetByName('Config');
  var existentes = leer_('Config').map(function (r) { return r.clave; });
  var nuevas = CONFIG_INICIAL.filter(function (c) { return existentes.indexOf(c[0]) < 0; });
  if (nuevas.length) cfgSh.getRange(cfgSh.getLastRow() + 1, 1, nuevas.length, 3).setValues(nuevas);
  cfgSh.getRange('B:B').setNumberFormat('@');
  cfgSh.setColumnWidth(1, 170); cfgSh.setColumnWidth(2, 420); cfgSh.setColumnWidth(3, 300);
  CacheService.getScriptCache().remove('cfg');

  // Carpetas de Drive
  var raiz = carpeta_('carpetaRaiz', 'Surchérie Registros - PDF', null);
  carpeta_('carpetaConsumo', 'Registros de consumo', raiz);
  carpeta_('carpetaRemito', 'Remitos de transporte', raiz);
  carpeta_('carpetaOC', 'Órdenes de compra', raiz);
  carpeta_('carpetaRecepcion', 'Recepciones', raiz);

  // Vista de vencimientos
  var v = ss.getSheetByName('Vencimientos') || ss.insertSheet('Vencimientos');
  v.clear();
  v.getRange('A1').setFormula('=IFERROR(QUERY(Recepcion_Items!A:L;' +
    '"select E, F, G, H, I, C, A where H is not null and H <= date \'"&TEXT(EDATE(TODAY();6);"yyyy-mm-dd")&"\' order by H";1);' +
    '"Sin lotes por vencer en los próximos 6 meses")');
  v.getRange('D:D').setNumberFormat('dd/mm/yyyy');

  // Seguimiento: columnas extra
  prepararSeguimiento_();

  // Orden de pestañas: maestros al final
  ['Consumos', 'Consumo_Items', 'Remitos', 'Remito_Items', 'OC', 'OC_Items', 'Recepciones', 'Recepcion_Items',
    'Vencimientos', 'Config'].forEach(function (n, i) {
      var s = ss.getSheetByName(n); if (s) { ss.setActiveSheet(s); ss.moveActiveSheet(i + 1); }
    });
  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja1');
  if (hoja1 && hoja1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(hoja1);
  return 'Listo';
}

function formatearTab_(sh, nombre) {
  var cols = TABS[nombre], heads = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var filas = Math.max(sh.getMaxRows() - 1, 1);
  cols.forEach(function (c) {
    var j = heads.indexOf(c[1]) + 1; if (!j) return;
    var rg = sh.getRange(2, j, filas, 1), t = c[2] || 't';
    if (t === 'f') rg.setNumberFormat('dd/mm/yyyy');
    else if (t === 'd') rg.setNumberFormat('dd/mm/yyyy HH:mm');
    else if (t === 'm') rg.setNumberFormat('#,##0.00');
    else if (t === 'n') rg.setNumberFormat('0.##');
    else if (t === 'b') rg.insertCheckboxes();
    else rg.setNumberFormat('@');
    var lista = listaDe_(nombre, c[0]);
    if (lista) rg.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(lista, true)
      .setAllowInvalid(true).build());
  });
}

function listaDe_(tab, clave) {
  if (clave === 'iva') return LISTAS.iva;
  if (clave === 'moneda') return LISTAS.moneda;
  if (clave === 'alicuota') return LISTAS.alicuota;
  if (clave === 'seccion') return LISTAS.seccion;
  if (clave === 'empaque' || clave === 'rotulo') return LISTAS.inspeccion;
  if (clave === 'tipo' && tab === 'OC') return LISTAS.tipoOC;
  if (clave === 'estado') return { Consumos: LISTAS.estadoConsumo, Remitos: LISTAS.estadoRemito, OC: LISTAS.estadoOC }[tab] || null;
  return null;
}

function carpeta_(clave, nombre, padre) {
  var id = cfg_(clave);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  var f = padre ? padre.createFolder(nombre) : DriveApp.createFolder(nombre);
  setCfg_(clave, f.getId());
  return f;
}

function prepararSeguimiento_() {
  var sh = hojaSeguimiento_();
  var hr = filaEncabezadoSeg_(sh);
  if (sh.getMaxColumns() < SEG_ANCHO) sh.insertColumnsAfter(sh.getMaxColumns(), SEG_ANCHO - sh.getMaxColumns());
  var rg = sh.getRange(hr, SEG.estado, 1, SEG_EXTRA.length);
  var act = rg.getValues()[0];
  if (act.join('') === '') {
    rg.setValues([SEG_EXTRA]);
    sh.getRange(hr, SEG.obs).copyTo(rg, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }
}

/* =====================================================================
 * Config y utilidades de pestañas
 * ===================================================================== */
function cfgTodo_() {
  var c = CacheService.getScriptCache(), raw = c.get('cfg');
  if (raw) return JSON.parse(raw);
  var o = {};
  var sh = SpreadsheetApp.getActive().getSheetByName('Config');
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) { if (r[0]) o[r[0]] = r[1]; });
  } else {
    CONFIG_INICIAL.forEach(function (r) { o[r[0]] = r[1]; });
  }
  c.put('cfg', JSON.stringify(o), 300);
  return o;
}
function cfg_(k) { return cfgTodo_()[k]; }
function setCfg_(k, v) {
  var sh = SpreadsheetApp.getActive().getSheetByName('Config');
  var vals = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues();
  for (var i = 1; i < vals.length; i++) if (vals[i][0] === k) { sh.getRange(i + 1, 2).setValue(String(v)); break; }
  if (i >= vals.length) sh.appendRow([k, String(v), '']);
  CacheService.getScriptCache().remove('cfg');
}

function hoja_(tab) {
  var sh = SpreadsheetApp.getActive().getSheetByName(tab);
  if (!sh) throw new Error('Falta la pestaña "' + tab + '". Ejecutá setup().');
  return sh;
}

function tipoCol_(tab, clave) {
  var c = (TABS[tab] || []).filter(function (x) { return x[0] === clave; })[0];
  return c ? (c[2] || 't') : 't';
}

/** Lee una pestaña como objetos con claves internas. Agrega _fila (1-based). */
function leer_(tab) {
  var sh = hoja_(tab), lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < 2) return [];
  var vals = sh.getRange(1, 1, lr, lc).getValues();
  var mapa = mapaCols_(tab, vals[0]);
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (r.join('') === '') continue;
    var o = { _fila: i + 1 };
    mapa.forEach(function (m) { o[m.k] = aCliente_(r[m.j], m.t); });
    out.push(o);
  }
  return out;
}

function mapaCols_(tab, heads) {
  return (TABS[tab] || []).map(function (c) { return { k: c[0], j: heads.indexOf(c[1]), t: c[2] || 't' }; })
    .filter(function (m) { return m.j >= 0; });
}

function aCliente_(v, t) {
  if (v instanceof Date) return t === 'd' ? Utilities.formatDate(v, TZ, 'dd/MM/yyyy HH:mm') : Utilities.formatDate(v, TZ, 'dd/MM/yyyy');
  if (t === 'b') return v === true || String(v).toUpperCase() === 'TRUE';
  if (t === 'n' || t === 'm') return v === '' ? '' : Number(v) || 0;
  return v === null || v === undefined ? '' : String(v);
}

function aHoja_(v, t) {
  if (t === 'f') return aFecha_(v) || '';
  if (t === 'd') return v instanceof Date ? v : (v ? aFecha_(v) || v : '');
  if (t === 'b') return v === true || String(v).toUpperCase() === 'TRUE';
  if (t === 'n' || t === 'm') return v === '' || v === null || v === undefined ? '' : num_(v);
  return v === null || v === undefined ? '' : String(v);
}

function filaDe_(heads, tab, obj) {
  var row = heads.map(function () { return ''; });
  (TABS[tab] || []).forEach(function (c) {
    var j = heads.indexOf(c[1]);
    if (j >= 0 && obj[c[0]] !== undefined) row[j] = aHoja_(obj[c[0]], c[2] || 't');
  });
  return row;
}

function heads_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; }

function agregar_(tab, objs) {
  if (!objs.length) return;
  var sh = hoja_(tab), h = heads_(sh);
  var rows = objs.map(function (o) { return filaDe_(h, tab, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, h.length).setValues(rows);
}

function reemplazarFila_(tab, fila, obj) {
  var sh = hoja_(tab), h = heads_(sh);
  var actual = sh.getRange(fila, 1, 1, h.length).getValues()[0];
  var nueva = filaDe_(h, tab, obj);
  // conserva lo que no vino en obj
  for (var j = 0; j < h.length; j++) {
    var col = (TABS[tab] || []).filter(function (c) { return c[1] === h[j]; })[0];
    if (!col || obj[col[0]] === undefined) nueva[j] = actual[j];
  }
  sh.getRange(fila, 1, 1, h.length).setValues([nueva]);
}

function borrarFilasDonde_(tab, clave, valor) {
  var sh = hoja_(tab), lr = sh.getLastRow();
  if (lr < 2) return;
  var h = heads_(sh), j = h.indexOf(colNombre_(tab, clave));
  var vals = sh.getRange(2, j + 1, lr - 1, 1).getValues();
  // borra en bloques contiguos, de abajo hacia arriba
  var i = vals.length - 1;
  while (i >= 0) {
    if (String(vals[i][0]) === String(valor)) {
      var fin = i;
      while (i - 1 >= 0 && String(vals[i - 1][0]) === String(valor)) i--;
      sh.deleteRows(i + 2, fin - i + 1);
    }
    i--;
  }
}

function colNombre_(tab, clave) {
  var c = (TABS[tab] || []).filter(function (x) { return x[0] === clave; })[0];
  return c ? c[1] : clave;
}

/* =====================================================================
 * Formatos
 * ===================================================================== */
function num_(v) {
  if (typeof v === 'number') return v;
  var s = String(v || '').replace(/[^\d,.\-]/g, '');
  if (!s) return 0;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  else if (/\.\d{3}$/.test(s)) s = s.replace('.', '');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** dd/mm/yyyy, d/m/yy, yyyy-mm-dd o Date → Date a las 12:00 (no se corre el día) */
function aFecha_(v) {
  if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate(), 12, 0, 0);
  var s = String(v || '').trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
    var y = +m[3]; if (y < 100) y += 2000;
    return new Date(y, +m[2] - 1, +m[1], 12, 0, 0);
  }
  return null;
}
function fmtFecha_(d) { return d ? Utilities.formatDate(d, TZ, 'dd/MM/yyyy') : ''; }
function norm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function pad_(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }

/* =====================================================================
 * Numeración
 * ===================================================================== */
var NUMERACION = {
  consumo: { cfg: 'ultimoRCC', fmt: function (n) { return pad_(Math.floor(n / 1000), 3) + '-' + pad_(n % 1000, 3); } },
  remito: { cfg: 'ultimoRemito', fmt: function (n) { return (cfg_('puntoVenta') || '0001') + '-' + pad_(n, 8); } },
  oc: { cfg: 'ultimaOC', fmt: function (n) { return (cfg_('puntoVenta') || '0001') + '-' + pad_(n, 8); } },
  solicitud: { cfg: 'ultimaSolicitud', fmt: function (n) { return '0000-' + pad_(n, 4); } },
  recepcion: { cfg: 'ultimaRecepcion', fmt: function (n) { return pad_(n, 5); } }
};

/** Número entero de un número formateado: 004-377 → 4377 · 0001-00003612 → 3612 · 00012 → 12 */
function numEntero_(serie, s) {
  s = String(s || '');
  if (serie === 'consumo') return parseInt(s.replace(/\D/g, ''), 10) || 0;
  var p = s.split('-');
  return parseInt(p[p.length - 1].replace(/\D/g, ''), 10) || 0;
}

function serieDe_(tipo, cab) {
  if (tipo === 'oc') return cab && cab.tipo === 'Solicitud de presupuesto' ? 'solicitud' : 'oc';
  return tipo;
}

function proximo_(serie) {
  var n = parseInt(String(cfg_(NUMERACION[serie].cfg)).replace(/\D/g, ''), 10) || 0;
  var tipo = serie === 'solicitud' ? 'oc' : serie;
  leer_(DOCS[tipo].tab).forEach(function (r) {
    if (serieDe_(tipo, r) !== serie) return;
    n = Math.max(n, numEntero_(serie, r.numero));
  });
  return n + 1;
}

function proximos_() {
  var o = {};
  Object.keys(NUMERACION).forEach(function (s) { o[s] = NUMERACION[s].fmt(proximo_(s)); });
  return o;
}

/* =====================================================================
 * Datos iniciales para la app
 * ===================================================================== */
function getInicio() {
  var email = verificar_();
  var c = cfgTodo_();
  var publico = {};
  ['razonSocial', 'subtitulo', 'domicilio', 'telefono', 'email', 'emailTecnica', 'condIva', 'cuit', 'iibb', 'inicioAct',
    'gln', 'anmat', 'confecciono', 'aprobo', 'formConsumo', 'formRemito', 'formRecepcion', 'leyendaOC',
    'leyendaSolicitud', 'lugarEntrega', 'tcUSD', 'esterilizacionPorCaja'].forEach(function (k) { publico[k] = c[k] || ''; });
  return {
    usuario: email,
    config: publico,
    logo: logo_(),
    listas: LISTAS,
    proximos: proximos_(),
    maestros: maestros_(),
    lotes: lotes_()
  };
}

function maestros_() {
  var o = {};
  MAESTROS.forEach(function (t) {
    o[t] = leer_(t).map(function (r) { delete r._fila; return r; });
  });
  return o;
}

/** Lotes ya recibidos por código: { codigo: [{lote, vto}] } */
function lotes_() {
  var o = {};
  leer_('Recepcion_Items').forEach(function (r) {
    if (!r.codigo || !r.lote) return;
    var k = String(r.codigo).toUpperCase();
    o[k] = o[k] || [];
    if (!o[k].some(function (x) { return x.lote === r.lote; })) o[k].push({ lote: r.lote, vto: r.vto });
  });
  return o;
}

function logo_() {
  var cache = CacheService.getScriptCache(), k = 'logo_' + cfg_('logoId');
  var v = cache.get(k);
  if (v) return v;
  try {
    var blob = DriveApp.getFileById(cfg_('logoId')).getBlob();
    v = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    if (v.length < 95000) cache.put(k, v, 21600);
    return v;
  } catch (e) {
    return '';
  }
}

/* =====================================================================
 * Seguimiento de cirugías
 * ===================================================================== */
function hojaSeguimiento_() {
  var ss = SpreadsheetApp.openById(cfg_('seguimientoId'));
  var sh = ss.getSheetByName(cfg_('seguimientoHoja') || 'Cirugias');
  if (!sh) throw new Error('No encuentro la pestaña "' + cfg_('seguimientoHoja') + '" en el Seguimiento.');
  return sh;
}

function filaEncabezadoSeg_(sh) {
  var a = sh.getRange(1, 1, Math.min(15, sh.getLastRow()), 1).getDisplayValues();
  for (var i = 0; i < a.length; i++) if (/RCC/i.test(a[i][0])) return i + 1;
  return 3;
}

function esMes_(s) { return MESES.indexOf(String(s || '').trim().toUpperCase()) >= 0; }
function esSinFecha_(s) { return /^SIN FECHA/i.test(String(s || '').trim()); }

/**
 * Lee el Seguimiento completo. Devuelve { sh, hr, filas:[...], secciones:[...], sinFecha }
 * Asigna un ID a las filas que no lo tienen (una sola escritura).
 */
function leerSeguimiento_() {
  var sh = hojaSeguimiento_(), hr = filaEncabezadoSeg_(sh), lr = sh.getLastRow();
  var n = Math.max(lr - hr, 0);
  var vals = n ? sh.getRange(hr + 1, 1, n, SEG_ANCHO).getValues() : [];
  var filas = [], secciones = [], actual = null, sinFecha = 0, enPendientes = false, faltanId = false;
  vals.forEach(function (r, i) {
    var fila = hr + 1 + i, a = r[0];
    if (esSinFecha_(a)) { sinFecha = fila; enPendientes = true; actual = null; return; }
    if (esMes_(a) && !r[2] && !r[3]) {
      actual = { fila: fila, mes: MESES.indexOf(String(a).trim().toUpperCase()), anio: null, ult: fila, filas: [] };
      secciones.push(actual); enPendientes = false; return;
    }
    if (!r[SEG.medico - 1] && !r[SEG.paciente - 1] && !r[SEG.procedimiento - 1]) return;
    var f = aFecha_(r[SEG.fecha - 1]);
    if (actual && f) {
      if (actual.anio === null) actual.anio = f.getFullYear();
      actual.filas.push({ fila: fila, t: f.getTime() });
      actual.ult = fila;
    }
    if (!r[SEG.id - 1]) { r[SEG.id - 1] = 'C' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); faltanId = true; }
    filas.push(cirugiaDeFila_(r, fila, enPendientes && !f));
  });
  if (faltanId && n) sh.getRange(hr + 1, SEG.id, n, 1).setValues(vals.map(function (r) { return [r[SEG.id - 1]]; }));
  // Secciones sin cirugías: año por posición (el de la sección anterior, o siguiente si cambia de diciembre a enero)
  for (var k = 0; k < secciones.length; k++) {
    if (secciones[k].anio !== null) continue;
    var prev = secciones[k - 1];
    if (prev && prev.anio !== null) secciones[k].anio = secciones[k].mes < prev.mes ? prev.anio + 1 : prev.anio;
  }
  return { sh: sh, hr: hr, filas: filas, secciones: secciones, sinFecha: sinFecha };
}

function cirugiaDeFila_(r, fila, pendiente) {
  var f = aFecha_(r[SEG.fecha - 1]);
  var c = {
    fila: fila, id: String(r[SEG.id - 1] || ''), rcc: String(r[SEG.rcc - 1] || ''), fecha: fmtFecha_(f),
    medico: String(r[SEG.medico - 1] || ''), paciente: String(r[SEG.paciente - 1] || ''),
    institucion: String(r[SEG.institucion - 1] || ''), procedimiento: String(r[SEG.procedimiento - 1] || ''),
    obraSocial: String(r[SEG.obraSocial - 1] || ''), remito: String(r[SEG.remito - 1] || ''),
    obs: String(r[SEG.obs - 1] || ''), instrumentador: String(r[SEG.instrumentador - 1] || ''),
    presupuesto: String(r[SEG.presupuesto - 1] || ''), pendiente: !!pendiente, checklist: {}
  };
  CHECKLIST.forEach(function (k) { c.checklist[k] = r[SEG[k] - 1] === true; });
  var est = String(r[SEG.estado - 1] || '');
  if (!est) {
    if (r[SEG.susp - 1] === true) est = 'Suspendida';
    else if (r[SEG.baja - 1] === true) est = 'Dada de baja';
    else if (c.rcc) est = 'Realizada';
    else est = 'Programada';
  }
  c.estado = est;
  return c;
}

/** Cirugías entre dos fechas (dd/mm/yyyy o yyyy-mm-dd) + las pendientes sin fecha + documentos vinculados */
function getCirugias(desde, hasta) {
  verificar_();
  var d = aFecha_(desde), h = aFecha_(hasta);
  var seg = leerSeguimiento_();
  var lista = seg.filas.filter(function (c) {
    if (c.pendiente || !c.fecha) return c.pendiente;
    var f = aFecha_(c.fecha).getTime();
    return (!d || f >= d.getTime()) && (!h || f <= h.getTime());
  });
  return docsDe_(lista);
}

function docsDe_(lista) {
  var ids = {}; lista.forEach(function (c) { ids[c.id] = c; c.docs = { consumos: [], remitos: [], ocs: [] }; });
  var porRcc = {}; lista.forEach(function (c) { if (c.rcc) porRcc[c.rcc] = c; });
  leer_('Consumos').forEach(function (r) {
    var c = ids[r.idCirugia] || porRcc[r.numero];
    if (c) c.docs.consumos.push({ numero: r.numero, estado: r.estado, pdf: r.pdf });
  });
  leer_('Remitos').forEach(function (r) {
    var c = ids[r.idCirugia];
    if (c) c.docs.remitos.push({ numero: r.numero, estado: r.estado, pdf: r.pdf, cajas: r.cajasEnviadas, vueltas: r.cajasVueltas });
  });
  leer_('OC').forEach(function (r) {
    var c = ids[r.idCirugia];
    if (c) c.docs.ocs.push({ numero: r.numero, tipo: r.tipo, estado: r.estado, proveedor: r.proveedor, pdf: r.pdf });
  });
  return lista;
}

/** Una cirugía por ID, con sus documentos */
function getCirugia(id) {
  verificar_();
  var seg = leerSeguimiento_();
  var c = seg.filas.filter(function (x) { return x.id === id; })[0];
  if (!c) throw new Error('No encontré la cirugía en el Seguimiento.');
  return docsDe_([c])[0];
}

/** Busca la fila de una cirugía por ID (o por fila + paciente como respaldo). */
function ubicarCirugia_(seg, ref) {
  var c = null;
  if (ref.id) c = seg.filas.filter(function (x) { return x.id === ref.id; })[0];
  if (!c && ref.fila) c = seg.filas.filter(function (x) { return x.fila === ref.fila && norm_(x.paciente) === norm_(ref.paciente); })[0];
  if (!c && ref.paciente) c = seg.filas.filter(function (x) { return norm_(x.paciente) === norm_(ref.paciente) && x.fecha === ref.fecha; })[0];
  return c;
}

/**
 * Alta o modificación de una cirugía en el Seguimiento.
 * c = {id?, fecha, medico, paciente, institucion, procedimiento, obraSocial, obs, estado, instrumentador,
 *      presupuesto, checklist:{...}}
 */
function guardarCirugia(c) {
  verificar_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var seg = leerSeguimiento_(), sh = seg.sh;
    var actual = c.id ? ubicarCirugia_(seg, c) : null;
    if (c.id && !actual) throw new Error('No encontré la cirugía en el Seguimiento (¿la borraron o la movieron?). Recargá.');
    var filaVals = actual ? sh.getRange(actual.fila, 1, 1, SEG_ANCHO).getValues()[0] : vacioSeg_();
    if (!actual) filaVals[SEG.id - 1] = 'C' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);

    var nuevaFecha = aFecha_(c.fecha);
    ['medico', 'paciente', 'institucion', 'procedimiento', 'obraSocial', 'obs', 'instrumentador', 'presupuesto']
      .forEach(function (k) { if (c[k] !== undefined) filaVals[SEG[k] - 1] = c[k]; });
    filaVals[SEG.fecha - 1] = nuevaFecha || '';
    if (c.estado) {
      filaVals[SEG.estado - 1] = c.estado;
      filaVals[SEG.susp - 1] = c.estado === 'Suspendida';
      filaVals[SEG.baja - 1] = c.estado === 'Dada de baja';
    }
    if (c.checklist) CHECKLIST.forEach(function (k) { filaVals[SEG[k] - 1] = !!c.checklist[k]; });

    var mover = !actual;
    if (actual) {
      var vieja = aFecha_(actual.fecha);
      var mismaSeccion = (!vieja && !nuevaFecha && actual.pendiente) ||
        (vieja && nuevaFecha && vieja.getMonth() === nuevaFecha.getMonth() && vieja.getFullYear() === nuevaFecha.getFullYear());
      mover = !mismaSeccion;
    }
    var fila;
    if (!mover) {
      fila = actual.fila;
      sh.getRange(fila, 1, 1, SEG_ANCHO).setValues([filaVals]);
    } else {
      if (actual) { sh.deleteRow(actual.fila); seg = leerSeguimiento_(); }
      fila = insertarFilaSeg_(seg, nuevaFecha);
      sh.getRange(fila, 1, 1, SEG_ANCHO).setValues([filaVals]);
      formatoFilaSeg_(sh, fila);
    }
    return cirugiaDeFila_(sh.getRange(fila, 1, 1, SEG_ANCHO).getValues()[0], fila, !nuevaFecha);
  } finally { lock.releaseLock(); }
}

function vacioSeg_() {
  var r = []; for (var i = 0; i < SEG_ANCHO; i++) r.push('');
  ['baja', 'susp', 'otro'].concat(CHECKLIST).forEach(function (k) { r[SEG[k] - 1] = false; });
  return r;
}

/** Inserta una fila vacía en la sección del mes (orden cronológico) o en "SIN FECHA". Devuelve su número. */
function insertarFilaSeg_(seg, fecha) {
  var sh = seg.sh;
  if (!fecha) {
    if (!seg.sinFecha) {
      sh.insertRowAfter(sh.getLastRow());
      var r = sh.getLastRow() + 1;
      sh.getRange(r, 1).setValue('SIN FECHA (pendientes)');
      seg.sinFecha = r;
    }
    sh.insertRowAfter(seg.sinFecha);
    return seg.sinFecha + 1;
  }
  var m = fecha.getMonth(), y = fecha.getFullYear(), t = fecha.getTime();
  var sec = seg.secciones.filter(function (s) { return s.mes === m && s.anio === y; })[0];
  if (sec) {
    var despues = sec.fila;
    sec.filas.forEach(function (f) { if (f.t <= t && f.fila > despues) despues = f.fila; });
    sh.insertRowAfter(despues);
    return despues + 1;
  }
  // Mes nuevo: va antes de "SIN FECHA" (o al final), con su título
  var antesDe = seg.sinFecha || (sh.getLastRow() + 1);
  var posterior = seg.secciones.filter(function (s) { return s.anio !== null && (s.anio > y || (s.anio === y && s.mes > m)); })[0];
  if (posterior) antesDe = posterior.fila;
  var lr = sh.getLastRow();
  if (antesDe > lr) { sh.insertRowsAfter(lr, 2); antesDe = lr + 1; }
  else sh.insertRowsBefore(antesDe, 2);
  var modelo = seg.secciones.length ? seg.secciones[seg.secciones.length - 1].fila : null;
  if (modelo && modelo >= antesDe) modelo += 2;
  if (modelo) sh.getRange(modelo, 1, 1, SEG_ANCHO).copyTo(sh.getRange(antesDe, 1, 1, SEG_ANCHO), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sh.getRange(antesDe, 1).setValue(MESES[m]);
  return antesDe + 1;
}

function formatoFilaSeg_(sh, fila) {
  sh.getRange(fila, SEG.fecha).setNumberFormat('dd/mm/yyyy');
  sh.getRange(fila, SEG.remito).setNumberFormat('@');
  [SEG.baja, SEG.susp, SEG.otro].concat(CHECKLIST.map(function (k) { return SEG[k]; })).forEach(function (j) {
    sh.getRange(fila, j).insertCheckboxes();
  });
  sh.getRange(fila, 1, 1, SEG_ANCHO).setBackground(null).setFontWeight('normal');
}

/** Escribe un dato puntual en la fila de la cirugía (N° RCC, remito, estado) */
function escribirEnSeguimiento_(ref, cambios) {
  if (!ref || (!ref.id && !ref.fila)) return;
  var seg = leerSeguimiento_(), c = ubicarCirugia_(seg, ref);
  if (!c) return;
  var sh = seg.sh;
  if (cambios.rcc !== undefined) sh.getRange(c.fila, SEG.rcc).setValue(cambios.rcc);
  if (cambios.remito !== undefined) {
    var actual = String(sh.getRange(c.fila, SEG.remito).getDisplayValue() || '').trim();
    var partes = actual ? actual.split(/\s*\/\s*/) : [];
    if (partes.indexOf(String(cambios.remito)) < 0) partes.push(String(cambios.remito));
    sh.getRange(c.fila, SEG.remito).setNumberFormat('@').setValue(partes.join(' / '));
  }
  if (cambios.estado) {
    sh.getRange(c.fila, SEG.estado).setValue(cambios.estado);
    sh.getRange(c.fila, SEG.susp).setValue(cambios.estado === 'Suspendida');
    sh.getRange(c.fila, SEG.baja).setValue(cambios.estado === 'Dada de baja');
  }
}

/* =====================================================================
 * Documentos
 * ===================================================================== */
function getDocumento(tipo, numero) {
  verificar_();
  var D = DOCS[tipo];
  var cab = leer_(D.tab).filter(function (r) { return String(r.numero) === String(numero); })[0];
  if (!cab) throw new Error('No encontré ' + D.nombre + ' N° ' + numero + '.');
  delete cab._fila;
  var items = leer_(D.items).filter(function (r) { return String(r.numero) === String(numero); })
    .sort(function (a, b) { return a.renglon - b.renglon; })
    .map(function (r) { delete r._fila; return r; });
  if (tipo === 'remito') items.forEach(function (it) { try { it.contenido = it.contenido ? JSON.parse(it.contenido) : null; } catch (e) { it.contenido = null; } });
  var out = { tipo: tipo, cab: cab, items: items };
  if (tipo === 'oc') out.recepciones = recepcionesDeOC_(numero);
  return out;
}

/**
 * Guarda un documento. d = {editar: numero|'' , cab:{...}, items:[...], cirugia:{id, fila, paciente, fecha}}
 * Devuelve {numero, proximos}
 */
function guardarDocumento(tipo, d) {
  var email = verificar_();
  var D = DOCS[tipo];
  if (!D) throw new Error('Tipo de documento desconocido: ' + tipo);
  var errores = validarServidor_(tipo, d);
  if (errores.length) throw new Error('Falta completar: ' + errores.join(', ') + '.');

  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var cab = d.cab, ahora = new Date(), numero = d.editar || '', previo = null;
    if (numero) {
      previo = leer_(D.tab).filter(function (r) { return String(r.numero) === String(numero); })[0];
      if (!previo) throw new Error(D.nombre + ' N° ' + numero + ' no existe.');
      // cambiar de OC a Solicitud (o al revés) requiere número nuevo
      if (tipo === 'oc' && serieDe_('oc', previo) !== serieDe_('oc', cab)) numero = '';
    }
    var serie = serieDe_(tipo, cab);
    if (!numero) {
      var n = proximo_(serie);
      numero = NUMERACION[serie].fmt(n);
      setCfg_(NUMERACION[serie].cfg, n);
    }
    cab.numero = numero;
    cab.modificado = ahora;
    cab.usuario = email;
    if (!previo) cab.creado = ahora;
    calcularServidor_(tipo, cab, d.items);

    if (previo) {
      cab.pdf = previo.pdf; // se reemplaza al subir el PDF nuevo
      reemplazarFila_(D.tab, previo._fila, cab);
      borrarFilasDonde_(D.items, 'numero', numero);
    } else {
      agregar_(D.tab, [cab]);
    }
    var items = (d.items || []).map(function (it, i) {
      var o = {}; for (var k in it) o[k] = it[k];
      o.numero = numero; o.renglon = i + 1;
      if (tipo === 'remito') o.contenido = it.contenido ? JSON.stringify(it.contenido) : '';
      if (tipo === 'recepcion') o.oc = cab.oc || '';
      return o;
    });
    agregar_(D.items, items);

    // Efectos sobre otros registros
    if (tipo === 'consumo') {
      escribirEnSeguimiento_(d.cirugia, { rcc: numero });
      if (d.cirugia && (!d.cirugia.estado || d.cirugia.estado === 'Programada')) escribirEnSeguimiento_(d.cirugia, { estado: 'Realizada' });
    }
    if (tipo === 'remito') escribirEnSeguimiento_(d.cirugia, { remito: String(numEntero_('remito', numero)) });
    if (tipo === 'recepcion') {
      recalcularOC_(cab.oc);
      if (previo && previo.oc && previo.oc !== cab.oc) recalcularOC_(previo.oc);
    }
    if (tipo === 'oc') recalcularOC_(numero);
    SpreadsheetApp.flush();
    return { numero: numero, proximos: proximos_(), lotes: tipo === 'recepcion' ? lotes_() : null };
  } finally { lock.releaseLock(); }
}

function validarServidor_(tipo, d) {
  var c = d.cab || {}, it = d.items || [], f = [];
  if (tipo === 'consumo') {
    if (!c.paciente) f.push('paciente');
    if (!c.fechaCx) f.push('fecha de cirugía');
    if (!c.medico) f.push('médico');
    if (!c.institucion) f.push('institución');
    if (!it.some(function (x) { return x.desc && num_(x.cant) > 0; })) f.push('al menos un producto con cantidad');
  }
  if (tipo === 'remito') {
    if (!c.institucion) f.push('institución de destino');
    if (!it.some(function (x) { return x.desc && num_(x.cant) > 0; })) f.push('al menos un sistema con cantidad');
  }
  if (tipo === 'oc') {
    if (!c.proveedor) f.push('proveedor');
    if (!it.some(function (x) { return x.desc && num_(x.cant) > 0; })) f.push('al menos un ítem con cantidad');
    if (c.tipo !== 'Solicitud de presupuesto' && it.some(function (x) { return x.desc && !num_(x.costo); })) f.push('costo en todos los ítems');
  }
  if (tipo === 'recepcion') {
    if (!c.oc && !c.proveedor) f.push('OC o proveedor');
    if (!it.length) f.push('al menos un ítem');
    it.forEach(function (x, i) {
      if (!x.lote || !x.vto || !x.empaque || !x.rotulo) f.push('lote, vencimiento e inspección en el renglón ' + (i + 1));
    });
  }
  return f;
}

function calcularServidor_(tipo, c, items) {
  items = items || [];
  if (tipo === 'oc') {
    var sub = 0, i21 = 0, i105 = 0, ex = 0;
    items.forEach(function (x) {
      var neto = Math.round(num_(x.cant) * num_(x.costo) * 100) / 100;
      var a = String(x.alicuota || '21').replace(',', '.');
      var rate = a === 'Exento' ? 0 : parseFloat(a) / 100 || 0;
      var iva = Math.round(neto * rate * 100) / 100;
      x.neto = neto; x.iva = iva; x.total = neto + iva;
      if (x.recibido === undefined || x.recibido === '') x.recibido = 0;
      x.pendiente = num_(x.cant) - num_(x.recibido);
      sub += neto;
      if (rate === 0.21) i21 += iva; else if (rate === 0.105) i105 += iva; else ex += neto;
    });
    c.subtotal = sub; c.iva21 = i21; c.iva105 = i105; c.exento = ex;
    c.total = Math.round((sub + i21 + i105 - num_(c.descuento)) * 100) / 100;
    if (!c.estado) c.estado = 'Emitida';
  }
  if (tipo === 'consumo') {
    var tc = num_(c.tc) || num_(cfg_('tcUSD')) || 1, imp = 0, des = 0;
    c.tc = tc;
    items.forEach(function (x) {
      x.costoArs = Math.round(num_(x.cant) * num_(x.costo) * (x.moneda === 'USD' ? tc : 1) * 100) / 100;
      if (x.seccion === 'Descartable') des += x.costoArs; else imp += x.costoArs;
    });
    c.costoImplantes = imp; c.costoDescartables = des;
    c.costoTotal = imp + des + num_(c.costoLogistica) + num_(c.costoEsterilizacion) + num_(c.costoOtros);
    if (!c.estado) c.estado = 'Registrado';
  }
  if (tipo === 'remito') {
    c.cajasEnviadas = items.reduce(function (s, x) { return s + num_(x.cant); }, 0);
    c.cajasVueltas = items.reduce(function (s, x) { return s + num_(x.vueltas); }, 0);
    if (!c.estado) c.estado = 'Emitido';
  }
  if (tipo === 'recepcion') {
    c.cantTotal = items.reduce(function (s, x) { return s + num_(x.cant); }, 0);
  }
}

/** Solo el control de retorno de un remito (sin regenerar el PDF) */
function guardarRetorno(numero, items, estado) {
  verificar_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = hoja_('Remito_Items'), h = heads_(sh);
    var jN = h.indexOf(colNombre_('Remito_Items', 'numero')), jR = h.indexOf(colNombre_('Remito_Items', 'renglon'));
    var jV = h.indexOf(colNombre_('Remito_Items', 'vueltas')), jO = h.indexOf(colNombre_('Remito_Items', 'obsRetorno'));
    var vals = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), h.length).getValues();
    var vueltas = 0, enviadas = 0;
    vals.forEach(function (r, i) {
      if (String(r[jN]) !== String(numero)) return;
      var it = items.filter(function (x) { return Number(x.renglon) === Number(r[jR]); })[0];
      if (it) {
        sh.getRange(i + 2, jV + 1).setValue(num_(it.vueltas));
        sh.getRange(i + 2, jO + 1).setValue(it.obsRetorno || '');
        vueltas += num_(it.vueltas);
      } else vueltas += num_(r[jV]);
      enviadas += num_(r[h.indexOf(colNombre_('Remito_Items', 'cant'))]);
    });
    var cab = leer_('Remitos').filter(function (r) { return String(r.numero) === String(numero); })[0];
    if (!cab) throw new Error('No existe el remito ' + numero);
    var est = estado || cab.estado;
    if (!estado && vueltas >= enviadas && enviadas > 0) est = 'Retornado';
    reemplazarFila_('Remitos', cab._fila, { cajasVueltas: vueltas, estado: est, modificado: new Date() });
    return { vueltas: vueltas, enviadas: enviadas, estado: est };
  } finally { lock.releaseLock(); }
}

/** Cambia solo el estado de un documento */
function cambiarEstado(tipo, numero, estado) {
  verificar_();
  var D = DOCS[tipo];
  var cab = leer_(D.tab).filter(function (r) { return String(r.numero) === String(numero); })[0];
  if (!cab) throw new Error('No encontré ' + D.nombre + ' N° ' + numero);
  reemplazarFila_(D.tab, cab._fila, { estado: estado, modificado: new Date() });
  return estado;
}

/* =====================================================================
 * PDF
 * ===================================================================== */
function subirPdf(tipo, numero, b64, nombre) {
  verificar_();
  var D = DOCS[tipo];
  var carpeta;
  try { carpeta = DriveApp.getFolderById(cfg_(D.carpeta)); }
  catch (e) { carpeta = carpeta_(D.carpeta, D.nombre, DriveApp.getFolderById(cfg_('carpetaRaiz'))); }
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/pdf', nombre);
  var file = carpeta.createFile(blob);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var cab = leer_(D.tab).filter(function (r) { return String(r.numero) === String(numero); })[0];
    if (cab) {
      var m = String(cab.pdf || '').match(/\/d\/([\w-]{20,})/);
      if (m && m[1] !== file.getId()) { try { DriveApp.getFileById(m[1]).setTrashed(true); } catch (e) { } }
      reemplazarFila_(D.tab, cab._fila, { pdf: file.getUrl() });
    }
  } finally { lock.releaseLock(); }
  return { url: file.getUrl() };
}

/* =====================================================================
 * Compras: OC + recepciones
 * ===================================================================== */
function getCompras() {
  verificar_();
  var ocs = leer_('OC'), items = leer_('OC_Items'), recs = leer_('Recepciones'), recItems = leer_('Recepcion_Items');
  var porOC = {};
  ocs.forEach(function (o) { delete o._fila; o.items = []; o.recepciones = []; porOC[o.numero] = o; });
  items.forEach(function (it) { delete it._fila; if (porOC[it.numero]) porOC[it.numero].items.push(it); });
  var porRec = {};
  recs.forEach(function (r) { delete r._fila; r.items = []; porRec[r.numero] = r; });
  recItems.forEach(function (it) { delete it._fila; if (porRec[it.numero]) porRec[it.numero].items.push(it); });
  var sueltas = [];
  recs.forEach(function (r) { if (r.oc && porOC[r.oc]) porOC[r.oc].recepciones.push(r); else sueltas.push(r); });
  ocs.forEach(function (o) { o.items.sort(function (a, b) { return a.renglon - b.renglon; }); });
  ocs.sort(function (a, b) {
    var sa = serieDe_('oc', a), sb = serieDe_('oc', b);
    if (sa !== sb) return sa === 'oc' ? -1 : 1;
    return numEntero_(sb, b.numero) - numEntero_(sa, a.numero);
  });
  return { ocs: ocs, sueltas: sueltas };
}

function recepcionesDeOC_(numero) {
  return leer_('Recepciones').filter(function (r) { return String(r.oc) === String(numero); })
    .map(function (r) { return { numero: r.numero, fecha: r.fecha, factura: r.factura, remitoProv: r.remitoProv, pdf: r.pdf }; });
}

/** Recalcula recibido/pendiente de cada ítem, facturas y estado de una OC */
function recalcularOC_(numero) {
  if (!numero) return;
  var oc = leer_('OC').filter(function (r) { return String(r.numero) === String(numero); })[0];
  if (!oc) return;
  var recItems = leer_('Recepcion_Items').filter(function (r) { return String(r.oc) === String(numero); });
  var facturas = [];
  leer_('Recepciones').forEach(function (r) {
    if (String(r.oc) === String(numero) && r.factura && facturas.indexOf(r.factura) < 0) facturas.push(r.factura);
  });
  var sh = hoja_('OC_Items'), h = heads_(sh);
  var jRec = h.indexOf(colNombre_('OC_Items', 'recibido')), jPen = h.indexOf(colNombre_('OC_Items', 'pendiente'));
  var items = leer_('OC_Items').filter(function (r) { return String(r.numero) === String(numero); });
  var usados = {};
  var hayItems = false, todo = true, algo = false;
  items.forEach(function (it) {
    var rec = 0;
    recItems.forEach(function (ri, k) {
      if (usados[k]) return;
      var mismo = ri.renglonOc ? Number(ri.renglonOc) === Number(it.renglon)
        : norm_(ri.codigo) === norm_(it.codigo) && !!it.codigo;
      if (mismo) { rec += num_(ri.cant); usados[k] = true; }
    });
    var pen = Math.max(num_(it.cant) - rec, 0);
    sh.getRange(it._fila, jRec + 1).setValue(rec);
    sh.getRange(it._fila, jPen + 1).setValue(pen);
    hayItems = true; if (pen > 0) todo = false; if (rec > 0) algo = true;
  });
  var estado = oc.estado;
  if (estado !== 'Anulada' && serieDe_('oc', oc) === 'oc') {
    if (hayItems && todo && algo) estado = 'Recibida';
    else if (algo) estado = 'Recibida parcial';
    else if (estado === 'Recibida' || estado === 'Recibida parcial') estado = 'Enviada';
  }
  reemplazarFila_('OC', oc._fila, { estado: estado, facturas: facturas.join(' · ') });
}

/** Arma una OC por proveedor con lo consumido en un registro de consumo */
function generarOCsReposicion(rcc) {
  var email = verificar_();
  var cons = leer_('Consumos').filter(function (r) { return String(r.numero) === String(rcc); })[0];
  if (!cons) throw new Error('No existe el registro ' + rcc);
  var items = leer_('Consumo_Items').filter(function (r) { return String(r.numero) === String(rcc); });
  var prods = {}; leer_('Productos').forEach(function (p) { prods[norm_(p.codigo)] = p; });
  var provs = leer_('Proveedores');
  var grupos = {}, sinProv = [];
  items.forEach(function (it) {
    var p = prods[norm_(it.codigo)] || {};
    var prov = it.proveedor || p.proveedor;
    if (!prov) { sinProv.push(it.desc || it.codigo); return; }
    var k = norm_(prov);
    grupos[k] = grupos[k] || { nombre: prov, items: [] };
    grupos[k].items.push({
      codigo: it.codigo, desc: it.desc, cant: it.cant, costo: p.costo || it.costo || 0,
      alicuota: p.alicuota || '21', moneda: p.moneda || it.moneda
    });
  });
  var creadas = [];
  Object.keys(grupos).forEach(function (k) {
    var g = grupos[k];
    var pv = provs.filter(function (p) { return norm_(p.razon) === k || norm_(p.codigo) === k; })[0] || {};
    var moneda = pv.moneda || g.items[0].moneda || 'ARS';
    var d = {
      cab: {
        tipo: 'Orden de compra', fecha: fmtFecha_(new Date()), estado: 'Emitida',
        pedido: 'Repo ' + (cons.paciente || '') + ' (RCC ' + rcc + ')',
        proveedor: pv.razon || g.nombre, cuit: pv.cuit || '', domicilio: pv.domicilio || '', localidad: pv.localidad || '',
        pago: pv.pago || '', lugar: cfg_('lugarEntrega') || '', moneda: moneda,
        tc: moneda === 'USD' ? num_(cfg_('tcUSD')) : '', descuento: 0,
        idCirugia: cons.idCirugia, rcc: rcc, fechaCx: cons.fechaCx, medico: cons.medico,
        institucion: cons.institucion, paciente: cons.paciente, obs: ''
      },
      items: g.items.map(function (x) { return { codigo: x.codigo, desc: x.desc, cant: x.cant, costo: x.costo, alicuota: x.alicuota }; })
    };
    // sin validar costo: queda Emitida para completar precios antes del PDF
    var lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      var n = proximo_('oc'), numero = NUMERACION.oc.fmt(n);
      setCfg_('ultimaOC', n);
      d.cab.numero = numero; d.cab.creado = new Date(); d.cab.modificado = new Date(); d.cab.usuario = email;
      calcularServidor_('oc', d.cab, d.items);
      agregar_('OC', [d.cab]);
      agregar_('OC_Items', d.items.map(function (x, i) { x.numero = numero; x.renglon = i + 1; return x; }));
      creadas.push({ numero: numero, proveedor: d.cab.proveedor, items: d.items.length });
    } finally { lock.releaseLock(); }
  });
  if (creadas.length) {
    var previas = cons.ocs ? String(cons.ocs).split(/\s*·\s*/) : [];
    reemplazarFila_('Consumos', cons._fila, { ocs: previas.concat(creadas.map(function (c) { return c.numero; })).join(' · ') });
  }
  return { creadas: creadas, sinProveedor: sinProv };
}

/* =====================================================================
 * Datos maestros desde la app
 * ===================================================================== */
function getTabla(tab) {
  verificar_();
  if (MAESTROS.indexOf(tab) < 0) throw new Error('Tabla no editable: ' + tab);
  return { columnas: TABS[tab], filas: leer_(tab).map(function (r) { delete r._fila; return r; }) };
}

function guardarTabla(tab, filas) {
  verificar_();
  if (MAESTROS.indexOf(tab) < 0) throw new Error('Tabla no editable: ' + tab);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = hoja_(tab), h = heads_(sh);
    var limpias = (filas || []).filter(function (o) {
      return TABS[tab].some(function (c) { return o[c[0]] !== undefined && o[c[0]] !== '' && o[c[0]] !== false; });
    });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, h.length).clearContent();
    if (limpias.length) {
      var rows = limpias.map(function (o) { return filaDe_(h, tab, o); });
      if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
      sh.getRange(2, 1, rows.length, h.length).setValues(rows);
      formatearTab_(sh, tab);
    }
    return maestros_();
  } finally { lock.releaseLock(); }
}

/** Alta rápida de un registro maestro (desde un buscador) */
function agregarMaestro(tab, obj) {
  verificar_();
  if (MAESTROS.indexOf(tab) < 0) throw new Error('Tabla no editable: ' + tab);
  agregar_(tab, [obj]);
  return maestros_();
}

/* =====================================================================
 * Total en letras (para el registro del Sheet y pruebas)
 * ===================================================================== */
function enLetras(total, moneda) {
  var U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE',
    'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS',
    'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  var D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  var C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS',
    'OCHOCIENTOS', 'NOVECIENTOS'];
  function m1000(n) {
    if (n === 0) return ''; if (n === 100) return 'CIEN';
    var c = Math.floor(n / 100), r = n % 100, s = C[c];
    if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : ''));
    return s;
  }
  function letras(n) {
    if (n === 0) return 'CERO';
    var mill = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), rest = n % 1000, out = [];
    if (mill) out.push(mill === 1 ? 'UN MILLÓN' : m1000(mill).replace(/UNO$/, 'UN') + ' MILLONES');
    if (miles) out.push(miles === 1 ? 'MIL' : m1000(miles).replace(/UNO$/, 'UN') + ' MIL');
    if (rest) out.push(m1000(rest));
    return out.join(' ');
  }
  var ent = Math.floor(total + 1e-9), cts = Math.round((total - ent) * 100);
  var s = 'SON ' + letras(ent).replace(/UNO$/, 'UN') + (moneda === 'USD' ? ' DÓLARES ESTADOUNIDENSES' : ' PESOS');
  if (cts) s += ' CON ' + pad_(cts, 2) + '/100';
  return s;
}
