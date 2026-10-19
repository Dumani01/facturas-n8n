const [mode='test',urlOverride]=process.argv.slice(2);
const url=urlOverride || `http://localhost:5678/webhook${mode==='prod'?'':'-test'}/facturacion/calcular`;
const body={cliente:'Prueba terminal '+Date.now(),monto:25000,moneda:'CRC',fechaEmision:'2026-10-19'};
try{
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
 const t=await r.text();console.log('HTTP',r.status,'\n',t);if(!r.ok)process.exitCode=1;
}catch(e){console.error('No responde el webhook:',e.message);process.exitCode=1;}
