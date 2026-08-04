import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AI_SCHEMAS, requestStructuredOutput, redactSensitiveText, AiServiceError } from '../src/ai-service.js';
import { buildMatchEvidence, buildCompletenessContext,rankInventoryMatches } from '../src/ai-domain.js';

const root=join(fileURLToPath(new URL('.',import.meta.url)),'..');

test('AI structured output uses server-side Responses API schema and disables storage',async()=>{
  const prior=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-only-key';
  try{
    const response=await requestStructuredOutput({name:'nysa_missing_information',instructions:'Test',input:{safe:true},schema:AI_SCHEMAS.missing_information,fetchImpl:async(url,options)=>{
      assert.match(url,/\/v1\/responses$/);assert.equal(options.headers.Authorization,'Bearer test-only-key');
      const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.type,'json_schema');assert.equal(body.text.format.strict,true);assert.equal(body.model,'gpt-5.6-luna');
      return{ok:true,json:async()=>({id:'resp_test',model:body.model,output:[{content:[{type:'output_text',text:JSON.stringify({blocking:[],recommended:[],questions:[],canProceed:true})}]}]})};
    }});
    assert.equal(response.responseId,'resp_test');assert.equal(response.result.canProceed,true);
  }finally{if(prior===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=prior;}
});

test('AI input redaction removes direct contact and identity identifiers without removing property budgets',()=>{
  const value=redactSensitiveText('Email buyer@example.com phone +971 50 123 4567 EID 784-1990-1234567-1 budget AED 2500000');
  assert.doesNotMatch(value,/buyer@example|1234567-1|\+971/);assert.match(value,/2500000/);
});

test('match explanation evidence is deterministic and exposes failures to the model',()=>{
  const evidence=buildMatchEvidence({businessLine:'Sale',purpose:'own_use',areas:['Dubai Marina'],propertyTypes:['Apartment'],budgetMin:2000000,budgetMax:2400000,fundingMethod:'mortgage',bedroomsMin:2,bedroomsMax:2,timelineCode:'0_3_months'},{inventoryReference:'NYSA-INV-000001',project:'Test',developer:'Dev',area:'Dubai Marina',propertyType:'Apartment',bedrooms:'2',sizeSqft:1200,price:2500000,currency:'AED',status:'Available',availabilityConfirmedAt:null});
  assert.ok(evidence.matched.some(x=>x.criterion==='Preferred area'));assert.ok(evidence.failed.some(x=>x.criterion==='Maximum budget'));assert.ok(evidence.failed.some(x=>x.criterion==='Availability confirmation'));
});

test('proposal shortlist ranking is deterministic transparent and excludes unavailable inventory',()=>{
  const requirement={areas:['Dubai Marina'],propertyTypes:['Apartment'],budgetMin:2000000,budgetMax:2500000,bedroomsMin:2,bedroomsMax:2};
  const ranked=rankInventoryMatches(requirement,[
    {id:'best',status:'Available',area:'Dubai Marina',propertyType:'Apartment',price:2300000,bedrooms:'2',availabilityConfirmedAt:'2026-07-18T00:00:00Z'},
    {id:'partial',status:'Available',area:'Downtown',propertyType:'Apartment',price:2400000,bedrooms:'2',availabilityConfirmedAt:null},
    {id:'hidden',status:'Closed',area:'Dubai Marina',propertyType:'Apartment',price:2200000,bedrooms:'2',availabilityConfirmedAt:'2026-07-18T00:00:00Z'}
  ]);
  assert.deepEqual(ranked.map(x=>x.listing.id),['best','partial']);assert.equal(ranked[0].score,100);assert.equal(ranked[0].fit,'Strong fit');assert.ok(ranked[1].criteria.some(x=>x.code==='area'&&!x.pass));
});

test('missing-information context identifies authoritative source gaps',()=>{
  const context=buildCompletenessContext({businessLine:'Sale',purpose:'own_use',propertyTypes:[],areas:[],budgetMin:null,budgetMax:2500000,fundingMethod:'cash',bedroomsMin:null,bedroomsMax:null,timelineCode:'0_3_months'},[{inventoryReference:'NYSA-INV-000001',project:'Test',developer:null,area:'Dubai Marina',propertyType:'Apartment',bedrooms:'2',sizeSqft:null,price:2400000,currency:'AED',status:'Available',availabilityConfirmedAt:null}]);
  assert.ok(context.deterministicMissing.requirement.includes('areas'));assert.ok(context.deterministicMissing.properties[0].fields.includes('availabilityConfirmedAt'));
});

test('AI REST routes are authenticated, mounted and never expose an API key',()=>{
  const server=readFileSync(join(root,'src/server.js'),'utf8'),routes=readFileSync(join(root,'src/routes/ai.js'),'utf8'),migration=readFileSync(join(root,'src/migrations/016_ai_assistance_runs.sql'),'utf8'),auditMigration=readFileSync(join(root,'src/migrations/019_ai_assistance_audit_constraint.sql'),'utf8');
  assert.match(server,/app\.mount\('\/api', aiRoutes\)/);assert.match(routes,/r\.use\(requireAuth/);assert.match(routes,/requirements-draft/);assert.match(routes,/match-explanation/);assert.match(routes,/missing-information/);assert.match(routes,/inputHash/);assert.doesNotMatch(routes,/process\.env\.OPENAI_API_KEY/);assert.match(migration,/ai_assistance_runs/);assert.match(auditMigration,/'AiAssistanceRun'/);
});

test('AI browser assistance requires editable review and a separate apply action',()=>{
  const app=readFileSync(join(root,'public/app.js'),'utf8'),html=readFileSync(join(root,'public/index.html'),'utf8');
  assert.match(app,/AI-assisted requirement draft/);assert.match(app,/Apply reviewed draft to form/);assert.match(app,/Save new version/);
  assert.match(app,/Draft match wording/);assert.match(app,/Apply reviewed wording to suitability/);assert.match(app,/Check missing information/);
  assert.match(app,/It does not select, rank or save properties/);assert.match(app,/Copy reviewed questions/);
  assert.match(html,/\.ai-review-box/);assert.match(html,/\.ai-advisory/);
});
