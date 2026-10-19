const checks=[
  ['JSON Server','http://localhost:3000/facturas'],
  ['n8n','http://localhost:5678/healthz'],
  ['API externa de feriados','https://date.nager.at/api/v3/PublicHolidays/2026/CR'],
];
let fallos=0;
for(const [name,url] of checks){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(8000)});
  const valid=response.ok;
  console.log(`${valid?'OK':'ERROR'} | ${name} | HTTP ${response.status} | ${url}`);
  if(!valid)fallos++;
 }catch(e){fallos++;console.error(`ERROR | ${name} | ${e.cause?.code??e.message}`);}
}
if(fallos){console.log('\nRevisa que los servicios esten encendidos, los puertos libres e Internet.');process.exitCode=1;}
else console.log('\nServicios accesibles. Falta validar el flujo real mediante Postman.');
