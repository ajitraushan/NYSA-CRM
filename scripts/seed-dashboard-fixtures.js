const database=process.env.PGDATABASE||'';
const password=process.env.DASHBOARD_TEST_PASSWORD||'';
if(!database.endsWith('_r1test'))throw new Error('REFUSED: dashboard test identities may only be created in a database ending _r1test');
if(process.env.ALLOW_DASHBOARD_TEST_DATA!=='YES')throw new Error('REFUSED: set ALLOW_DASHBOARD_TEST_DATA=YES to confirm isolated test-data creation');
if(password.length<12)throw new Error('DASHBOARD_TEST_PASSWORD must contain at least 12 characters');
const [{transaction,closeDatabase},{hashPassword}]=await Promise.all([import('../src/db.js'),import('../src/auth.js')]);

const ids={director:'d1000000-0000-4000-8000-000000000001',managerA:'d1000000-0000-4000-8000-000000000002',agentA1:'d1000000-0000-4000-8000-000000000003',agentA2:'d1000000-0000-4000-8000-000000000004',managerB:'d1000000-0000-4000-8000-000000000005',agentB1:'d1000000-0000-4000-8000-000000000006',teamA:'d2000000-0000-4000-8000-000000000001',teamB:'d2000000-0000-4000-8000-000000000002'};
const people=[
  [ids.director,'CORE Test Managing Director','core.test.director@example.invalid','director',null],
  [ids.managerA,'CORE Test Sales Manager','core.test.manager.a@example.invalid','manager',ids.teamA],
  [ids.agentA1,'CORE Test Agent A1','core.test.agent.a1@example.invalid','sales_agent',ids.teamA],
  [ids.agentA2,'CORE Test Agent A2','core.test.agent.a2@example.invalid','sales_agent',ids.teamA],
  [ids.managerB,'CORE Test Leasing Manager','core.test.manager.b@example.invalid','manager',ids.teamB],
  [ids.agentB1,'CORE Test Agent B1','core.test.agent.b1@example.invalid','listing_agent',ids.teamB]
];
const leads=[
  ['d4000000-0000-4000-8000-000000000001','Hot website buyer','Website','Sale','New','Hot',ids.teamA,ids.agentA1,'-2 hours','-30 minutes',null,'-1 day','SUMMER26'],
  ['d4000000-0000-4000-8000-000000000002','Warm referral buyer','Referral','Sale','Qualified','Warm',ids.teamA,ids.agentA1,'-4 days','+20 minutes','-3 days','+1 day','REFERRAL26'],
  ['d4000000-0000-4000-8000-000000000003','Unassigned portal enquiry','Property portal','Rental','New','Warm',ids.teamA,null,'-1 day','-1 hour',null,null,'PORTAL26'],
  ['d4000000-0000-4000-8000-000000000004','Stale negotiation','Current CRM','Commercial','Negotiation','Hot',ids.teamA,ids.agentA2,'-12 days','-11 days','-11 days',null,'RETENTION26'],
  ['d4000000-0000-4000-8000-000000000005','Won off-plan lead','Social media','Off-plan','Won','Warm',ids.teamA,ids.agentA2,'-6 days','-5 days','-5 days',null,'SOCIAL26'],
  ['d4000000-0000-4000-8000-000000000006','Leasing follow-up','Phone','Rental','Contacted','Cold',ids.teamB,ids.agentB1,'-3 days','-2 days','-2 days','-1 hour','LEASING26'],
  ['d4000000-0000-4000-8000-000000000007','Prior-period website lead','Website','Sale','Lost','Cold',ids.teamA,ids.agentA1,'-40 days','-39 days','-39 days',null,'SUMMER26']
];
const listings=[
  ['d6000000-0000-4000-8000-000000000001','CORE Verified Residence','Downtown','Available','-2 days','verified','+180 days','RERA-TEST-001','+120 days','ready'],
  ['d6000000-0000-4000-8000-000000000002','CORE Permit Attention','Business Bay','Available',null,'pending','+10 days','RERA-TEST-002','+15 days','not_ready'],
  ['d6000000-0000-4000-8000-000000000003','CORE Aging Inventory','Dubai Marina','Reserved','-20 days','expired','-1 day','RERA-TEST-003','-2 days','blocked']
];
const executiveMetrics=['new_leads','won_leads','hot_leads','sla_breaches','sla_risk','no_next_action','stale_risk','team_capacity_pressure','proposal_workload','customer_engagement','inventory_available','inventory_stale','inventory_readiness_exposure','operational_exceptions'];

