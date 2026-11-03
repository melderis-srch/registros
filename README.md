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

### 1. Planilla y Apps Script

1. Con **direcciontecnicasurcherie@gmail.com**, crear un Google Sheet nuevo: **Surchérie Registros**.
2. *Extensiones → Apps Script*. Crear los archivos `Codigo.gs` e `Importar.gs` y pegar el contenido de `gas/`. En *Configuración del proyecto*, tildar "Mostrar el archivo de manifiesto" y reemplazar `appsscript.json` por el de `gas/`.
3. Volver al Sheet y recargar. Aparece el menú **Registros**:
   1. **Preparar pestañas (setup)**: crea las pestañas, encabezados, desplegables, formatos, carpetas de Drive y la vista *Vencimientos*. En el *Seguimiento de cirugías* agrega a la derecha las columnas `Estado · Instrumentador · N° presupuesto · Firma · Sello · Protocolo · Certificado · RX · Epicrisis · ID app` (no toca las existentes).
   2. Revisar la pestaña **Config**: últimos números (RCC 4376 = 004-376, remito 3611, OC 3684, solicitud 3, recepción 0), tipo de cambio, firmas, leyendas, ID del logo.
   3. **Importar datos maestros**: trae proveedores, médicos, instituciones, sistemas y su contenido, productos y obras sociales desde las planillas viejas (sus IDs están en Config). Se puede repetir; reemplaza esas pestañas.
   4. **Ver token para Vercel**: genera el token secreto (`GAS_TOKEN`).
4. En Apps Script: *Implementar → Nueva implementación → Aplicación web*.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**. La URL solo responde con el token.
   - Copiar la URL que termina en `/exec` (`GAS_URL`).

> Cuando cambies el código de Apps Script: *Implementar → Gestionar implementaciones → editar → Nueva versión*. Así la URL se mantiene.

### 2. Web app en Vercel

1. Importar este repositorio en Vercel (framework: Next.js).
2. Variables de entorno (ver `.env.example`):

   | Variable | Valor |
   |---|---|
   | `GAS_URL` | URL `/exec` de Apps Script |
   | `GAS_TOKEN` | el token del menú *Ver token para Vercel* |
   | `USUARIOS` | `direcciontecnicasurcherie@gmail.com:CLAVE1,cxsurcherie@gmail.com:CLAVE2` |
   | `SESSION_SECRET` | un texto largo y aleatorio |

3. Deploy. Se entra con el email y la clave definidos en `USUARIOS`.

### 3. Probar sin tocar las planillas

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
