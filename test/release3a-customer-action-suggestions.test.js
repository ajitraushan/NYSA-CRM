import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_SCHEMAS,AI_INSTRUCTIONS } from '../src/ai-service.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('R3A-AI-ACTION-46B has a strict controlled next-action contract',()=>{
  const schema=AI_SCHEMAS.customer_next_action;
  assert.equal(schema.additionalProperties,false);
  assert.ok(schema.required.includes('whyNow'));assert.ok(schema.required.includes('delayConsequence'));
  assert.ok(schema.properties.actionCode.enum.includes('review_contact_restriction'));
  assert.match(AI_INSTRUCTIONS.customer_next_action,/Never invent customer facts/);
  assert.match(AI_INSTRUCTIONS.customer_next_action,/Never.*contact a customer.*reserve Inventory/i);
});

test('R3A-AI-ACTION-46B persists evidence and governed broker decisions in migration 062',()=>{
  const migration=read('src/migrations/062_release3a_customer_action_suggestions.sql'),route=read('src/routes/ai.js');
  assert.match(migration,/customer_action_suggestions/);assert.match(migration,/customer_next_action/);
  assert.match(migration,/evidence_hash/);assert.match(migration,/resulting_task_id/);
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
  for(const marker of ['deterministic_rules','ai_assisted','do_now','schedule','dismiss','customer_action_suggested'])assert.match(route,new RegExp(marker));
  assert.match(route,/canOperateLead/);assert.match(route,/A dismissal reason is required/);assert.match(route,/Schedule a valid future date and time/);
  assert.doesNotMatch(route,/process\.env\.OPENAI_API_KEY/);
});

test('R3A-AI-ACTION-46B Customer 360 explains and never silently executes a suggestion',()=>{
  const app=read('public/app.js'),html=read('public/index.html');
  for(const marker of ['Explain next action','Do now','Edit and schedule','Dismiss','If delayed:'])assert.match(app,new RegExp(marker));
  assert.match(app,/requiresHumanConfirmation|suggestionSource/);
  assert.match(html,/customer-action-suggestion/);
});
