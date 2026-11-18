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

Son tres partes: la planilla con su Apps Script (el "motor", corre con la cuenta DT y tiene acceso a todo el kardex), el ingreso con Google y la web en Vercel. Se hace una sola vez.

### 1. Planilla y Apps Script (cuenta direcciontecnicasurcherie@gmail.com)

1. Abrir la planilla **[Surchérie Registros](https://docs.google.com/spreadsheets/d/1cfTGC7um9e7LtaPXgravEAu4aoeUrMWF_oHFd5zGkRk/edit)** (ya está creada; tiene las pestañas *Consumos* y *Consumo_Items* listas para recibir los RCC de la app de Claude).
2. *Extensiones → Apps Script*. Crear tres archivos de script y pegar el contenido de la carpeta `gas/`: `Codigo.gs`, `Kardex.gs` e `Importar.gs` (en ese orden). En *Configuración del proyecto* tildar "Mostrar el archivo de manifiesto en el editor" y reemplazar `appsscript.json` por el de `gas/`.
3. Volver a la planilla y recargar. Aparece el menú **Registros**:
   1. **Preparar pestañas (setup)**: crea el resto de las pestañas, formatos y carpetas de Drive. Pide permisos la primera vez: aceptar.
   2. Revisar **Config**: últimos números (RCC 4469 = 004-469, remito 3614, OC 3700), tipo de cambio, firmas. Las carpetas de los PDF se pueden reemplazar por las propias pegando el link de Drive en `carpetaConsumo`, `carpetaRemito`, `carpetaOC`, `carpetaRecepcion`; `subcarpetaPDF` = `mes` las separa por mes (NOVIEMBRE).
   3. **Importar datos maestros**: productos, proveedores, médicos, instituciones y sistemas desde las planillas viejas.
   4. **Leer kardex ahora** y después **Leer kardex todas las noches**.
   5. **Ver token para Vercel**: copiar el token (`GAS_TOKEN`).
4. *Implementar → Nueva implementación → Aplicación web* · Ejecutar como: **Yo** · Acceso: **Cualquier usuario**. Copiar la URL que termina en `/exec` (`GAS_URL`).

> Cuando cambie el código de Apps Script: *Implementar → Gestionar implementaciones → editar → Nueva versión*. La URL no cambia.

### 2. Ingreso con Google (una vez)

1. Entrar a [console.cloud.google.com](https://console.cloud.google.com) con la cuenta DT → crear un proyecto "Surcherie Registros".
2. *APIs y servicios → Pantalla de consentimiento de OAuth*: tipo **Externo**, nombre "Surchérie Registros", mail de soporte. Publicarla (*Publicar app*).
3. *Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web*. En **Orígenes de JavaScript autorizados** agregar la dirección de Vercel (por ejemplo `https://registros-surcherie.vercel.app`). Copiar el **ID de cliente** (`GOOGLE_CLIENT_ID`).

### 3. Web en Vercel

1. En [vercel.com](https://vercel.com), *Add New → Project* → importar este repositorio (framework: Next.js).
2. Variables de entorno (ver `.env.example`):

   | Variable | Valor |
   |---|---|
   | `GAS_URL` | URL `/exec` de Apps Script |
   | `GAS_TOKEN` | el token de *Ver token para Vercel* |
   | `GOOGLE_CLIENT_ID` | el ID de cliente del paso 2 |
   | `USUARIOS` | mails que pueden entrar, separados por coma |
   | `SESSION_SECRET` | un texto largo cualquiera |

3. *Deploy*. Si la dirección final es otra, agregarla en los orígenes autorizados del paso 2.3.
4. Para sumar o sacar gente: editar `USUARIOS` en Vercel y *Redeploy*.

### 4. Traer los RCC de la app de Claude

En la app de Claude (artifact *Surchérie Registros*) → *Cirugías y RCC* → **⇪ Pasar a la app del equipo**. Copia los RCC con sus productos a la planilla (solo los que falten; se puede repetir).

### 5. Probar sin tocar las planillas

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
