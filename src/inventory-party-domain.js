export const INVENTORY_OWNER_PARTY_ROLES=['seller','landlord','lessor','developer','authorized_representative'];
export const INVENTORY_OWNER_PARTY_TYPES=['person','company','external_broker','external_agency'];

export function validateInventoryPartyInput(input={}){
  if(!INVENTORY_OWNER_PARTY_ROLES.includes(input.partyRole))return 'Select a valid Inventory owner or representative role';
  if(!INVENTORY_OWNER_PARTY_TYPES.includes(input.partyType))return 'Select a valid Inventory party type';
  for(const [field,label] of [['displayName','Name'],['source','Source'],['authorityEvidence','Authority evidence']]){
    if(!String(input[field]||'').trim())return `${label} is required`;
  }
  return null;
}
