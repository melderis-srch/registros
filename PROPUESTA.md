# Surchérie · Registros — Propuesta para revisar

Estado: **borrador para aprobar. No hay código todavía.**

Basado en lo que hay hoy en:

| Planilla actual | Qué hace hoy | Qué la reemplaza |
|---|---|---|
| Seguimiento de cirugías (`Cirugias`, `Consumo2024`) | Agenda de cirugías; la app de Presupuestos ya carga filas ("Cargado desde Presupuestos") | **Se mantiene como está.** Es la fuente de las cirugías: la app la lee y le escribe el N° RCC y el N° de remito |
| Registro consumo cirugía (`Consumo`, `costos`, `gastos`, `base_consumo`, `lista`, `Medicos`, `Hoja 3`) | RCC 004-376, FORM POE 14-01 · costos de la cirugía · checklist de facturación | **Consumos** + **Consumo_Items** |
| Remito de transporte (`caratula_auto`, `caratula_manual`, `Contenido`, `datos_ciru`, `datos_instu`, hojas por sistema) | Remito 0001-0000-3611, FORM PG 19-01 · contenido de cada caja | **Remitos** + **Remito_Items** + **Sistemas** |
| Orden de compra (`ocompra`, `OC pedido caja`, `Pedido de presupuesto`, `control_oc`, `cod_art`, `datos_proov`) | OC 0001-0000-3684 · solicitud de presupuesto 0000-0003 · control de OC | **OC** + **OC_Items** |
| Recepción de stock (`recepcion`, `Facturas`, `pendientes`, `cod`, `Resumen Mensual`) | FORM POE 15-01 · lote y vencimiento por OC · pendientes | **Recepciones** + **Recepcion_Items** |

---

## 1. Circuito

```
Presupuesto (app existente)
      │  "cargar en seguimiento" (sin cambios)
      ▼
SEGUIMIENTO DE CIRUGÍAS (planilla actual, sin cambios)
      │  la app lista las cirugías de ahí; elegís una
      ├─────────────────────────────►  REMITO DE TRANSPORTE
      │                                  sistemas/cajas que viajan
      │                                  escribe el N° de remito en el Seguimiento (col. H)
      │                                  ▼
      │                                  Control de retorno: cajas enviadas / vueltas
      ▼
REGISTRO DE CONSUMO (cuando se hizo la cx)
  toma el próximo N° RCC y lo escribe en el Seguimiento (col. A)  ──►  PDF (FORM POE 14-01)
      │
      │  "Generar OC de reposición"  → una OC por proveedor
      ▼
ORDEN DE COMPRA (Emitida → Enviada)
      │
      ▼
RECEPCIÓN  (acá se registran lote + vto + inspección)  ──►  PDF FORM POE 15-01
      │  descuenta lo pendiente de la OC
      ▼
ORDEN DE COMPRA (Recibida parcial / Recibida)
```

Cada documento se puede crear también suelto. Los vínculos son por número (N° RCC o fila del Seguimiento en el remito y en la OC; N° OC en la recepción) y desde cualquier documento se abre el vinculado.

**Cómo se usa el Seguimiento.** La app lee la pestaña `Cirugias` de "Seguimiento de cirugías" (salteando los títulos de mes y la sección "SIN FECHA") y muestra la lista con fecha, médico, paciente, institución, procedimiento y obra social. No se carga nada dos veces: al elegir una cirugía se completan esos datos. Lo único que la app escribe en el Seguimiento es el N° RCC (col. A) y el N° de remito (col. H), en la fila de esa cirugía. Si una cirugía no está en el Seguimiento, la app permite cargarla ahí mismo (agrega la fila en el mes que corresponde).

---

## 2. Pestañas del Sheet

Convención: la primera fila es encabezado, fila 2 en adelante datos. Fechas guardadas a las 12:00, zona `America/Argentina/Buenos_Aires`. Los importes con formato `#.##0,00`.

### 2.1 Datos maestros

**Config** (clave · valor · descripción)

