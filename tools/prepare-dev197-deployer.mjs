import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev196-r1.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev197-r1.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev197-r1.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text
  .replaceAll('dev.196','dev.197')
  .replaceAll('dev196-r1','dev197-r1')
  .replaceAll('dev196','dev197')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.192','readonly PREVIOUS_VERSION=2.1.0-dev.196')
  .replace('readonly PREVIOUS_MIGRATION=123_agent_payout_calculation_sheet_audit.sql','readonly PREVIOUS_MIGRATION=126_executing_agent_tier_and_social_uplift.sql')
  .replace(/^readonly APPROVED_SHA256=.*$/m,`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('|$LATEST_MIGRATION|false','|$LATEST_MIGRATION|true')
  .replace('requires exact dev.192/migration 123 baseline or exact dev.197 rerun','requires exact dev.196/migration 126 baseline or exact dev.197 rerun')
  .replace('"123|$PREVIOUS_MIGRATION"','"126|$PREVIOUS_MIGRATION"');
if(text.includes('dev196-r1')||!text.includes('migration 126 baseline')||!text.includes('|$LATEST_MIGRATION|true')||!text.includes('PREVIOUS_VERSION=2.1.0-dev.196')||!text.includes('PREVIOUS_MIGRATION=126_executing_agent_tier_and_social_uplift.sql'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
