import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const app=read('public/app.js');
const crm=read('src/routes/crm.js');
const activityRoute=crm.match(/r\.post\('\/crm\/leads\/:id\/activities',[\s\S]*?\n\}\);/)?.[0]||'';

test('customer activity uses customer-centred direction labels without changing canonical values',()=>{
  assert.match(app,/<option value="Outbound">To Customer<\/option><option value="Inbound">From Customer<\/option>/);
});

test('outbound customer activity enforces contact restriction but not listing marketing authorization',()=>{
  assert.match(activityRoute,/do_not_contact/);
  assert.match(activityRoute,/Outbound communication is blocked by the contact restriction/);
  assert.doesNotMatch(activityRoute,/marketing_agreements|permitted_channels|effective agreement permits outbound/i);
});

test('invalid optional document identifiers fail before the activity transaction',()=>{
  const validation=activityRoute.indexOf('Exact document version ID must be a valid governed document UUID or left blank');
  const transaction=activityRoute.indexOf('const activity=await transaction');
  assert.ok(validation>=0&&transaction>validation);
  assert.match(activityRoute,/Exact document version was not found in this Customer-linked Lead record/);
  assert.match(activityRoute,/Offer letter sent requires the exact immutable sent document version/);
});
