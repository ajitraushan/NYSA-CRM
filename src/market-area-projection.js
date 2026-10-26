import {one,execute,uuid,audit} from './db.js';

const normalize=value=>String(value??'').trim().normalize('NFKC').toLowerCase().replace(/\s+/g,' ');

export async function ensureMarketAreaProjection(area,actorId,client){
  if(!area?.id||!area?.stableCode||!area?.businessLabel)throw new Error('A governed Area is required for Market Intelligence projection');
  let community=await one('SELECT * FROM market_communities WHERE area_id=$1 AND managed_from_area=1 FOR UPDATE',[area.id],client);
  if(!community){
    community=await one('SELECT * FROM market_communities WHERE stable_code=$1 FOR UPDATE',[area.stableCode],client);
    if(community&&community.areaId!==area.id){const error=new Error(`Market Intelligence stable code ${area.stableCode} belongs to a different Area`);error.statusCode=409;throw error;}
    if(community)community=await one('UPDATE market_communities SET managed_from_area=1 WHERE id=$1 RETURNING *',[community.id],client);
    else community=await one('INSERT INTO market_communities(id,stable_code,area_id,managed_from_area,created_by) VALUES($1,$2,$3,1,$4) RETURNING *',[uuid(),area.stableCode,area.id,actorId],client);
  }
  let version=await one("SELECT * FROM market_community_versions WHERE community_id=$1 AND status='active' FOR UPDATE",[community.id],client);
  if(!version){
    const latest=await one('SELECT COALESCE(MAX(version_number),0)::int AS n FROM market_community_versions WHERE community_id=$1',[community.id],client);
    version=await one(`INSERT INTO market_community_versions(id,community_id,area_id,version_number,business_label,normalized_label,status,created_by,approved_by,approved_at) VALUES($1,$2,$3,$4,$5,$6,'active',$7,$7,NOW()) RETURNING *`,[uuid(),community.id,area.id,Number(latest.n)+1,area.businessLabel,normalize(area.businessLabel),actorId],client);
    await audit('MarketCommunity',version.id,'area_projection_created',actorId,{areaId:area.id,stableCode:area.stableCode,source:'area_maintenance'},client);
  }
  return{community,version};
}
