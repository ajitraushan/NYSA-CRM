import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const source=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev204-r1.sh');
const target=path.join(root,'release-artifacts/release-3/consolidated/deploy-crm-test-consolidated-dev205-r3-redeploy.sh');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev205-r3.manifest.json'),'utf8'));
let text=await fs.readFile(source,'utf8');
text=text.replaceAll('dev.204','dev.205').replaceAll('dev204-r1','dev205-r3').replaceAll('dev204','dev205')
  .replace('readonly PREVIOUS_VERSION=2.1.0-dev.203','readonly PREVIOUS_VERSION=2.1.0-dev.204')
  .replace(/^readonly APPROVED_SHA256=.*$/m,`readonly APPROVED_SHA256=${manifest.packageSha256}`)
  .replace('requires exact dev.203/migration 126 baseline or exact dev.205 rerun','requires exact dev.204/migration 126 baseline or exact dev.205 rerun')
  .replace(`if [[ "$installed_version" == "$EXPECTED_VERSION" ]]; then (cd "$APP_ROOT"&&sha256sum -c "$tmp/RUNTIME_MANIFEST.sha256"); verify_contract; confirmed=1; echo "Deployment already confirmed"; exit 0; fi`,`if [[ "$installed_version" == "$EXPECTED_VERSION" ]]; then
  if (cd "$APP_ROOT"&&sha256sum -c "$tmp/RUNTIME_MANIFEST.sha256" >/dev/null 2>&1); then verify_contract; confirmed=1; echo "Deployment already confirmed"; exit 0; fi
  echo "Same semantic version but different runtime revision detected; proceeding with guarded R3 replacement"
fi`);
if(text.includes('dev204-r1')||!text.includes('dev205-r3')||!text.includes('PREVIOUS_VERSION=2.1.0-dev.204')||!text.includes('Same semantic version but different runtime revision detected')||!text.includes('requires exact dev.204/migration 126 baseline or exact dev.205 rerun')||!text.includes('LATEST_MIGRATION=126_executing_agent_tier_and_social_uplift.sql'))throw new Error('deployer transformation incomplete');
await fs.writeFile(target,text.replace(/\r\n/g,'\n'),{flag:'wx'});
console.log(target);
