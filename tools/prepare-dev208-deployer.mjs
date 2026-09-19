import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev207-r2.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev208-r1.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev208-r1.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text.replaceAll('dev.207','dev.208').replaceAll('dev207-r2','dev208-r1').replaceAll('dev207','dev208')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.206','readonly PREVIOUS_VERSION=2.1.0-dev.207')
  .replace(/^readonly APPROVED_SHA256=.*$/m,`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('readonly LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift.sql','readonly LATEST_MIGRATION=127_governed_purchased_data_intake.sql')
  .replace('requires exact dev.206/migration 126 baseline or exact dev.208 rerun','requires exact dev.207/migration 126 baseline or exact dev.208 rerun')
  .replace('( "$installed_version" == "$EXPECTED_VERSION" && "$before_migration" == "126|$LATEST_MIGRATION" )','( "$installed_version" == "$EXPECTED_VERSION" && "$before_migration" == "127|$LATEST_MIGRATION" )')
  .replace('$LATEST_MIGRATION|true','$LATEST_MIGRATION|false')
  .replace("-eq 126 ]]||fail \"unexpected migration inventory\"","-eq 127 ]]||fail \"unexpected migration inventory\"")
  .replace('[[ "$after_migration" == "126|$LATEST_MIGRATION" ]]','[[ "$after_migration" == "127|$LATEST_MIGRATION" ]]')
  .replace('Latest migration: $LATEST_MIGRATION (126 total)','Latest migration: $LATEST_MIGRATION (127 total)')
  .replace('Commission payout database contract failed: $result','DEV208 database contract failed: $result')
  .replace('LIKE \'%executing_agent_received_gross_v1%\');','LIKE \'%executing_agent_received_gross_v1%\'),EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=\'public\' AND table_name=\'purchased_data_import_batches\'),EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=\'public\' AND table_name=\'purchased_data_import_rows\'),EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=\'public\' AND table_name=\'purchased_data_import_authorizations\');')
  .replace('t|t|t|t|t|t|t','t|t|t|t|t|t|t|t|t|t');
if(text.includes('dev207-r2')||!text.includes('dev208-r1')||!text.includes('PREVIOUS_VERSION=2.1.0-dev.207')||!text.includes('requires exact dev.207/migration 126 baseline or exact dev.208 rerun')||!text.includes('LATEST_MIGRATION=127_governed_purchased_data_intake.sql')||!text.includes('"127|$LATEST_MIGRATION"')||!text.includes('-eq 127')||!text.includes('$LATEST_MIGRATION|false')||!text.includes('purchased_data_import_batches'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
