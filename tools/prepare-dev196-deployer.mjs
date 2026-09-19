import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev192-r5.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev196-r1.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev196-r1.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text
  .replaceAll('dev.192','dev.196')
  .replaceAll('dev192-r5','dev196-r1')
  .replaceAll('dev192','dev196')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.191','readonly PREVIOUS_VERSION=2.1.0-dev.192')
  .replace('readonly APPROVED_SHA256=4f36f775d49324ab0056994386b6362b5c02d01a18ee8f28221147a7c983bfe7',`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('readonly PREVIOUS_MIGRATION=122_commission_invoice_legal_and_bank_details.sql','readonly PREVIOUS_MIGRATION=123_agent_payout_calculation_sheet_audit.sql')
  .replace('readonly LATEST_MIGRATION=123_agent_payout_calculation_sheet_audit.sql','readonly LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift.sql')
  .replace(/^verify_contract\(\).*$/m,`verify_contract(){ local result; result=$(PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -X -Atqc "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version='$LATEST_MIGRATION'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commission_payment_batches' AND column_name='payment_status'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='agent_payout_calculations' AND column_name='current_gross_commission_amount'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='agent_payout_calculations' AND column_name='tier_agent_id'),EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='agent_payout_calculations' AND column_name='social_media_uplift_eligible'),EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='agent_payout_calculations'::regclass AND conname='agent_payout_social_uplift_basis_ck'),EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='agent_payout_calculations'::regclass AND conname='agent_payout_calculation_basis_version_ck' AND pg_get_expr(conbin,conrelid) LIKE '%executing_agent_received_gross_v1%');"); [[ "$result" == "t|t|t|t|t|t|t" ]]||fail "Commission payout database contract failed: $result"; }`)
  .replace('"122|$PREVIOUS_MIGRATION"','"123|$PREVIOUS_MIGRATION"')
  .replaceAll('"123|$LATEST_MIGRATION"','"126|$LATEST_MIGRATION"')
  .replace('requires exact dev.191/migration 122 baseline or exact dev.196 rerun','requires exact dev.192/migration 123 baseline or exact dev.196 rerun')
  .replace("-eq 123 ]]||fail \"unexpected migration inventory\"","-eq 126 ]]||fail \"unexpected migration inventory\"")
  .replace('Latest migration: $LATEST_MIGRATION (123 total)','Latest migration: $LATEST_MIGRATION (126 total)');
if(text.includes('dev192-r5')||text.includes('dev192-env')||!text.includes('migration 123 baseline')||!text.includes('executing_agent_received_gross_v1')||!text.includes('-eq 126'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
