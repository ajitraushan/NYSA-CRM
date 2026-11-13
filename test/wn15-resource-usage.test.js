import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parseResourceUsage} from '../tools/wn15-resource-usage.mjs';

const receipt = readFileSync(new URL('../release-artifacts/wn15-preparation/WN15_TELEMETRY.3271a0fa.txt', import.meta.url), 'utf8');
const resourceEnvelope = JSON.parse(receipt.split(/\r?\n/).find(line => line.includes('"module":"ResourceUsage"')));

test('Run A reads all six resource metrics from the hosted receipt', () => {
  assert.deepEqual(parseResourceUsage(resourceEnvelope), [
    {name:'cpu', usage:0, maximum:100},
    {name:'pmem', usage:346230784, maximum:4294967296},
    {name:'ep', usage:7, maximum:200},
    {name:'nproc', usage:77, maximum:500},
    {name:'iops', usage:0, maximum:2048},
    {name:'io', usage:0, maximum:104857600},
  ]);
});

test('Run A stops at 80% and rejects missing resource data', () => {
  const envelope = structuredClone(resourceEnvelope);
  for (const id of ['lvecpu','lvememphy','lveep','lvenproc','lveiops','lveio']) {
    const row = envelope.result.data.find(metric => metric.id === id);
    const original = row.usage;
    row.usage = row.maximum * 0.8;
    assert.throws(() => parseResourceUsage(envelope), /at least 80%/);
    row.usage = original;
  }
  envelope.result.data = envelope.result.data.filter(row => row.id !== 'lvecpu');
  assert.throws(() => parseResourceUsage(envelope), /at least 80%: cpu/);
});
