'use client';
// PDF de los documentos con @react-pdf/renderer (vectorial, A4, paginado).
import { enLetras, fmt, num } from '@/lib/format';

const AZUL = '#2F55B0', AZUL_OSC = '#24448F', AZUL_CLARO = '#EEF2FA', TINTA = '#1B1F2A', GRIS = '#5B6272', GRIS_CLARO = '#9AA1AE', LINEA = '#E3E7EF', FONDO = '#F8FAFD';

export const TITULOS = {
  consumo: 'REGISTRO DE CONSUMO DE CIRUGÍA',
  remito: 'REMITO DE TRANSPORTE',
  oc: 'ORDEN DE COMPRA',
  solicitud: 'SOLICITUD DE PRESUPUESTO',
  recepcion: 'RECEPCIÓN · INSPECCIÓN DE PRODUCTOS MÉDICOS',
};

export function nombreArchivo(tipo, cab) {
  const base = {
    consumo: `RCC ${cab.numero} ${cab.medico || ''} ${cab.paciente || ''}`,
    remito: `Remito ${cab.numero} ${cab.institucion || ''} ${cab.paciente || ''}`,
    oc: `${cab.tipo === 'Solicitud de presupuesto' ? 'Solicitud' : 'OC'} ${cab.numero} ${cab.proveedor || ''} ${cab.pedido || ''}`,
    recepcion: `Recepcion ${cab.numero} OC ${cab.oc || '-'} ${cab.proveedor || ''}`,
  }[tipo];
  return base.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() + '.pdf';
}

