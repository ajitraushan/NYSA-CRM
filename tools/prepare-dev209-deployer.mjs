import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev208-r1.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev209-r1.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev209-r1.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text.replaceAll('dev.208','dev.209').replaceAll('dev208-r1','dev209-r1').replaceAll('dev208','dev209')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.207','readonly PREVIOUS_VERSION=2.1.0-dev.208')
  .replace(/^readonly APPROVED_SHA256=.*$/m,`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('readonly PREVIOUS_MIGRATION=126_executing_agent_tier_and_social_uplift.sql','readonly PREVIOUS_MIGRATION=127_governed_purchased_data_intake.sql')
  .replace('$LATEST_MIGRATION|false','$LATEST_MIGRATION|true')
  .replace('"126|$PREVIOUS_MIGRATION"','"127|$PREVIOUS_MIGRATION"')
  .replace('requires exact dev.207/migration 126 baseline or exact dev.209 rerun','requires exact dev.208/migration 127 baseline or exact dev.209 rerun')
  .replace('DEV208 database contract failed: $result','DEV209 database contract failed: $result');
if(text.includes('dev208-r1')||!text.includes('dev209-r1')||!text.includes('PREVIOUS_VERSION=2.1.0-dev.208')||!text.includes('PREVIOUS_MIGRATION=127_governed_purchased_data_intake.sql')||!text.includes('requires exact dev.208/migration 127 baseline or exact dev.209 rerun')||!text.includes('LATEST_MIGRATION=127_governed_purchased_data_intake.sql')||!text.includes('"127|$LATEST_MIGRATION"')||!text.includes('"127|$PREVIOUS_MIGRATION"')||!text.includes('-eq 127')||!text.includes('$LATEST_MIGRATION|true')||!text.includes('purchased_data_import_batches'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
