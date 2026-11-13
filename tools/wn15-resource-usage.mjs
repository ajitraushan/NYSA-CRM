const resourceIds = {
  cpu: 'lvecpu',
  pmem: 'lvememphy',
  ep: 'lveep',
  nproc: 'lvenproc',
  iops: 'lveiops',
  io: 'lveio',
};

function readNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return NaN;
}

export function parseResourceUsage(envelope) {
  const result = envelope?.result;
  if (Number(result?.status) !== 1 || !Array.isArray(result.data)) {
    throw new Error('Account resource data unavailable');
  }
  return Object.entries(resourceIds).map(([name, id]) => {
    const rows = result.data.filter(row => row?.id === id);
    const row = rows[0];
    const usage = readNumber(row?.usage);
    const maximum = readNumber(row?.maximum);
    if (rows.length !== 1 || row.error != null || !Number.isFinite(usage) ||
        !Number.isFinite(maximum) || usage < 0 || maximum <= 0 || usage >= maximum * 0.8) {
      throw new Error('Account resource unavailable or at least 80%: ' + name);
    }
    return {name, usage, maximum};
  });
}