| Clave | Valor inicial |
|---|---|
| razonSocial | Surchérie |
| domicilio | San Martín 4041 · 3000 Santa Fe |
| telefono | (0342) 456 3173 |
| email | ventas@surcherie.com.ar |
| emailTecnica | direcciontecnicasurcherie@gmail.com |
| condIva | IVA Responsable Inscripto |
| cuit | 30-70932838-3 |
| iibb | CM 921-554855-1 |
| inicioAct | 01/09/2005 |
| gln | 7798275210004 |
| anmat | Establecimiento habilitado por ANMAT, Disposición N.° 9212/15 |
| confecciono | Bioing. Melisa Deris |
| aprobo | Ing. Gustavo Cobelli |
| formCirugia · formRemito · formRecepcion | FORM POE 14-01 REV 2 · FORM PG 19-01 REV 3 · FORM POE 15-01 REV 3 |
| leyendaOC | "La presente Orden de Compra está sujeta a las condiciones…" |
| puntoVenta | 0001 |
| ultimoRCC · serieRCC | 376 · 004 |
| ultimoRemito | 3611 |
| ultimaOC | 3684 |
| ultimaSolicitud | 3 |
| ultimaRecepcion | 0 |
| tcUSD | 1545,25 (dólar BNA, se actualiza a mano) |
| esterilizacionPorCaja | 25.000,00 |
| usuarios | direcciontecnicasurcherie@gmail.com, cxsurcherie@gmail.com (los dos acceden a todo) |
| seguimientoId | ID de "Seguimiento de cirugías" (15HI2_nU6Tc6mFxRdDuJRSCmNgTH3gKQFq1ATwhab63M) |
| carpetaCirugias · carpetaRemitos · carpetaOC · carpetaRecepciones | IDs de carpetas de Drive (las crea `setup()`) |

**Clientes** (obras sociales) — de `Datos.gs`, igual que Presupuestos
`Código · Razón social · CUIT · Domicilio · Localidad · Condición IVA ▾`

**Productos** — une `Datos.gs` + `cod_art` (OC) + `lista` (cirugía) + `cod` (recepción), por código
`Código · Descripción · Marca · Modelo · Detalle · Origen · Proveedor habitual ▾ · Costo ref. · Moneda ▾ (ARS/USD) · Alícuota IVA ▾ · Activo`

**Proveedores** — de `datos_proov` (≈37)
`Código · Razón social · CUIT · Condición IVA ▾ · Domicilio · Localidad · Contacto · Email · Teléfono · Moneda ▾ (ARS / USD) · Condiciones de pago habituales`

La moneda del proveedor es la que toma la OC por defecto (se puede cambiar en cada OC).

**Medicos** — de `Medicos` (≈165)
`Nombre (Apellido, Nombre) · CUIT · Localidad · Mat. provincial · Mat. nacional · Especialidad · Teléfono · Sellos ☐`

**Instituciones** — une `datos_instu` (remito) + `lista` (logística)
`Nombre · GLN/CUFF · CUIT · Dirección · Localidad · Contacto · Km · Costo logística`

**Sistemas** (cajas que viajan) — de `Contenido` (≈80)
`Código · Descripción · Marca · Estéril ☐`

**Sistemas_Contenido** — de las hojas `quimera1`, `cage + trim`, `RTR`, etc.
`Sistema · Bandeja/Sección · Cantidad · Código · Descripción`
Se imprime como anexo del remito (una página por sistema). Se edita desde la app (pestaña Datos → Sistemas) o en el Sheet; y en cada remito se puede ajustar el contenido de esa caja puntual sin tocar el maestro.

### 2.2 Registro de consumo

La agenda **no** se duplica: sigue en "Seguimiento de cirugías". En el Sheet nuevo solo se guarda el registro de consumo de cada cirugía realizada.

**Consumos** (una fila por registro de consumo; equivale a `Consumo` + `costos` + `gastos` + `base_consumo`)

| Columna | Nota |
|---|---|
| N° RCC | `004-377`, correlativo, se toma al guardar |
| Fecha cx | del Seguimiento |
| Paciente | "Nombre Apellido", del Seguimiento |
| Institución | del Seguimiento (buscador de Instituciones) |
| Médico · Mat. | del Seguimiento; la matrícula sale de Medicos |
| Obra social | del Seguimiento (buscador de Clientes) |
| Procedimiento | del Seguimiento (col. F) |
| Instrumentador · Mat. | |
| N° remito Surchérie · N° remito transporte | |
| N° presupuesto | texto libre |
| Cant. cajas | desde el remito; se usa para la esterilización |
| Resumen consumo | automático, ej. `4N+1SBD` (como `base_consumo`) |
| Costo implantes · descartables · logística · esterilización · otros · total | como la hoja `costos`; uso interno, no sale en el PDF |
| Checklist facturación | Firma ☐ Sello ☐ Protocolo ☐ Certificado ☐ RX ☐ Epicrisis ☐ (hoy en `Hoja 3`) |
| Estado ▾ | Registrado / Facturado |
| OCs de reposición | se completan solas al generarlas |
| Observaciones | |
| PDF | link al RCC en Drive |
| Creado · Modificado · Usuario | auditoría |

