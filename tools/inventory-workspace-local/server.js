import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
export const inventoryWorkspaceReviewHeaders={
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'",
  'X-Content-Type-Options':'nosniff'
};
const file=(relative,type)=>({body:readFileSync(path.join(root,relative)),type});
const styles=()=>({body:Buffer.from([...readFileSync(path.join(root,'public/index.html'),'utf8').matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match=>match[1]).join('\n')),type:'text/css; charset=utf-8'});

export function createInventoryWorkspaceReviewServer(){return http.createServer((req,res)=>{
  Object.entries(inventoryWorkspaceReviewHeaders).forEach(([name,value])=>res.setHeader(name,value));
  if(req.method!=='GET'){res.writeHead(405);res.end('GET only');return;}
  const routes={
    '/':()=>file('tools/inventory-workspace-local/index.html','text/html; charset=utf-8'),
    '/review.js':()=>file('tools/inventory-workspace-local/review.js','text/javascript; charset=utf-8'),
    '/inventory-workspace-ui.js':()=>file('public/inventory-workspace-ui.js','text/javascript; charset=utf-8'),
    '/source-ui.css':styles
  };
  const handler=routes[new URL(req.url,'http://127.0.0.1').pathname];if(!handler){res.writeHead(404);res.end('Not found');return;}
  const result=handler();res.setHeader('Content-Type',result.type);res.writeHead(200);res.end(result.body);
});}

if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.NYSA_INVENTORY_REVIEW_PORT||3253);createInventoryWorkspaceReviewServer().listen(port,'127.0.0.1',()=>console.log(`Inventory workspace review ready on http://127.0.0.1:${port}/`));}
