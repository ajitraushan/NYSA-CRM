import assert from 'node:assert/strict';
import test from 'node:test';
import {DEFAULT_PROSPECT_OUTSIDE_CALLING_HOURS_MODE,parseProspectCallingPolicyConfig} from '../src/prospect-calling-policy.js';

test('DEV269 outside-hours policy defaults to warning and supports governed refusal',()=>{
  assert.equal(DEFAULT_PROSPECT_OUTSIDE_CALLING_HOURS_MODE,'warning');
  assert.deepEqual(parseProspectCallingPolicyConfig({}),{outsideCallingHoursMode:'warning',source:'default'});
  assert.deepEqual(parseProspectCallingPolicyConfig({PROSPECT_OUTSIDE_CALLING_HOURS_MODE:'refuse'}),{outsideCallingHoursMode:'refuse',source:'environment'});
  assert.throws(()=>parseProspectCallingPolicyConfig({PROSPECT_OUTSIDE_CALLING_HOURS_MODE:'allow'}),/must be warning or refuse/);
});
