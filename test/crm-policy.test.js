import test from 'node:test';
import assert from 'node:assert/strict';
import { hasInternalCrmIdentity,isCompanyReader,isManager,isCrmReadOnly,canReadLead,canWriteLead,canAssignLead,
  leadScopeSql,contactScopeSql } from '../src/crm-policy.js';

const admin={id:'a',role:'admin',jobRole:'admin'};
const director={id:'d',role:'internal_broker',jobRole:'director'};
const manager={id:'m',role:'internal_broker',jobRole:'manager',teamId:'t1',managedTeamIds:['t1','t3']};
const agent={id:'u',role:'internal_broker',jobRole:'sales_agent',teamId:'t1'};
const accountant={id:'x',role:'internal_broker',jobRole:'accountant'};

test('internal CRM identity requires an approved access and job role',()=>{
  assert.equal(hasInternalCrmIdentity(admin),true);
  assert.equal(hasInternalCrmIdentity({role:'partner_broker',jobRole:null}),false);
  assert.equal(hasInternalCrmIdentity({role:'internal_broker',jobRole:null}),false);
});

test('company readers and read-only roles are explicit',()=>{
  assert.equal(isCompanyReader(admin),true);
  assert.equal(isCompanyReader(director),true);
  assert.equal(isManager(manager),true);
  assert.equal(isManager(director),false);
  assert.equal(isCrmReadOnly(director),true);
  assert.equal(isCrmReadOnly(accountant),true);
});

test('lead access follows company, team, and own-record scope',()=>{
  const teamLead={assignedTo:'someone',assignedTeamId:'t1',createdBy:'other'};
  const otherLead={assignedTo:'someone',assignedTeamId:'t2',createdBy:'other'};
  assert.equal(canReadLead(admin,otherLead),true);
  assert.equal(canReadLead(director,otherLead),true);
  assert.equal(canReadLead(manager,teamLead),true);
  assert.equal(canReadLead(manager,{...teamLead,assignedTeamId:'t3'}),true);
  assert.equal(canReadLead(manager,otherLead),false);
  assert.equal(canReadLead(agent,{...otherLead,assignedTo:'u'}),true);
  assert.equal(canReadLead(accountant,teamLead),false);
});

test('write and assignment rights exclude directors and cross-team managers',()=>{
  const teamLead={assignedTo:'someone',assignedTeamId:'t1',createdBy:'other'};
  assert.equal(canWriteLead(director,teamLead),false);
  assert.equal(canWriteLead(manager,teamLead),true);
  assert.equal(canAssignLead(manager,teamLead),true);
  assert.equal(canAssignLead(manager,{...teamLead,assignedTeamId:'t2'}),false);
  assert.equal(canAssignLead(admin,{...teamLead,assignedTeamId:'t2'}),true);
});

test('SQL scopes are parameterized and deny accountants',()=>{
  const lead=leadScopeSql('l',manager,[]);
  assert.match(lead.clause,/team_memberships/);
  assert.deepEqual(lead.params,['m']);
  const contact=contactScopeSql('c',accountant,[]);
  assert.equal(contact.clause,'1=0');
  assert.deepEqual(contact.params,[]);
});
