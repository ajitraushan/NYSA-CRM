import { Router } from '../lib/http-kit.js';
import { one,many,execute,transaction,uuid,audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { calculateQualification,applyQualificationOverride,validateQualificationFactors,calculateMortgage,calculateInvestmentReturns } from '../crm-domain.js';
import { hasInternalCrmIdentity,isManager,isCrmReadOnly,canReadLead,canWriteLead } from '../crm-policy.js';

const r=Router();r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'CRM customer data is restricted to NYSA staff'}));
const clean=v=>typeof v==='string'&&v.trim()?v.trim():null;
const admin=(req,res)=>req.broker.role==='admin'||(res.status(403).json({error:'Administrator access required'}),false);
async function leadFor(req,res,write=false){const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);if(!lead){res.status(404).json({error:'Lead not found'});return null;}if(!(write?canWriteLead(req.broker,lead):canReadLead(req.broker,lead))){res.status(403).json({error:'Lead is outside your permitted scope'});return null;}return lead;}

r.get('/admin/qualification-models',async(req,res)=>{if(!admin(req,res))return;res.json({models:await many('SELECT * FROM qualification_models ORDER BY model_code,version DESC')});});
r.post('/admin/qualification-models',async(req,res)=>{
  if(!admin(req,res))return;const b=req.body||{},factorError=validateQualificationFactors(b.factors);
  if(!clean(b.modelCode)||!clean(b.name)||!clean(b.purpose)||factorError)return res.status(400).json({error:factorError||'modelCode, name and purpose are required'});
  const hot=Number(b.thresholds?.hotMin),warm=Number(b.thresholds?.warmMin);if(!Number.isFinite(hot)||!Number.isFinite(warm)||warm<0||hot>100||warm>=hot)return res.status(400).json({error:'Thresholds must satisfy 0 <= warmMin < hotMin <= 100'});
  const current=await one('SELECT * FROM qualification_models WHERE model_code=$1 ORDER BY version DESC LIMIT 1',[clean(b.modelCode)]),id=uuid(),version=(current?.version||0)+1;
  const row=await one(`INSERT INTO qualification_models(id,model_code,name,description,purpose,business_line,version,factors,thresholds,guidance,supersedes_model_id,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[id,clean(b.modelCode),clean(b.name),clean(b.description),clean(b.purpose),clean(b.businessLine),version,JSON.stringify(b.factors),JSON.stringify(b.thresholds),JSON.stringify(b.guidance||{}),current?.id||null,req.broker.id]);
  await audit('QualificationModel',id,'draft_created',req.broker.id,{version});res.status(201).json(row);
});
r.post('/admin/qualification-models/:modelId/test',async(req,res)=>{if(!admin(req,res))return;const model=await one('SELECT * FROM qualification_models WHERE id=$1',[req.params.modelId]);if(!model)return res.status(404).json({error:'Model not found'});const result=calculateQualification(model,req.body?.inputs||{});res.status(result.error?400:200).json(result);});
r.post('/admin/qualification-models/:modelId/approve',async(req,res)=>{
  if(!admin(req,res))return;if(!clean(req.body?.reason))return res.status(400).json({error:'Approval reason is required'});
  const row=await one("UPDATE qualification_models SET status='approved',approved_by=$1,approved_at=NOW(),approval_reason=$2 WHERE id=$3 AND status='draft' RETURNING *",[req.broker.id,clean(req.body.reason),req.params.modelId]);
  if(!row)return res.status(409).json({error:'Only a draft model can be approved'});await audit('QualificationModel',row.id,'approved',req.broker.id,{reason:req.body.reason});res.json(row);
});
r.post('/admin/qualification-models/:modelId/activate',async(req,res)=>{
  if(!admin(req,res))return;const result=await transaction(async client=>{const model=await one('SELECT * FROM qualification_models WHERE id=$1 FOR UPDATE',[req.params.modelId],client);if(!model||model.status!=='approved')return null;
    await execute("UPDATE qualification_models SET status='retired',effective_to=NOW() WHERE model_code=$1 AND status='active'",[model.modelCode],client);
    const active=await one("UPDATE qualification_models SET status='active',effective_from=NOW() WHERE id=$1 RETURNING *",[model.id],client);await audit('QualificationModel',model.id,'activated',req.broker.id,null,client);return active;});
  if(!result)return res.status(409).json({error:'Only an approved model can be activated'});res.json(result);
});

r.get('/crm/leads/:id/qualification-assessments',async(req,res)=>{const lead=await leadFor(req,res);if(!lead)return;res.json({assessments:await many(`SELECT a.*,m.name AS model_name,m.model_code FROM qualification_assessments a JOIN qualification_models m ON m.id=a.model_id WHERE a.lead_id=$1 ORDER BY assessed_at DESC`,[lead.id])});});
r.post('/crm/leads/:id/qualification-assessments',async(req,res)=>{
  const lead=await leadFor(req,res,true);if(!lead||isCrmReadOnly(req.broker))return;const b=req.body||{};
  const model=await one(`SELECT * FROM qualification_models WHERE status='active' AND (business_line IS NULL OR business_line=$1) ORDER BY effective_from DESC LIMIT 1`,[lead.businessType]);
  if(!model)return res.status(409).json({error:'No active qualification model applies to this lead'});const calculated=calculateQualification(model,b.inputs||{});if(calculated.error)return res.status(400).json({error:calculated.error});
  const override=applyQualificationOverride(calculated,b.overrideTemperature,b.overrideReason,isManager(req.broker));
  if(override.error)return res.status(isManager(req.broker)?400:403).json({error:override.error});
  const finalTemperature=override.finalTemperature,overrideReason=override.overrideReason,overriddenBy=overrideReason?req.broker.id:null;
  const id=uuid(),row=await transaction(async client=>{const assessment=await one(`INSERT INTO qualification_assessments(id,lead_id,model_id,model_version,factor_inputs,factor_contributions,calculated_score,calculated_temperature,
      final_temperature,recommendation,override_reason,overridden_by,assessed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [id,lead.id,model.id,model.version,JSON.stringify(b.inputs||{}),JSON.stringify(calculated.contributions),calculated.score,calculated.temperature,finalTemperature,JSON.stringify(calculated.recommendation),overrideReason,overriddenBy,req.broker.id],client);
    await execute('UPDATE leads SET temperature=$1,updated_at=NOW() WHERE id=$2',[finalTemperature,lead.id],client);await audit('QualificationAssessment',id,'calculated',req.broker.id,{modelId:model.id,modelVersion:model.version,score:calculated.score,calculatedTemperature:calculated.temperature,finalTemperature,overrideReason},client);return assessment;});
  res.status(201).json({...row,contributions:calculated.contributions,recommendation:calculated.recommendation});
});

