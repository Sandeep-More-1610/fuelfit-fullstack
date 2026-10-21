// Serve only public storefront assets, never backend sources, credentials or Git metadata.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const types = {'index.html':'text/html; charset=utf-8','2nd.css':'text/css; charset=utf-8',
  '3rd.js':'application/javascript; charset=utf-8','catalog.js':'application/javascript; charset=utf-8'};
http.createServer((req,res)=>{
  const file = new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!Object.hasOwn(types,file)||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[file],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(path.join(root,file)).pipe(res);
}).listen(Number(process.env.FRONTEND_PORT||8859),'127.0.0.1',()=>console.log('FuelFit: http://127.0.0.1:'+(process.env.FRONTEND_PORT||8859)));
