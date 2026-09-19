import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {calculateRealtimePayout} from '../src/commission-payout-domain.js';

const enabled=process.env.NYSA_RUN_DEV198_DB_INTEGRATION==='1',gate={skip:enabled?false:'Requires the restricted local synthetic PostgreSQL fixture'};
let pool;
after(async()=>{if(pool)await pool.end();});

test('split payout output satisfies the deployed immutable payout-band constraint',gate,async()=>{
  const guard=await import('../tools/local-postgres-fixture/fixture-guard.mjs');pool=guard.createFixturePool();await guard.assertDedicatedFixture(pool);
  const result=await pool.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='agent_payout_calculation_bands'::regclass AND contype='c' ORDER BY conname`),constraint=result.rows.find(row=>/portion_amount.*agent_payout_amount.*company_retained_amount/.test(row.definition));
  assert.ok(constraint,'immutable payout-band reconciliation constraint must exist');
  const slabs=[{displayOrder:1,lowerAmount:0,upperAmount:100000,agentPercent:55},{displayOrder:2,lowerAmount:100000,upperAmount:200000,agentPercent:60},{displayOrder:3,lowerAmount:200000,upperAmount:300000,agentPercent:65},{displayOrder:4,lowerAmount:300000,upperAmount:400000,agentPercent:70},{displayOrder:5,lowerAmount:400000,upperAmount:null,agentPercent:75}],calculation=calculateRealtimePayout({agentId:'synthetic-agent',dealReference:'NYSA-DL-SYN-198',receiptDate:'2026-09-05',currentGrossCommissionAmount:23809.52,agentSharePercent:75,triggerMethod:'quarter_achieved_rate',slabs,policyVersionId:'synthetic-policy'}),band=calculation.bands[0],check=await pool.query('SELECT $1::numeric(16,2)=$2::numeric(16,2)+$3::numeric(16,2) AS reconciles',[band.portionAmount,band.agentPayoutAmount,band.companyRetainedAmount]);
  assert.equal(check.rows[0].reconciles,true);assert.equal(calculation.agentPayoutAmount,9821.43);
});
