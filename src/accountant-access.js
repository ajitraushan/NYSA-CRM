// Accountant scope: receivables plus commission-payment preparation and recording.
// MD approval authority remains excluded.
export const isRestrictedAccountant = actor => actor?.jobRole === 'accountant';
export function accountantRequestAllowed(actor, method, requestPath) {
  if (!isRestrictedAccountant(actor)) return true;
  const p = String(requestPath || '').replace(/^\/api(?=\/)/, '').replace(/\/$/, '');
  if (method === 'GET') return [
    /^\/finance\/workspace\/(queue|counts|filters)$/,
    /^\/finance\/workspace\/batches\/[a-f0-9-]{36}$/,
    /^\/finance\/payout-advice\/[a-f0-9-]{36}\/document$/,
    /^\/me$/, /^\/crm\/classification-catalogue\/active$/,
    /^\/crm\/my-(employment|leave-balances|leave-applications)$/,
    /^\/finance\/commission-deals$/,
    /^\/finance\/commission-opportunities$/,
    /^\/finance\/agent-payouts$/,
    /^\/finance\/agent-payouts\/[a-f0-9-]{36}\/quarters\/\d{4}-Q[1-4]\/document$/,
    /^\/finance\/receivables\/awaiting$/,
    /^\/finance\/receivables-adjustments$/,
    /^\/finance\/opportunities\/[a-f0-9-]{36}\/commission$/,
    /^\/finance\/opportunities\/[a-f0-9-]{36}\/commission-proofs(?:\/[a-f0-9-]{36}\/download)?$/,
    /^\/finance\/receivables(?:\/(?:payers|opportunities|[a-f0-9-]{36}))?$/,
    /^\/finance\/receivables\/[a-f0-9-]{36}\/document$/,
    /^\/finance\/receivables\/opportunities\/[a-f0-9-]{36}\/context$/,
    /^\/finance\/accountant-opportunities(?:\/[a-f0-9-]{36})?$/,
    /^\/crm\/deals\/[a-f0-9-]{36}\/commission$/,
    /^\/crm\/deals\/[a-f0-9-]{36}\/commission-proofs(?:\/[a-f0-9-]{36}\/download)?$/
  ].some(rule => rule.test(p));
  if (method === 'POST') return [
    /^\/finance\/payout-advice\/[a-f0-9-]{36}\/retry$/,
    /^\/finance\/workspace\/batches\/[a-f0-9-]{36}\/advice$/,
    /^\/auth\/logout$/,
    /^\/finance\/opportunities\/[a-f0-9-]{36}\/commission-(proofs|receipts|receipt-confirmations)$/,
    /^\/finance\/receivables\/schedules$/,
    /^\/finance\/receivables\/[a-f0-9-]{36}\/(issue|collections|reverse|cancel)$/,
    /^\/finance\/receivables\/[a-f0-9-]{36}\/adjustment-requests$/,
    /^\/finance\/deal-agent-credit-lines\/[a-f0-9-]{36}\/payout\/calculate$/,
    /^\/finance\/agent-payouts\/prepare-batch$/,
    /^\/finance\/commission-payment-batches$/,
    /^\/finance\/commission-payment-batches\/[a-f0-9-]{36}\/release$/,
    /^\/crm\/my-leave-applications(?:\/[a-f0-9-]{36}\/(submit|withdraw))?$/,
    /^\/crm\/deals\/[a-f0-9-]{36}\/commission-(proofs|receipts|receipt-confirmations)$/
  ].some(rule => rule.test(p));
  return false;
}
