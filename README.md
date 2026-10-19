# FACTURACIÓN CR — Proyecto conectado para n8n, Postman, JSON Server y POO

**Escenario 1** del Laboratorio #1: vencimiento de facturas a **15 días hábiles** sin sábados, domingos ni feriados nacionales públicos de Costa Rica. No requiere interfaz web. El flujo **acepta la factura completa en Postman sin indicar un ID**. n8n realiza el POST a JSON Server, obtiene el ID asignado, consulta feriados de Nager.Date, calcula el vencimiento con las mismas clases POO de `src/` y actualiza la factura mediante PATCH. También acepta `{ "facturaId": 1 }` para reprocesar una factura existente.

## A. Inicio rápido en Windows (sin Docker)

1. Tener **Node.js 20+** e internet. Cierra servicios previos que ocupen los puertos **3000** o **5678**.
2. Haz doble clic en **`INICIAR_TODO_WINDOWS.bat`**. Abre JSON Server y n8n en dos terminales. La primera descarga de n8n con `npx` puede tardar varios minutos. No cierres las ventanas.
3. Abre **http://localhost:5678** y completa la configuración inicial de n8n si la solicita.
4. En un workflow nuevo de n8n, menú `...` → **Import from File** → importa `workflow/FacturaHabiles_CR_n8n_WINDOWS_IMPORTAR.json`.
5. Abre el nodo `Webhook POST - Recibir factura` y haz clic en **Listen for Test Event**.
6. En Postman, **Import** → `postman/FacturaHabiles_CR_POSTMAN_IMPORTAR.json` → ejecutar **`01 - CREAR Y PROCESAR SIN ID (modo prueba)`**. No cambies nada de ese Body. Se envía una factura completa.
7. Postman debería recibir `ok: true`, un `facturaId`, `fechaVencimiento` y `estado` si la API externa y JSON Server responden bien. Verifica en **http://localhost:3000/facturas**.
8. Para enviar solicitudes sin volver a pulsar Listen, **publica/activa el workflow** en n8n y usa `02 - CREAR Y PROCESAR SIN ID (publicado)` en Postman (ruta `/webhook/`).

### Si ya tienes n8n instalado y abierto

No abras otro n8n. Inicia solo JSON Server con `npm install` seguido de `npm run db`. Importa el workflow Windows dentro de tu n8n existente y continúa desde el paso 5.

### Sin instalar nada en Windows excepto Docker Desktop

1. Abre Docker Desktop.
2. Doble clic en `INICIAR_CON_DOCKER_WINDOWS.bat` o ejecuta `docker compose up -d --build`.
3. Abre `http://localhost:5678` e importa **`workflow/FacturaHabiles_CR_n8n_DOCKER_IMPORTAR.json`** (la variante Docker apunta al servicio `http://json-server:3000`).
4. Repite los pasos de Postman 5–8 anteriores. Usa las mismas URLs `localhost` en Postman: las diferencias de red son internas a n8n.

**No uses el workflow Windows con n8n dentro de Docker:** `127.0.0.1:3000` dentro del contenedor apunta al contenedor, no a JSON Server. **No uses n8n Cloud** con estas URLs locales: Cloud no puede alcanzar `localhost` de tu computador.

## B. El JSON exacto para POSTMAN — NO tienes que cambiar el ID

**POST** `http://localhost:5678/webhook-test/facturacion/calcular`

Header: `Content-Type: application/json`. En Body → **raw** → **JSON** pega:

```json
{
  "cliente": "Empresa Ejemplo Costa Rica",
  "monto": 85000,
  "moneda": "CRC",
  "fechaEmision": "2026-10-19"
}
```

**No envíes `id` ni `facturaId` al crear.** Lo crea JSON Server. La respuesta esperada tiene esta **estructura ilustrativa** (el estado y vencimiento reales se calculan desde el calendario de feriados consultado):

```json
{
  "ok": true,
  "httpStatus": 200,
  "tipo": "factura_procesada",
  "facturaId": "7",
  "cliente": "Empresa Ejemplo Costa Rica",
  "monto": 85000,
  "moneda": "CRC",
  "fechaEmision": "2026-10-19",
  "fechaVencimiento": "2026-11-09",
  "estado": "pendiente",
  "diasHabiles": 15,
  "modo": "nueva",
  "mensaje": "Vencimiento calculado"
}
```

El ID y los valores de ejemplo no son garantías: el número lo asigna JSON Server y el vencimiento se determina en ejecución. Si quieres recalcular una factura existente, el Body es `{ "facturaId": 1 }`. La colección de Postman guarda automáticamente el último ID devuelto bajo `ultimaFacturaId` para las solicitudes 03 y 04.

**Dos modos de webhook:** URL de prueba `/webhook-test/facturacion/calcular` solo escucha tras pulsar **Listen for Test Event** (duración limitada); URL de producción `/webhook/facturacion/calcular` funciona cuando el workflow está **publicado/activo**.

