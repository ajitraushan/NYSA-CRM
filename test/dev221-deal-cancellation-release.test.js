import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV221 Manager cancellation accepts stale effective state but retains atomic release and audit',()=>{
  const routes=read('src/routes/opportunities.js');
  const start=routes.indexOf("r.post('/crm/deals/:dealId/close-lost'");
  const end=routes.indexOf("r.post('/crm/deal-cancellation-requests/:id/reject'");
  const closure=routes.slice(start,end);
  assert.match(closure,/dealReservationReleaseAligned/);
  assert.doesNotMatch(closure,/!\['Reserved','reserved'\]\.includes\(deal\.listingStatus\)/);
  assert.doesNotMatch(closure,/Closure records are not aligned/);
  for(const message of ['no longer at the Deal stage','reservation record is no longer available','no Inventory release is required','cannot be released through Deal cancellation','no longer linked to a releasable property reservation'])assert.ok(closure.includes(message),message);
  for(const marker of [
    "UPDATE deals SET status='closed_lost'",
    "UPDATE bookings SET status='cancelled'",
    "UPDATE inventory_assignments SET state='closed'",
    "SELECT nysa_inventory_effective_status($1) AS status",
    "UPDATE opportunities SET stage='Closed Lost'",
    "UPDATE deal_cancellation_requests SET status='approved'",
    "audit('DealCancellationRequest'"
  ])assert.ok(closure.includes(marker),marker);
});
