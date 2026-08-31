import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('dev.166 uses an accessible in-page governed Requirement alignment form',()=>{
  const app=read('public/app.js'),start=app.indexOf('async function openRequirementAlignmentReview'),end=app.indexOf('\nasync function openLead',start),flow=app.slice(start,end);
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');
  assert.ok(start>0&&end>start,'alignment review function');
  assert.match(flow,/id="requirement-alignment-form"/);
  assert.match(flow,/name="reason"[^>]*minlength="10"[^>]*required/);
  assert.match(flow,/name="acknowledgeStaleMatching" required/);
  assert.match(flow,/Immutable impact preview/);
  assert.match(flow,/expectedVersion:alignment\.expectedOpportunityVersion,reason,acknowledgeStaleMatching/);
  assert.doesNotMatch(flow,/\bprompt\s*\(/);
  assert.doesNotMatch(flow,/\bconfirm\s*\(/);
  assert.match(app,/openRequirementAlignmentReview\(requirementAlignment,o,\{leadId:id,afterStageChange\}\)/);
});
