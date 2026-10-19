import { readFileSync, writeFileSync } from 'node:fs';
const leer=(f)=>readFileSync(new URL(f,import.meta.url),'utf8');
const clase=(f)=>leer('../src/'+f).replace(/^import\s+.*?;\s*$/gm,'').replace(/^export\s+/gm,'');
const source=['fechas.js','CalendarioLaboral.js','Factura.js'].map(clase).join('\n\n');
const base=JSON.parse(leer('./workflow-template.json'));
for(const [destino,url] of [
  ['../workflow/FacturaHabiles_CR_n8n_WINDOWS_IMPORTAR.json','http://127.0.0.1:3000'],
  ['../workflow/FacturaHabiles_CR_n8n_DOCKER_IMPORTAR.json','http://json-server:3000']
]){
  const wf=structuredClone(base);
  for(const n of wf.nodes){
    if(n.type==='n8n-nodes-base.httpRequest') n.parameters.url=n.parameters.url.replaceAll('__JSON_SERVER_BASE__',url);
    if(n.name==='POO - Calcular 15 dias habiles'){
      if(!n.parameters.jsCode.includes('__CODIGO_POO_GENERADO__')) throw Error('Marcador ausente');
      n.parameters.jsCode=n.parameters.jsCode.replace('__CODIGO_POO_GENERADO__',source);
    }
  }
  writeFileSync(new URL(destino,import.meta.url),JSON.stringify(wf,null,2)+'\n');
}
console.log('Workflows Windows y Docker generados con una sola fuente de POO.');
