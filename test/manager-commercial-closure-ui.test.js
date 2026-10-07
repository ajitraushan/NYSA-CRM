import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/deal-ui.js',import.meta.url),'utf8');
function render(dealType,status,jobRole='manager',writable=true,cancellationRequestStatus=null){
  const context=vm.createContext({window:{},ME:{jobRole},esc:v=>String(v??''),fmtPrice:String,fmtDate:String});
  vm.runInContext(source,context);
  return context.dealWorkspaceHTML({writable,deals:[{id:'synthetic',dealType,status,cancellationRequestStatus,cancellationRequestId:cancellationRequestStatus?'request-1':null,cancellationReasonCode:'other',cancellationReason:'Synthetic cancellation reason',cancellationEvidenceReference:'SYN-EVIDENCE',parties:[],
    closureGates:['commercial','reservation','documents','approval'].map(code=>({code,complete:code!=='approval',label:code})),
    checklistItems:[{id:'review',itemCode:'DIRECTOR_REVIEW',responsibleRole:'director',label:'Director-designated commercial review',required:true,evidenceRequired:true,status:'pending'}]}]});
}
for(const type of ['commercial_sale','commercial_rental'])test(`${type}: Manager gets standard review, approval and closure actions without MD dependency`,()=>{
  const draft=render(type,'draft');
  assert.match(draft,/Three evidence gates lead to one management decision/);
  assert.doesNotMatch(draft,/deal-checklist-form/);
  assert.match(draft,/deal-approval-form/);
  assert.doesNotMatch(draft,/A Director must approve/);
  const approved=render(type,'approved');
  assert.match(approved,/deal-close-won-form/);
  assert.match(approved,/Complete previously approved Deal/);
  assert.doesNotMatch(approved,/deal-close-lost-form/);
  assert.match(render(type,'approved','manager',true,'pending'),/deal-close-lost-form/);
  assert.match(render(type,'approved','manager',true,'pending'),/Approve cancellation and release Inventory/);
  const agent=render(type,'approved','sales_agent',true);assert.doesNotMatch(agent,/deal-close-won-form/);assert.match(agent,/deal-close-lost-form/);
  for(const [role,writable] of [['accountant',false],['manager',false]])assert.doesNotMatch(render(type,'approved',role,writable),/id="deal-close-(?:won|lost)-form"/);
  for(const [role,writable] of [['sales_agent',true],['accountant',false],['manager',false]])assert.doesNotMatch(render(type,'draft',role,writable),/id="deal-approval-form"/);
});