**Consumo_Items**

`N° RCC · Renglón · Sección ▾ (Implantado / Descartable) · Código · Descripción · Marca/Modelo · Proveedor · Cant. · Costo unit. · Moneda · Costo ARS`

Sin lote ni vencimiento: eso se registra en Recepción. El PDF conserva el recuadro **STICKERS** para pegar las etiquetas físicas, como hoy.

### 2.3 Remitos

**Remitos**

`N° (0001-00003612) · Fecha · Estado ▾ (Emitido / Entregado / Retornado / Anulado) · N° RCC (si ya tiene) · Institución · GLN/CUFF · CUIT · Dirección · Localidad · Fecha cx · Médico · Paciente · Transportista · Observaciones · Recibió (aclaración) · DNI · Fecha entrega · Cajas enviadas · Cajas vueltas · PDF`

**Remito_Items**

`N° remito · Renglón · Código sistema · Descripción · Marca · Cant. cajas · Estéril ☐ · Cajas vueltas · Obs. retorno`

Solo cantidades, sin precios. El control de retorno registra cuántas cajas volvieron de cada sistema. No cambia el estado de la cirugía (eso lo hacés vos).

### 2.4 Órdenes de compra

**OC**

`N° (0001-00003685) · Tipo ▾ (Orden de compra / Solicitud de presupuesto) · Fecha · Estado ▾ (Emitida / Enviada / Recibida parcial / Recibida / Anulada) · Pedido (texto corto, ej. "repo inserto") · Proveedor · CUIT · Dirección · Localidad · Forma de envío · Fecha de envío · Condiciones de pago · Plazo y lugar de entrega · Moneda ▾ (la del proveedor) · TC (de Config, editable; solo si es USD) · Subtotal neto · IVA 21 · IVA 10,5 · No gravado/Exento · Descuento · Total · N° RCC · Fecha cx · Médico · Institución · Paciente · Factura proveedor · Valor factura · Observaciones · PDF`

**OC_Items**

`N° OC · Renglón · Código · Descripción · Cant. · Costo unit. neto · Alícuota ▾ (21 / 10,5 / 0 / Exento) · Neto · IVA · Total · Cant. recibida · Pendiente`

"Cant. recibida" se suma sola desde las recepciones. Así desaparecen `control_oc`, `pendientes` y `Facturas`.

### 2.5 Recepciones

**Recepciones**

`N° (propio) · Fecha recepción · N° OC · Proveedor · Marca · Origen · Remito proveedor · Factura proveedor · Valor factura · Descripción · Cantidad total · Revisó · PDF`

**Recepcion_Items**

`N° recepción · Renglón · Código · Producto · Lote · Vto · Cant. · Empaque ▾ (Conforme / No conforme) · Rótulo ▾ (Conforme / No conforme) · Observaciones`

### 2.6 Vistas automáticas (solo lectura, con fórmulas)

- **Vencimientos**: lotes recibidos con vencimiento en los próximos 6 meses (hoy está a mano en "IMPORTANTES - RECORDATORIOS").
- **Resumen mensual**: cantidades consumidas y compradas por producto y por mes (hoy `Resumen Mensual` en OC y en Recepción).

---

## 3. La pantalla

