// Derive and lint a private review copy only. Never writes into WordPress.
import fs from 'node:fs';import crypto from 'node:crypto';import{execFileSync}from'node:child_process';
process.umask(0o077);
const base='/home/nysareal/crm-release-preparation/20261031-ui001',candidate=base+'/production-candidate-dev251',out=base+'/website-companion-review',theme='/home/nysareal/public_html/wp-content/themes/nysa-advisory-theme',expected='660cd1b1f407676924c4b783b56c1c208080d83e549f952a5cc73bbf21daa719';
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const p=JSON.parse(fs.readFileSync(candidate+'/RELEASE_PROVENANCE.json'));
if(p.commit!=='8f722679c92eabcd2efb6cef824d5225b28dbcf4'||sha(theme+'/functions.php')!==expected)throw Error('Exact source/baseline guard failed');
fs.mkdirSync(out,{mode:0o700});fs.copyFileSync(theme+'/functions.php',out+'/functions.php');
execFileSync(process.execPath,[candidate+'/integrations/wordpress/staging-overrides/apply-functions-contact-core-hook.mjs',out+'/functions.php'],{stdio:['ignore','pipe','pipe']});
fs.copyFileSync(candidate+'/integrations/wordpress/staging-overrides/page-contact-us.php',out+'/page-contact-us.php');
fs.copyFileSync(candidate+'/integrations/wordpress/nysa-core-lead-bridge/nysa-core-lead-bridge.php',out+'/nysa-core-lead-bridge.php');
const files=[];for(const name of ['functions.php','page-contact-us.php','nysa-core-lead-bridge.php']){execFileSync('php',['-l',out+'/'+name],{stdio:['ignore','pipe','pipe']});files.push({name,sha256:sha(out+'/'+name),phpLint:'passed'});}
if(sha(theme+'/functions.php')!==expected)throw Error('Production theme drifted');
const receipt={status:'REVIEW_COPY_ONLY_NOT_DEPLOYED',candidateCommit:p.commit,productionThemeBaselineSha256:expected,originHookPatchSha256:sha(candidate+'/integrations/wordpress/staging-overrides/apply-functions-contact-core-hook.mjs'),files,productionContactHookPresent:false,productionCoreBridgeInstalled:false,productionOutboxTablePresent:false,requiredEndpoint:'https://crm.nysarealty.com/api/website-intake',sharedSecret:'Private pending CRM configuration; never printed',productionWebsiteMutation:false,requiresExactWebsiteDeploymentApproval:true,requiresFreshPairedWebsiteBackupBeforeApply:true,optionalOutreachProvidersMustRemainOff:true};
fs.writeFileSync(out+'/SAFE_RECEIPT.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
