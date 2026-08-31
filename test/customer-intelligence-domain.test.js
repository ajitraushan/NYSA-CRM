import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerPriorityCase,sortCustomerPriorityCases,buildCustomer360Profile } from '../src/customer-intelligence-domain.js';

const now=new Date('2026-08-01T08:00:00Z');
const base={leadId:'lead-1',customerName:'Aisha',assignedTo:'agent-1',acceptedAt:'2026-08-01T06:00:00Z',firstContactAt:'2026-08-01T06:15:00Z',receivedAt:'2026-08-01T05:50:00Z',requirementCount:1,qualificationCount:1,temperature:'Warm'};

test('R3A-BROKER-PRIORITY-46A hard deadlines always outrank AI-eligible potential',()=>{
  const urgent=buildCustomerPriorityCase({...base,leadId:'urgent',dueAt:'2026-08-01T07:55:00Z'},now);
  const potential=buildCustomerPriorityCase({...base,leadId:'potential',dueAt:'2026-08-03T08:00:00Z'},now);
  assert.equal(urgent.priorityBand,'immediate');assert.match(urgent.whyNow[0],/overdue/i);
  assert.equal(potential.priorityBand,'high_potential');
  assert.deepEqual(sortCustomerPriorityCases([potential,urgent],now).map(x=>x.leadId),['urgent','potential']);
});

test('R3A-BROKER-PRIORITY-46A new enquiries explain the missing governed step',()=>{
  const offered=buildCustomerPriorityCase({...base,acceptedAt:null,firstContactAt:null,dueAt:'2026-08-01T10:00:00Z'},now);
  assert.equal(offered.priorityBand,'new_enquiry');assert.equal(offered.suggestedAction.code,'accept_assignment');assert.match(offered.whyNow.join(' '),/not been accepted/i);
  const contacted=buildCustomerPriorityCase({...base,requirementCount:0,qualificationCount:0,dueAt:null},now);
  assert.equal(contacted.suggestedAction.code,'capture_requirements');assert.match(contacted.whyNow.join(' '),/requirements/i);
});

test('R3A-BROKER-PRIORITY-46A communication restrictions are immediate and never suggest contact as safe',()=>{
  const restricted=buildCustomerPriorityCase({...base,doNotContact:true,dueAt:'2026-08-03T08:00:00Z'},now);
  assert.equal(restricted.priorityBand,'immediate');assert.equal(restricted.suggestedAction.code,'review_contact_restriction');assert.doesNotMatch(restricted.suggestedAction.label,/contact the customer/i);assert.match(restricted.consequence,/must not proceed/i);
});

test('overdue and enquiry ages use readable minutes, hours, days and weeks',()=>{
  const overdue=buildCustomerPriorityCase({...base,dueAt:'2026-07-18T08:00:00Z'},now);
  assert.match(overdue.whyNow[0],/overdue by 2 weeks/i);
  assert.doesNotMatch(overdue.whyNow[0],/\d{4,} minutes/i);
  const enquiry=buildCustomerPriorityCase({...base,acceptedAt:null,firstContactAt:null,receivedAt:'2026-07-11T08:00:00Z',dueAt:null},now);
  assert.match(enquiry.whyNow.join(' '),/3 weeks ago/i);
});

test('R3A-PROFILE-46 builds Customer 360 from authoritative pursuits without hidden profiling',()=>{
  const profile=buildCustomer360Profile({customer:{id:'customer-1',fullName:'Aisha',email:'a@example.com',phone:'+971500000000',emailStatus:'format_valid',phoneStatus:'format_valid'},effectiveConsent:true,pursuits:[{id:'lead-1',leadStage:'Qualified',currentStatus:'active',businessType:'Sale',temperature:'Warm',requirementId:'req-1',qualificationId:'qa-1'}]},now);
  assert.equal(profile.activePursuitCount,1);assert.equal(profile.primaryPursuit.id,'lead-1');assert.equal(profile.contactQuality,'format valid');assert.deepEqual(profile.missingInformation,[]);assert.equal(profile.source,'authoritative_records');
});
