import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

process.env.PGDATABASE||='unit_contract';
process.env.PGUSER||='unit_contract';
process.env.PGPASSWORD||='unit_contract';

const {buildPoolConfig,checkDatabaseReadiness}=await import('../src/db.js');

test('PostgreSQL pool is bounded and retires connections deterministically',()=>{
  const config=buildPoolConfig({PGDATABASE:'db',PGUSER:'user',PGPASSWORD:'secret',PGPOOL_MAX:'3'});
  assert.equal(config.max,3);
  assert.equal(config.idleTimeoutMillis,30000);
  assert.equal(config.connectionTimeoutMillis,10000);
  assert.equal(config.query_timeout,15000);
  assert.equal(config.statement_timeout,12000);
  assert.equal(config.idle_in_transaction_session_timeout,15000);
  assert.equal(config.maxLifetimeSeconds,300);
  assert.equal(config.maxUses,1000);
  assert.equal(config.keepAlive,true);
});

test('unsafe or excessive PostgreSQL pool values fall back to bounded defaults',()=>{
  const config=buildPoolConfig({PGDATABASE:'db',PGUSER:'user',PGPASSWORD:'secret',PGPOOL_MAX:'500',PG_QUERY_TIMEOUT_MS:'0',PG_CONNECTION_MAX_LIFETIME_SECONDS:'99999'});
  assert.equal(config.max,3);
  assert.equal(config.query_timeout,15000);
  assert.equal(config.maxLifetimeSeconds,300);
});

test('database readiness uses one bounded pool query without checking out a client',async()=>{
  const calls=[],client={query:async query=>{calls.push(query);return{rows:[{database_ready:1}]};}};
  assert.equal(await checkDatabaseReadiness(client),true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].text,'SELECT 1 AS database_ready');
  assert.equal(calls[0].query_timeout,2000);
  assert.equal('connect' in client,false);
});

test('public liveness is database-free and readiness owns the database probe',()=>{
  const source=fs.readFileSync(new URL('../src/routes/auth.js',import.meta.url),'utf8');
  const health=source.slice(source.indexOf("r.get('/health'"),source.indexOf("r.get('/readiness'"));
  const readiness=source.slice(source.indexOf("r.get('/readiness'"),source.indexOf('function clientIp'));
  assert.match(health,/process: 'ready'/);
  assert.doesNotMatch(health,/checkDatabaseReadiness|SELECT 1|await one/);
  assert.match(readiness,/checkDatabaseReadiness/);
  assert.match(readiness,/status\(503\)/);
});
