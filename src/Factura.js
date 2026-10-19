import { fechaUTC } from './fechas.js';

export class Factura {
  #datos;
  constructor(datos) {
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('Factura inexistente o incorrecta');
    if ((typeof datos.id !== 'number' && typeof datos.id !== 'string') || String(datos.id).trim() === '') {
      throw new Error('Factura sin ID');
    }
    if (!['pendiente', 'vencida', 'pagada', 'anulada'].includes(datos.estado)) {
      throw new Error(`Estado de factura inválido: ${String(datos.estado)}`);
    }
    if (typeof datos.cliente !== 'string' || !datos.cliente.trim()) throw new Error('Factura sin cliente');
    if (typeof datos.monto !== 'number' || !Number.isFinite(datos.monto) || datos.monto <= 0) {
      throw new Error('Monto de factura inválido');
    }
    fechaUTC(datos.fechaEmision);
    if (datos.fechaVencimiento != null) fechaUTC(datos.fechaVencimiento);
    this.#datos = { ...datos };
  }
  get id() { return this.#datos.id; }
  get estado() { return this.#datos.estado; }
  get fechaEmision() { return this.#datos.fechaEmision; }
  calcularVencimiento(calendario, diasHabiles = 15) {
    return calendario.sumarDiasHabiles(this.fechaEmision, diasHabiles);
  }
  estaVencida(hoy, vencimiento) {
    fechaUTC(hoy);
    fechaUTC(vencimiento);
    return hoy > vencimiento; // Vence al acabar la fecha indicada.
  }
  planificarActualizacion(calendario, hoy, diasHabiles = 15) {
    if (this.estado === 'pagada' || this.estado === 'anulada') {
      return { tipo: 'sin_cambios', id: this.id, motivo: `Factura ${this.estado}; se respeta su estado` };
    }
    const fechaVencimiento = this.calcularVencimiento(calendario, diasHabiles);
    const estado = this.estaVencida(hoy, fechaVencimiento) ? 'vencida' : 'pendiente';
    const actualizacion = { fechaVencimiento, estado };
    const cambio = this.#datos.fechaVencimiento !== fechaVencimiento || this.estado !== estado;
    return cambio
      ? { tipo: 'actualizar', id: this.id, cliente: this.#datos.cliente, actualizacion,
          motivo: estado === 'vencida' ? 'Plazo de pago superado' : 'Vencimiento calculado' }
      : { tipo: 'sin_cambios', id: this.id, motivo: 'Ya estaba actualizado' };
  }
}
