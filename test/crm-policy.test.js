import test from 'node:test';
import assert from 'node:assert/strict';
import { hasInternalCrmIdentity,isCompanyReader,isManager,isProposalApprover,canApproveProposal,isCrmReadOnly,canReadLead,canWriteLead,canAssignLead,
  canReadOpportunity,canWriteOpportunity,canCreateOpportunity,leadScopeSql,agentWorkLeadScopeSql,opportunityScopeSql,proposalApprovalScopeSql,teamScopeSql,contactScopeSql,companyScopeSql } from '../src/crm-policy.js';

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

test('administrators and directors have assignment intervention while routine director writes remain restricted',()=>{
  const teamLead={assignedTo:'someone',assignedTeamId:'t1',createdBy:'other'};
  assert.equal(canWriteLead(director,teamLead),false);
  assert.equal(canAssignLead(director,teamLead),true);
  assert.equal(canWriteLead(manager,teamLead),true);
  assert.equal(canAssignLead(manager,teamLead),true);
  assert.equal(canAssignLead(manager,{...teamLead,assignedTeamId:'t2'}),false);
  assert.equal(canAssignLead(admin,{...teamLead,assignedTeamId:'t2'}),true);
});

test('proposal approval is team-scoped for managers and company-wide for directors',()=>{
  const managedLead={assignedTo:'agent',assignedTeamId:'t1',createdBy:'agent'};
  const otherLead={...managedLead,assignedTeamId:'t2'};
  assert.equal(isProposalApprover(manager),true);
  assert.equal(isProposalApprover(director),true);
  assert.equal(isProposalApprover(admin),false);
  assert.equal(isProposalApprover(agent),false);
  assert.equal(canApproveProposal(manager,managedLead),true);
  assert.equal(canApproveProposal(manager,otherLead),false);
  assert.equal(canApproveProposal(director,otherLead),true);
  assert.equal(canApproveProposal(admin,otherLead),false);
  assert.equal(canApproveProposal(agent,managedLead),false);
  assert.match(proposalApprovalScopeSql('l',manager,[]).clause,/membership_role='manager'/);
  assert.equal(proposalApprovalScopeSql('l',director,[]).clause,'1=1');
  assert.equal(proposalApprovalScopeSql('l',admin,[]).clause,'1=0');
  assert.equal(proposalApprovalScopeSql('l',agent,[]).clause,'1=0');
});

test('SQL scopes are parameterized and deny accountants',()=>{
  const lead=leadScopeSql('l',manager,[]);
  assert.match(lead.clause,/team_memberships/);
  assert.deepEqual(lead.params,['m']);
  const contact=contactScopeSql('c',accountant,[]);
  assert.equal(contact.clause,'1=0');
  assert.deepEqual(contact.params,[]);
});

test('Agent work areas contain assigned Leads only while governed management scopes remain unchanged',()=>{
  const agentWork=agentWorkLeadScopeSql('l',agent,[]),managerWork=agentWorkLeadScopeSql('l',manager,[]);
  assert.equal(agentWork.clause,'l.assigned_to=$1');
  assert.deepEqual(agentWork.params,['u']);
  assert.doesNotMatch(agentWork.clause,/created_by/);
  assert.match(managerWork.clause,/team_memberships/);
});

test('Sales Agents can list customers they own or serve through a scoped lead',()=>{
  const contact=contactScopeSql('c',agent,[]);
  assert.deepEqual(contact.params,['u']);
  assert.match(contact.clause,/c\.owner_id=\$1/);
  assert.match(contact.clause,/sl\.contact_id=c\.id/);
  assert.match(contact.clause,/sl\.assigned_to=\$1 OR sl\.created_by=\$1/);
  assert.equal((contact.clause.match(/\(/g)||[]).length,(contact.clause.match(/\)/g)||[]).length,'Sales Agent contact scope SQL must have balanced parentheses');
});

test('generated CRM visibility predicates keep balanced SQL parentheses',()=>{
  const scopes=[leadScopeSql('l',agent,[]),leadScopeSql('l',manager,[]),contactScopeSql('c',agent,[]),contactScopeSql('c',manager,[]),companyScopeSql('c',agent,[]),companyScopeSql('c',manager,[]),teamScopeSql('t',manager,[])];
  for(const scope of scopes)assert.equal((scope.clause.match(/\(/g)||[]).length,(scope.clause.match(/\)/g)||[]).length,scope.clause);
  assert.match(companyScopeSql('c',agent,[]).clause,/sl\.assigned_to=\$1 OR sl\.created_by=\$1/);
  assert.match(contactScopeSql('c',manager,[]).clause,/member\.broker_id=c\.owner_id/);
});

test('team selectors expose company scope to directors managed scope to managers and own team to agents',()=>{
  const directorScope=teamScopeSql('t',director,[]),managerScope=teamScopeSql('t',manager,[]),agentScope=teamScopeSql('t',agent,[]);
  assert.equal(directorScope.clause,'1=1');
  assert.match(managerScope.clause,/team_memberships/);assert.deepEqual(managerScope.params,['m']);
  assert.match(agentScope.clause,/t\.id=\$1/);assert.deepEqual(agentScope.params,['t1']);
});

test('opportunity scope follows owner team participation and finance boundaries',()=>{
  const owned={ownerId:'u',assignedTeamId:'t1',createdBy:'other',participantIds:[]};
  const managed={ownerId:'someone',assignedTeamId:'t3',createdBy:'other',participantIds:[]};
  const participated={ownerId:'someone',assignedTeamId:'t2',createdBy:'other',participantIds:['listing-user']};
  const listing={id:'listing-user',role:'internal_broker',jobRole:'listing_agent'};
  assert.equal(canReadOpportunity(agent,owned),true);
  assert.equal(canWriteOpportunity(agent,owned),true);
  assert.equal(canReadOpportunity(manager,managed),true);
  assert.equal(canWriteOpportunity(manager,managed),true);
  assert.equal(canReadOpportunity(director,managed),true);
  assert.equal(canWriteOpportunity(director,managed),false);
  assert.equal(canReadOpportunity(accountant,managed),false);
  assert.equal(canReadOpportunity(listing,participated),true);
  assert.equal(canWriteOpportunity(listing,participated),false);
  assert.equal(canCreateOpportunity(agent,{assignedTo:'u',createdBy:'other',assignedTeamId:'t1'}),true);
  assert.equal(canCreateOpportunity(listing,{assignedTo:'listing-user',createdBy:'other',assignedTeamId:'t1'}),false);
  assert.match(opportunityScopeSql('o',manager,[]).clause,/team_memberships/);
  assert.match(opportunityScopeSql('o',listing,[]).clause,/opportunity_participants/);
  assert.equal(opportunityScopeSql('o',accountant,[]).clause,'1=0');
});
