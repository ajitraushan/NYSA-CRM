import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

export const WN15_EXPECTED_TEAMS=Object.freeze([
  Object.freeze({
    id:'d2000000-0000-4000-8000-000000000001',
    name:'CORE Test Sales Team',
    managerId:'d1000000-0000-4000-8000-000000000002',
    managerName:'CORE Test Sales Manager',
    managerStatus:'active',
    managerRole:'manager'
  }),
  Object.freeze({
    id:'d2000000-0000-4000-8000-000000000002',
    name:'CORE Test Leasing Team',
    managerId:'d1000000-0000-4000-8000-000000000005',
    managerName:'CORE Test Leasing Manager',
    managerStatus:'active',
    managerRole:'manager'
  })
]);

export const WN15_EXPECTED_ACCOUNTS=Object.freeze([
  Object.freeze({id:'d1000000-0000-4000-8000-000000000002',name:'CORE Test Sales Manager',status:'active',jobRole:'manager',teamId:'d2000000-0000-4000-8000-000000000001'}),
  Object.freeze({id:'d1000000-0000-4000-8000-000000000003',name:'CORE Test Agent A1',status:'active',jobRole:'sales_agent',teamId:'d2000000-0000-4000-8000-000000000001'}),
  Object.freeze({id:'d1000000-0000-4000-8000-000000000004',name:'CORE Test Agent A2',status:'active',jobRole:'sales_agent',teamId:'d2000000-0000-4000-8000-000000000001'}),
  Object.freeze({id:'d1000000-0000-4000-8000-000000000005',name:'CORE Test Leasing Manager',status:'active',jobRole:'manager',teamId:'d2000000-0000-4000-8000-000000000002'})
]);

function section(lines,header,nextHeader){
  const start=lines.indexOf(header);
  if(start<0)throw new Error(`missing output header: ${header}`);
  const end=nextHeader?lines.indexOf(nextHeader,start+1):lines.findIndex((line,index)=>index>start&&line==='ROLLBACK');
  if(end<0)throw new Error(`missing output terminator after: ${header}`);
  return lines.slice(start+1,end).filter(Boolean).map(line=>line.split('|'));
}

function requireExactSet(actual,expected,label){
  if(actual.length!==expected.length)throw new Error(`${label} row count mismatch: expected ${expected.length}, observed ${actual.length}`);
  const byId=new Map(actual.map(row=>[row[0],row]));
  if(byId.size!==actual.length)throw new Error(`${label} output contains duplicate identifiers`);
  for(const item of expected){
    if(!byId.has(item.id))throw new Error(`${label} missing exact id ${item.id}`);
  }
  return byId;
}

export function assertWn15TeamStateOutput(text,{expectedActive}={}){
  const requiredActive=String(expectedActive);
  if(!/^[01]$/.test(requiredActive))throw new Error('expectedActive must be exactly integer 0 (inactive) or 1 (active)');
  const lines=String(text).replaceAll('\r','').split('\n').map(line=>line.trim()).filter(Boolean);
  const teamHeader='team_id|team_name|active|manager_id|manager_name|manager_status|manager_role';
  const accountHeader='broker_id|name|status|job_role|team_id|non_delivery_email|has_phone';
  const teamRows=section(lines,teamHeader,accountHeader);
  const accountRows=section(lines,accountHeader);
  const teams=requireExactSet(teamRows,WN15_EXPECTED_TEAMS,'team');
  const accounts=requireExactSet(accountRows,WN15_EXPECTED_ACCOUNTS,'account');

  for(const expected of WN15_EXPECTED_TEAMS){
    const row=teams.get(expected.id);
    const [id,name,active,managerId,managerName,managerStatus,managerRole]=row;
    if(!/^[01]$/.test(active))throw new Error(`team ${id} active must be database integer 0 or 1; observed ${JSON.stringify(active)}`);
    if(active!==requiredActive)throw new Error(`team ${id} active mismatch: expected ${requiredActive}, observed ${active}`);
    const observed={id,name,managerId,managerName,managerStatus,managerRole};
    for(const key of Object.keys(observed)){
      if(observed[key]!==expected[key])throw new Error(`team ${id} ${key} mismatch: expected ${JSON.stringify(expected[key])}, observed ${JSON.stringify(observed[key])}`);
    }
  }

  for(const expected of WN15_EXPECTED_ACCOUNTS){
    const row=accounts.get(expected.id);
    const [id,name,status,jobRole,teamId,nonDeliveryEmail,hasPhone]=row;
    const observed={id,name,status,jobRole,teamId};
    for(const key of Object.keys(observed)){
      if(observed[key]!==expected[key])throw new Error(`account ${id} ${key} mismatch: expected ${JSON.stringify(expected[key])}, observed ${JSON.stringify(observed[key])}`);
    }
    if(nonDeliveryEmail!=='t'||hasPhone!=='f')throw new Error(`account ${id} safety attributes mismatch: expected .invalid email and no phone`);
  }

  return {
    expectedActive:Number(requiredActive),
    teamCount:teamRows.length,
    accountCount:accountRows.length,
    teamIds:WN15_EXPECTED_TEAMS.map(team=>team.id),
    accountIds:WN15_EXPECTED_ACCOUNTS.map(account=>account.id)
  };
}

function parseArgs(argv){
  const args={};
  for(let index=0;index<argv.length;index+=1){
    const flag=argv[index];
    if(!flag.startsWith('--')||index+1>=argv.length)throw new Error(`invalid argument ${flag}`);
    args[flag.slice(2)]=argv[++index];
  }
  return args;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const args=parseArgs(process.argv.slice(2));
    if(!args.input)throw new Error('--input is required');
    const expectedActive=args.expected==='inactive'?0:args.expected==='active'?1:args.expected;
    const result=assertWn15TeamStateOutput(fs.readFileSync(args.input,'utf8'),{expectedActive});
    process.stdout.write(`${JSON.stringify({result:'passed',...result})}\n`);
  }catch(error){
    process.stderr.write(`${error.message}\n`);
    process.exitCode=1;
  }
}
