// Fechas ISO estrictas, interpretadas en UTC para evitar cambios por zona horaria.
export function fechaUTC(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error(`Fecha ISO inválida: ${String(iso)}`);
  }
  const [ano, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(ano, mes - 1, dia));
  if (fecha.getUTCFullYear() !== ano || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    throw new Error(`Fecha imposible: ${iso}`);
  }
  return fecha;
}
export function formatoISO(fecha) { return fecha.toISOString().slice(0, 10); }
export function sumarDiasISO(iso, cantidad) {
  const f = fechaUTC(iso);
  f.setUTCDate(f.getUTCDate() + cantidad);
  return formatoISO(f);
}
export function hoyCostaRica(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(ahora);
  const valor = (tipo) => partes.find(p => p.type === tipo)?.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
