/**
 * Importación de datos maestros desde las planillas viejas (IDs en Config: fuenteOC, fuenteCirugia,
 * fuenteRemito, fuenteRecepcion) y del Seguimiento de cirugías.
 * Reemplaza el contenido de: Clientes, Productos, Proveedores, Medicos, Instituciones, Sistemas, Sistemas_Contenido.
 */
function importarMaestros() {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { }
  if (ui) {
    var r = ui.alert('Importar datos maestros',
      'Se reemplazan Clientes, Productos, Proveedores, Medicos, Instituciones y Sistemas con lo que hay en las ' +
      'planillas viejas. Lo que hayas cargado a mano en esas pestañas se pierde. ¿Seguir?', ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return 'Cancelado';
  }

  var resumen = [];
  var datos = {
    Proveedores: importarProveedores_(),
    Medicos: importarMedicos_(),
    Instituciones: importarInstituciones_(),
    Clientes: importarObrasSociales_()
  };
  var sis = importarSistemas_();
  datos.Sistemas = sis.sistemas;
  datos.Sistemas_Contenido = sis.contenido;
  datos.Productos = importarProductos_(datos.Proveedores);

  Object.keys(datos).forEach(function (tab) {
    escribirTabla_(tab, datos[tab]);
    resumen.push(tab + ': ' + datos[tab].length);
  });
  var msg = 'Importado.\n' + resumen.join('\n');
  if (ui) ui.alert(msg);
  return msg;
}

function escribirTabla_(tab, objs) {
  var sh = hoja_(tab), h = heads_(sh);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, h.length).clearContent();
  if (!objs.length) return;
  var rows = objs.map(function (o) { return filaDe_(h, tab, o); });
  if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
  sh.getRange(2, 1, rows.length, h.length).setValues(rows);
  formatearTab_(sh, tab);
}

function valoresFuente_(clave, hoja) {
  var id = cfg_(clave);
  if (!id) return [];
  var sh = SpreadsheetApp.openById(id).getSheetByName(hoja);
  if (!sh || sh.getLastRow() === 0) return [];
  return sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), 1)).getDisplayValues();
}

function limpio_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function vacioGuion_(s) { s = limpio_(s); return /^-+$/.test(s) ? '' : s; }

function precio_(s) {
  s = limpio_(s);
  if (!/\d/.test(s) || /[a-z]{3,}/i.test(s.replace(/usd|ars/ig, ''))) return '';
  var n = num_(s);
  return n ? n : '';
}

/* ---------------- Proveedores (OC → datos_proov) ---------------- */
function importarProveedores_() {
  var v = valoresFuente_('fuenteOC', 'datos_proov'), out = [], vistos = {};
  // monedas declaradas en cod_art (columna E = "USD")
  var usd = {};
  var art = valoresFuente_('fuenteOC', 'cod_art'), grupo = '';
  art.slice(1).forEach(function (r) {
    if (r[0] && !r[1] && !r[2]) { grupo = limpio_(r[0]); return; }
    var prov = limpio_(r[2]) || grupo;
    if (String(r[4]).toUpperCase().indexOf('USD') >= 0 && prov) usd[norm_(prov)] = true;
  });
  v.slice(1).forEach(function (r) {
    var razon = vacioGuion_(r[0]);
    if (!razon || vistos[norm_(razon)]) return;
    vistos[norm_(razon)] = true;
    out.push({
      codigo: norm_(razon).replace(/ /g, '_').toUpperCase().slice(0, 20), razon: razon,
      cuit: vacioGuion_(r[3]), iva: 'Responsable Inscripto', domicilio: vacioGuion_(r[1]),
      localidad: vacioGuion_(r[2]), contacto: '', email: '', telefono: '',
      moneda: usd[norm_(razon)] ? 'USD' : 'ARS', pago: ''
    });
  });
  return out;
}

