# Surchérie · Registros

Tablero web para el circuito de cirugías y compras:

- **Cirugías**: calendario (mes, semana, lista) armado en vivo desde la planilla *Seguimiento de cirugías*. Cada cirugía tiene su ficha, y desde ahí se emiten el **remito de transporte** y el **registro de consumo**.
- **Compras**: **órdenes de compra** (y solicitudes de presupuesto) con sus **recepciones**. Una OC puede tener una o más recepciones, y cada recepción descuenta lo pendiente.
- **Datos**: médicos, instituciones, obras sociales, proveedores, productos, sistemas/cajas y su contenido.

Cada documento se numera solo, sin repetir, y se guarda en un Google Sheet. El PDF (A4, vectorial) va a Drive y el link queda en la fila.

```
Navegador ──► Web app Next.js (Vercel) ──► /api/gas ──► Apps Script (doPost + token) ──► Google Sheets / Drive
                 login con usuario y clave        el token nunca llega al navegador
```

## Estructura

| Carpeta | Qué hay |
|---|---|
| `app/` | Pantallas (Next.js App Router): `cirugias`, `compras`, `datos`, `login` y la API `/api/gas` |
| `components/` | UI común, ficha de cirugía, marco de documentos, tabla de ítems |
| `lib/` | Formatos argentinos, PDF (`@react-pdf/renderer`), sesión, cliente de la API, datos de demo |
| `public/logo.jpg` | Logo de Surchérie (el mismo de Drive, "LOGO SURCHERIE.jpeg"). Los PDF usan el de Drive indicado en Config → `logoId`; si no está disponible, este |
| `gas/` | Apps Script: `Codigo.gs` (API, numeración, Seguimiento, PDF a Drive), `Importar.gs` (datos maestros), `appsscript.json` |
| `tests/` | Pruebas de la lógica de Apps Script con una planilla simulada (`npm test`) |
| `PROPUESTA.md` | Esquema de pestañas y columnas aprobado |

## Puesta en marcha

La pantalla principal es **`/sistema.html`** (Tablero de gestión, cirugías y RCC, remitos, OC, recepciones, stock y Sistema de Gestión de Calidad). Es la misma app que se armó en Claude, conectada al Apps Script: al entrar a la dirección de Vercel, después del login con Google, se abre directo.

```
Navegador ──► Vercel: /sistema.html + /api/gas (valida el login) ──► Apps Script (cuenta DT) ──► Planillas y Drive
```

