import {api,context,freshBackup,quota,requireCondition,teams,verifyRange,verifyTeams} from './wn15-dev272-common.mjs';

const {db,query}=await context();
freshBackup();
quota();
verifyTeams(query,0);
verifyRange(db);
const simulator=await api('/admin/whatsapp-simulation');
requireCondition(simulator.enabled===true&&simulator.environment==='crm-test'&&simulator.externalNetwork===false&&simulator.state?.paused===true&&simulator.state?.faultMode==='none','Running simulator state mismatch');
for(const team of teams){
  const row=await api('/crm/teams/'+team.teamId,'PATCH',{active:1});
  requireCondition(row.id===team.teamId&&row.name===team.name&&row.managerId===team.managerId&&row.active===1,'Activation response mismatch');
  console.log(JSON.stringify({teamId:row.id,active:row.active}));
}
verifyTeams(query,1);
