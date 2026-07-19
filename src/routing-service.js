import { one } from './db.js';
import { normalizeDelimitedValues } from './crm-domain.js';

export async function resolvePrimaryRoutingArea(primaryAreaId,preferredAreas,client){
  if(!primaryAreaId)return{areaId:null,area:null};
  const area=await one('SELECT id,stable_code,business_label,emirate FROM areas WHERE id=$1 AND active=1',[primaryAreaId],client);
  if(!area)return{error:'The selected primary routing area is not active'};
  const preferred=normalizeDelimitedValues(preferredAreas).map(x=>x.toLocaleLowerCase());
  if(preferred.length&&!preferred.includes(area.businessLabel.toLocaleLowerCase()))return{error:'The primary routing area must also be included in Preferred areas'};
  return{areaId:area.id,area};
}

export async function selectRoutingRule({source,businessType,primaryAreaId=null},client){
  return one(`SELECT r.* FROM routing_rules r
    WHERE r.active=1
      AND (r.source IS NULL OR r.source=$1)
      AND (r.business_type IS NULL OR r.business_type=$2)
      AND (r.area_id IS NULL OR r.area_id=$3::uuid)
    ORDER BY r.priority,CASE WHEN r.area_id IS NULL THEN 1 ELSE 0 END,r.id LIMIT 1`,[source,businessType,primaryAreaId],client);
}