r.get('/admin/regulatory-assumptions',async(req,res)=>{if(!admin(req,res))return;res.json({versions:await many('SELECT * FROM regulatory_assumption_versions ORDER BY created_at DESC')});});
r.post('/admin/regulatory-assumptions',async(req,res)=>{if(!admin(req,res))return;const b=req.body||{};if(!clean(b.name)||!clean(b.disclaimer)||!b.assumptions||typeof b.assumptions!=='object')return res.status(400).json({error:'name, assumptions and disclaimer are required'});const prior=await one('SELECT COALESCE(MAX(version),0) AS version FROM regulatory_assumption_versions WHERE name=$1',[clean(b.name)]),id=uuid();const row=await one(`INSERT INTO regulatory_assumption_versions(id,name,version,currency,assumptions,disclaimer,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[id,clean(b.name),prior.version+1,b.currency||'AED',JSON.stringify(b.assumptions),clean(b.disclaimer),req.broker.id]);await audit('RegulatoryAssumption',id,'draft_created',req.broker.id);res.status(201).json(row);});
r.post('/admin/regulatory-assumptions/:assumptionId/activate',async(req,res)=>{if(!admin(req,res))return;const row=await transaction(async client=>{const found=await one('SELECT * FROM regulatory_assumption_versions WHERE id=$1 FOR UPDATE',[req.params.assumptionId],client);if(!found||found.status!=='draft')return null;await execute("UPDATE regulatory_assumption_versions SET status='retired' WHERE status='active'",[],client);const active=await one("UPDATE regulatory_assumption_versions SET status='active',effective_from=NOW() WHERE id=$1 RETURNING *",[found.id],client);await audit('RegulatoryAssumption',found.id,'activated',req.broker.id,null,client);return active;});if(!row)return res.status(409).json({error:'Only a draft assumption version can be activated'});res.json(row);});

r.get('/crm/leads/:id/financial-scenarios',async(req,res)=>{const lead=await leadFor(req,res);if(!lead)return;res.json({scenarios:await many(`SELECT f.*,l.project AS listing_project,a.name AS assumption_name,a.version AS assumption_version FROM financial_scenarios f LEFT JOIN listings l ON l.id=f.listing_id JOIN regulatory_assumption_versions a ON a.id=f.assumption_version_id WHERE f.lead_id=$1 ORDER BY f.created_at DESC`,[lead.id])});});
r.post('/crm/leads/:id/financial-scenarios',async(req,res)=>{
  const lead=await leadFor(req,res,true);if(!lead)return;const b=req.body||{},type=b.scenarioType;
  if(!['mortgage','roi'].includes(type)||!clean(b.scenarioName))return res.status(400).json({error:'scenarioType and scenarioName are required'});
  if(b.listingId&&!(await one('SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL',[b.listingId])))return res.status(400).json({error:'Listing not found'});
  const assumption=await one("SELECT * FROM regulatory_assumption_versions WHERE status='active'");if(!assumption)return res.status(409).json({error:'No active regulatory assumption version'});
  const output=type==='mortgage'?calculateMortgage(b.inputs||{}):calculateInvestmentReturns(b.inputs||{});if(output.error)return res.status(400).json({error:output.error});
  const id=uuid(),row=await one(`INSERT INTO financial_scenarios(id,lead_id,listing_id,scenario_type,scenario_name,input_snapshot,output_snapshot,currency,assumption_version_id,
    property_price,loan_amount,monthly_payment,gross_yield,net_yield,cash_on_cash_return,disclaimer,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,[id,lead.id,b.listingId||null,type,clean(b.scenarioName),JSON.stringify(b.inputs||{}),JSON.stringify(output),assumption.currency,assumption.id,output.propertyPrice||output.price,output.principal||null,output.monthlyPayment||null,output.grossYield||null,output.netYield||null,output.cashOnCashReturn||null,assumption.disclaimer,req.broker.id]);
  await audit('FinancialScenario',id,'created',req.broker.id,{leadId:lead.id,type,assumptionVersionId:assumption.id});res.status(201).json({...row,output});
});

export default r;
