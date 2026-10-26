import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev191.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev192-r5.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev192-r5.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text
  .replaceAll('dev.191','dev.192')
  .replaceAll('dev191-r10','dev192-r5')
  .replaceAll('dev191','dev192')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.190','readonly PREVIOUS_VERSION=2.1.0-dev.191')
  .replace('readonly APPROVED_SHA256=76e89622721934fc396a8ebeee26755ec8628689bc7d875eac38825de85ed233',`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('readonly PREVIOUS_MIGRATION=121_agent_social_media_payout_eligibility.sql','readonly PREVIOUS_MIGRATION=122_commission_invoice_legal_and_bank_details.sql')
  .replace('readonly LATEST_MIGRATION=122_commission_invoice_legal_and_bank_details.sql','readonly LATEST_MIGRATION=123_agent_payout_calculation_sheet_audit.sql')
  .replace("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_settings' AND column_name='vat_registration_number'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_settings' AND column_name='bank_iban'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_settings' AND column_name='bank_account_number'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='vat_registration_number'),EXISTS(SELECT 1 FROM schema_migrations WHERE version='$LATEST_MIGRATION');\"); [[ \"$result\" == \"t|t|t|t|t\" ]]||fail \"Commission invoice database contract failed: $result\";",
    "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version='$LATEST_MIGRATION'),EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check' AND pg_get_expr(conbin,conrelid) LIKE '%AgentPayoutCalculationSheet%');\"); [[ \"$result\" == \"t|t\" ]]||fail \"Payout calculation-sheet audit contract failed: $result\";")
  .replace('"121|$PREVIOUS_MIGRATION"','"122|$PREVIOUS_MIGRATION"')
  .replace('"122|$LATEST_MIGRATION"','"123|$LATEST_MIGRATION"')
  .replace('requires exact dev.190/migration 121 baseline or exact dev.192 rerun','requires exact dev.191/migration 122 baseline or exact dev.192 rerun')
  .replace("-eq 122 ]]||fail \"unexpected migration inventory\"","-eq 123 ]]||fail \"unexpected migration inventory\"")
  .replace('after_migration\" == \"122|$LATEST_MIGRATION','after_migration\" == \"123|$LATEST_MIGRATION')
  .replace('Latest migration: $LATEST_MIGRATION (122 total)','Latest migration: $LATEST_MIGRATION (123 total)');
if(text.includes('dev191')||!text.includes('AgentPayoutCalculationSheet')||!text.includes('migration 122 baseline'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
