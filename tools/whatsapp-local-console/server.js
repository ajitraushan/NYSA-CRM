import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'..','..');
const routes=new Map([
  ['/',{file:path.join(here,'index.html'),type:'text/html; charset=utf-8'}],
  ['/app.js',{file:path.join(here,'app.js'),type:'text/javascript; charset=utf-8'}],
  ['/styles.css',{file:path.join(here,'styles.css'),type:'text/css; charset=utf-8'}],
  ['/modules/communication-domain.js',{file:path.join(projectRoot,'src','communication-domain.js'),type:'text/javascript; charset=utf-8'}],
  ['/modules/communication-connector.js',{file:path.join(projectRoot,'src','communication-connector.js'),type:'text/javascript; charset=utf-8'}],
  ['/modules/communication-local-connector.js',{file:path.join(projectRoot,'src','communication-local-connector.js'),type:'text/javascript; charset=utf-8'}]
]);

const securityHeaders={
  'Cache-Control':'no-store',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy':'same-origin',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY'
};

export function createLocalConsoleServer(){
  return http.createServer(async(req,res)=>{
    try{
      if(!['GET','HEAD'].includes(req.method||'')){
        res.writeHead(405,{...securityHeaders,Allow:'GET, HEAD'});return res.end();
      }
      const pathname=new URL(req.url||'/','http://127.0.0.1').pathname;
      if(pathname==='/favicon.ico'){res.writeHead(204,securityHeaders);return res.end();}
      const route=routes.get(pathname);
      if(!route){res.writeHead(404,{...securityHeaders,'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found');}
      const body=await fs.readFile(route.file);
      res.writeHead(200,{...securityHeaders,'Content-Type':route.type,'Content-Length':body.length});
      return res.end(req.method==='HEAD'?undefined:body);
    }catch{
      res.writeHead(500,{...securityHeaders,'Content-Type':'text/plain; charset=utf-8'});return res.end('Local console error');
    }
  });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const requested=Number(process.argv[2]||3219);
  const port=Number.isInteger(requested)&&requested>0&&requested<65536?requested:3219;
  createLocalConsoleServer().listen(port,'127.0.0.1',()=>{
    console.log(`NYSA WhatsApp Local Console: http://127.0.0.1:${port}`);
    console.log('Local simulation only. No provider or external network connection.');
  });
}
