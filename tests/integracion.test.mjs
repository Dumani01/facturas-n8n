import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workflow=JSON.parse(fs.readFileSync(new URL('../workflow/FacturaHabiles_CR_n8n_WINDOWS_IMPORTAR.json',import.meta.url)));
const docker=JSON.parse(fs.readFileSync(new URL('../workflow/FacturaHabiles_CR_n8n_DOCKER_IMPORTAR.json',import.meta.url)));
const postman=JSON.parse(fs.readFileSync(new URL('../postman/FacturaHabiles_CR_POSTMAN_IMPORTAR.json',import.meta.url)));
const database=JSON.parse(fs.readFileSync(new URL('../db.json',import.meta.url)));
const feriados=JSON.parse(fs.readFileSync(new URL('../fixtures/feriados_demo.json',import.meta.url)));
const nodeMap=new Map(workflow.nodes.map(node=>[node.name,node]));

// Emulador de las transformaciones Code, IF y HTTP de este flujo.
// No sustituye a una prueba de ejecucion real dentro de n8n.
function simular(request,{apiFalla=false}={}) {
  const registros=structuredClone(database.facturas);
  const output=new Map();
  const pasos=[];
  let nombre='Webhook POST - Recibir factura',entrada={body:request};
  for(let i=0;i<45;i++) {
    const n=nodeMap.get(nombre);assert.ok(n,`Nodo ausente ${nombre}`);pasos.push(nombre);
    let respuesta=entrada;let branch=0;
    if(n.type.endsWith('.code')){
      const ctx={
        $input:{first:()=>({json:entrada})},
        $:key=>({first:()=>({json:output.get(key)})}),
      };
      const result=vm.runInNewContext(`(function(){${n.parameters.jsCode}\n})()`,ctx,{timeout:2000});
      assert.ok(Array.isArray(result)&&result.length===1,`El Code ${nombre} no devuelve 1 item`);
      respuesta=JSON.parse(JSON.stringify(result[0].json));
    }else if(n.type.endsWith('.if')){
      const cond=n.parameters.conditions.conditions[0];
      const field=cond.leftValue.match(/\$json\.(\w+)/)?.[1];
      assert.ok(field,`IF campo inválido ${nombre}`);
      const v=entrada[field];
      const cumple=cond.operator.type==='boolean'? v===true : v===cond.rightValue;
      branch=cumple?0:1;
    }else if(n.type.endsWith('.httpRequest')){
      const p=n.parameters;
      const evalExpression=s=>s.startsWith('={{') ? vm.runInNewContext(s.slice(3,-2).trim(),{$json:entrada},{timeout:2000}) : s;
      const url=String(evalExpression(p.url));
      const body=p.jsonBody?JSON.parse(evalExpression(p.jsonBody)):null;
      if(url.includes('date.nager.at')) {
        if(apiFalla){respuesta={error:{message:'API de feriados no responde'}};branch=1;}
        else {
          const year=Number(url.match(/PublicHolidays\/(\d{4})\/CR/)?.[1]);
          respuesta={statusCode:200,body:feriados.filter(x=>x.date.startsWith(year+'-'))};
        }
      }else if(url.includes('/facturas')){
        const id=Number(url.match(/\/facturas\/(\d+)/)?.[1]);
        if(p.method==='POST'){
          const nuevo={...body,id:Math.max(0,...registros.map(x=>Number(x.id)))+1};
          registros.push(nuevo);respuesta={statusCode:201,body:nuevo};
        }else if(p.method==='GET'){
          const f=registros.find(x=>Number(x.id)===id);
          respuesta=f?{statusCode:200,body:f}:{statusCode:404,body:{}};
        }else if(p.method==='PATCH'){
          const f=registros.find(x=>Number(x.id)===id);
          if(!f)respuesta={statusCode:404,body:{}};
          else {Object.assign(f,body);respuesta={statusCode:200,body:f};}
        }
      }else throw Error('HTTP unexpected '+url);
    }else if(n.type.endsWith('.respondToWebhook')){
      return {status:entrada.httpStatus||200,response:entrada,registros,pasos};
    }
    output.set(nombre,respuesta);
    const next=workflow.connections[nombre]?.main[branch]?.[0]?.node;
    if(!next)throw new Error(`Sin conexion en ${nombre} salida ${branch}`);
    nombre=next;entrada=respuesta;
  }
  throw new Error('Flujo no termina');
}

