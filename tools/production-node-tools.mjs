import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileHash} from './production-runtime-manifest.mjs';

const installation='/opt/alt/alt-nodejs24/root/usr';
const nodeExecutable=installation+'/bin/node';
const nodevenv='/home/nysareal/nodevenv/nysa-crm/24';
const selectorWrapper='/usr/share/l.v.e-manager/utils/node_wrapper';

export async function inspectProductionNodeTools({
  executable=process.execPath,nodeVersion=process.versions.node,
  realpath=fs.realpathSync,hash=fileHash
}={}){
  assert.equal(executable,nodeExecutable,'Production must run with the exact ALT Node.js 24 interpreter');
  assert.equal(realpath(nodeExecutable),nodeExecutable,'ALT Node.js interpreter path changed');
  assert.match(nodeVersion,/^24\./,'Production requires Node.js 24');
  const nodeWrapper=realpath(nodevenv+'/bin/node');
  assert.equal(nodeWrapper,selectorWrapper,'Unexpected CloudLinux selector wrapper');
  const npmCli=realpath(installation+'/bin/npm');
  assert.match(path.posix.relative(installation,npmCli),/^lib(?:64)?\/node_modules\/npm\/bin\/npm-cli\.js$/,
    'npm must resolve to the ALT Node.js installation CLI');
  const [nodeWrapperSha256,nodeExecutableSha256,npmCliSha256]=await Promise.all(
    [nodeWrapper,nodeExecutable,npmCli].map(file=>hash(file)));
  return {nodeWrapper,nodeWrapperSha256,nodeExecutable,nodeExecutableSha256,nodeVersion,npmCli,npmCliSha256};
}

export function assertApprovedProductionNodeTools(observed,approved){
  for(const key of ['nodeWrapper','nodeWrapperSha256','nodeExecutable','nodeExecutableSha256','npmCli','npmCliSha256']){
    assert.equal(observed[key],approved[key],'Production Node/npm approval mismatch: '+key);
  }
}
