import fs from 'node:fs/promises';

const sourceUrl=new URL('./build-isolated-dev180.mjs',import.meta.url);
const generatedUrl=new URL('./.build-isolated-dev181.generated.mjs',import.meta.url);
const source=(await fs.readFile(sourceUrl,'utf8'))
  .replaceAll('dev180-only-20260904','dev181-only-20260904')
  .replaceAll('2.1.0-dev.180','2.1.0-dev.181')
  .replaceAll('crm-test-dev180','crm-test-dev181');
await fs.writeFile(generatedUrl,source,{flag:'wx'});
try{await import(generatedUrl.href+`?run=${Date.now()}`);}finally{await fs.unlink(generatedUrl);}
