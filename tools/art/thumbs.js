// Small transparent PNG thumbnails (contracted frame) for lists.
const {chromium}=require('playwright');const fs=require('fs');
const [src,out]=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:200,height:150},deviceScaleFactor:2});
for(const f of fs.readdirSync(src).filter(f=>f.endsWith('-1.svg'))){
  fs.writeFileSync(src+'/_t.html','<html><body style="margin:0;background:transparent"><img id="i" src="'+f+'" style="width:200px;height:150px;object-fit:contain;padding:6px;box-sizing:border-box"></body></html>');
  await p.goto('file://'+src+'/_t.html');
  await p.waitForFunction(()=>document.getElementById('i').complete&&document.getElementById('i').naturalWidth>0);
  await p.screenshot({path:out+'/'+f.replace('-1.svg','.png'),omitBackground:true});
}
await b.close();})();