test('dos workflows y Postman son JSON importables con todos sus nodos conectados',()=>{
  for(const flow of [workflow,docker]){
    const todos=new Set(flow.nodes.map(n=>n.name));
    assert.equal(flow.nodes.length,20);
    assert.equal(flow.nodes.filter(n=>n.type.endsWith('.httpRequest')).length,5);
    assert.ok(flow.nodes.some(n=>n.type.endsWith('.webhook')));
    assert.ok(flow.nodes.some(n=>n.type.endsWith('.respondToWebhook')));
    for(const [origen,data]of Object.entries(flow.connections)){
      assert.ok(todos.has(origen));
      for(const routes of data.main)for(const e of routes)assert.ok(todos.has(e.node),`${origen}->${e.node}`);
    }
    for(const n of flow.nodes.filter(n=>n.type.endsWith('.httpRequest'))){
      assert.equal(n.onError,'continueErrorOutput');assert.ok(flow.connections[n.name].main[1].length);
    }
  }
  assert.equal(postman.item.length,8);
  assert.equal(JSON.parse(postman.item[0].request.body.raw).facturaId,undefined);
  assert.match(postman.item[0].request.url.raw,/webhook-test/);
  assert.match(postman.item[1].request.url.raw,/\/webhook\//);
  const win=workflow.nodes.find(n=>n.name==='POST - Crear nueva factura');
  const dock=docker.nodes.find(n=>n.name==='POST - Crear nueva factura');
  assert.match(win.parameters.url,/127\.0\.0\.1/);
  assert.match(dock.parameters.url,/json-server/);
});

test('todo el codigo de nodos Code compila sin errores sintacticos',()=>{
  for(const n of workflow.nodes.filter(n=>n.type.endsWith('.code'))){
    assert.doesNotThrow(()=>new Function(n.parameters.jsCode),n.name);
  }
});

test('simulacion: una sola solicitud de Postman CREA, CALCULA y GUARDA sin ID manual',()=>{
  const r=simular({cliente:'Cliente nuevo',monto:85000,moneda:'CRC',fechaEmision:'2026-10-19'});
  assert.equal(r.status,200);
  assert.equal(r.response.ok,true);
  assert.equal(r.response.tipo,'factura_procesada');
  assert.equal(r.response.facturaId,'7');
  assert.equal(r.response.fechaVencimiento,'2026-11-09');
  assert.equal(r.registros.find(x=>String(x.id)==='7').fechaVencimiento,'2026-11-09');
  assert.ok(r.pasos.includes('POST - Crear nueva factura'));
  assert.ok(r.pasos.includes('PATCH - Guardar factura calculada'));
});

test('simulacion: ID existente se procesa, sin dar datos de nuevo',()=>{
  const r=simular({facturaId:1});
  assert.equal(r.status,200);assert.equal(r.response.ok,true);
  assert.ok(r.pasos.includes('GET - Consultar por ID'));
  assert.ok(!r.pasos.includes('POST - Crear nueva factura'));
});

test('simulacion: errores 400 y 404 son legibles',()=>{
  const a=simular({cliente:'Sin monto',fechaEmision:'2026-10-19'});
  assert.equal(a.status,400);assert.equal(a.response.tipo,'error_solicitud');
  const b=simular({facturaId:9999999});
  assert.equal(b.status,404);assert.equal(b.response.tipo,'factura_no_existe');
});

test('simulacion: factura pagada no se modifica',()=>{
  const r=simular({facturaId:4});
  assert.equal(r.status,200);assert.equal(r.response.tipo,'sin_cambios');
  assert.equal(r.registros.find(x=>x.id===4).estado,'pagada');
  assert.ok(!r.pasos.includes('PATCH - Guardar factura calculada'));
});

test('simulacion: factura inválida devuelve 422 sin modificarla',()=>{
  const r=simular({facturaId:6});
  assert.equal(r.status,422);assert.equal(r.response.tipo,'error_datos_factura');
  assert.ok(!r.pasos.includes('PATCH - Guardar factura calculada'));
});

test('simulacion: API externa caída devuelve 503 sin PATCH',()=>{
  const r=simular({facturaId:1},{apiFalla:true});
  assert.equal(r.status,503);assert.equal(r.response.tipo,'error_conexion');
  assert.ok(!r.pasos.includes('PATCH - Guardar factura calculada'));
});
