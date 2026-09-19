import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev205-r3.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev206-r1.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev206-r1.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text.replaceAll('dev.205','dev.206').replaceAll('dev205-r3','dev206-r1').replaceAll('dev205','dev206')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.204','readonly PREVIOUS_VERSION=2.1.0-dev.205')
  .replace(/^readonly APPROVED_SHA256=.*$/m,`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('requires exact dev.204/migration 126 baseline or exact dev.206 rerun','requires exact dev.205/migration 126 baseline or exact dev.206 rerun');
if(text.includes('dev205-r3')||!text.includes('dev206-r1')||!text.includes('PREVIOUS_VERSION=2.1.0-dev.205')||!text.includes('requires exact dev.205/migration 126 baseline or exact dev.206 rerun')||!text.includes('LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift.sql'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
