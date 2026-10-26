import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),port=3240,types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=http.createServer((req,res)=>{if(req.method!=='GET'){res.writeHead(405);return res.end('GET only');}const pathname=new URL(req.url,'http://127.0.0.1').pathname,file=path.join(root,pathname==='/'?'index.html':pathname.slice(1));if(!file.startsWith(root)){res.writeHead(403);return res.end('Forbidden');}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end(data);});});
server.listen(port,'127.0.0.1',()=>console.log(`Release 3B matching completion local review: http://127.0.0.1:${port}/`));
export default server;
