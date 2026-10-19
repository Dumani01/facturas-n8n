# Guion de presentación (5 a 7 minutos)

**1. Problema (45 s).** «Una empresa no puede vencer facturas contando quince días naturales porque hay sábados, domingos y feriados. Nuestra solución calcula el plazo real y registra el estado en una base de datos».

**2. Arquitectura (60 s).** «Postman envía un POST al Webhook de n8n. El flujo valida el Body, crea automáticamente la factura en JSON Server —o la consulta por ID—, obtiene feriados de Nager.Date, calcula días hábiles con dos clases JavaScript y actualiza el registro por PATCH. Las ramas IF separan los casos correctos y los errores».

**3. Código POO (60 s).** Mostrar `src/Factura.js` y `src/CalendarioLaboral.js`: encapsulación con campos privados, métodos de negocio, estados y cálculo de días hábiles. Ejecutar `npm run demo`. Indicar que el nodo Code de n8n contiene el código generado desde esas mismas clases: `npm run workflow`.

**4. Demostración en vivo (90 s).** Iniciar JSON Server y n8n. Importar workflow Windows o Docker según el entorno. Pulsar **Listen for Test Event**. Abrir Postman y enviar la solicitud **01 CREAR Y PROCESAR SIN ID**. Observar que la respuesta incluye `facturaId`, `fechaVencimiento` y `estado`. Abrir `http://localhost:3000/facturas` para confirmar persistencia. Si se publicó el workflow, usar la solicitud **02** de producción.

**5. Errores (45 s).** En Postman ejecutar solicitud **05** (faltan campos → HTTP 400) y **06** (ID inexistente → HTTP 404). Reprocesar una factura pagada con `{"facturaId":4}` para mostrar que su estado se conserva. Mencionar caída de API → error informado y sin fecha inventada.

**6. Conclusión (30 s).** «El desafío principal fue unir entrada HTTP, persistencia y una API de calendario real, manteniendo una sola lógica de negocio en JS. Las pruebas automáticas verifican las clases; la demostración en n8n confirma la integración funcionando en este entorno».

**Nota para el expositor:** Las 22 pruebas de este paquete incluyen simulaciones y no prueban conectividad real en tu computadora. Durante la defensa es necesario ejecutar el flujo en n8n y verificar JSON Server. No confundir creación de la factura con procesamiento completo si el API de feriados falló.
