import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const [keyFile,certFile]=process.argv.slice(2);
if(!keyFile||!certFile)throw new Error('TLS key and certificate are required');
https.createServer({key:fs.readFileSync(keyFile),cert:fs.readFileSync(certFile)},(request,response)=>{
  const upstream=http.request({hostname:'127.0.0.1',port:3000,path:request.url,method:request.method,headers:request.headers},incoming=>{
    response.writeHead(incoming.statusCode||502,incoming.headers);
    incoming.pipe(response);
  });
  upstream.on('error',error=>{response.writeHead(502,{'content-type':'text/plain'});response.end(`rehearsal upstream unavailable: ${error.code||'error'}`);});
  request.pipe(upstream);
}).listen(443,'127.0.0.1',()=>process.stdout.write('DEV267 rehearsal TLS proxy ready\n'));
