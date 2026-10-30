import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import {
  listWebIntakeDesk,pickupWebIntake,promoteRecoveryCase,reconcileWebIntake,recordWebIntakeJourney,recordWebIntakeTaskOutcome
} from '../src/web-intake-workflow.js';

const enabled=process.env.NYSA_WEB_INTAKE_DB_TEST==='local-synthetic';
const uuid=()=>crypto.randomUUID();

test('Phase 1 WEB intake lifecycle on the guarded PostgreSQL fixture',{skip:!enabled},async()=>{
  const pool=new pg.Pool();
  const client=await pool.connect();
  try{
    const identity=(await client.query('SELECT current_database() AS database,current_user AS username')).rows[0];
    assert.deepEqual(identity,{database:'nysa_test_fixture',username:'nysa_test_user'});
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO nysa_test_user,public');
    const ids={actor:uuid(),owner:uuid(),manager:uuid(),team:uuid(),event:uuid()};
    await client.query("INSERT INTO teams(id,name) VALUES($1,'Synthetic WEB Intake Team')",[ids.team]);
    await client.query(`INSERT INTO brokers(id,name,email,role,job_role,password_hash,status,team_id)
      VALUES($1,'Synthetic WEB Intake Actor','web-intake-actor@example.invalid','admin','admin','synthetic-not-a-password','active',NULL),
      ($2,'Synthetic WEB Intake Owner','web-intake-owner@example.invalid','internal_broker','sales_agent','synthetic-not-a-password','active',$3),
      ($4,'Synthetic WEB Intake Manager','web-intake-manager@example.invalid','internal_broker','manager','synthetic-not-a-password','active',$3)`,
    [ids.actor,ids.owner,ids.team,ids.manager]);
    const payload={eventId:`synthetic-web-${uuid()}`,sourceWebsite:'staging.nysarealty.com',source:'Website',form:'ai_buyer_profile',
      intakeMode:'multi_step',intakeCompleteness:'partial',journeyKey:`synthetic-journey-${uuid()}`,title:'Synthetic WEB intake',businessType:'Sale',
      contact:{fullName:'Synthetic Intake Customer',email:'synthetic-intake@example.invalid',phone:'+971500000099',preferredChannel:'Email'},
      requirement:{purpose:null,propertyTypes:['Apartment'],areas:['Synthetic Area'],budgetMin:null,budgetMax:null,fundingMethod:'unknown',timelineCode:null},
      consent:{marketing:false,aiWhatsapp:false,aiEmail:false,statementVersion:'synthetic-v1'},
      location:{country:'AE',timeZone:'Asia/Dubai',confirmed:true}};
    await client.query(`INSERT INTO website_intake_events(id,event_id,payload_hash,status,received_payload)
      VALUES($1,$2,$3,'processing',$4::jsonb)`,[ids.event,payload.eventId,'a'.repeat(64),JSON.stringify(payload)]);
    const secrets={WEB_INTAKE_IDENTITY_KEY:'1'.repeat(64),WEB_INTAKE_MATCH_KEY:'synthetic-match-key-that-is-long-enough-for-tests',WEB_INTAKE_MATCH_KEY_VERSION:'test-v1'};
    const event={id:ids.event,eventId:payload.eventId,receivedAt:new Date(),payloadHash:'a'.repeat(64)};
    const normalized={email:payload.contact.email,phone:payload.contact.phone,emailStatus:'format_valid',phoneStatus:'unverified'};
    const saved=await recordWebIntakeJourney({event,payload,identity:normalized,actorId:ids.actor},client,secrets);
    assert.equal(saved.status,'in_progress');
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM contacts')).rows[0].n,0);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM leads')).rows[0].n,0);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM lead_follow_up_cases')).rows[0].n,0);

    await client.query("UPDATE web_intake_journeys SET resume_expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[saved.journeyId]);
    const reconciled=await reconcileWebIntake({actorId:ids.actor},client);assert.equal(reconciled.dropped,1);
    const dropped=(await client.query('SELECT * FROM lead_follow_up_cases WHERE journey_id=$1',[saved.journeyId])).rows[0];
    assert.equal(dropped.case_kind,'incomplete_recovery');assert.equal(dropped.fallback_owner_id,null);assert.equal(dropped.lead_id,null);

    const broker={id:ids.owner,role:'internal_broker',jobRole:'sales_agent'};
    const picked=await pickupWebIntake(dropped.id,broker,client,secrets);
    assert.equal(picked.leadId,null);assert.ok(picked.taskId);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM contacts')).rows[0].n,1);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM leads')).rows[0].n,0);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM tasks WHERE follow_up_case_id=$1 AND is_primary_next_action AND status='open'",[dropped.id])).rows[0].n,1);

    const promoted=await promoteRecoveryCase(dropped.id,{customerConfirmed:true,requirement:{purpose:'investment',propertyTypes:['Apartment'],
      areas:['Synthetic Area'],budgetMin:900000,budgetMax:1200000,fundingMethod:'cash',timelineCode:'0_3_months'}},broker,client);
    assert.ok(promoted.leadId);assert.ok(promoted.taskId);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM lead_requirements WHERE lead_id=$1',[promoted.leadId])).rows[0].n,1);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM tasks WHERE follow_up_case_id=$1 AND is_primary_next_action AND status='open'",[dropped.id])).rows[0].n,1);

    const outcome=await recordWebIntakeTaskOutcome(promoted.taskId,{outcome:'no_answer',notes:'Synthetic test outcome'},broker,client);
    assert.ok(outcome.successorTaskId);
    assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM web_intake_contact_attempts WHERE case_id=$1',[dropped.id])).rows[0].n,2);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM tasks WHERE follow_up_case_id=$1 AND is_primary_next_action AND status='open'",[dropped.id])).rows[0].n,1);

    const completeEventId=uuid(),completePayload={...payload,eventId:`synthetic-complete-${uuid()}`,form:'contact_enquiry_v2',intakeMode:'single_step',
      intakeCompleteness:'complete',journeyKey:`synthetic-complete-journey-${uuid()}`,
      customerObjective:'buy',marketStageRequirement:'ready_secondary',propertySegmentRequirement:'residential',
      contact:{fullName:'Synthetic Completed Customer',email:'synthetic-completed@example.invalid',phone:'+971500000098',preferredChannel:'Phone'},
      requirement:{purpose:'own_use',propertyTypes:['Apartment'],areas:['Synthetic Community'],budgetMin:1000000,budgetMax:1400000,
        fundingMethod:'mortgage',timelineCode:'3_6_months',bedroomsMin:2,bedroomsMax:3,readiness:'ready'}};
    await client.query(`INSERT INTO website_intake_events(id,event_id,payload_hash,status,received_payload)
      VALUES($1,$2,$3,'processing',$4::jsonb)`,[completeEventId,completePayload.eventId,'b'.repeat(64),JSON.stringify(completePayload)]);
    const completed=await recordWebIntakeJourney({event:{id:completeEventId,eventId:completePayload.eventId,receivedAt:new Date(),payloadHash:'b'.repeat(64)},
      payload:completePayload,identity:{email:completePayload.contact.email,phone:completePayload.contact.phone,emailStatus:'format_valid',phoneStatus:'unverified'},
      actorId:ids.actor},client,secrets);
    assert.equal(completed.status,'completed_unassigned');assert.equal(completed.leadId,null);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM leads WHERE external_source_id=$1",[`web-intake:${completed.journeyId}`])).rows[0].n,0);
    const completedPickup=await pickupWebIntake(completed.caseId,broker,client,secrets);assert.equal(completedPickup.leadId,null);
    assert.equal((await client.query("SELECT COUNT(*)::int AS n FROM leads WHERE external_source_id=$1",[`web-intake:${completed.journeyId}`])).rows[0].n,0);
    assert.equal((await listWebIntakeDesk(broker,{view:'all',source:'all',campaign:'all'},client)).some(item=>item.follow_up_case_id===completed.caseId),false);
    assert.equal((await listWebIntakeDesk(broker,{view:'assigned',source:'all',campaign:'all'},client)).some(item=>item.follow_up_case_id===completed.caseId),true);
    const completedPromotion=await promoteRecoveryCase(completed.caseId,{customerConfirmed:true,requirement:completePayload.requirement},broker,client);
    assert.ok(completedPromotion.leadId);
    const completedRequirement=(await client.query(`SELECT purpose,property_types,areas,bedrooms_min,bedrooms_max,timeline_code,funding_method
      FROM lead_requirements WHERE lead_id=$1`,[completedPromotion.leadId])).rows[0];
    assert.deepEqual(completedRequirement,{purpose:'own_use',property_types:['Apartment'],areas:['Synthetic Community'],bedrooms_min:'2',bedrooms_max:'3',
      timeline_code:'3_6_months',funding_method:'mortgage'});
    await client.query("UPDATE lead_follow_up_cases SET last_contact_attempt_at=NULL,stale_notice_due_at=NOW()-INTERVAL '1 minute',stale_release_due_at=NOW()+INTERVAL '30 minutes' WHERE id=$1",[completed.caseId]);
    const notified=await reconcileWebIntake({actorId:ids.actor},client);assert.equal(notified.staleNotified,1);
    const notices=(await client.query("SELECT assignee_id,task_kind FROM tasks WHERE follow_up_case_id=$1 AND task_kind IN ('stale_owner_notice','intake_escalation')",[completed.caseId])).rows;
    assert.ok(notices.some(item=>item.assignee_id===ids.owner&&item.task_kind==='stale_owner_notice'));
    assert.ok(notices.some(item=>item.assignee_id===ids.manager&&item.task_kind==='intake_escalation'));
    await client.query("UPDATE lead_follow_up_cases SET stale_release_due_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[completed.caseId]);
    const released=await reconcileWebIntake({actorId:ids.actor},client);assert.equal(released.released,1);
    assert.deepEqual((await client.query('SELECT state,fallback_owner_id,previous_owner_id FROM lead_follow_up_cases WHERE id=$1',[completed.caseId])).rows[0],
      {state:'released',fallback_owner_id:null,previous_owner_id:ids.owner});

    const invalidEventId=uuid(),invalidPayload={...completePayload,eventId:`synthetic-invalid-${uuid()}`,journeyKey:`synthetic-invalid-journey-${uuid()}`,
      contact:{...completePayload.contact,email:'synthetic-invalid@example.invalid',phone:'+971500000097'}};
    await client.query(`INSERT INTO website_intake_events(id,event_id,payload_hash,status,received_payload)
      VALUES($1,$2,$3,'processing',$4::jsonb)`,[invalidEventId,invalidPayload.eventId,'c'.repeat(64),JSON.stringify(invalidPayload)]);
    const invalid=await recordWebIntakeJourney({event:{id:invalidEventId,eventId:invalidPayload.eventId,receivedAt:new Date(),payloadHash:'c'.repeat(64)},
      payload:invalidPayload,identity:{email:invalidPayload.contact.email,phone:invalidPayload.contact.phone,emailStatus:'format_valid',phoneStatus:'format_valid'},
      actorId:ids.actor},client,secrets);
    const invalidPickup=await pickupWebIntake(invalid.caseId,broker,client,secrets);
    const closed=await recordWebIntakeTaskOutcome(invalidPickup.taskId,{outcome:'not_genuine',notes:'Synthetic closure evidence'},broker,client);
    assert.equal(closed.state,'closed');
    const closedHistory=await listWebIntakeDesk(broker,{view:'closed',source:'contact_form',campaign:'all'},client);
    assert.ok(closedHistory.some(item=>item.follow_up_case_id===invalid.caseId&&item.close_outcome==='not_genuine'&&item.closed_at));
    await client.query('ROLLBACK');
  }catch(error){
    await client.query('ROLLBACK').catch(()=>{});throw error;
  }finally{client.release();await pool.end();}
});
