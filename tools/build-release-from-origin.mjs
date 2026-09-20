import path from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {assertAdvertisedCommit,assertFullCommit,git,parseAdvertisedRefs,withDetachedCheckout} from './release-origin-core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
const commit=assertFullCommit(value('--commit')),remote=value('--remote')||process.env.NYSA_RELEASE_GIT_REMOTE||'origin',output=path.resolve(root,value('--output')||'release-artifacts/origin');
const remoteUrl=git(root,['remote','get-url',remote]);if(!/^https:\/\/github\.com\/ajitraushan\/NYSA-CRM(?:\.git)?$/i.test(remoteUrl))throw new Error(`Configured origin is not the governed GitHub repository: ${remoteUrl}`);
git(root,['fetch','--no-tags',remote]);assertAdvertisedCommit(commit,parseAdvertisedRefs(git(root,['ls-remote','--heads','--tags',remote])));
await withDetachedCheckout({repo:root,commit,run:checkout=>execFileSync(process.execPath,['tools/build-release-from-checkout.mjs','--commit',commit,'--remote',remote,'--output',output],{cwd:checkout,stdio:'inherit'})});
