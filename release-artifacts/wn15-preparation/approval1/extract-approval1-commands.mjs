import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const history=fs.readFileSync(path.join(root,'audit','SHELL_HISTORY_TAIL.txt'),'utf8').replaceAll('\r','').split('\n');
const entries=[
  {history:974,name:'attempt-1-placement'},
  {history:976,name:'attempt-2-authorized-replacement-placement'},
  {history:978,name:'attempt-3-remaining-checks'}
];
for(const entry of entries){
  const prefix=new RegExp(`^\\s*${entry.history}\\s+`);
  const line=history.find(value=>prefix.test(value));
  if(!line)throw new Error(`missing shell history entry ${entry.history}`);
  const command=line.replace(/^\s*\d+\s+\S+\s+/,'');
  fs.writeFileSync(path.join(root,`${entry.name}-exact-command.txt`),`${command}\n`);
  const encoded=command.match(/printf '%s' '([A-Za-z0-9+/=]+)'/u)?.[1];
  if(!encoded)throw new Error(`missing encoded payload in history entry ${entry.history}`);
  fs.writeFileSync(path.join(root,`${entry.name}-decoded-payload.sh`),Buffer.from(encoded,'base64'));
}
process.stdout.write('APPROVAL1_COMMAND_EXTRACTION=passed entries=3\n');
