import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fechaUTC, sumarDiasISO, hoyCostaRica} from '../src/fechas.js';
import {Factura} from '../src/Factura.js';
import {CalendarioLaboral} from '../src/CalendarioLaboral.js';
const festivos = JSON.parse(readFileSync(new URL('../fixtures/feriados_demo.json',import.meta.url),'utf8'));
const calendario = new CalendarioLaboral(festivos,[2026,2027]);
const base = {id:10,cliente:'Cliente de prueba',monto:1500,estado:'pendiente',fechaEmision:'2026-10-16',fechaVencimiento:null};

test('fechas ISO: 29 feb 2024 válido, 31 feb 2026 inválido',()=>{
  assert.equal(fechaUTC('2024-02-29').toISOString().slice(0,10),'2024-02-29');
  assert.throws(()=>fechaUTC('2026-02-31'),/imposible/);
  assert.throws(()=>fechaUTC('31-10-2026'),/inválida/);
});
test('día de emisión no cuenta, se saltan sábados y domingos',()=>{
  assert.equal(calendario.sumarDiasHabiles('2026-10-16',15),'2026-11-06');
});
test('se omite el feriado 15 sep en Costa Rica',()=>{
  assert.equal(calendario.sumarDiasHabiles('2026-09-14',1),'2026-09-16');
});
test('fin de año: consulta ambos años y excluye 1 de enero',()=>{
  assert.equal(calendario.sumarDiasHabiles('2026-12-31',1),'2027-01-04');
  assert.equal(calendario.sumarDiasHabiles('2026-12-24',1),'2026-12-28');
});
test('no inventa días hábiles si no se consultó el año requerido',()=>{
  assert.throws(()=>calendario.sumarDiasHabiles('2027-12-30',15),/Sin calendario/);
});
test('día de vencimiento no se considera todavía vencido',()=>{
  const factura = new Factura(base);
  assert.equal(factura.estaVencida('2026-11-06','2026-11-06'),false);
  assert.equal(factura.estaVencida('2026-11-07','2026-11-06'),true);
});
test('pendiente vencida genera PATCH de estado y fecha (R4)',()=>{
  const r = new Factura(base).planificarActualizacion(calendario,'2026-11-08',15);
  assert.deepEqual(r.actualizacion,{fechaVencimiento:'2026-11-06',estado:'vencida'});
  assert.equal(r.tipo,'actualizar');
});
test('no se modifica una factura pagada o anulada (R5)',()=>{
  for (const estado of ['pagada','anulada']) {
    assert.equal(new Factura({...base,estado}).planificarActualizacion(calendario,'2026-11-10').tipo,'sin_cambios');
  }
});
test('evita PATCH duplicado en ejecuciones repetidas (idempotencia)',()=>{
  const factura = new Factura({...base,fechaVencimiento:'2026-11-06',estado:'vencida'});
  assert.equal(factura.planificarActualizacion(calendario,'2026-11-08').tipo,'sin_cambios');
});
test('errores de datos: monto, fecha, ID, cliente, estado y calendario',()=>{
  for (const cambio of [{monto:-1},{fechaEmision:'2026-02-31'},{id:null},{cliente:''},{estado:'error'}]) {
    assert.throws(()=>new Factura({...base,...cambio}));
  }
  assert.throws(()=>new CalendarioLaboral([{date:'2026-12-25',countryCode:'US',global:true}],[2026]),/otro país/);
});
test('nunca incluye feriados regionales ni eventos no públicos',()=>{
  const c = new CalendarioLaboral([
    {date:'2026-10-19',countryCode:'CR',global:false,types:['Public']},
    {date:'2026-10-20',countryCode:'CR',global:true,types:['Observance']},
  ],[2026]);
  assert.equal(c.sumarDiasHabiles('2026-10-16',2),'2026-10-20');
});
test('el workflow es un JSON conectado e incluye los nodos requeridos',()=>{
  const wf = JSON.parse(readFileSync(new URL('./fixtures/workflow_legacy_fixtures.json',import.meta.url)));
  assert.ok(wf.nodes.length >= 12);
  assert.ok(wf.nodes.some(n=>n.type==='n8n-nodes-base.if'));
  assert.ok(wf.nodes.some(n=>n.type==='n8n-nodes-base.scheduleTrigger'));
  assert.ok(wf.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest').length >= 3);
  assert.ok(wf.nodes.some(n=>n.type==='n8n-nodes-base.code'));
  const todos = new Set(wf.nodes.map(n=>n.name));
  for (const [origen, data] of Object.entries(wf.connections)) {
    assert.ok(todos.has(origen),origen);
    for (const salidas of data.main) for (const e of salidas) assert.ok(todos.has(e.node),e.node);
  }
  for (const node of wf.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest')) {
    assert.equal(node.onError,'continueErrorOutput');
    assert.ok(wf.connections[node.name].main[1].length>0);
  }
});
test('nodo n8n POO (código generado) coincide con clases de main.js',()=>{
  const wf = JSON.parse(readFileSync(new URL('./fixtures/workflow_legacy_fixtures.json',import.meta.url)));
  const code = wf.nodes.find(n=>n.name==='Aplicar POO y clasificar facturas').parameters.jsCode;
  const registros = [{...base},{...base,id:11,estado:'pagada'},{...base,id:12,monto:-1}];
  const ctx = {
    $input: {first:()=>({json:{statusCode:200,body:festivos.filter(h=>h.date.startsWith('2027'))}})},
    $: (nombre)=>({first:()=>({json:{
      hoy:'2026-11-08',anioActual:2026,anioSiguiente:2027,diasHabiles:15,
      facturas:registros,feriadosActuales:festivos.filter(h=>h.date.startsWith('2026'))
    }})})
  };
  const salida = vm.runInNewContext(`(function() { ${code} })()`,ctx);
  const esperado = registros.map(registro=>{
    try {return new Factura(registro).planificarActualizacion(calendario,'2026-11-08',15)}
    catch(e){return {tipo:'error_dato',id:registro.id,motivo:e.message}}
  });
  assert.deepEqual(JSON.parse(JSON.stringify(salida.map(x=>x.json))),esperado);
});
test('fecha Costa Rica formato ISO y aritmética sin desfase UTC',()=>{
  assert.match(hoyCostaRica(new Date('2026-10-19T04:00:00Z')), /^2026-10-18$/);
  assert.equal(sumarDiasISO('2026-12-31',1),'2027-01-01');
});
