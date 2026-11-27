# Surchérie · Sistema de gestión — guía para Claude Code

Usuaria: Mel, Directora Técnica de Surchérie (distribuidora de implantes de columna, Santa Fe, Argentina). Escribe en español rioplatense; quiere ejecución directa y opciones concretas, sin relleno.

## Qué es

Sistema de registros del SGC (Manual de Calidad 2026): Tablero, agenda y calendario de cirugías, RCC (FORM POE 14-01), remitos de transporte, OC, recepciones, stock/kardex y Sistema de Gestión de Calidad (22 tipos de registro: T11, L10, P10, C09, H09, S16, I12, PROV, EVAL, EQ, TRA, REC, NC, BAJ, DEV, AC, RET, REV, AUD, CAP, DOCI, DOCE, MAE). Uso: la DT y una segunda persona.

## Arquitectura

```
Navegador: public/sistema.html + public/sistema-puente.js
   └─► Next.js en Vercel: /api/gas (cookie de sesión reg_sesion firmada, login Google, lista USUARIOS)
         └─► Apps Script doPost (token GAS_TOKEN, corre como direcciontecnicasurcherie@gmail.com)
               └─► Planillas + Drive
```

- `public/sistema.html` es la página principal (`next.config.mjs` redirige `/` → `/sistema.html`; el login vuelve ahí). Es un HTML único con JS vanilla, que viene de una app de Claude (artifact "Surchérie Registros") que usa `window.claude.use("db"|"mcp"|"downloads")`.
- `public/sistema-puente.js` define ese `window.claude.use` contra `/api/gas`:
  - `db`: copia en memoria; carga con `dbTodo`, sondea `dbCambios` cada 8 s y escribe de forma optimista con `dbSet`/`dbDelete`.
  - `mcp`: `callTool("Google Sheets", …)` → `sheetsProxy`; `callTool("Google Drive", …)` → `driveProxy`.
  - `downloads`: descarga con `<a download>`.
  - Además pone `window.SISTEMA_WEB=true` (oculta los botones que solo tienen sentido en Claude). Una respuesta 401 manda a `/login`.
- `gas/AppDB.gs`:
  - La base vive en la pestaña **AppDB** de la planilla Surchérie Registros, con columnas `coleccion,id,json,ts,usuario,borrado`, una fila por documento y JSON de hasta 49 000 caracteres. Todo cambio queda en **AppDB_Log**.
  - `sheetsProxy` maneja `get_values`, `update_values` y `append_values`, y solo sobre planillas permitidas: Registros, Seguimiento, Catálogo Maestro y los kardex linkeados en la columna E del Catálogo (con caché de 6 h).
  - `driveProxy` maneja `search_files` y `create_file` (carpeta o PDF en base64).
- `gas/Codigo.gs`: `ACCIONES` (router de doPost). `app/api/gas/route.js`: `PERMITIDAS` (lo que el navegador puede llamar; `dbImportar` NO se expone).
- Las colecciones de la app son `rcc`, `remitos`, `oc`, `recepciones`, `kardex` y `sgc`, más los documentos `meta/sgc`, `meta/carpetas`, `meta/agenda` y `meta/kardex`.

## IDs

| Qué | ID |
|---|---|
| Surchérie Registros (planilla del Apps Script, pestaña AppDB) | `1cfTGC7um9e7LtaPXgravEAu4aoeUrMWF_oHFd5zGkRk` |
| Seguimiento de cirugías | `15HI2_nU6Tc6mFxRdDuJRSCmNgTH3gKQFq1ATwhab63M` |
| Catálogo Maestro | `1MvXkmp88wPqKz-xyT9IQud1YD7R0A5B5Y5XzeqoYERM` |
| Apps Script (scriptId, ver `.clasp.json`) | `1IR1ZNC0JfdnSHKbHsNUrrnIgT20TS6sqleOfUcc0tiszNV4ZskvPu-EF` |
| App de Claude (origen de sistema.html) | https://claude.ai/artifact/QaAqfpYZkPvJMSh2aRUM1z |

## Comandos

- `npm install`, `npm test` (node:test; 24 pruebas, incluye `tests/appdb.test.mjs` que corre AppDB.gs con dobles de SpreadsheetApp/DriveApp), `npm run build`.
- Demo sin planillas: `DEMO=1 npm run dev`.
- Apps Script: `npx @google/clasp login` y luego `npx @google/clasp push` (usa `.clasp.json`, `rootDir: gas`). Después hay que crear una **nueva versión** de la implementación web existente (la URL `/exec` no cambia).
- Vercel: `npx vercel` / `npx vercel --prod`. Las variables de entorno están en `.env.example`.

## Puesta en marcha (estado al 27/11/2026)

Hecho: código en la rama `sistema-web` (PR #2 hacia `claude/pensive-carson-vss421`), pestaña AppDB creada en Surchérie Registros, botón "Pasar datos a la app web" publicado en la app de Claude.

Falta (lo hace Mel, con la cuenta direcciontecnicasurcherie@gmail.com). El paso a paso está en el README, "Puesta en marcha":
1. `clasp push` y una nueva versión de la implementación web. Anotar `GAS_URL`, y sacar `GAS_TOKEN` del menú Registros → Ver token para Vercel.
2. Crear un cliente OAuth de tipo Aplicación web en Google Cloud (origen = dominio de Vercel) → `GOOGLE_CLIENT_ID`.
3. Importar el repo en Vercel, con la rama de producción `sistema-web` (o mergear el PR), y cargar `GAS_URL`, `GAS_TOKEN`, `GOOGLE_CLIENT_ID`, `USUARIOS` y `SESSION_SECRET`.
4. El día del arranque: en la app de Claude, Tablero → "Pasar datos a la app web" (no duplica). Desde ahí se carga solo en la web.
5. En la web: Sistema de calidad → Configuración → agregar a la segunda persona. Después, Actualizar agenda y Actualizar desde kardex.

## Pendientes conocidos

- El selector "Usuario" de las firmas es manual; no está atado al mail de la sesión. AppDB sí guarda el mail de la sesión en cada cambio. Mejora posible: exponer `/api/yo` y preseleccionar el usuario.
- La sincronización es por sondeo (8 s), así que si dos personas editan el mismo documento gana la última escritura.
- html2canvas y jsPDF se cargan por CDN (cdnjs) para los PDF.

## Reglas

- Nunca commitear secretos (`.env*`, tokens). El token del Apps Script se genera en el script.
- Si se cambia la pantalla, se edita `public/sistema.html` directamente (pasa a ser la fuente). La app de Claude queda solo para la migración.
- Fórmulas en Sheets con configuración regional es_AR: separador `;`.
- Commits en español, claros para alguien no técnico.
