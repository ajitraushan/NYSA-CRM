import { many } from './db.js';

export const interestFields = {
  purpose:'prospect_purpose', budgetBand:'prospect_budget_band', propertyType:'prospect_property_type',
  market:'prospect_market', timeline:'prospect_timeline',
};

export async function loadProspectInterestLabels() {
  const rows = await many(
    'SELECT s.stable_code AS set_code,d.stable_code,d.display_label_en FROM value_sets s JOIN value_definitions d ON d.value_set_id=s.id WHERE s.stable_code=ANY($1::text[])',
    [Object.values(interestFields)]
  );
  return Object.fromEntries(Object.entries(interestFields).map(([field,set]) => [
    field, Object.fromEntries(rows.filter(row => row.setCode === set).map(row => [row.stableCode,row.displayLabelEn])),
  ]));
}
