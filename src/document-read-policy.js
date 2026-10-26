// User-approved 23 October 2026: documents, including KYC, are readable by
// every active signed-in account role. This grants no writes or decisions.
export function canReadAllCrmDocuments(broker) {
  return Boolean(broker && ['admin','internal_broker','partner_broker','viewer'].includes(broker.role) &&
    (!broker.status || broker.status === 'active'));
}

// Explicit read-only exceptions to workspace gates; never a prefix wildcard.
export function isCrmDocumentReadRequest(method,requestPath) {
  if(String(method).toUpperCase()!=='GET')return false;
  const p=String(requestPath||'').replace(/^\/api(?=\/)/,'').replace(/\/$/,'');
  const id='[a-f0-9-]{36}';
  return [
    `/crm/documents/${id}`,`/crm/document-versions/${id}/(?:view|download)`,
    `/crm/offers/${id}/acceptance\\.pdf`,
    `/crm/(?:customers|leads)/${id}/documents`,
    `/crm/task-reviews/[a-z_]+/${id}/document`,
    `/listings/${id}/agreements/${id}/documents(?:/${id})?`,
    `/external-permit-evidence/${id}/download`,
    `/crm/property-media/${id}/(?:view|download|thumbnail)`,
    `/finance/payout-advice/${id}/document`,
    `/finance/receivables/${id}/document`,
    `/finance/agent-payouts/${id}/quarters/\\d{4}-Q[1-4]/document`,
    `/finance/opportunities/${id}/commission-proofs(?:/${id}/download)?`,
    `/crm/deals/${id}/commission-proofs(?:/${id}/download)?`
  ].some(pattern=>new RegExp('^'+pattern+'$','i').test(p));
}
