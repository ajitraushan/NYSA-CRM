import { execute, many } from './db.js';

const clean=value=>String(value??'').trim().replace(/\s+/g,' ');

export function normalizeInventoryIdentity(input={}){
  const size=Number(input.sizeSqft);
  const value={
    unitReference:clean(input.unitReference),
    building:clean(input.building),
    community:clean(input.community),
    areaId:clean(input.areaId),
    sizeSqft:Number.isFinite(size)&&size>0?size:null
  };
  const missing=Object.entries(value).filter(([,item])=>item===null||item==='').map(([key])=>key);
  return{value,complete:missing.length===0,missing};
}

export async function inspectInventoryDuplicate(input,{client,excludeListingId=null,lock=true}={}){
  const identity=normalizeInventoryIdentity(input);
  if(!identity.complete)return{outcome:'incomplete_identity',...identity};
  const key=[identity.value.areaId,identity.value.community.toLowerCase(),identity.value.building.toLowerCase(),identity.value.unitReference.toLowerCase(),identity.value.sizeSqft].join('|');
  if(lock)await execute("SELECT pg_advisory_xact_lock(hashtext('inventory-identity'),hashtext($1))",[key],client);
  const matches=await many(`SELECT id,inventory_reference,inventory_headline,project,status,closed_reason,closed_at,workflow_status,
      unit_reference,building,community,area_id,size_sqft
    FROM listings
    WHERE deleted_at IS NULL
      AND ($6::uuid IS NULL OR id<>$6)
      AND area_id=$1
      AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(community,'')),'\\s+',' ','g'))=LOWER($2)
      AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(building,'')),'\\s+',' ','g'))=LOWER($3)
      AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(unit_reference,'')),'\\s+',' ','g'))=LOWER($4)
      AND size_sqft=$5
    ORDER BY CASE WHEN status='Closed' THEN 1 ELSE 0 END,updated_at DESC`,
    [identity.value.areaId,identity.value.community,identity.value.building,identity.value.unitReference,identity.value.sizeSqft,excludeListingId],client);
  const active=matches.find(item=>item.status!=='Closed'),closed=matches.find(item=>item.status==='Closed');
  if(active)return{outcome:'block_active_duplicate',match:active,matches,...identity};
  if(closed)return{outcome:'require_manager_reopen_approval',match:closed,matches,...identity};
  return{outcome:'allow_inventory_maintenance',matches,...identity};
}

export function inventoryDuplicateError(result){
  if(result.outcome==='block_active_duplicate')return{status:409,error:'An active Inventory already exists for this Unit Reference, Building, Size, Community and Area.',code:'ACTIVE_INVENTORY_DUPLICATE',existingListingId:result.match.id,inventoryReference:result.match.inventoryReference};
  if(result.outcome==='require_manager_reopen_approval')return{status:409,error:'A closed Inventory already exists. Request manager approval to reopen and edit the same Inventory; a second Inventory cannot be created.',code:'CLOSED_INVENTORY_REOPEN_REQUIRED',existingListingId:result.match.id,inventoryReference:result.match.inventoryReference};
  if(result.outcome==='incomplete_identity')return{status:409,error:`Inventory identity is incomplete: ${result.missing.join(', ')}. Complete the identity before creating Inventory.`,code:'INVENTORY_IDENTITY_INCOMPLETE',missing:result.missing};
  return null;
}
