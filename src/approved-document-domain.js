const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;

export function validateViewingConfirmationSelection(selectedIds,completedRows){
  const ids=Array.isArray(selectedIds)?[...new Set(selectedIds.filter(Boolean))]:[];
  if(!ids.length||ids.length>10)return{error:'Select between one and ten completed viewings'};
  if(!Array.isArray(completedRows)||completedRows.length!==ids.length)return{error:'Every selected viewing must be completed and belong to this Customer Opportunity'};
  return{value:{ids,rows:completedRows}};
}

export function validateA2aIssue({code,representationPath,hasProperty,otherAgent,organization,draft,hasPriorIssue,hasDownstream}){
  const buyer=code==='a2a_buyer',allowed=buyer?['buyer','dual'].includes(representationPath):['inventory','dual'].includes(representationPath);
  if(!allowed)return{error:`${buyer?'A2A Buyer':'A2A Seller'} is not applicable to this Opportunity representation`};
  if(!hasPriorIssue&&hasDownstream)return{error:'The initial A2A must be issued after property and counterparty identification and before Viewing or Offer. An existing issued A2A may still be revised through a new immutable version.'};
  if(!hasProperty)return{error:'Select the property before preparing A2A'};
  if(!otherAgent?.name||!otherAgent?.agency||!otherAgent?.brn||!otherAgent?.brnIssuedOn)return{error:'Identify both agencies and agents, including agent BRN and BRN issue date, before preparing A2A'};
  if(!clean(organization?.orn))return{error:'Maintain the NYSA ORN in Company Profile before issuing A2A'};
  if(!clean(draft?.otherAgencyAddress)||!clean(draft?.otherAgencyLicence))return{error:'Complete the other agency address and licence in the editable draft'};
  return{value:true};
}

export function approvedDocumentOpportunityLinks(opportunity={}){
  return [
    ['Opportunity',opportunity.id],
    ['Contact',opportunity.contactId],
    ['Lead',opportunity.leadId],
    ['Listing',opportunity.resolvedListingId]
  ].filter(([,id])=>id);
}