await transaction(async client=>{
  const passwordHash=hashPassword(password);
  for(const [id,name,email,jobRole] of people)await client.query(`INSERT INTO brokers(id,name,email,brokerage,role,can_post,status,password_hash,job_role,preferred_language,timezone)
    VALUES($1,$2,$3,'NYSA Realty','internal_broker',1,'active',$4,$5,'English','Asia/Dubai') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,job_role=EXCLUDED.job_role,status='active'`,[id,name,email,passwordHash,jobRole]);
  await client.query(`INSERT INTO teams(id,name,manager_id,lead_response_hours,active) VALUES($1,'CORE Test Sales Team',$2,4,1) ON CONFLICT(id) DO UPDATE SET manager_id=EXCLUDED.manager_id,active=1`,[ids.teamA,ids.managerA]);
  await client.query(`INSERT INTO teams(id,name,manager_id,lead_response_hours,active) VALUES($1,'CORE Test Leasing Team',$2,4,1) ON CONFLICT(id) DO UPDATE SET manager_id=EXCLUDED.manager_id,active=1`,[ids.teamB,ids.managerB]);
  for(const [id,,,jobRole,teamId] of people)if(teamId){await client.query('UPDATE brokers SET team_id=$1 WHERE id=$2',[teamId,id]);await client.query(`INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($2,$1,$2,$3,$4) ON CONFLICT(team_id,broker_id) WHERE ends_at IS NULL DO UPDATE SET membership_role=EXCLUDED.membership_role`,[teamId,id,jobRole==='manager'?'manager':'member',ids.director]);}
  for(let index=0;index<leads.length;index++){
    const [leadId,title,source,business,stage,temp,teamId,agentId,createdOffset,acceptOffset,contactOffset,nextOffset,campaignCode]=leads[index],contactId=`d3000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`;
    await client.query(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by,source_first_seen) VALUES($1,$2,$3,'buyer',$4,$5,'Dashboard test fixture') ON CONFLICT(id) DO UPDATE SET full_name=EXCLUDED.full_name`,[contactId,`Test Customer ${index+1}`,`core.test.customer.${index+1}@example.invalid`,agentId,ids.director]);
    await client.query(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_team_id,assigned_to,assignment_status,next_follow_up_at,lost_reason,won_at,closed_at,created_by,created_at,updated_at,received_at,accepted_at,first_contact_at,original_acceptance_due_at,first_contact_due_at,acceptance_due_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()+$11::interval,$12,CASE WHEN $6='Won' THEN NOW() ELSE NULL END,CASE WHEN $6 IN('Won','Lost') THEN NOW() ELSE NULL END,$13,NOW()+$14::interval,CASE WHEN $3='Stale negotiation' THEN NOW()-INTERVAL '9 days' ELSE NOW()+$14::interval END,NOW()+$14::interval,CASE WHEN $9::uuid IS NULL THEN NULL ELSE NOW()+$15::interval END,NOW()+$16::interval,NOW()+$15::interval,NOW()+$15::interval,NOW()+$15::interval)
      ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,stage=EXCLUDED.stage,temperature=EXCLUDED.temperature,assigned_team_id=EXCLUDED.assigned_team_id,assigned_to=EXCLUDED.assigned_to,next_follow_up_at=EXCLUDED.next_follow_up_at,created_at=EXCLUDED.created_at,updated_at=EXCLUDED.updated_at,accepted_at=EXCLUDED.accepted_at,first_contact_at=EXCLUDED.first_contact_at,acceptance_due_at=EXCLUDED.acceptance_due_at,first_contact_due_at=EXCLUDED.first_contact_due_at`,[leadId,contactId,title,source,business,stage,temp,teamId,agentId,agentId?'assigned':'unassigned',nextOffset,stage==='Lost'?'Test fixture: not proceeding':null,ids.director,createdOffset,acceptOffset,contactOffset]);
    await client.query('UPDATE leads SET campaign_code=$1 WHERE id=$2',[campaignCode,leadId]);
    if(index<3)await client.query(`INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,priority,status,due_at,created_by) VALUES($1,$2,$3,$4,$5,$6,'open',NOW()+$7::interval,$8) ON CONFLICT(id) DO UPDATE SET due_at=EXCLUDED.due_at,status='open'`,[`d5000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,leadId,contactId,`Dashboard test task ${index+1}`,agentId||ids.agentA2,index===0?'urgent':'normal',index===0?'-1 hour':index===1?'+3 hours':'+1 day',ids.director]);
  }
  await client.query(`INSERT INTO activities(id,lead_id,contact_id,activity_type,subject,direction,outcome,owner_id,created_by,created_at,duration_seconds,follow_up_required,lead_stage_snapshot,qualification_snapshot) VALUES('d9000000-0000-4000-8000-000000000001',$1,'d3000000-0000-4000-8000-000000000001','Call','Dashboard test call','Outbound','Connected',$2,$3,NOW()-INTERVAL '1 hour',180,1,'New','Hot') ON CONFLICT(id) DO UPDATE SET created_at=EXCLUDED.created_at,follow_up_required=EXCLUDED.follow_up_required`,[leads[0][0],ids.agentA1,ids.director]);
  await client.query(`INSERT INTO proposals(id,lead_id,contact_id,template_type,title,status,created_by,created_at,updated_at) VALUES('da000000-0000-4000-8000-000000000001',$1,'d3000000-0000-4000-8000-000000000001','property_proposal','Dashboard draft proposal','draft',$2,NOW()-INTERVAL '2 hours',NOW()-INTERVAL '2 hours'),('da000000-0000-4000-8000-000000000002',$3,'d3000000-0000-4000-8000-000000000002','property_proposal','Dashboard sent proposal','sent',$2,NOW()-INTERVAL '3 hours',NOW()-INTERVAL '30 minutes') ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,[leads[0][0],ids.director,leads[1][0]]);
  for(let index=0;index<listings.length;index++){
    const [id,project,area,status,confirmedOffset,verificationStatus,verificationOffset,permitNumber,permitOffset,portalStatus]=listings[index];
    await client.query(`INSERT INTO listings(id,project,developer,area,property_type,bedrooms,price,currency,status,exclusivity_tier,posted_by,availability_confirmed_at,verification_status,verification_expires_at,permit_number,permit_expires_at,portal_status,updated_at)
      VALUES($1,$2,'CORE Test Developer',$3,'Apartment','2',$4,'AED',$5,'Exclusive to Nysa',$6,NOW()+$7::interval,$8,NOW()+$9::interval,$10,NOW()+$11::interval,$12,CASE WHEN $2='CORE Aging Inventory' THEN NOW()-INTERVAL '45 days' ELSE NOW() END)
      ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,availability_confirmed_at=EXCLUDED.availability_confirmed_at,verification_status=EXCLUDED.verification_status,verification_expires_at=EXCLUDED.verification_expires_at,permit_expires_at=EXCLUDED.permit_expires_at,portal_status=EXCLUDED.portal_status,updated_at=EXCLUDED.updated_at`,[id,project,area,1200000+index*250000,status,ids.director,confirmedOffset,verificationStatus,verificationOffset,permitNumber,permitOffset,portalStatus]);
  }
  for(let index=0;index<executiveMetrics.length;index++)await client.query(`INSERT INTO dashboard_targets(id,metric_code,scope_type,scope_id,period_start,period_end,target_value,unit,definition,status,exception_threshold,threshold_direction,benchmark_source,created_by)
    VALUES($1,$2,'company',NULL,'2026-01-01','2027-12-31',$3,$4,$5,'active',$6,$7,'CORE Release 1 test benchmark',$8) ON CONFLICT(id) DO UPDATE SET target_value=EXCLUDED.target_value,exception_threshold=EXCLUDED.exception_threshold,benchmark_source=EXCLUDED.benchmark_source`,[`d7000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,executiveMetrics[index],10,executiveMetrics[index].startsWith('inventory_')?'properties':executiveMetrics[index].includes('exception')?'exceptions':'leads',`Controlled test definition for ${executiveMetrics[index]}`,5,['new_leads','won_leads','hot_leads','inventory_available'].includes(executiveMetrics[index])?'low_bad':'high_bad',ids.director]);
  for(const [index,metricCode,value] of [['1','sla_risk',1],['2','team_capacity_pressure',0],['3','proposal_workload',2],['4','customer_engagement',3],['5','inventory_available',2],['6','inventory_stale',0],['7','inventory_readiness_exposure',2]])await client.query(`INSERT INTO dashboard_metric_snapshots(id,metric_code,scope_type,scope_id,snapshot_date,value) VALUES($1,$2,'company','',CURRENT_DATE-INTERVAL '30 days',$3) ON CONFLICT(metric_code,scope_type,scope_id,snapshot_date) DO UPDATE SET value=EXCLUDED.value`,[`d8000000-0000-4000-8000-${index.padStart(12,'0')}`,metricCode,value]);
});
await closeDatabase();
console.log(`DASHBOARD_TEST_DATA_READY in ${database}`);
for(const [,name,email,role] of people)console.log(`${role.padEnd(13)} ${email}  (${name})`);