Todo lo que se carga queda en la pestaña **AppDB** de la planilla [Surchérie Registros](https://docs.google.com/spreadsheets/d/1cfTGC7um9e7LtaPXgravEAu4aoeUrMWF_oHFd5zGkRk/edit) (una fila por documento, con quién y cuándo lo guardó). Cada cambio en planillas o Drive queda en **AppDB_Log**. La web solo puede leer o escribir las planillas del sistema (Registros, Seguimiento de cirugías, Catálogo Maestro) y las de kardex linkeadas en el Catálogo Maestro.

Se hace una sola vez, con la cuenta **direcciontecnicasurcherie@gmail.com**:

### 1. Apps Script

1. Abrir el [proyecto de Apps Script](https://script.google.com/d/1IR1ZNC0JfdnSHKbHsNUrrnIgT20TS6sqleOfUcc0tiszNV4ZskvPu-EF/edit).
2. Subir el código de la carpeta `gas/`:
   - **Con clasp** (desde la compu, en esta carpeta): `npx @google/clasp push`.
   - **A mano**: crear el archivo `AppDB` y pegar `gas/AppDB.gs`; reemplazar `Codigo.gs` por el de `gas/` (y `Kardex`, `KardexLectura`, `Historial`, `Diag` si no están al día).
3. *Implementar → Gestionar implementaciones*:
   - si ya hay una aplicación web: lápiz → *Versión: Nueva versión* → *Implementar* (la URL no cambia);
   - si no hay: *Nueva implementación → Aplicación web* · Ejecutar como **Yo** · Acceso **Cualquier usuario**.
   Copiar la URL que termina en `/exec` → **`GAS_URL`**.
4. En la planilla, menú **Registros → Ver token para Vercel** → **`GAS_TOKEN`**.

### 2. Ingreso con Google

1. [Google Cloud → Credenciales](https://console.cloud.google.com/apis/credentials) → *Crear credenciales → ID de cliente de OAuth → Aplicación web* (si pide la pantalla de consentimiento: tipo **Externo**, publicarla).
2. En **Orígenes de JavaScript autorizados** poner la dirección de Vercel (ej. `https://surcherie-registros.vercel.app`). Copiar el ID → **`GOOGLE_CLIENT_ID`**.

### 3. Vercel

1. [vercel.com/new](https://vercel.com/new) → importar `melderis-srch/registros` (Next.js, sin cambiar nada más).
2. *Environment Variables*:

   | Variable | Valor |
   |---|---|
   | `GAS_URL` | URL `/exec` del paso 1.3 |
   | `GAS_TOKEN` | token del paso 1.4 |
   | `GOOGLE_CLIENT_ID` | ID del paso 2 |
   | `USUARIOS` | mails que pueden entrar, separados por coma (ej. `direcciontecnicasurcherie@gmail.com,otra@...`) |
   | `SESSION_SECRET` | un texto largo cualquiera |

3. *Deploy*. Si la dirección final no es la que pusiste en el paso 2.2, agregala ahí.
4. Para sumar o sacar gente: editar `USUARIOS` → *Redeploy*.

### 4. Pasar los datos de la app de Claude

En la app de Claude (*Surchérie Registros*) → **Tablero → Pasar datos a la app web**. Copia todo (cirugías y RCC, remitos, OC, recepciones, kardex leído, registros de calidad, carpetas, configuración y agenda) a la pestaña AppDB. Se puede tocar de nuevo: lo que ya está no se duplica ni se pisa. Desde ese momento se carga **solo en la web**.

### 5. Primer uso en la web

1. Entrar con Google → se abre el Tablero.
2. *Sistema de calidad → Configuración*: agregar a la segunda persona en "Personas".
3. *Carpetas Drive*: revisar las carpetas de los PDF (vienen de la app de Claude).
4. *Agenda quirúrgica → Actualizar agenda* y *Stock → Actualizar desde kardex*.

### 6. Probar sin tocar las planillas

```bash
npm install
```

```bash
printf 'DEMO=1\nSESSION_SECRET=dev\n' > .env.local
```

```bash
npm run dev
```

Con `DEMO=1` la app usa datos de ejemplo en memoria (cualquier email entra). Se borran al reiniciar.

```bash
npm test
```

## Cómo funciona

- **Pendientes** (pantalla de inicio): todo lo que hay que resolver, con contador en el menú: stickers sin lote, bajas listas para el kardex, RCC a revisar, cirugías hechas sin RCC, próximas cirugías sin remito, consumo sin pasar a OC, stock bajo mínimo, OC sin enviar, OC esperando mercadería, OC que llegaron sin recepción, recibido sin ingresar al kardex, remitos sin retorno y vencimientos.
- **Gestión**: totales por período. Stock valorizado por proveedor y producto, lo que viene en camino (OC enviadas sin recibir), lo recibido que no entró al kardex, lo consumido por producto, médico, institución y mes, y lo pendiente de reponer por proveedor.
- **Stock**: copia del kardex (FORM POE 14-02) de cada producto, por lote y vencimiento, con sus movimientos (cada ingreso suma, cada cirugía resta, con saldo). Se lee del Catálogo Maestro: la app lee de a tandas, y el Apps Script todas las noches.
- **Bajas**: en cada RCC se carga el lote del sticker y "Dar de baja en kardex" escribe fecha, N° RCC y médico/paciente en las filas de ese lote. Sin lote usa el que vence primero y lo marca como *lote asumido*.
- **Recepción → kardex**: al guardar una recepción, cada renglón se agrega a la planilla de su producto (fila de grupo + una fila por unidad con fecha, lote, vto, remito y factura). Si falla, queda en *Recibido sin ingresar* para reintentar.
- **Reposición**: lo consumido queda pendiente hasta que se pasa a una OC (nueva o sumándolo a una Emitida del mismo proveedor), junto con lo que está bajo mínimo. Cada renglón del RCC guarda en qué OC se repuso.

- **Seguimiento de cirugías** sigue siendo la fuente; Presupuestos puede seguir cargando ahí. La app lee la pestaña `Cirugias`, saltea los títulos de mes y toma la sección "SIN FECHA" como pendientes. A cada fila le asigna un **ID** (columna *ID app*) para encontrarla aunque cambie de lugar. Escribe:
  - altas y cambios desde la ficha, en el mes que corresponde y en orden de fecha (si el mes no existe, crea el título antes de "SIN FECHA"; arrastrar una pendiente al calendario la mueve);
  - el **N° RCC** (columna A) al emitir el registro de consumo, que pasa la cirugía a *Realizada*;
  - el **N° de remito** (columna H) al emitir un remito (si ya había uno, lo agrega: `3611 / 3612`);
  - *Suspendida* y *Dada de baja* se sincronizan con sus casillas.
- **Numeración**: se toma con `LockService` al guardar, como `max(último en Config, último en la pestaña) + 1`. Formatos: RCC `004-377`, remito y OC `0001-00003685`, solicitud `0000-0004`, recepción `00001`. Editar un documento conserva su número; *Guardar como nuevo* le asigna otro.
- **Remito**: solo cantidades de cajas por sistema. Cada sistema trae su listado de contenido, que se puede ajustar en cada remito y sale como anexo del PDF. El control de retorno registra cuántas cajas volvieron.
- **Registro de consumo**: ítems implantados y descartables, con proveedor. Los costos (USD × TC, logística por institución, esterilización por caja) son internos y no salen en el PDF. El PDF deja el recuadro para los stickers. **OC de reposición** arma una OC por proveedor.
- **OC**: costo neto + IVA por ítem (21 / 10,5 / 0 / exento), subtotal, IVA por alícuota, descuento, total y total en letras (pesos o dólares según el proveedor). Al guardar recepciones se actualizan *recibido*, *pendiente*, *facturas* y el estado (*Recibida parcial* / *Recibida*).
- **Recepción**: lote, vencimiento e inspección (empaque y rótulo) son obligatorios. Al escribir un código se sugieren los lotes ya recibidos. La pestaña *Vencimientos* lista los lotes que vencen en los próximos 6 meses.
- **Fechas**: se guardan a las 12:00, con zona horaria `America/Argentina/Buenos_Aires`.
