import { readFileSync } from 'node:fs';
import { Factura } from './src/Factura.js';
import { CalendarioLaboral } from './src/CalendarioLaboral.js';
import { hoyCostaRica } from './src/fechas.js';
const datos = JSON.parse(readFileSync(new URL('./db.json', import.meta.url), 'utf8'));
const hoy = hoyCostaRica();
const anio = Number(hoy.slice(0,4));
// Demostración POO local: los feriados vienen de FIXTURES para funcionar sin internet.
// El workflow n8n consulta SIEMPRE feriados reales de Nager.Date.
const feriados = [
  ...JSON.parse(readFileSync(new URL('./fixtures/feriados_demo.json', import.meta.url), 'utf8'))
];
const calendario = new CalendarioLaboral(feriados, [anio, anio+1]);
console.log('DEMOSTRACIÓN POO LOCAL — calendario de ejemplo, NO consulta externa');
console.log(`Fecha Costa Rica: ${hoy} | Plazo: 15 días hábiles`);
for (const datosFactura of datos.facturas) {
  try {
    const factura = new Factura(datosFactura);
    const accion = factura.planificarActualizacion(calendario,hoy,15);
    console.log(`${factura.id} | ${accion.tipo} | ${accion.actualizacion?.fechaVencimiento ?? '-'} | ${accion.motivo}`);
  } catch (error) {
    console.log(`${datosFactura.id ?? '?'} | error_dato | ${error.message}`);
  }
}