/* ---------------- Médicos (registro de cirugía → Medicos) ---------------- */
function importarMedicos_() {
  var v = valoresFuente_('fuenteCirugia', 'Medicos'), out = [], vistos = {};
  v.slice(1).forEach(function (r) {
    var n = limpio_(r[0]);
    if (!n || vistos[norm_(n)]) return;
    vistos[norm_(n)] = true;
    out.push({
      nombre: n, cuit: limpio_(r[1]), localidad: limpio_(r[2]), matProv: limpio_(r[3]), matNac: limpio_(r[4]),
      especialidad: limpio_(r[5]), telefono: '', sellos: String(r[6]).toUpperCase() === 'TRUE'
    });
  });
  return out;
}

/* ---------------- Instituciones (remito → datos_instu + cirugía → lista I:K) ---------------- */
function importarInstituciones_() {
  var out = [], idx = {};
  function get(nombre) {
    var k = norm_(nombre);
    if (!idx[k]) {
      idx[k] = { nombre: limpio_(nombre), gln: '', cuit: '', direccion: '', localidad: '', contacto: '', km: '', logistica: '' };
      out.push(idx[k]);
    }
    return idx[k];
  }
  valoresFuente_('fuenteRemito', 'datos_instu').slice(1).forEach(function (r) {
    var n = vacioGuion_(r[0]); if (!n) return;
    var o = get(n);
    o.gln = o.gln || vacioGuion_(r[1]); o.cuit = o.cuit || vacioGuion_(r[2]);
    o.direccion = o.direccion || vacioGuion_(r[3]); o.localidad = o.localidad || vacioGuion_(r[4]);
  });
  valoresFuente_('fuenteCirugia', 'lista').slice(1).forEach(function (r) {
    var n = vacioGuion_(r[8]); if (!n || /^nombre$/i.test(n) || /^encomienda$/i.test(n)) return;
    var o = get(n);
    if (r[9]) o.km = num_(r[9]);
    if (r[10]) o.logistica = num_(r[10]);
  });
  return out;
}

/* ---------------- Obras sociales (Seguimiento → columna OBRA SOCIAL) ---------------- */
function importarObrasSociales_() {
  var seg = leerSeguimiento_(), vistos = {}, out = [];
  seg.filas.forEach(function (c) {
    var n = limpio_(c.obraSocial);
    if (!n || vistos[norm_(n)]) return;
    vistos[norm_(n)] = true;
    out.push({ codigo: '', razon: n, cuit: '', domicilio: '', localidad: '', iva: '' });
  });
  out.sort(function (a, b) { return a.razon.localeCompare(b.razon); });
  return out;
}

/* ---------------- Sistemas y contenido de cajas (remito) ---------------- */
var HOJAS_NO_SISTEMA = ['caratula_auto', 'caratula_manual', 'contenido', 'hoja 12', 'hoja 13', 'hoja 14',
  'datos_ciru', 'datos_instu'];

function importarSistemas_() {
  var id = cfg_('fuenteRemito');
  var ss = SpreadsheetApp.openById(id);
  // Contenido de cada hoja de sistema
  var contenido = [], listados = [];
  ss.getSheets().forEach(function (sh) {
    var nombre = sh.getName(), k = nombre.toLowerCase();
    if (HOJAS_NO_SISTEMA.indexOf(k) >= 0 || /^copia de/i.test(nombre) || sh.getLastRow() === 0) return;
    var v = sh.getRange(1, 1, Math.min(sh.getLastRow(), 400), Math.min(Math.max(sh.getLastColumn(), 1), 8)).getDisplayValues();
    var cols = null, seccion = '', filas = [];
    v.forEach(function (r) {
      var celdas = r.map(limpio_), llenas = celdas.filter(String);
      if (!llenas.length) return;
      var up = celdas.map(function (x) { return x.toUpperCase(); });
      var jCant = up.indexOf('CANTIDAD'), jCod = up.indexOf('CODIGO') >= 0 ? up.indexOf('CODIGO') : up.indexOf('CÓDIGO');
      var jDesc = up.indexOf('DESCRIPCION') >= 0 ? up.indexOf('DESCRIPCION') : up.indexOf('DESCRIPCIÓN');
      if (jCant >= 0 && jDesc >= 0) { cols = { cant: jCant, cod: jCod, desc: jDesc }; return; }
      if (llenas.length === 1 && !/^\d+([.,]\d+)?$/.test(llenas[0])) { seccion = llenas[0]; return; }
      if (!cols) return;
      var desc = celdas[cols.desc];
      if (!desc) return;
      filas.push({ listado: nombre, seccion: seccion, cant: num_(celdas[cols.cant]) || '', codigo: cols.cod >= 0 ? celdas[cols.cod] : '', desc: desc });
    });
    if (filas.length) { listados.push(nombre); contenido = contenido.concat(filas); }
  });

  // Catálogo de sistemas (pestaña Contenido)
  var sistemas = [], vistos = {};
  valoresFuente_('fuenteRemito', 'Contenido').slice(1).forEach(function (r) {
    var cod = limpio_(r[0]);
    if (!cod || vistos[norm_(cod)]) return;
    vistos[norm_(cod)] = true;
    var nc = norm_(cod), listado = '';
    listados.forEach(function (l) {
      var nl = norm_(l);
      if (!listado && (nl === nc || nl.indexOf(nc) === 0 || nc.indexOf(nl) === 0)) listado = l;
    });
    sistemas.push({ codigo: cod, desc: limpio_(r[1]), marca: limpio_(r[2]), esteril: false, listado: listado });
  });
  return { sistemas: sistemas, contenido: contenido };
}

