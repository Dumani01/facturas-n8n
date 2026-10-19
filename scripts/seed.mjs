import { writeFileSync } from 'node:fs';
import { hoyCostaRica, sumarDiasISO } from '../src/fechas.js';
const hoy = hoyCostaRica();
const factura = (id, cliente, monto, fechaEmision, estado='pendiente', fechaVencimiento=null) =>
  ({ id, cliente, monto, moneda:'CRC', fechaEmision, fechaVencimiento, estado });
const registros = [
  factura(1, 'Cooperativa del Pacífico', 175000, sumarDiasISO(hoy,-32)),
  factura(2, 'Distribuidora Marina', 89500, sumarDiasISO(hoy,-8)),
  factura(3, 'Servicios del Golfo', 250000, sumarDiasISO(hoy,-2)),
  factura(4, 'Empresa cancelada', 99000, sumarDiasISO(hoy,-45), 'pagada'),
  factura(5, 'Factura anulada', 12000, sumarDiasISO(hoy,-35), 'anulada'),
  factura(6, 'Factura con monto inválido', -100, sumarDiasISO(hoy,-5))
];
writeFileSync(new URL('../db.json', import.meta.url), JSON.stringify({ facturas: registros }, null, 2) + '\n');
console.log(`Se preparó db.json con 6 facturas (fecha CR: ${hoy}). La #6 es inválida intencionalmente.`);
