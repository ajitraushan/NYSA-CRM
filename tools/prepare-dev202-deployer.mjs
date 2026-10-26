import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev201-r1.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev202-r1.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev202-r1.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text.replaceAll('dev.201','dev.202').replaceAll('dev201-r1','dev202-r1').replaceAll('dev201','dev202')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.200','readonly PREVIOUS_VERSION=2.1.0-dev.201')
  .replace(/^readonly APPROVED_SHA256=.*$/m,`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('requires exact dev.200/migration 126 baseline or exact dev.202 rerun','requires exact dev.201/migration 126 baseline or exact dev.202 rerun');
if(text.includes('dev201-r1')||!text.includes('PREVIOUS_VERSION=2.1.0-dev.201')||!text.includes('requires exact dev.201/migration 126 baseline or exact dev.202 rerun')||!text.includes('LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift.sql'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
