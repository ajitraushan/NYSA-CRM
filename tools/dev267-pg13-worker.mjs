import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=process.argv[2];
if(root!=='/home/nysareal/nysa-core-dashboard-dd6262a-stage')throw new Error('Unexpected rehearsal application root');
process.chdir(root);
process.title=`lsnode:${root}/`;
await import(pathToFileURL(path.join(root,'src','server.js')));
