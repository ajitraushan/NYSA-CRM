import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.'),source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev198-r1.sh'),target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev199-r1.sh'),manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev199-r1.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text.replaceAll('dev.198','dev.199').replaceAll('dev198-r1','dev199-r1').replaceAll('dev198','dev199').replace('readonly PREVIOUS_VERSION=2.1.0-dev.197','readonly PREVIOUS_VERSION=2.1.0-dev.198').replace(/^readonly APPROVED_SHA256=.*$/m,`readonly APPROVED_SHA256=${manifest.packageSha256}`).replace('requires exact dev.197/migration 126 baseline or exact dev.199 rerun','requires exact dev.198/migration 126 baseline or exact dev.199 rerun');
if(text.includes('dev198-r1')||!text.includes('PREVIOUS_VERSION=2.1.0-dev.198')||!text.includes('requires exact dev.198/migration 126 baseline or exact dev.199 rerun')||!text.includes('LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift.sql'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});console.log(target);
