// Render drawing SVGs to PNG (white background, longest side = size) and record the scale.
const {chromium}=require('playwright');const fs=require('fs');
const [src,out,size]=process.argv.slice(2);const S=+size||720;
(async()=>{const b=await chromium.launch();const p=await b.newPage();const meta={};
for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.svg'))){
  const svg=fs.readFileSync(src+'/'+f,'utf8');const vb=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const k=S/Math.max(vb[2],vb[3]);const w=Math.round(vb[2]*k),h=Math.round(vb[3]*k);
  await p.setViewportSize({width:w,height:h});
  await p.setContent('<html><body style="margin:0;background:#fff">'+svg.replace('<svg ','<svg width="'+w+'" height="'+h+'" ')+'</body></html>');
  await p.screenshot({path:out+'/'+f.replace('.svg','.png'),clip:{x:0,y:0,width:w,height:h}});
  meta[f.replace('.svg','')]={vb,k,w,h};
}
fs.writeFileSync(out+'/../meta.json',JSON.stringify(meta));await b.close();})();
