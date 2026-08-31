import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DB_INTEGRATION==='1';

test('M-04/J POST coordinated reassignment preserves an Accepted Offer in PostgreSQL',{
  skip:enabled?false:'Set NYSA_RUN_DB_INTEGRATION=1 with dedicated PostgreSQL test credentials'
},async()=>{
  const required=['PGDATABASE','PGUSER','PGPASSWORD'];
  for(const name of required)assert.ok(process.env[name],`${name} is required`);
  assert.match(process.env.PGDATABASE,/test|fixture|ci/i,'Refusing to mutate a database not explicitly named as test, fixture or CI');

  const [{createApp},{default:crmRoutes},database]=await Promise.all([
    import('../src/lib/http-kit.js'),
    import('../src/routes/crm.js'),
    import('../src/db.js')
  ]);
  const {db,execute,one,closeDatabase}=database;
  const id=()=>crypto.randomUUID();
  const token=crypto.randomBytes(32).toString('hex');
  const sessionHash=crypto.createHash('sha256').update(token).digest('hex');
  const fixture={
    admin:id(),oldAgent:id(),newAgent:id(),team:id(),contact:id(),lead:id(),listing:id(),opportunity:id(),offer:id()
  };
  const prefix=`dev154-reassignment-${fixture.opportunity.slice(0,8)}`;
  let server;

  try{
    const latest=await one("SELECT version FROM schema_migrations WHERE version='099_dev153_inventory_assignment_lifecycle.sql'");
    assert.equal(latest?.version,'099_dev153_inventory_assignment_lifecycle.sql','Dedicated database must be migrated through 099');

    await execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role)
      VALUES($1,$2,$3,'admin','active','integration-only','admin'),
            ($4,$5,$6,'internal_broker','active','integration-only','sales_agent'),
            ($7,$8,$9,'internal_broker','active','integration-only','sales_agent')`,[
      fixture.admin,`${prefix} admin`,`${prefix}-admin@example.invalid`,
      fixture.oldAgent,`${prefix} original agent`,`${prefix}-old@example.invalid`,
      fixture.newAgent,`${prefix} new agent`,`${prefix}-new@example.invalid`
    ]);
    await execute('INSERT INTO teams(id,name,manager_id,active) VALUES($1,$2,$3,1)',[fixture.team,`${prefix} team`,fixture.admin]);
    await execute('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[fixture.team,[fixture.admin,fixture.oldAgent,fixture.newAgent]]);
    await execute(`INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by)
      VALUES($1,$2,$3,'manager',$3),($4,$2,$5,'member',$3),($6,$2,$7,'member',$3)`,[
      id(),fixture.team,fixture.admin,id(),fixture.oldAgent,id(),fixture.newAgent
    ]);
    await execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by)
      VALUES($1,$2,$3,'buyer',$4,$4)`,[fixture.contact,`${prefix} customer`,`${prefix}-customer@example.invalid`,fixture.oldAgent]);
    await execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_team_id,assigned_to,created_by)
      VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$5,$5)`,[
      fixture.lead,fixture.contact,`${prefix} lead`,fixture.team,fixture.oldAgent
    ]);
    await execute(`INSERT INTO listings(id,inventory_headline,project,area,property_type,price,currency,status,posted_by,responsible_agent_id,originating_agent_id)
      VALUES($1,$2,$3,'Integration Test Area','Apartment',1000000,'AED','Available',$4,$4,$4)`,[
      fixture.listing,`${prefix} inventory`,`${prefix} project`,fixture.oldAgent
    ]);
    await execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,listing_id,assigned_team_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'Sale','Offer','Continue accepted offer servicing',NOW()+INTERVAL '1 day','follow_up_offer_feedback',$7)`,[
      fixture.opportunity,`NYSA-OP-TEST-${fixture.opportunity.slice(0,8)}`,fixture.lead,fixture.contact,fixture.listing,
      fixture.team,fixture.oldAgent,`${prefix} opportunity`
    ]);
    await execute(`INSERT INTO offers(id,offer_reference,opportunity_id,listing_id,offer_type,status,currency,owner_id,accepted_at,created_by)
      VALUES($1,$2,$3,$4,'purchase','accepted','AED',$5,NOW(),$5)`,[
      fixture.offer,`NYSA-OF-TEST-${fixture.offer.slice(0,8)}`,fixture.opportunity,fixture.listing,fixture.oldAgent
    ]);
    await execute('INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL \'1 hour\')',[sessionHash,fixture.admin]);

    const before=await one('SELECT id,status,owner_id,created_by,withdrawn_at FROM offers WHERE id=$1',[fixture.offer]);
    const app=createApp();
    app.mount('/api',crmRoutes);
    server=await new Promise((resolve,reject)=>{
      const listening=app.listen(0,()=>resolve(listening));
      listening.once('error',reject);
    });
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/crm/leads/${fixture.lead}/coordinated-reassignment`,{
      method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
      body:JSON.stringify({includeLead:false,opportunityIds:[fixture.opportunity],opportunityVersions:{[fixture.opportunity]:1},
        assignedTo:fixture.newAgent,assignedTeamId:fixture.team,reason:'Integration proof of servicing-agent reassignment'})
    });
    const payload=await response.json();
    assert.equal(response.status,200,JSON.stringify(payload));
    assert.deepEqual(payload.opportunityIds,[fixture.opportunity]);

    const after=await one('SELECT id,status,owner_id,created_by,withdrawn_at FROM offers WHERE id=$1',[fixture.offer]);
    assert.equal(after.id,before.id,'Offer ID must not change');
    assert.equal(after.status,'accepted','Accepted status must remain unchanged');
    assert.equal(after.ownerId,fixture.newAgent,'Current servicing ownership must move to the new agent');
    assert.equal(after.createdBy,before.createdBy,'Original Offer authorship must remain unchanged');
    assert.equal(after.withdrawnAt,before.withdrawnAt,'Withdrawal timestamp must remain unchanged');
    const withdrawn=await one("SELECT COUNT(*)::int AS count FROM negotiation_events WHERE offer_id=$1 AND event_type='withdrawn'",[fixture.offer]);
    assert.equal(withdrawn.count,0,'Reassignment must not create a withdrawn event');
    const currentOpportunity=await one('SELECT owner_id,version FROM opportunities WHERE id=$1',[fixture.opportunity]);
    assert.equal(currentOpportunity.ownerId,fixture.newAgent);
    assert.equal(currentOpportunity.version,2);
    const audit=await one("SELECT action,details FROM audit_log WHERE entity_type='OpportunityAssignment' AND action='servicing_agent_reassigned' AND details::jsonb->>'opportunityId'=$1 ORDER BY timestamp DESC LIMIT 1",[fixture.opportunity]);
    assert.equal(audit?.action,'servicing_agent_reassigned');
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await db.query('DELETE FROM sessions WHERE broker_id=$1',[fixture.admin]).catch(()=>{});
    // This test is intentionally restricted to a disposable database because immutable audit/history
    // triggers correctly prevent complete fixture erasure. The surrounding harness must drop it.
    await closeDatabase();
  }
});
