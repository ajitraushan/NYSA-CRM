import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev203-r1.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev204-r1.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev204-r1.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text.replaceAll('dev.203','dev.204').replaceAll('dev203-r1','dev204-r1').replaceAll('dev203','dev204')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.202','readonly PREVIOUS_VERSION=2.1.0-dev.203')
  .replace(/^readonly APPROVED_SHA256=.*$/m,`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('requires exact dev.202/migration 126 baseline or exact dev.204 rerun','requires exact dev.203/migration 126 baseline or exact dev.204 rerun');
if(text.includes('dev203-r1')||!text.includes('PREVIOUS_VERSION=2.1.0-dev.203')||!text.includes('requires exact dev.203/migration 126 baseline or exact dev.204 rerun')||!text.includes('LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift.sql'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
