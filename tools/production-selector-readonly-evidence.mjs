import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {inspectProductionNodeTools} from './production-node-tools.mjs';

const root='/home/nysareal/nysa-crm';
const nodevenv='/home/nysareal/nodevenv/nysa-crm/24';
const modules=path.join(nodevenv,'lib','node_modules');
const prefix='/home/nysareal/crm-release-preparation/';
const [evidenceFlag,evidenceFile,approvalFlag,approval]=process.argv.slice(2);
assert.equal(process.platform,'linux');
assert.equal(process.argv.length,6);
assert.equal(evidenceFlag,'--evidence');
assert.equal(approvalFlag,'--approved');
assert.equal(approval,'5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-selector-readonly');
assert.ok(path.normalize(evidenceFile)===evidenceFile&&evidenceFile.startsWith(prefix));
assert.equal(fs.realpathSync(path.dirname(evidenceFile)),path.dirname(evidenceFile));
assert.equal(fs.realpathSync(root),root);
assert.equal(fs.realpathSync(nodevenv),nodevenv);
const link=path.join(root,'node_modules');
assert.ok(fs.lstatSync(link).isSymbolicLink());
assert.equal(fs.realpathSync(link),modules);
const nodeTools=await inspectProductionNodeTools();
const evidence={
  result:'SELECTOR_DEPENDENCIES_VERIFIED',root,nodevenv,modules,
  linkTarget:fs.readlinkSync(link),...nodeTools
};
fs.writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify(evidence));