/* ---------------- Productos (OC cod_art + cirugía lista + recepción cod) ---------------- */
function importarProductos_(proveedores) {
  var out = [], idx = {};
  var monedaProv = {};
  (proveedores || []).forEach(function (p) { monedaProv[norm_(p.razon)] = p.moneda; });
  function get(cod) {
    var k = norm_(cod);
    if (!idx[k]) {
      idx[k] = { codigo: limpio_(cod), desc: '', marca: '', modelo: '', detalle: '', origen: '', proveedor: '',
        costo: '', moneda: '', alicuota: '21', activo: true };
      out.push(idx[k]);
    }
    return idx[k];
  }

  // 1) OC → cod_art: A código · B descripción · C proveedor · D precio · E moneda; filas de grupo = nombre del proveedor
  var grupo = '';
  valoresFuente_('fuenteOC', 'cod_art').slice(1).forEach(function (r) {
    var a = limpio_(r[0]), b = limpio_(r[1]), c = limpio_(r[2]);
    if (a && !b && !c) { grupo = a; return; }
    if (!a || !b) return;
    var o = get(a);
    o.desc = o.desc || b;
    o.proveedor = o.proveedor || c || grupo;
    var p = precio_(r[3]);
    if (p !== '' && o.costo === '') {
      o.costo = p;
      o.moneda = String(r[4]).toUpperCase().indexOf('USD') >= 0 ? 'USD' : '';
    }
  });

  // 2) Cirugía → lista: A código · B producto · C marca/modelo · D proveedor · F precio en pesos
  valoresFuente_('fuenteCirugia', 'lista').slice(2).forEach(function (r) {
    var a = limpio_(r[0]), b = limpio_(r[1]);
    if (!a || !b) return;
    var nuevo = !idx[norm_(a)];
    var o = get(a);
    o.desc = o.desc || b;
    var mm = limpio_(r[2]).split('/');
    if (mm.length === 2) { o.modelo = o.modelo || limpio_(mm[0]); o.marca = o.marca || limpio_(mm[1]); }
    else if (mm[0]) o.marca = o.marca || limpio_(mm[0]);
    o.proveedor = o.proveedor || limpio_(r[3]);
    if (nuevo && o.costo === '') { var p = precio_(r[5]); if (p !== '') { o.costo = p; o.moneda = 'ARS'; } }
  });

  // 3) Recepción → cod: fila 2 encabezado · A código · B descripción · C proveedor · D precio
  valoresFuente_('fuenteRecepcion', 'cod').slice(2).forEach(function (r) {
    var a = limpio_(r[0]), b = limpio_(r[1]);
    if (!a || !b) return;
    var o = get(a);
    o.desc = o.desc || b;
    o.proveedor = o.proveedor || limpio_(r[2]);
    if (o.costo === '') { var p = precio_(r[3]); if (p !== '') o.costo = p; }
  });

  // Moneda: la declarada, o la del proveedor, o ARS
  out.forEach(function (o) {
    if (!o.moneda) o.moneda = monedaProv[norm_(o.proveedor)] || 'ARS';
  });
  return out;
}
