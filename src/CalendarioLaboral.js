import { fechaUTC, formatoISO } from './fechas.js';

/** Solo feriados nacionales públicos. Feriados regionales no aplican a todas las facturas. */
export class CalendarioLaboral {
  #feriados;
  #aniosDisponibles;

  constructor(registros = [], aniosDisponibles = []) {
    if (!Array.isArray(registros)) throw new Error('La API de feriados debe devolver un arreglo');
    this.#feriados = new Set();
    this.#aniosDisponibles = new Set(aniosDisponibles.map(Number));
    for (const feriado of registros) {
      if (typeof feriado !== 'object' || feriado === null) throw new Error('Feriado inválido');
      if (feriado.countryCode && feriado.countryCode !== 'CR') {
        throw new Error(`El feriado pertenece a otro país: ${feriado.countryCode}`);
      }
      fechaUTC(feriado.date);
      if (feriado.global === true && (!Array.isArray(feriado.types) || feriado.types.includes('Public'))) {
        this.#feriados.add(feriado.date);
      }
    }
  }

  esDiaHabil(fechaISO) {
    const fecha = fechaUTC(fechaISO);
    const anio = fecha.getUTCFullYear();
    if (!this.#aniosDisponibles.has(anio)) throw new Error(`Sin calendario de feriados verificado para ${anio}`);
    const dia = fecha.getUTCDay();
    return dia !== 0 && dia !== 6 && !this.#feriados.has(fechaISO);
  }

  sumarDiasHabiles(fechaEmision, dias = 15) {
    fechaUTC(fechaEmision);
    if (!Number.isInteger(dias) || dias <= 0 || dias > 100) throw new Error('El plazo debe ser de 1 a 100 días hábiles');
    let actual = fechaUTC(fechaEmision);
    let restantes = dias;
    while (restantes > 0) {
      actual.setUTCDate(actual.getUTCDate() + 1); // El día de emisión no se cuenta.
      if (this.esDiaHabil(formatoISO(actual))) restantes -= 1;
    }
    return formatoISO(actual);
  }
}
