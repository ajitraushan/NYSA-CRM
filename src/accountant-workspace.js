import { many } from './db.js';
import { hasInternalCrmIdentity } from './crm-policy.js';
import { calculateExpectedCommission } from './commission-payout-domain.js';

// A purpose-specific read projection, not permission to use sales/Inventory APIs.
export function registerAccountantWorkspace(r) {
  const read = async (req,res) => {
    if (!hasInternalCrmIdentity(req.broker) || req.broker.jobRole !== 'accountant')
      return res.status(403).json({error:'Accountant workspace required'});
    const id=req.params.id||null;
    if(id&&!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))
      return res.status(400).json({error:'Valid Opportunity identifier required'});
    const q=String(req.query.q||'').trim().slice(0,100);
    const page=Math.max(1,Math.min(100000,parseInt(req.query.page,10)||1)),limit=25;
    const rows=await many(`SELECT o.id,o.opportunity_reference,o.title,o.stage,o.transaction_type,
      o.buyer_commission_percent,o.buyer_commission_minimum,o.seller_commission_percent,o.seller_commission_minimum,
      o.originating_agent_split_percent,o.servicing_agent_split_percent,
      d.id AS deal_id,d.deal_reference,d.status AS deal_status,d.agreed_value,d.currency,
      e.expected_company_receipt,c.confirmed_actual_received,
      COUNT(*) OVER()::int AS result_count
      FROM opportunities o
      LEFT JOIN LATERAL (SELECT id,deal_reference,status,agreed_value,currency FROM deals
        WHERE opportunity_id=o.id ORDER BY created_at DESC,id DESC LIMIT 1) d ON TRUE
      LEFT JOIN deal_commission_expectation_versions e ON e.deal_id=d.id AND e.status='frozen'
      LEFT JOIN LATERAL (SELECT confirmed_actual_received FROM opportunity_commission_confirmations
        WHERE finance_opportunity_id=o.id AND status='confirmed' ORDER BY confirmed_at DESC LIMIT 1) c ON TRUE
      WHERE ($1::uuid IS NULL OR o.id=$1) AND ($2='' OR o.opportunity_reference ILIKE '%'||$2||'%'
        OR d.deal_reference ILIKE '%'||$2||'%')
      ORDER BY o.created_at DESC,o.id LIMIT $3 OFFSET $4`,[id,q,limit,id?0:(page-1)*limit]);
    const count=rows[0]?.resultCount||0;
    const opportunities=rows.map(({resultCount,...row})=>{
      let agreedGrossCommission=null;
      if(row.dealId)try{agreedGrossCommission=calculateExpectedCommission(row).expectedGrossAmount;}catch{}
      return {...row,agreedGrossCommission};
    });
    if(id){if(!opportunities.length)return res.status(404).json({error:'Opportunity not found'});
      return res.json({opportunity:opportunities[0],readOnly:true});}
    res.json({opportunities,count,page,pageCount:Math.max(1,Math.ceil(count/limit)),readOnly:true});
  };
  r.get('/finance/accountant-opportunities',read);
  r.get('/finance/accountant-opportunities/:id',read);
}