## C. Conexiones y recorrido

```text
Postman POST (factura completa) ─────┐
                                     v
                         [WEBHOOK n8n]
                                     |
                              [Code valida]
                                     |
                          [IF ¿factura nueva?]
                             /            \
               [POST JSON Server]   [GET JSON Server por ID]
                             \            /
                         [Code verifica factura]
                                     |
                         [GET Nager.Date año emisión]
                                     |
                       [Validar feriados + IF]
                                     |
                         [GET Nager.Date año siguiente]
                                     |
                       [Code POO Factura/Calendario]
                                     |
                            [IF requiere PATCH]
                                /          \
                      [PATCH JSON Server] [Sin cambios]
                                \          /
                          [Responder JSON Postman]
```

El workflow posee rutas de error HTTP y de validación que responden con JSON sin ocultar fallos. Si se cae la API después de crear una factura, **la factura nueva puede quedar guardada pero sin procesar**. Su ID aparece en el error cuando está disponible; se puede enviar luego `{ "facturaId": ID }` para reintentar. **No hay transacción distribuida/rollback de creación**, y no debe afirmarse lo contrario.

## D. Reglas de negocio

1. La factura debe contener ID (tras persistir), nombre de cliente válido, monto mayor a cero, estado y fecha ISO real.
2. El día de emisión no se cuenta; el plazo configurado es **15 días hábiles**.
3. Se excluyen sábados, domingos y feriados públicos nacionales, con datos reales de **Nager.Date** (`global: true`, tipo `Public`).
4. Una factura solo pasa a **`vencida`** si la fecha en Costa Rica ya superó el vencimiento.
5. Los estados **`pagada`** y **`anulada`** se conservan.
6. Si estado/fecha ya coinciden, se evita PATCH innecesario (idempotencia al reprocesar).
7. Si los feriados o los datos son inválidos, se devuelve error, sin inventar un vencimiento.

Las clases `src/Factura.js` y `src/CalendarioLaboral.js` funcionan fuera de n8n con `node main.js`. `scripts/generar-integracion.mjs` **inserta el código de esas mismas clases** en el nodo Code de los dos JSON de n8n.

## E. Diagnóstico y pruebas

Desde la carpeta del proyecto, en PowerShell:

```powershell
npm install
npm test
npm run verificar
npm run demo
```

`npm run verificar` consulta JSON Server, n8n y Nager.Date (solo si los servicios están corriendo). Para lanzar una factura de ejemplo sin Postman tras pulsar Listen en n8n:

```powershell
npm run probar:postman
```

La URL de producción se comprueba con `npm run probar:produccion` (requiere publicar el workflow).

**Errores frecuentes:**

- `400 error_solicitud`: Body no es raw → JSON, falta `cliente`, `monto` numérico o `fechaEmision`, o enviaste un ID incorrecto. Usa la solicitud **01** de la colección.
- `404 factura_no_existe`: enviaste `facturaId` que no está en JSON Server.
- `503 error_conexion`: JSON Server caído, puerto incorrecto o falla de red hacia Nager.Date.
- `502 error_feriados`: Nager.Date respondió con calendario incorrecto o no verificable.
- `404 webhook not registered`: no pulsaste Listen (modo test) o falta publicar el workflow (modo producción).
- `EADDRINUSE`: algún servicio ya ocupa los puertos 3000/5678. Cierra la instancia duplicada, en lugar de abrir otra.

## F. Archivos de entrega

- `workflow/FacturaHabiles_CR_n8n_WINDOWS_IMPORTAR.json` — n8n local en Windows.
- `workflow/FacturaHabiles_CR_n8n_DOCKER_IMPORTAR.json` — n8n con Docker Compose.
- `postman/FacturaHabiles_CR_POSTMAN_IMPORTAR.json` — 8 solicitudes con ejemplos y variables.
- `db.json` — JSON Server (facturas ejemplo); se modifica al crear/procesar.
- `src/` + `main.js` — JavaScript POO independiente.
- `tests/` — validación automatizada de cálculos, formato, y código de integración.
- `docs/Documento_Logica_Negocio.docx` y `.pdf` — informe de laboratorio 2–4 páginas.
- `docs/GUION_PRESENTACION.md` — exposición oral.
- `INICIAR_TODO_WINDOWS.bat`, `INICIAR_CON_DOCKER_WINDOWS.bat` — arranque.

**Estado de pruebas:** El ZIP se comprueba con pruebas locales de JavaScript y una simulación de ejecución de nodos; el arranque efectivo en tu Windows, el n8n real y la API en vivo **deben verificarse allí** porque no puedo abrir servicios en tu computadora desde esta conversación.

Referencias: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/ ; https://date.nager.at/Api ; https://github.com/typicode/json-server