Un solo `Index.html`, con el mismo estilo que Presupuestos: barra de trabajo arriba, hoja A4 editable abajo.

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Cirugías] [Remitos] [Órdenes de compra] [Recepciones] [Datos]       │
├──────────────────────────────────────────────────────────────────────┤
│ Nueva cirugía · N° se confirma al guardar   Buscar…  [Abrir ▾]       │
│ [Nuevo] [Guardar como nuevo] [Guardar y generar PDF]                 │
│ [Generar remito] [Generar OC de reposición]   ← solo en Cirugías     │
└──────────────────────────────────────────────────────────────────────┘
```

- **Cirugías** abre con la lista del Seguimiento (por mes, como la planilla), marcando cuáles ya tienen RCC y remito. Desde cada una: [Registro de consumo] [Generar remito] [Generar OC de reposición].
- Buscadores con datalist: obra social, médico, institución, producto, proveedor, sistema. Completan y se puede pisar.
- **Lote**: en Recepción, al escribir el código se ofrecen los lotes ya recibidos de ese código (para no tipearlos dos veces).
- **Datos**: alta y edición rápida de médicos, instituciones, proveedores, productos y sistemas sin abrir el Sheet.

Validaciones antes de guardar:

- Registro de consumo: institución, médico, paciente, fecha, obra social; al menos un ítem con cantidad.
- Remito: institución, al menos un sistema con cantidad.
- OC: proveedor, al menos un ítem con cantidad y costo (en Solicitud de presupuesto el costo no se pide).
- Recepción: OC o proveedor, cada ítem con lote, vencimiento e inspección.

---

## 4. Bocetos de los PDF

Todos A4, mismo encabezado que el presupuesto: logo a la izquierda; tipo, N° y fecha a la derecha; línea azul con datos fiscales; pie con ANMAT. Si no entra en una hoja, corta en varias páginas y repite el encabezado de la tabla ("Página 1 de 2").

### 4.1 Registro de consumo de cirugía

```
[LOGO]                                     REGISTRO DE CONSUMO DE CIRUGÍA
Surchérie · San Martín 4041 …                                N° 004-377
                                                         Fecha 31/08/2026
                                                     FORM POE 14-01 REV 2
IVA RI · CUIT … · IIBB … · Inicio act. … · GLN …
════════════════════════════════════════════════════════════════════════
┌ PACIENTE ───────────┬ MÉDICO ───────────────┬ INSTITUCIÓN ──────────┐
│ RODRIGO MORE        │ MORALES, ELOY         │ MIT                   │
│ Obra social OSPEDYC │ M.P. 8284             │ Fecha cx 31/08/2026   │
│                     │ Instrumentador Noelia │ Remito N° 3582        │
└─────────────────────┴───────────────────────┴───────────────────────┘
PRODUCTOS IMPLANTADOS
 Cant │ Código │ Descripción             │ Marca/Modelo  │ Proveedor
   2  │ …      │ Tornillo pedi 6x40mm    │ Quimera/NOVAX │ NOVAX
   6  │ …      │ Tornillo pedi 6x45mm    │ Quimera/NOVAX │ NOVAX
   1  │ bd_10  │ Sustituto óseo 10cc     │ Biodesis      │ Lab BIOXEN
DESCARTABLES
   1  │ …      │ Paño iodado             │               │
Procedimiento: Fij 4 niv + sustituto      Observaciones: …
┌ STICKERS ───────────────────────────────────────────────────────────┐
│                                                                     │
│                 (espacio para pegar las etiquetas)                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
────────────────────────────────────────────────────────────────────────
Evaluó y confeccionó: Bioing. Melisa Deris   Aprobó: Ing. Gustavo Cobelli
                                                   Firma ____________
                Establecimiento habilitado por ANMAT, Disp. N.° 9212/15
```

### 4.2 Remito de transporte

```
[LOGO]                                           REMITO DE TRANSPORTE
                                                   N° 0001-00003612
                                                   Fecha 03/11/2026
                                    NO VÁLIDO COMO FACTURA · FORM PG 19-01
════════════════════════════════════════════════════════════════════════
┌ DESTINO ───────────────────────────┬ CIRUGÍA ──────────────────────────┐
│ SANATORIO ADVENTISTA DEL PLATA     │ Fecha cx 04/11/2026               │
│ 25 de Mayo 255 · Lib. San Martín   │ Médico  MORRA, BRIAN              │
│ CUIT 30-70735360-7 · GLN …         │ Paciente POELSTRA, CELINA         │
└────────────────────────────────────┴───────────────────────────────────┘
 Cajas │ Código    │ Descripción del material entregado      │ Marca │ Estéril
   1   │ vtp       │ Set VTP. Contiene agujas y dosis de cem…│SUBITON│  Sí
   5   │ quim      │ Sistema de fijación dorsolumbar QUIMERA…│ NOVAX │  No
                                              Total de cajas: 6
Transportista: ……………      Observaciones: ……………
────────────────────────────────────────────────────────────────────────
Recibí conforme                         Fecha de entrega ___/___/____
Firma ___________  Aclaración ___________  DNI ___________
Evaluó y confeccionó: Bioing. Melisa Deris
```

### 4.3 Orden de compra (y Solicitud de presupuesto)

```
[LOGO]                                                 ORDEN DE COMPRA
                                                   N° 0001-00003685
                                                   Fecha 03/11/2026
