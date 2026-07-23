import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePropertyMatch,validateMatchDecision,validateViewingCreate,validateViewingOutcome,buildViewingIcs } from '../src/matching-viewing-domain.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..'),read=path=>readFileSync(join(root,path),'utf8');

test('R2.2 match rationale and exception evidence are explicit',()=>{
  assert.match(validatePropertyMatch({}).error,/approved property/);
  assert.match(validatePropertyMatch({listingId:'l1',fitStatus:'exception',rationale:'Location works'}).error,/material fit exception/);
  assert.equal(validatePropertyMatch({listingId:'l1',fitStatus:'strong_fit',rationale:'Budget and location match'}).value.matchSource,'manual');
  assert.match(validateMatchDecision({shortlistStatus:'rejected',expectedVersion:1}).error,/rejection reason/);
  assert.equal(validateMatchDecision({shortlistStatus:'shortlisted',expectedVersion:2}).value.status,'shortlisted');
});

test('R2.2 viewing validation requires bounded scheduling and complete outcomes',()=>{
  assert.match(validateViewingCreate({propertyMatchId:'m1',startsAt:'2026-07-24T10:00:00+04:00',endsAt:'2026-07-24T09:00:00+04:00',timezone:'Asia/Dubai',location:'Dubai Marina',instructions:'Tower lobby'}).error,/start date and duration/);
  assert.match(validateViewingCreate({propertyMatchId:'m1',startsAt:'2026-07-24T10:00:00+04:00',endsAt:'2026-07-24T11:00:00+04:00',timezone:'Asia/Dubai',location:'Dubai Marina'}).error,/address and meeting point/);
  const viewing=validateViewingCreate({propertyMatchId:'m1',startsAt:'2026-07-24T10:00:00+04:00',endsAt:'2026-07-24T11:00:00+04:00',timezone:'Asia/Dubai',location:'Dubai Marina',instructions:'Tower lobby',clientMessage:'Please arrive ten minutes early.',attendees:[{guestName:'Owner'}]});
  assert.equal(viewing.value.attendees.length,1);
  assert.equal(viewing.value.clientMessage,'Please arrive ten minutes early.');
  assert.match(validateViewingCreate({propertyMatchId:'m1',startsAt:'2026-07-24T10:00:00+04:00',endsAt:'2026-07-24T11:00:00+04:00',timezone:'Asia/Dubai',location:'Dubai Marina',instructions:'Tower lobby',clientMessage:'x'.repeat(1001)}).error,/1,000 characters/);
  assert.match(validateViewingOutcome({status:'completed',expectedVersion:1}).error,/outcome and feedback/);
  assert.match(validateViewingOutcome({status:'completed',outcome:'Interested',feedback:'Customer requested terms',expectedVersion:1}).error,/follow-up/);
  assert.equal(validateViewingOutcome({status:'completed',outcome:'Interested',feedback:'Customer requested terms',followUpAction:'Prepare options',followUpDueAt:'2026-07-25',attendance:[{id:'a1',attendanceStatus:'attended'}],expectedVersion:1}).value.status,'completed');
});

test('R2.2 calendar export is provider-neutral and escaped',()=>{
  const ics=buildViewingIcs({calendarUid:'view-1@nysarealty.com',startsAt:'2026-07-24T06:00:00Z',endsAt:'2026-07-24T07:00:00Z',listingProject:'Private Tower',location:'Lobby; desk',instructions:'Ask for concierge',clientMessage:'Please bring photo ID.',opportunityReference:'NYSA-OP-1'});
  for(const marker of ['BEGIN:VCALENDAR','BEGIN:VEVENT','UID:view-1@nysarealty.com','DTSTART:20260724T060000Z','NYSA Realty – Property Viewing Confirmation','Lobby\\; desk','Meeting point: Ask for concierge','Message from NYSA: Please bring photo ID.'])assert.match(ics,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(ics,/Private Tower|NYSA-OP-1/);
});

test('R2.2 migration and API preserve inventory authority and audit history',()=>{
  const sql=read('src/migrations/040_release2_matching_viewing.sql'),routes=read('src/routes/opportunities.js'),ui=read('public/app.js');
  for(const marker of ['CREATE TABLE property_matches','CREATE TABLE property_match_history','CREATE TABLE viewings','CREATE TABLE viewing_attendees','CREATE TABLE viewing_status_history','opportunities_r2_2_enabled_stage_ck'])assert.match(sql,new RegExp(marker));
  assert.doesNotMatch(sql,/UPDATE listings/i);
  for(const marker of ["workflow_status='approved'",'Property automatically shortlisted when its viewing was scheduled','property_match_history','viewing_status_history','Record attendance for every viewing attendee','calendar.ics','buildViewingIcs'])assert.match(routes,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const marker of ['1. Property options','You do not need a separate shortlist step','Confirm property viewing','Confirm viewing','Download .ics','Record viewing outcome','Attendance'])assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/startsAt=start\.toISOString\(\)/);
});
