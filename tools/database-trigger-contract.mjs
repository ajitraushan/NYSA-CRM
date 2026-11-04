import crypto from 'node:crypto';

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

export function normalizeExpectedTriggerContract(value,{label='trigger'}={}){
  if(!Array.isArray(value))throw Error(`Expected ${label} contract must be an array`);
  const normalized=value.map(item=>({
    table:String(item.table||''),
    name:String(item.name||''),
    function:String(item.function||''),
    enabled:String(item.enabled||'')
  })).sort((left,right)=>`${left.table}\0${left.name}`.localeCompare(`${right.table}\0${right.name}`));
  const keys=new Set();
  for(const item of normalized){
    if(!/^[a-z0-9_]+$/.test(item.table)||!/^[a-z0-9_]+$/.test(item.name)||!/^public\.[a-z0-9_]+$/.test(item.function)||!['O','D','R','A'].includes(item.enabled))throw Error(`Expected ${label} contract is invalid`);
    const key=`${item.table}\0${item.name}`;
    if(keys.has(key))throw Error(`Expected ${label} contract contains a duplicate`);
    keys.add(key);
  }
  return normalized;
}

export const canonicalTriggerContract=value=>`${JSON.stringify(normalizeExpectedTriggerContract(value))}\n`;

export async function compareDatabaseTriggerContract(pool,expected,{label='trigger'}={}){
  const expectedTriggers=normalizeExpectedTriggerContract(expected,{label});
  const sql=`SELECT c.relname AS table_name,t.tgname AS trigger_name,
      pn.nspname||'.'||p.proname AS function_name,t.tgenabled AS enabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace pn ON pn.oid=p.pronamespace
   WHERE NOT t.tgisinternal AND n.nspname='public'
   ORDER BY c.relname,t.tgname`;
  const observedTriggers=(await pool.query(sql)).rows.map(row=>({table:row.table_name,name:row.trigger_name,function:row.function_name,enabled:row.enabled}));
  const expectedMap=new Map(expectedTriggers.map(item=>[`${item.table}\0${item.name}`,item]));
  const observedMap=new Map(observedTriggers.map(item=>[`${item.table}\0${item.name}`,item]));
  const missing=expectedTriggers.filter(item=>!observedMap.has(`${item.table}\0${item.name}`)).map(item=>({table:item.table,name:item.name}));
  const extra=observedTriggers.filter(item=>!expectedMap.has(`${item.table}\0${item.name}`)).map(item=>({table:item.table,name:item.name}));
  const wrongFunction=[];
  const wrongEnabled=[];
  for(const expectedItem of expectedTriggers){
    const observed=observedMap.get(`${expectedItem.table}\0${expectedItem.name}`);
    if(!observed)continue;
    if(observed.function!==expectedItem.function)wrongFunction.push({table:expectedItem.table,name:expectedItem.name,expected:expectedItem.function,observed:observed.function});
    if(observed.enabled!==expectedItem.enabled)wrongEnabled.push({table:expectedItem.table,name:expectedItem.name,expected:expectedItem.enabled,observed:observed.enabled});
  }
  const expectedCanonical=canonicalTriggerContract(expectedTriggers),observedCanonical=canonicalTriggerContract(observedTriggers);
  return {sql,label,expectedCount:expectedTriggers.length,observedCount:observedTriggers.length,expectedTableCount:new Set(expectedTriggers.map(item=>item.table)).size,observedTableCount:new Set(observedTriggers.map(item=>item.table)).size,expectedSha256:sha256(expectedCanonical),observedSha256:sha256(observedCanonical),missing,extra,wrongFunction,wrongEnabled,matches:missing.length===0&&extra.length===0&&wrongFunction.length===0&&wrongEnabled.length===0&&expectedCanonical===observedCanonical,observedTriggers};
}
