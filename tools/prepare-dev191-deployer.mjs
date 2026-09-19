import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev190.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev191.sh');
let text=await fs.readFile(source,'utf8');
text=text
  .replaceAll('dev.190','dev.191')
  .replaceAll('dev190-r6','dev191')
  .replaceAll('dev190','dev191')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.189','readonly PREVIOUS_VERSION=2.1.0-dev.190')
  .replace('readonly EXPECTED_PACKAGE=nysa-core-consolidated-crm-test-dev191.zip','readonly EXPECTED_PACKAGE=nysa-core-consolidated-crm-test-dev191-r10.zip')
  .replace('readonly APPROVED_SHA256=220c14b96cb8650d30c716acf75e4e857f06893def782421fe58eb62a94d171f','readonly APPROVED_SHA256=76e89622721934fc396a8ebeee26755ec8628689bc7d875eac38825de85ed233')
  .replaceAll('nysa-core-consolidated-crm-test-dev191.sha256.txt','nysa-core-consolidated-crm-test-dev191-r10.sha256.txt')
  .replaceAll('nysa-core-consolidated-crm-test-dev191.manifest.json','nysa-core-consolidated-crm-test-dev191-r10.manifest.json')
  .replace('readonly PREVIOUS_MIGRATION=120_commission_payment_batches.sql','readonly PREVIOUS_MIGRATION=121_agent_social_media_payout_eligibility.sql')
  .replace('readonly LATEST_MIGRATION=121_agent_social_media_payout_eligibility.sql','readonly LATEST_MIGRATION=122_commission_invoice_legal_and_bank_details.sql')
  .replace("SELECT to_regclass('public.commission_payment_batches') IS NOT NULL,to_regclass('public.agent_social_media_payout_status_versions') IS NOT NULL,EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='agent_payout_calculations' AND column_name='social_media_status_version_id'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='agent_payout_calculations' AND column_name='social_media_bonus_percent'),EXISTS(SELECT 1 FROM schema_migrations WHERE version='$LATEST_MIGRATION');\"); [[ \"$result\" == \"t|t|t|t|t\" ]]||fail \"Commission Payments database contract failed: $result\";",
    "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_settings' AND column_name='vat_registration_number'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_settings' AND column_name='bank_iban'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='organization_settings' AND column_name='bank_account_number'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='companies' AND column_name='vat_registration_number'),EXISTS(SELECT 1 FROM schema_migrations WHERE version='$LATEST_MIGRATION');\"); [[ \"$result\" == \"t|t|t|t|t\" ]]||fail \"Commission invoice database contract failed: $result\";")
  .replace('"120|$PREVIOUS_MIGRATION"','"121|$PREVIOUS_MIGRATION"')
  .replace('"121|$LATEST_MIGRATION"','"122|$LATEST_MIGRATION"')
  .replace('requires exact dev.189/migration 120 baseline or exact dev.191 rerun','requires exact dev.190/migration 121 baseline or exact dev.191 rerun')
  .replace("-eq 121 ]]||fail \"unexpected migration inventory\"","-eq 122 ]]||fail \"unexpected migration inventory\"")
  .replace('after_migration\" == \"121|$LATEST_MIGRATION','after_migration\" == \"122|$LATEST_MIGRATION')
  .replace('Latest migration: $LATEST_MIGRATION (121 total)','Latest migration: $LATEST_MIGRATION (122 total)');
if(text.includes('dev190')||text.includes('dev.190/migration 120')||!text.includes('organization_settings'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
