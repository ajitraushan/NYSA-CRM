import { Router } from '../lib/http-kit.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity,isManager } from '../crm-policy.js';
import { many } from '../db.js';
import { loadActiveClassificationCatalogue } from '../classification-catalogue.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'CRM classification is restricted to NYSA staff'}));

r.get('/crm/classification-catalogue/active',async(req,res)=>res.json(await loadActiveClassificationCatalogue()));
r.get('/crm/classification-exceptions',async(req,res)=>{
  if(req.broker.role!=='admin'&&!isManager(req.broker))return res.status(403).json({error:'Manager or Administrator access required'});
  const exceptions=await many(`SELECT e.id,e.lead_id,e.source_field,e.source_value,e.reason_code,e.status,e.created_at,l.lead_reference
    FROM classification_legacy_exceptions e JOIN leads l ON l.id=e.lead_id
    WHERE e.status='pending' ORDER BY e.created_at,e.id`);
  res.json({exceptions});
});

export default r;
