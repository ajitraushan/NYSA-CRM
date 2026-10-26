import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDedicatedFixture,createFixturePool,quoteIdentifier,FIXTURE_SCHEMA} from '../tools/local-postgres-fixture/fixture-guard.mjs';

test('Local migration removes only the closure trigger; rollback DDL is reversible and finance immutability remains',
  {skip:process.env.NYSA_RUN_INDEPENDENT_CLOSURE_DB!=='1'},async()=>{
    assert.ok(['localhost','127.0.0.1','::1'].includes(process.env.PGHOST));
    const pool=createFixturePool();
    try{
      await assertDedicatedFixture(pool);
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        await client.query(`SET LOCAL search_path TO ${quoteIdentifier(FIXTURE_SCHEMA)}, public`);
        const triggers=async()=>new Set((await client.query(`SELECT tgname FROM pg_trigger
          WHERE tgrelid IN ('deals'::regclass,'deal_commission_receipts'::regclass,'deal_commission_proofs'::regclass)
          AND NOT tgisinternal`)).rows.map(x=>x.tgname));
        const before=await triggers();
        assert.equal(before.has('deals_commission_receipt_close_gate'),false);
        assert.ok([...before].some(x=>x.includes('immutable')));
        await client.query(`CREATE TRIGGER deals_commission_receipt_close_gate BEFORE UPDATE OF status ON deals
          FOR EACH ROW EXECUTE FUNCTION enforce_commission_receipt_before_close_won()`);
        assert.equal((await triggers()).has('deals_commission_receipt_close_gate'),true);
        await client.query('ROLLBACK');
        await client.query('BEGIN');
        await client.query(`SET LOCAL search_path TO ${quoteIdentifier(FIXTURE_SCHEMA)}, public`);
        assert.deepEqual(await triggers(),before);
        await client.query('ROLLBACK');
      }finally{await client.query('ROLLBACK');client.release();}
    }finally{await pool.end();}
  });
