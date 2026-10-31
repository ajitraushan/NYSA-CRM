import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const original=fs.readFileSync(new URL('../public/bootstrap.js',import.meta.url),'utf8');
async function boot({styleFails=false}={}){
 const loaded=[],window={},body={innerHTML:'',appendChild(script){const file=new URL(script.src,'http://localhost').pathname.slice(1),delay=file==='incoming-leads-ui.js'?40:file==='lead-response-dev244-ui.js'?30:0;setTimeout(()=>{if(file==='incoming-leads-ui.js')window.intake='legacy';if(file==='lead-response-dev244-ui.js')window.queue='legacy';if(file==='web-intake-phase1-ui.js'){window.intake='phase1';window.queue='phase1';}if(file==='app.js')loaded.push({file,intake:window.intake,queue:window.queue});else loaded.push({file});script.onload();},delay);}};
 const document={body,createElement:tag=>({tagName:tag}),head:{appendChild(link){if(link.onload)setTimeout(()=>styleFails?link.onerror():link.onload(),0);}}};
 // Only the ESM money-input import is a boundary stub; real bootstrap ordering executes unchanged.
 const source=original.replace('import(`/money-input.js?v=${encodeURIComponent(build)}`)','Promise.resolve({parseReceiptAmount:()=>null})');assert.notEqual(source,original);
 await vm.runInNewContext(source,{window,document,location:{hostname:'localhost'},fetch:async()=>({ok:true,json:async()=>({version:'2.1.0-dev.251'})}),setTimeout});return {loaded,body};
}
test('UI-001 current intake and queue win even when legacy scripts finish last',async()=>{
 const {loaded}=await boot(),app=loaded.find(item=>item.file==='app.js');assert.equal(app.intake,'phase1');assert.equal(app.queue,'phase1');const phase=loaded.findIndex(item=>item.file==='web-intake-phase1-ui.js');assert.ok(phase>loaded.findIndex(item=>item.file==='incoming-leads-ui.js'));assert.ok(phase>loaded.findIndex(item=>item.file==='lead-response-dev244-ui.js'));
});
test('UI-001 refuses an incomplete workspace when its shared stylesheet cannot load',async()=>{
 const {loaded,body}=await boot({styleFails:true});assert.equal(loaded.some(item=>item.file==='app.js'),false);assert.match(body.innerHTML,/shared workspace styles could not be loaded/);
});
