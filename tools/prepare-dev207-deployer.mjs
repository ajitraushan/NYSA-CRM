import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev206-r1.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev207-r2.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev207-r2.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text.replaceAll('dev.206','dev.207').replaceAll('dev206-r1','dev207-r2').replaceAll('dev206','dev207')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.205','readonly PREVIOUS_VERSION=2.1.0-dev.206')
  .replace(/^readonly APPROVED_SHA256=.*$/m,`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('requires exact dev.205/migration 126 baseline or exact dev.207 rerun','requires exact dev.206/migration 126 baseline or exact dev.207 rerun');
if(text.includes('dev206-r1')||!text.includes('dev207-r2')||!text.includes('PREVIOUS_VERSION=2.1.0-dev.206')||!text.includes('requires exact dev.206/migration 126 baseline or exact dev.207 rerun')||!text.includes('LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift.sql'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
