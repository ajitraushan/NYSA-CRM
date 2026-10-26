import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const app=read('public/app.js');
const routes=read('src/routes/ai.js');
const service=read('src/ai-service.js');

test('AI requirement drafting loads the current requirement and latest qualification assessment',()=>{
  assert.match(routes,/lead_requirements WHERE lead_id=\$1 AND superseded_at IS NULL/);
  assert.match(routes,/qualification_assessments WHERE lead_id=\$1 ORDER BY assessed_at DESC,id DESC LIMIT 1/);
  assert.match(routes,/currentStructuredRequirement:current\?\{requirementId:current\.id,versionNo:current\.versionNo/);
  assert.match(routes,/latestQualificationAssessment:latestQualification\?\{assessmentId:latestQualification\.id,finalTemperature:latestQualification\.finalTemperature/);
});

test('authoritative later versions explicitly outrank original Lead intake text',()=>{
  assert.match(routes,/evidencePrecedence:\['currentStructuredRequirement','latestQualificationAssessment','conversationNotes','leadClassification'\]/);
  assert.match(routes,/currentVersionsOverrideEarlierLeadIntake:true/);
  assert.match(service,/Later authoritative versions override conflicting original Lead intake or earlier assessments/);
  assert.match(service,/Never describe the Lead as uncontacted or unassessed when the latest assessment or current requirement proves otherwise/);
});

test('AI panel prefills current requirement notes and identifies the latest qualification used',()=>{
  assert.match(app,/authoritativeNotes=currentRequirement\?\(currentRequirement\.notes\|\|currentRequirement\.aiConversationNotes\|\|''\):\(lead\.propertyRequirements\|\|''\)/);
  assert.match(app,/latest Qualification \$\{latestQualification\.finalTemperature\} · score \$\{latestQualification\.calculatedScore\}/);
  assert.match(app,/These current records take priority over original Lead intake text/);
  assert.match(app,/<label>Supplemental conversation notes<\/label>/);
});

test('supplemental text is optional when authoritative current evidence exists',()=>{
  assert.match(routes,/if\(!notes&&!current&&!latestQualification\)return res\.status\(400\)/);
  assert.match(app,/!conversationNotes&&!currentRequirement&&!latestQualification/);
});
