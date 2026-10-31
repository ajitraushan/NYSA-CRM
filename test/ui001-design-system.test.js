import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../public/ui-design-system.js',import.meta.url),'utf8');
const context={window:{},Intl,Date};vm.runInNewContext(script,context);const ui=context.window.NysaUI;
test('UI-001 presents instants in Dubai, handles date-only values without timezone drift',()=>{
 assert.equal(ui.date('2026-10-30T05:00:00.000Z'),'30 Oct 2026, 09:00');
 assert.equal(ui.date('2026-10-30 05:00:00'),'30 Oct 2026, 09:00');
 assert.equal(ui.date('2026-10-30T23:00:00Z'),'31 Oct 2026, 03:00');
 assert.equal(ui.date('2026-10-30',{dateOnly:true}),'30 Oct 2026');
 assert.equal(ui.date(null),'Not provided');assert.equal(ui.date('invalid'),'Not provided');
});
test('UI-001 task priorities use the same business vocabulary',()=>{
 for(const [input,expected]of [['urgent','Urgent'],['high','High'],['normal','Normal'],['medium','Normal'],['low','Normal']])assert.equal(ui.priority(input),expected);
});
test('UI-001 list contact hints minimize values and preserve already masked server responses',()=>{
 assert.equal(ui.contactHint('synthetic@example.test','email'),'s***@example.test');
 assert.equal(ui.contactHint('+971500000123','phone'),'••••0123');
 assert.equal(ui.contactHint('a***@example.test','email'),'a***@example.test');
 assert.equal(ui.contactHint(null,'phone'),'Not provided');
});
function luminance(hex){const c=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
test('UI-001 ordinary text, primary action and focus colours meet AA contrast',()=>{
 for(const[a,b]of [['14232c','f4f1eb'],['5b6770','f4f1eb'],['7a5a26','f4f1eb'],['c9a86a','14232c'],['8f6a30','ffffff'],['285b75','ffffff']]){const l=[luminance(a),luminance(b)].sort((x,y)=>y-x);assert.ok((l[0]+.05)/(l[1]+.05)>=4.5,`${a}/${b}`);}
});
test('UI-001 identity filters are visible only in Customers and retain handler IDs elsewhere',()=>{
 const lookup={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../public/customer-lookup-ui.js',import.meta.url),'utf8'),lookup);
 const customers=lookup.window.customerIdentityFields('customer');assert.match(customers,/Passport/);assert.match(customers,/Emirates ID/);
 for(const prefix of['lead','inventory','opportunity','lookup-synthetic']){const markup=lookup.window.customerIdentityFields(prefix);assert.equal((markup.match(/type="hidden"/g)||[]).length,2);assert.doesNotMatch(markup,/<label[^>]*>Passport|<label[^>]*>Emirates ID/);assert.ok(markup.includes(`id="${prefix}-passportLast4"`));assert.ok(markup.includes(`id="${prefix}-emiratesIdLast4"`));}
 const root={querySelector:selector=>({value:selector.endsWith('mobile')?'synthetic-phone':'1234'})};
 for(const prefix of['customer','lead','inventory','opportunity']){const params=new URLSearchParams();lookup.window.customerIdentityParams(prefix,params,root);assert.equal(params.get('mobile'),'synthetic-phone');assert.equal(params.has('passportLast4'),prefix==='customer');assert.equal(params.has('emiratesIdLast4'),prefix==='customer');}
});