/** Genera el PDF y devuelve un Blob */
export async function crearPdf(tipo, doc, ctx) {
  const R = await import('@react-pdf/renderer');
  const { Document, Page, View, Text, Image, StyleSheet, Font, pdf } = R;
  Font.registerHyphenationCallback((palabra) => [palabra]);
  const { config: C = {}, logo } = ctx;
  const cab = doc.cab || {};
  const items = doc.items || [];
  const esSolicitud = tipo === 'oc' && cab.tipo === 'Solicitud de presupuesto';
  const titulo = TITULOS[esSolicitud ? 'solicitud' : tipo];

  const s = StyleSheet.create({
    page: { paddingTop: 26, paddingBottom: 46, paddingHorizontal: 32, fontFamily: 'Helvetica', fontSize: 8.6, color: TINTA },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo: { width: 150, height: 42, objectFit: 'contain', objectPositionX: 0 },
    marca: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: AZUL_OSC, lineHeight: 1.1 },
    rs: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginTop: 6 },
    dom: { color: GRIS, fontSize: 7.8, marginTop: 1, lineHeight: 1.3 },
    doc: { alignItems: 'flex-end', maxWidth: 300 },
    tipo: { color: AZUL, fontFamily: 'Helvetica-Bold', fontSize: 7.6, letterSpacing: 1.6, textAlign: 'right', lineHeight: 1.2 },
    num: { fontFamily: 'Helvetica-Bold', fontSize: 16, lineHeight: 1.15, marginTop: 4, marginBottom: 2 },
    fecha: { color: GRIS, lineHeight: 1.3 },
    sello: { marginTop: 6, borderWidth: 1, borderColor: '#B8BECA', borderStyle: 'dashed', borderRadius: 3, paddingVertical: 2.5, paddingHorizontal: 6, fontSize: 6.6, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, color: GRIS },
    fiscal: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 9, paddingBottom: 7, borderBottomWidth: 2, borderBottomColor: AZUL, fontSize: 7.4, color: GRIS },
    fiscalItem: { marginRight: 14 },
    b: { fontFamily: 'Helvetica-Bold', color: TINTA },
    partes: { flexDirection: 'row', marginTop: 12, borderWidth: 1, borderColor: LINEA, borderRadius: 6, backgroundColor: FONDO },
    parte: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
    parteSep: { borderLeftWidth: 1, borderLeftColor: LINEA },
    lbl: { color: AZUL, fontSize: 6.6, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' },
    nom: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 3, textTransform: 'uppercase', lineHeight: 1.25 },
    sub: { color: GRIS, marginTop: 1.5, lineHeight: 1.3 },
    tabla: { marginTop: 12 },
    th: { flexDirection: 'row', backgroundColor: AZUL_CLARO, borderTopWidth: 1, borderTopColor: LINEA, borderBottomWidth: 1, borderBottomColor: '#D3DAEA' },
    thc: { paddingVertical: 5, paddingHorizontal: 5, color: AZUL_OSC, fontSize: 6.6, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
    tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINEA },
    td: { paddingVertical: 5, paddingHorizontal: 5, lineHeight: 1.3 },
    grupo: { paddingVertical: 4, paddingHorizontal: 5, fontFamily: 'Helvetica-Bold', fontSize: 7, letterSpacing: 0.8, color: AZUL_OSC, backgroundColor: FONDO, borderBottomWidth: 1, borderBottomColor: LINEA },
    r: { textAlign: 'right' },
    c: { textAlign: 'center' },
    caja: { borderWidth: 1, borderColor: LINEA, borderRadius: 6, padding: 9, marginTop: 10 },
    p: { lineHeight: 1.35 },
    pie: { position: 'absolute', bottom: 18, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.8, color: GRIS_CLARO, borderTopWidth: 1, borderTopColor: LINEA, paddingTop: 5 },
    firmas: { flexDirection: 'row', marginTop: 16, gap: 18 },
    firma: { flex: 1, borderTopWidth: 1, borderTopColor: '#B8BECA', paddingTop: 4, fontSize: 7.4, color: GRIS },
    totales: { width: 210, borderWidth: 1, borderColor: LINEA, borderRadius: 6, overflow: 'hidden' },
    totFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: LINEA },
    totFinal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: AZUL, color: '#fff', paddingVertical: 7, paddingHorizontal: 9 },
    letras: { borderWidth: 1, borderColor: LINEA, backgroundColor: FONDO, borderRadius: 5, padding: 7, fontFamily: 'Helvetica-Bold', fontSize: 7.6, textTransform: 'uppercase', lineHeight: 1.3 },
  });

  const t = (v) => (v === null || v === undefined ? '' : String(v));
  const fiscal = [['IVA', C.condIva?.replace(/^IVA\s*/i, '')], ['CUIT', C.cuit], ['Ing. Brutos', C.iibb], ['Inicio act.', C.inicioAct]];
  if (tipo === 'remito' || tipo === 'consumo' || tipo === 'recepcion') fiscal.push(['GLN', C.gln]);

  const sello = { consumo: C.formConsumo, remito: 'NO VÁLIDO COMO FACTURA · ' + t(C.formRemito), recepcion: C.formRecepcion, oc: '' }[tipo];
  const fechaLbl = tipo === 'recepcion' ? 'Fecha recepción' : 'Fecha';

  const Encabezado = () => (
    <View fixed>
      <View style={s.head}>
        <View>
          {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.marca}>{C.razonSocial || 'Surchérie'}</Text>}
          <Text style={s.rs}>{C.razonSocial}{C.subtitulo ? '  ·  ' + C.subtitulo : ''}</Text>
          <Text style={s.dom}>{[C.domicilio, C.telefono].filter(Boolean).join('  ·  ')}</Text>
          <Text style={s.dom}>{C.email}</Text>
        </View>
        <View style={s.doc}>
          <Text style={s.tipo}>{titulo}</Text>
          <Text style={s.num}>N° {t(cab.numero)}</Text>
          <Text style={s.fecha}>{fechaLbl} <Text style={s.b}>{t(cab.fecha)}</Text></Text>
          {sello ? <Text style={s.sello}>{sello}</Text> : null}
        </View>
      </View>
      <View style={s.fiscal}>
        {fiscal.filter((f) => f[1]).map(([k, v]) => (
          <Text key={k} style={s.fiscalItem}><Text style={s.b}>{k}</Text> {v}</Text>
        ))}
      </View>
    </View>
  );

  const Pie = () => (
    <View style={s.pie} fixed>
      <Text>{C.anmat}</Text>
      <Text render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Página ${pageNumber} de ${totalPages}` : '')} />
    </View>
  );

  const Partes = ({ cols }) => (
    <View style={s.partes} wrap={false}>
      {cols.map((p, i) => (
        <View key={i} style={[s.parte, i > 0 && s.parteSep, p.flex ? { flex: p.flex } : null]}>
          <Text style={s.lbl}>{p.lbl}</Text>
          {p.nom !== undefined && <Text style={s.nom}>{t(p.nom) || ' '}</Text>}
          {(p.sub || []).filter((x) => x && (x[1] || x[2])).map((x, j) => (
            <Text key={j} style={s.sub}>{x[0] ? <Text style={s.b}>{x[0]} </Text> : null}{t(x[1])}</Text>
          ))}
        </View>
      ))}
    </View>
  );

  /** cols: [{h, w, k|f, al}] · filas: objetos · grupos opcionales [{titulo, filas}] */
  const Tabla = ({ cols, filas, grupos, style }) => (
    <View style={[s.tabla, style]}>
      <View style={s.th} fixed={false}>
        {cols.map((c, i) => <Text key={i} style={[s.thc, { width: c.w }, c.al === 'r' && s.r, c.al === 'c' && s.c]}>{c.h}</Text>)}
      </View>
      {(grupos || [{ filas }]).map((g, gi) => (
        <View key={gi}>
          {g.titulo ? <Text style={s.grupo} wrap={false}>{g.titulo}</Text> : null}
          {g.filas.map((f, i) => (
            <View key={i} style={s.tr} wrap={false}>
              {cols.map((c, j) => (
                <Text key={j} style={[s.td, { width: c.w }, c.al === 'r' && s.r, c.al === 'c' && s.c, c.b && s.b]}>{c.f ? c.f(f) : t(f[c.k])}</Text>
              ))}
            </View>
          ))}
          {!g.filas.length && g.titulo ? <Text style={[s.td, { color: GRIS_CLARO }]}>—</Text> : null}
        </View>
      ))}
    </View>
  );

  const Firmas = ({ lista }) => (
    <View style={s.firmas} wrap={false}>
      {lista.map((f, i) => <Text key={i} style={s.firma}>{f}</Text>)}
    </View>
  );

  let cuerpo;
  const anexos = [];

  if (tipo === 'consumo') {
    const imp = items.filter((x) => x.seccion !== 'Descartable');
    const des = items.filter((x) => x.seccion === 'Descartable');
    cuerpo = (
      <>
        <Partes cols={[
          { lbl: 'Paciente', nom: cab.paciente, sub: [['Obra social', cab.obraSocial]] },
          { lbl: 'Médico', nom: cab.medico, sub: [['M.P.', cab.matricula], ['Instrumentador', [cab.instrumentador, cab.matInstr && 'M.P. ' + cab.matInstr].filter(Boolean).join(' · ')]] },
          { lbl: 'Institución', nom: cab.institucion, sub: [['Fecha de cirugía', cab.fechaCx], ['Remito Surchérie', cab.remitoSur], ['Remito transporte', cab.remitoTr], ['N° presupuesto', cab.presupuesto]] },
        ]} />
        <Tabla
          cols={[{ h: 'Cant.', w: '8%', k: 'cant', al: 'c', b: true }, { h: 'Código', w: '16%', k: 'codigo' }, { h: 'Descripción', w: '42%', k: 'desc' }, { h: 'Marca / Modelo', w: '18%', k: 'marca' }, { h: 'Proveedor', w: '16%', k: 'proveedor' }]}
          grupos={[{ titulo: 'PRODUCTOS IMPLANTADOS', filas: imp }, ...(des.length ? [{ titulo: 'DESCARTABLES', filas: des }] : [])]}
        />
        {(cab.procedimiento || cab.obs) ? (
          <View style={s.caja} wrap={false}>
            {cab.procedimiento ? <Text><Text style={s.b}>Procedimiento: </Text>{cab.procedimiento}</Text> : null}
            {cab.obs ? <Text style={{ marginTop: 3 }}><Text style={s.b}>Observaciones: </Text>{cab.obs}</Text> : null}
          </View>
        ) : null}
        <View style={[s.caja, { height: 150 }]} wrap={false}>
          <Text style={s.lbl}>Stickers</Text>
        </View>
        <Firmas lista={[`Evaluó y confeccionó: ${t(C.confecciono)}`, `Aprobó: ${t(C.aprobo)}`, 'Firma']} />
      </>
    );
  }

  if (tipo === 'remito') {
    const total = items.reduce((a, x) => a + num(x.cant), 0);
    cuerpo = (
      <>
        <Partes cols={[
          { lbl: 'Destino', nom: cab.institucion, flex: 1.3, sub: [['', [cab.direccion, cab.localidad].filter(Boolean).join(' · ')], ['CUIT', cab.cuit], ['GLN/CUFF', cab.gln]] },
          { lbl: 'Cirugía', nom: cab.paciente, sub: [['Fecha de cirugía', cab.fechaCx], ['Médico', cab.medico], ['N° RCC', cab.rcc]] },
        ]} />
        <Text style={[s.lbl, { marginTop: 12 }]}>Descripción del material entregado</Text>
        <Tabla
          style={{ marginTop: 5 }}
          cols={[{ h: 'Cajas', w: '8%', k: 'cant', al: 'c', b: true }, { h: 'Código', w: '13%', k: 'codigo' }, { h: 'Descripción', w: '55%', k: 'desc' }, { h: 'Marca', w: '14%', k: 'marca' }, { h: 'Estéril', w: '10%', al: 'c', f: (x) => (x.esteril ? 'Sí' : 'No') }]}
          filas={items}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
          <Text>Total de cajas: <Text style={s.b}>{total}</Text></Text>
        </View>
        {(cab.transportista || cab.obs) ? (
          <View style={s.caja} wrap={false}>
            {cab.transportista ? <Text><Text style={s.b}>Transportista: </Text>{cab.transportista}</Text> : null}
            {cab.obs ? <Text style={{ marginTop: 3 }}><Text style={s.b}>Observaciones: </Text>{cab.obs}</Text> : null}
          </View>
        ) : null}
        <View style={[s.caja, { marginTop: 14 }]} wrap={false}>
          <Text style={s.lbl}>Recibí conforme</Text>
          <View style={[s.firmas, { marginTop: 30 }]}>
            <Text style={s.firma}>Firma</Text>
            <Text style={s.firma}>Aclaración {cab.recibio ? ': ' + cab.recibio : ''}</Text>
            <Text style={s.firma}>DNI {cab.dni ? ': ' + cab.dni : ''}</Text>
            <Text style={s.firma}>Fecha de entrega {cab.fechaEntrega ? ': ' + cab.fechaEntrega : ''}</Text>
          </View>
        </View>
        <Text style={{ marginTop: 12, color: GRIS, fontSize: 7.4 }}>Evaluó y confeccionó: {t(C.confecciono)}</Text>
      </>
    );
    if (cab.anexo !== false) {
      items.filter((x) => x.contenido && x.contenido.length).forEach((x, i) => {
        const secciones = [];
        x.contenido.forEach((r) => {
          const ult = secciones[secciones.length - 1];
          if (!ult || ult.titulo !== (r.seccion || '')) secciones.push({ titulo: r.seccion || '', filas: [r] });
          else ult.filas.push(r);
        });
        anexos.push(
          <View key={'a' + i} break>
            <Text style={[s.lbl, { marginTop: 12 }]}>Listado de contenido · {x.cant} {num(x.cant) === 1 ? 'caja' : 'cajas'}</Text>
            <Text style={[s.nom, { textTransform: 'none', fontSize: 9.5 }]}>{x.codigo}  ·  {x.marca}</Text>
            <Text style={s.sub}>{x.desc}</Text>
            <Tabla cols={[{ h: 'Cant.', w: '10%', k: 'cant', al: 'c', b: true }, { h: 'Código', w: '22%', k: 'codigo' }, { h: 'Descripción', w: '68%', k: 'desc' }]} grupos={secciones} />
          </View>,
        );
      });
    }
  }

  if (tipo === 'oc') {
    const mon = cab.moneda === 'USD' ? 'USD ' : '$ ';
    cuerpo = (
      <>
        <Partes cols={[
          { lbl: 'Proveedor', nom: cab.proveedor, flex: 1.3, sub: [['', [cab.domicilio, cab.localidad].filter(Boolean).join(' · ')], ['CUIT', cab.cuit]] },
          { lbl: 'Entrega', sub: [['Forma de envío', cab.formaEnvio], ['Fecha de envío', cab.fechaEnvio], ['Plazo', cab.plazo], ['Lugar', cab.lugar]] },
          { lbl: 'Pago', sub: [['Condiciones', cab.pago], ['Moneda', cab.moneda === 'USD' ? 'Dólares (USD)' : 'Pesos (ARS)'], ['TC', cab.moneda === 'USD' && cab.tc ? fmt(cab.tc) : '']] },
        ]} />
        {cab.pedido ? <Text style={{ marginTop: 9 }}><Text style={s.b}>Pedido: </Text>{cab.pedido}</Text> : null}
        <Tabla
          cols={esSolicitud
            ? [{ h: 'Cant.', w: '10%', k: 'cant', al: 'c', b: true }, { h: 'Código', w: '22%', k: 'codigo' }, { h: 'Descripción', w: '68%', k: 'desc' }]
            : [{ h: 'Cant.', w: '7%', k: 'cant', al: 'c', b: true }, { h: 'Código', w: '15%', k: 'codigo' }, { h: 'Descripción', w: '40%', k: 'desc' }, { h: 'Unit. neto', w: '13%', al: 'r', f: (x) => fmt(x.costo) }, { h: 'IVA', w: '9%', al: 'r', f: (x) => (x.alicuota === 'Exento' ? 'Exento' : t(x.alicuota) + '%') }, { h: 'Total neto', w: '16%', al: 'r', b: true, f: (x) => fmt(num(x.cant) * num(x.costo)) }]}
          filas={items}
        />
        {!esSolicitud ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 16 }} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={s.letras}>{enLetras(num(cab.total), cab.moneda)}</Text>
              {cab.obs ? <Text style={{ marginTop: 8 }}><Text style={s.b}>Observaciones: </Text>{cab.obs}</Text> : null}
            </View>
            <View style={s.totales}>
              <View style={s.totFila}><Text style={{ color: GRIS }}>Subtotal neto</Text><Text style={s.b}>{fmt(cab.subtotal)}</Text></View>
              {num(cab.iva21) ? <View style={s.totFila}><Text style={{ color: GRIS }}>IVA 21%</Text><Text style={s.b}>{fmt(cab.iva21)}</Text></View> : null}
              {num(cab.iva105) ? <View style={s.totFila}><Text style={{ color: GRIS }}>IVA 10,5%</Text><Text style={s.b}>{fmt(cab.iva105)}</Text></View> : null}
              {num(cab.exento) ? <View style={s.totFila}><Text style={{ color: GRIS }}>No gravado / Exento</Text><Text style={s.b}>{fmt(cab.exento)}</Text></View> : null}
              {num(cab.descuento) ? <View style={s.totFila}><Text style={{ color: GRIS }}>Descuento</Text><Text style={s.b}>- {fmt(cab.descuento)}</Text></View> : null}
              <View style={s.totFinal}><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.6, letterSpacing: 1.2 }}>TOTAL</Text><Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12 }}>{mon}{fmt(cab.total)}</Text></View>
            </View>
          </View>
        ) : cab.obs ? <Text style={{ marginTop: 10 }}><Text style={s.b}>Observaciones: </Text>{cab.obs}</Text> : null}
        {(cab.paciente || cab.medico || cab.institucion || cab.fechaCx) ? (
          <View style={s.caja} wrap={false}>
            <Text style={s.lbl}>Datos de cirugía</Text>
            <Text style={{ marginTop: 3 }}>
              {[['Fecha', cab.fechaCx], ['Médico', cab.medico], ['Institución', cab.institucion], ['Paciente', cab.paciente]].filter((x) => x[1]).map((x) => x[0] + ': ' + x[1]).join('    ·    ')}
            </Text>
          </View>
        ) : null}
        <Text style={{ marginTop: 14, fontSize: 7, color: GRIS }}>{esSolicitud ? C.leyendaSolicitud : C.leyendaOC}</Text>
      </>
    );
  }

  if (tipo === 'recepcion') {
    cuerpo = (
      <>
        <Partes cols={[
          { lbl: 'Orden de compra', nom: cab.oc ? 'OC ' + cab.oc : 'Sin OC', sub: [['', cab.descripcion], ['Cantidad total', t(cab.cantTotal)]] },
          { lbl: 'Proveedor', nom: cab.proveedor, sub: [['Marca', cab.marca], ['Origen', cab.origen]] },
          { lbl: 'Documentos', sub: [['Remito', cab.remitoProv], ['Factura', cab.factura], ['Valor factura', num(cab.valorFactura) ? fmt(cab.valorFactura) : '']] },
        ]} />
        <Tabla
          cols={[{ h: 'Código', w: '13%', k: 'codigo' }, { h: 'Producto', w: '29%', k: 'desc' }, { h: 'Lote', w: '11%', k: 'lote', b: true }, { h: 'Vto', w: '11%', k: 'vto' }, { h: 'Cant.', w: '6%', k: 'cant', al: 'c', b: true }, { h: 'Empaque', w: '9%', k: 'empaque' }, { h: 'Rótulo', w: '9%', k: 'rotulo' }, { h: 'Obs.', w: '12%', k: 'obs' }]}
          filas={items}
        />
        {cab.obs ? <View style={s.caja} wrap={false}><Text><Text style={s.b}>Observaciones: </Text>{cab.obs}</Text></View> : null}
        <Firmas lista={[`Revisó: ${t(cab.reviso || C.confecciono)}`, `Aprobó: ${t(C.aprobo)}`, 'Fecha', 'Firma']} />
      </>
    );
  }

  const documento = (
    <Document title={titulo + ' ' + t(cab.numero)} author={C.razonSocial || 'Surchérie'}>
      <Page size="A4" style={s.page}>
        <Encabezado />
        <Pie />
        {cuerpo}
        {anexos}
      </Page>
    </Document>
  );
  return pdf(documento).toBlob();
}

export function blobABase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
