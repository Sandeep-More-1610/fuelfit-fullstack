const {spawn} = require('node:child_process');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const server=process.env.FUELFIT_URL?null:spawn(process.execPath,['scripts/serve.cjs'],{cwd:root,stdio:'ignore'});
(async()=>{
  const url=process.env.FUELFIT_URL||'http://127.0.0.1:8859/';
  try{
    let ready=false;
    for(let n=0;n<40;n++){try{if((await fetch(url)).ok){ready=true;break;}}catch(e){}await new Promise(r=>setTimeout(r,100));}
    if(!ready)throw new Error('Frontend test server did not start');
    const files=['auth-frontend','catalog-toolbar','catalog-browser','responsive-browser','review-browser'].map(n=>'tests/'+n+'.test.cjs');
    const child=spawn(process.execPath,['--test','--test-concurrency=1',...files],{cwd:root,stdio:'inherit'});
    process.exitCode=await new Promise(resolve=>child.on('exit',resolve));
  }catch(e){console.error(e.message);process.exitCode=1;}finally{server?.kill();}
})();