════════════════════════════════════════════════════════════════════════
┌ PROVEEDOR ─────────────────┬ ENTREGA ───────────────┬ PAGO ────────────┐
│ CROSMED                    │ Forma de envío …       │ 0/30/60/90/120   │
│ Aguirre 545 · CABA         │ Plazo …                │ Moneda USD · TC  │
│ CUIT 30-70842959-3         │ Lugar San Martín 4041  │                  │
└────────────────────────────┴────────────────────────┴──────────────────┘
 Cant │ Código     │ Descripción                  │ Unit. neto │ IVA │ Total neto
   1  │ KIMP 410 L │ Inserto tibial 4x10 IZQUIERDO│     250,00 │ 21% │    250,00
                                         ┌─────────────────────────────┐
 SON DOSCIENTOS CINCUENTA …              │ Subtotal neto        250,00 │
                                         │ IVA 21%               52,50 │
                                         │ IVA 10,5%              0,00 │
                                         │ TOTAL USD            302,50 │
                                         └─────────────────────────────┘
Datos de cirugía: Fecha cx … · Médico … · Institución … · Paciente …
Observaciones: …
La presente Orden de Compra está sujeta a las condiciones particulares…
```

En la Solicitud de presupuesto el título cambia a "SOLICITUD DE PRESUPUESTO", el número es `0000-0004` y no aparecen las columnas de precio ni los totales.

### 4.4 Recepción — inspección de productos médicos

```
[LOGO]                       RECEPCIÓN · INSPECCIÓN DE PRODUCTOS MÉDICOS
                                                         N° 0001
                                              Fecha recepción 23/04/2026
                                                  FORM POE 15-01 REV 3
════════════════════════════════════════════════════════════════════════
┌ ORDEN DE COMPRA ───────────┬ PROVEEDOR ─────────────┬ DOCUMENTOS ─────┐
│ OC 3550 · repo descartables│ SURGICAL SUPPLY        │ Remito 0001-…   │
│ Cantidad total 2           │ Marca … · Origen Nac.  │ Factura 00003-… │
└────────────────────────────┴────────────────────────┴─────────────────┘
 Código │ Producto                     │ Lote   │ Vto        │Cant│Empaque│Rótulo
 CEGEA  │ Cemento alta con gentamicina │ AC5849 │ 30/09/2030 │  2 │Conf.  │Conf.
Observaciones: …
────────────────────────────────────────────────────────────────────────
Revisó: Bioing. Melisa Deris      Aprobó: Ing. Gustavo Cobelli
Fecha ___/___/____                Firma ____________
```

---

## 5. Importación inicial

Un archivo `Datos.gs` con los maestros, y `cargarDatos()` los vuelca en las pestañas:

| Origen | Destino | Filas aprox. |
|---|---|---|
| `Datos.gs` (Presupuestos) | Clientes, Productos | 305 · 367 |
| OC → `cod_art` | Productos (costo, proveedor, moneda) | ~1.100 |
| Cirugía → `lista` (A:F) | Productos (marca/modelo) | — |
| Recepción → `cod` | Productos | ~390 |
| OC → `datos_proov` | Proveedores | ~37 |
| Cirugía → `Medicos` | Medicos | ~165 |
| Remito → `datos_instu` + Cirugía → `lista` (I:K) | Instituciones | ~45 |
| Remito → `Contenido` | Sistemas | ~80 |
| Remito → hojas por sistema | Sistemas_Contenido | ~25 sistemas |
| Seguimiento | no se importa: se lee en vivo | — |

---

## 6. Decisiones tomadas

- Usuarios: direcciontecnicasurcherie@gmail.com y cxsurcherie@gmail.com, con acceso a todo.
- Seguimiento de cirugías sigue siendo la fuente; el N° RCC se asigna correlativo al registrar cada cirugía hecha.
- Lote y vencimiento solo en Recepción.
- Moneda por proveedor (ARS o USD), editable por OC.
- Solicitud de presupuesto incluida como variante de la OC, sin precios.
- Contenido de cajas importado, editable, y como anexo del remito.
- Reposición: una OC por proveedor.
- Remito sin precios; el retorno cuenta cajas y no cambia el estado de la cirugía.

## 7. Pendiente

- `Code.gs` y `Datos.gs` de Presupuestos.
- Aprobación de esta propuesta.
