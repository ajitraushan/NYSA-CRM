import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const routes = new Map([
  ['/', [path.join(here, 'index.html'), 'text/html; charset=utf-8']],
  ['/app.js', [path.join(here, 'app.js'), 'text/javascript; charset=utf-8']],
  ['/styles.css', [path.join(here, 'styles.css'), 'text/css; charset=utf-8']],
  ['/modules/listing-agreement-readiness-domain.js', [path.join(root, 'src', 'listing-agreement-readiness-domain.js'), 'text/javascript; charset=utf-8']]
]);
export const listingAgreementHeaders = {'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};
export function createListingAgreementLocalServer(){return http.createServer(async(req,res)=>{try{if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405,{...listingAgreementHeaders,Allow:'GET, HEAD'});return res.end();}const pathname=new URL(req.url??'/','http://127.0.0.1').pathname;if(pathname==='/favicon.ico'){res.writeHead(204,listingAgreementHeaders);return res.end();}const route=routes.get(pathname);if(!route){res.writeHead(404,{...listingAgreementHeaders,'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found');}const body=await fs.readFile(route[0]);res.writeHead(200,{...listingAgreementHeaders,'Content-Type':route[1],'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(500,{...listingAgreementHeaders,'Content-Type':'text/plain; charset=utf-8'});res.end('Local prototype error');}});}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){createListingAgreementLocalServer().listen(3225,'127.0.0.1',()=>console.log('NYSA Listing Agreement Readiness: http://127.0.0.1:3225'));}
