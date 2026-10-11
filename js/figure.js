/* Figure engine: draws an exercise as an SVG side (or front) view from two key poses. */
import {EX} from './data/catalog.js';
/* ---------- Figure engine: side-view body solved from joint targets, with muscles and coaching marks ---------- */
const FL={th:44,sh:42,ua:30,fa:28,to:50,ft:14,heel:4,neck:8,head:10};
const FC={fig:'var(--fig)',far:'var(--fig-far)',line:'var(--fig-line)',farLine:'var(--fig-far-line)',hl:'var(--muscle)',eq:'var(--eq)',eq2:'var(--eq2)',pad:'var(--pad)',plate:'var(--plate)',ground:'var(--line)',bg:'var(--sunk)',mark:'var(--mark)',bad:'var(--danger)',shoe:'var(--shoe)'};
const rad=d=>d*Math.PI/180, dir=(d,l)=>[l*Math.cos(rad(d)),l*Math.sin(rad(d))];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], mul=(a,s)=>[a[0]*s,a[1]*s];
const len=v=>Math.hypot(v[0],v[1])||0.0001, unit=v=>mul(v,1/len(v)), lerp2=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function ik(r,t,l1,l2,s){
  const dx=t[0]-r[0],dy=t[1]-r[1];let d=Math.hypot(dx,dy)||0.001;const a=Math.atan2(dy,dx);
  d=Math.min(l1+l2-0.05,Math.max(Math.abs(l1-l2)+0.05,d));
  const ca=(l1*l1+d*d-l2*l2)/(2*l1*d);const al=Math.acos(Math.max(-1,Math.min(1,ca)));
  const j=[r[0]+l1*Math.cos(a+s*al),r[1]+l1*Math.sin(a+s*al)];
  return[j,add(j,mul(unit(sub(t,j)),l2))];
}
function lerpPose(A,B,k){
  if(typeof A==='number')return typeof B==='number'?A+(B-A)*k:A;
  if(Array.isArray(A))return A.map((v,i)=>lerpPose(v,B?B[i]:v,k));
  if(A&&typeof A==='object'){const o={};const keys=new Set([...Object.keys(A),...Object.keys(B||{})]);
    keys.forEach(key=>{o[key]=(key in A)?((B&&key in B)?lerpPose(A[key],B[key],k):A[key]):B[key];});return o;}
  return A;
}
function poses(ex,mode){
  const f=ex.fig;const bd=(mode!=null&&mode>=0&&f.bad)?f.bad[mode]:null;
  const A={curve:0,...f.A,...(bd&&bd.A||{})},B={curve:0,...f.B,...(bd&&bd.B||{})};return[A,B,bd];
}
function solve(p,front){
  let hip,sh,t=p.t;
  if(p.sh&&p.hip&&Array.isArray(p.hip)){const v=sub(p.sh,p.hip);t=Math.atan2(v[1],v[0])*180/Math.PI;sh=p.sh;hip=sub(sh,dir(t,FL.to));}
  else if(p.sh){sh=p.sh;hip=sub(sh,dir(t,FL.to));}
  else if(p.hip&&p.hip.a){hip=add(p.a,p.hip.a);sh=add(hip,dir(t,FL.to));}
  else{hip=p.hip;sh=add(hip,dir(t,FL.to));}
  const rel=v=>!v?null:Array.isArray(v)?v:v.sh?add(sh,v.sh):v.hip?add(hip,v.hip):v.a?add(p.a,v.a):null;
  const J={hip,sh,t,curve:p.curve||0,front:!!front};
  let shN=sh,shF=sh,hipN=hip,hipF=hip;
  if(front){shN=add(sh,[13,-3]);shF=add(sh,[-13,-3]);hipN=add(hip,[7,0]);hipF=add(hip,[-7,0]);}
  const a1=rel(p.a);let a2=p.a2?rel(p.a2):a1;if(front)a2=[2*hip[0]-a1[0],a1[1]];
  let k1,an1,k2,an2;
  if(front&&p.seatF){k1=add(hipN,[2,-7]);an1=add(k1,[1,-40]);k2=add(hipF,[-2,-7]);an2=add(k2,[-1,-40]);}
  else if(p.legA){k1=add(hipN,dir(p.legA[0],FL.th));an1=add(k1,dir(p.legA[1],FL.sh));k2=k1;an2=an1;}
  else{[k1,an1]=ik(hipN,a1,FL.th,FL.sh,p.ks??1);[k2,an2]=ik(hipF,a2,FL.th,FL.sh,front?-(p.ks??1):(p.ks2??p.ks??1));}
  let e1,w1,e2,w2;const mir=q=>[2*sh[0]-q[0],q[1]];
  if(p.armA){e1=add(shN,dir(p.armA[0],FL.ua));w1=add(e1,dir(p.armA[1],FL.fa));
    if(front&&p.armA2){e2=add(shF,dir(p.armA2[0],FL.ua));w2=add(e2,dir(p.armA2[1],FL.fa));}else if(front){e2=mir(e1);w2=mir(w1);}else if(p.hand2){[e2,w2]=ik(shF,rel(p.hand2),FL.ua,FL.fa,p.es2??-1);}else{e2=e1;w2=w1;}}
  else{const h1=rel(p.hand);let h2=p.hand2?rel(p.hand2):h1;if(front)h2=mir(h1);
    [e1,w1]=ik(shN,h1,FL.ua,FL.fa,p.es??-1);[e2,w2]=ik(shF,h2,FL.ua,FL.fa,front?-(p.es??-1):(p.es2??p.es??-1));}
  const neck=add(sh,dir(t,FL.neck));const hd=p.h??t;const head=add(neck,dir(hd,FL.head+1));
  const ft1=p.ft??0,ft2=p.ft2??p.ft??0;
  const foot=(an,ft,side)=>front?[add(an,[side*8,-3]),add(an,[0,-2])]:[add(an,dir(ft,FL.ft)),add(an,dir(ft+180,FL.heel))];
  Object.assign(J,{shN,shF,hipN,hipF,k1,an1,k2,an2,e1,w1,e2,w2,neck,head,hd,f1:foot(an1,ft1,1),f2:foot(an2,ft2,-1)});
  J.toe=J.f1[0];J.heel=J.f1[1];J.mid=lerp2(J.f1[1],J.f1[0],0.4);
  return J;
}
function eqPoint(J,q){
  if(Array.isArray(q.at))return q.at;
  const m={hand:J.w1,hand2:J.w2,hip:J.hip,ankle:J.an1,knee:J.k1,sh:J.sh,elbow:J.e1,head:J.head}[q.at||'hand'];
  return add(m,[q.dx||0,q.dy||0]);
}
function jointOf(J,name,f){
  if(name==='bar'){const q=f.eq.find(e=>(e.t==='bar'||e.t==='db')&&e.at!=='hand2');return q?eqPoint(J,q):J.w1;}
  return J[name]||J.w1;
}
function figBounds(ex,RA,tight){
  const f=ex.fig;const pts=[];const modes=tight?[-1]:[-1].concat((f.bad||[]).map((_,i)=>i));
  modes.forEach(md=>{const [A,B]=poses(ex,md);[0,0.5,1].forEach(k=>{const J=solve(lerpPose(A,B,k),f.front);
    ['hip','sh','k1','an1','k2','an2','e1','w1','e2','w2','toe','heel'].forEach(n=>pts.push(J[n]));J.f2.forEach(q=>pts.push(q));
    pts.push(add(J.head,[-12,-12]),add(J.head,[12,12]));
    f.eq.forEach(q=>{if(q.t==='bar'||q.t==='db'){const c=eqPoint(J,q);const r=q.t==='bar'?18:(q.r||8)+1;pts.push([c[0]-r,c[1]-r],[c[0]+r,c[1]+r]);}});});});
  f.eq.forEach(q=>{if(q.pts)q.pts.forEach(v=>{pts.push(v);pts.push([v[0],0]);});
    if(q.t==='cable')pts.push(q.from);if(q.t==='dip'){pts.push([q.x1,q.y],[q.x2,0]);}
    if(q.t==='pullbar')pts.push(add(q.at,[0,12]));if(q.t==='box')pts.push([q.x,0],[q.x+q.w,q.h]);
    if(q.t==='plate')pts.push([q.x,q.y1],[q.x,q.y2]);if(q.t==='pad'&&Array.isArray(q.at))pts.push(q.at);
    if(q.t==='rail')pts.push(q.from,q.to);if(q.t==='rect')pts.push([q.x,q.y],[q.x+q.w,q.y+q.h]);if(q.t==='lever')pts.push(q.from);});
  let x0=Math.min(...pts.map(p=>p[0])),x1=Math.max(...pts.map(p=>p[0])),y0=Math.min(...pts.map(p=>p[1])),y1=Math.max(...pts.map(p=>p[1]));
  const ground=y0<=8;if(ground)y0=Math.min(y0,-4);
  if(tight){x0-=8;x1+=8;y0-=5;y1+=6;}else{x0-=16;x1+=16;y0-=10;y1+=14;}
  let w=x1-x0,h=y1-y0;const R=RA==='auto'?Math.max(0.95,Math.min(1.7,w/h)):(RA||4/3);
  if(w/h<R){const nw=h*R;x0-=(nw-w)/2;w=nw;}else{const nh=w/R;y0-=(nh-h)/2;h=nh;}
  return{x0,y0,w,h,ground};
}
/* --- drawing primitives (math coords, y up; flipped on output) --- */
const P=q=>q[0].toFixed(1)+' '+(-q[1]).toFixed(1);
const cir=(c,r,fill,extra)=>'<circle cx="'+c[0].toFixed(1)+'" cy="'+(-c[1]).toFixed(1)+'" r="'+r+'" fill="'+fill+'"'+(extra||'')+'/>';
const lnS=(a,c,w,col,extra)=>'<line x1="'+a[0].toFixed(1)+'" y1="'+(-a[1]).toFixed(1)+'" x2="'+c[0].toFixed(1)+'" y2="'+(-c[1]).toFixed(1)+'" stroke="'+col+'" stroke-width="'+w+'" stroke-linecap="round"'+(extra||'')+'/>';
const plS=(pts,w,col,extra)=>'<polyline points="'+pts.map(P).join(' ')+'" fill="none" stroke="'+col+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"'+(extra||'')+'/>';
function cap(a,b,w1,w2,col,extra){const n=unit([-(b[1]-a[1]),b[0]-a[0]]);const r1=w1/2,r2=w2/2;
  return'<path d="M'+P(add(a,mul(n,r1)))+' L'+P(add(b,mul(n,r2)))+' L'+P(sub(b,mul(n,r2)))+' L'+P(sub(a,mul(n,r1)))+'Z" fill="'+col+'"'+(extra||'')+'/>'+cir(a,r1,col,extra)+cir(b,r2,col,extra);}
function smooth(pts){let d='M'+P(pts[0]);const n=pts.length;
  for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
    d+=' C'+P([p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6])+' '+P([p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6])+' '+P(p2);}return d+'Z';}
/* torso: spine from hip to shoulder, bulging backwards by `curve`; widths front/back per fraction */
function spineAt(J,f){const u=unit(sub(J.sh,J.hip));const back=[-u[1],u[0]];const nb=J.front?[0,0]:back;
  return add(add(J.hip,mul(sub(J.sh,J.hip),f)),mul(nb,J.curve*Math.sin(Math.PI*f)));}
function torsoFrame(J,f){const e=0.02;const a=spineAt(J,Math.max(0,f-e)),b=spineAt(J,Math.min(1,f+e));const u=unit(sub(b,a));return{p:spineAt(J,f),u,front:[u[1],-u[0]],back:[-u[1],u[0]]};}
const TF=[0,0.22,0.5,0.75,0.92,1],TWf=[9,9.5,8.5,12.5,10,7],TWb=[11,9,8,10,10,7],TWs=[11,10,9,13,13,10];
function torsoPath(J){
  const fr=[],bk=[];TF.forEach((f,i)=>{const t=torsoFrame(J,f);
    if(J.front){const s=[1,0];fr.push(add(t.p,mul(s,TWs[i])));bk.push(sub(t.p,mul(s,TWs[i])));}
    else{fr.push(add(t.p,mul(t.front,TWf[i])));bk.push(add(t.p,mul(t.back,TWb[i])));}});
  return smooth(fr.concat(bk.reverse()));
}
function muscleShapes(J,ex,C){
  const out=[],arm=[];const op=w=>w>=1?0.92:0.45;const m=ex.m||{};
  const seg=(a,b,side,f0,f1,wid,w,cw)=>{const v=sub(b,a);const n=unit([-v[1],v[0]]);const off=mul(n,side*wid*0.22);
    out.push(cap(add(lerp2(a,b,f0),off),add(lerp2(a,b,f1),off),wid*0.55,(cw||wid)*0.5,C.hl,' opacity="'+op(w)+'"'));};
  const tor=(side,f0,f1,wid,w)=>{const pts=[];for(let i=0;i<=6;i++){const f=f0+(f1-f0)*i/6;const t=torsoFrame(J,f);pts.push(J.front?t.p:add(t.p,mul(side>0?t.front:t.back,wid*0.42)));}
    out.push(plS(pts,wid*0.55,C.hl,' opacity="'+op(w)+'"'));};
  for(const k in m){const w=m[k];
    if(k==='quads')seg(J.hipN,J.k1,1,0.15,0.85,15,w,11);
    if(k==='hams')seg(J.hipN,J.k1,-1,0.18,0.85,15,w,11);
    if(k==='calves')seg(J.k1,J.an1,-1,0.12,0.55,11,w,8);
    if(k==='biceps'){const n0=out.length;seg(J.shN,J.e1,1,0.2,0.85,10,w,8);arm.push(out.pop());}
    if(k==='triceps'){seg(J.shN,J.e1,-1,0.15,0.85,10,w,8);arm.push(out.pop());}
    if(k==='glutes'&&!J.front){const t=torsoFrame(J,0.06);out.push(cir(add(t.p,mul(t.back,7)),7.5,C.hl,' opacity="'+op(w)+'"'));}
    if(k==='chest'&&!J.front)tor(1,0.6,0.88,13,w);
    if(k==='chest'&&J.front){const t=torsoFrame(J,0.78);out.push(cir(add(t.p,[6.5,0]),6,C.hl,' opacity="'+op(w)+'"')+cir(add(t.p,[-6.5,0]),6,C.hl,' opacity="'+op(w)+'"'));}
    if(k==='abs')tor(1,0.15,0.5,11,w);
    if(k==='back'&&!J.front)tor(-1,0.4,0.9,12,w);
    if(k==='delts'){arm.push(cir(J.shN,6.5,C.hl,' opacity="'+op(w)+'"'));if(J.front)arm.push(cir(J.shF,6.5,C.hl,' opacity="'+op(w)+'"'));}
  }
  return[out.join(''),arm.join('')];
}
const OW=1.4;
function headSVG(J,C){
  const r=FL.head;let s=cir(J.head,r+OW,C.line);
  if(!J.front){const face=J.hd-90;const nose=add(add(J.head,dir(face,r-0.5)),dir(J.hd,-1));s+=cir(nose,2.6+OW,C.line)+cir(nose,2.6,C.fig);}
  s+=cir(J.head,r,C.fig);
  const a0=J.front?J.hd-75:J.hd-25,a1=J.front?J.hd+75:J.hd+125;const o=[],n=[];
  for(let i=0;i<=12;i++){const a=a0+(a1-a0)*i/12;o.push(add(J.head,dir(a,r+0.6)));}
  for(let i=12;i>=0;i--){const a=a0+(a1-a0)*i/12;const t=Math.sin(Math.PI*i/12);n.push(add(J.head,dir(a,r-1.2-3.8*t)));}
  s+='<path d="M'+o.concat(n).map(P).join(' L')+'Z" fill="'+C.shoe+'"/>';
  return s;
}
function badge(c,n,col,C){return cir(c,6.5,col,' stroke="'+C.bg+'" stroke-width="1.5"')+'<text x="'+c[0].toFixed(1)+'" y="'+(-c[1]+3).toFixed(1)+'" text-anchor="middle" font-size="8.5" font-weight="700" font-family="IBM Plex Sans,system-ui,sans-serif" fill="'+C.bg+'">'+n+'</text>';}
const visMark=(m,k)=>m.ph==='A'?k<0.25:m.ph==='B'?k>0.75:true;
function marksSVG(ex,J,k,A,B,b,C){
  const f=ex.fig;let s='';const dash=' stroke-dasharray="3 3"';
  (f.marks||[]).forEach(m=>{if(!visMark(m,k))return;const col=C.mark;let bp=null;
    if(m.t==='vline'){const p=jointOf(J,m.j,f);s+=lnS([p[0],b.y0+6],[p[0],b.y0+b.h-12],1.3,col,dash);bp=[p[0],b.y0+b.h-8];}
    else if(m.t==='hline'){const p=jointOf(J,m.j,f);s+=lnS([b.x0+12,p[1]],[b.x0+b.w-6,p[1]],1.3,col,dash);bp=[b.x0+8,p[1]];}
    else if(m.t==='line'){let a=jointOf(J,m.a,f),c=jointOf(J,m.b,f);const u=unit(sub(c,a));const n=[-u[1],u[0]];const o=mul(n,m.o||0);
      a=add(sub(a,mul(u,6)),o);c=add(add(c,mul(u,6)),o);s+=lnS(a,c,1.6,col,dash);bp=add(lerp2(a,c,0.5),mul(n,(m.o||0)>=0?9:-9));}
    else if(m.t==='path'){const pts=[];for(let i=0;i<=20;i++){const Jt=solve(lerpPose(A,B,i/20),f.front);pts.push(jointOf(Jt,m.j,f));}
      s+=plS(pts,1.6,col,dash);const e=pts[pts.length-1],pe=pts[pts.length-3];const u=unit(sub(e,pe));const n=[-u[1],u[0]];
      if(len(sub(e,pts[0]))>4)s+='<path d="M'+P(add(e,mul(u,4)))+' L'+P(add(sub(e,mul(u,3)),mul(n,3.5)))+' L'+P(sub(sub(e,mul(u,3)),mul(n,3.5)))+'Z" fill="'+col+'"/>';
      s+=cir(pts[0],2.2,col);const mid=pts[10];bp=add(mid,mul(n,m.side||10));}
    else if(m.t==='dot'){const p=jointOf(J,m.j,f);s+=cir(p,8,'none',' stroke="'+col+'" stroke-width="1.6"');bp=add(p,m.d||[10,10]);}
    else if(m.t==='angle'){const c=jointOf(J,m.j,f);const pa=jointOf(J,m.a,f);const a1=Math.atan2(pa[1]-c[1],pa[0]-c[0]);
      let a2;if(m.b==='h')a2=Math.cos(a1)>=0?0:Math.PI;else if(m.b==='v')a2=Math.sin(a1)>=0?Math.PI/2:-Math.PI/2;else{const pb=jointOf(J,m.b,f);a2=Math.atan2(pb[1]-c[1],pb[0]-c[0]);}
      let d=a1-a2;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;const R=m.r||17;const arc=[];
      for(let i=0;i<=16;i++)arc.push(add(c,[R*Math.cos(a2+d*i/16),R*Math.sin(a2+d*i/16)]));
      const ref=add(c,[(R+8)*Math.cos(a2),(R+8)*Math.sin(a2)]);s+=lnS(c,ref,1.2,col,dash)+plS(arc,1.6,col);
      const mid=a2+d/2;const tp=add(c,[(R+10)*Math.cos(mid),(R+10)*Math.sin(mid)]);
      s+='<text x="'+tp[0].toFixed(1)+'" y="'+(-tp[1]+3).toFixed(1)+'" text-anchor="middle" font-size="9" font-weight="700" font-family="IBM Plex Mono,monospace" fill="'+col+'" stroke="'+C.bg+'" stroke-width="2.5" paint-order="stroke">'+Math.round(Math.abs(d)*180/Math.PI)+'°</text>';
      bp=add(c,[(R+22)*Math.cos(mid),(R+22)*Math.sin(mid)]);}
    if(m.n&&bp)s+=badge(bp,m.n,col,C);});
  return s;
}
function figSVG(exId,k,C,box,o){
  C=C||FC;o=o||{};const ex=EX[exId];const f=ex.fig;const b=box||figBounds(ex);
  const [A,B,bd]=poses(ex,o.mode);const J=solve(lerpPose(A,B,k),f.front);
  let back='',mid='',front='';
  if(b.ground){back+=lnS([b.x0,-1.5],[b.x0+b.w,-1.5],2,C.ground);if(!f.front){const fx=[J.toe[0],J.heel[0],J.f2[0][0],J.f2[1][0]];const cx=(Math.min(...fx)+Math.max(...fx))/2;back+='<ellipse cx="'+cx.toFixed(1)+'" cy="0.5" rx="'+Math.max(18,(Math.max(...fx)-Math.min(...fx))/2+10).toFixed(1)+'" ry="3" fill="'+C.ground+'" opacity=".7"/>';}}
  if(o.ghost&&!f.static){const Jg=solve(lerpPose(A,B,k<0.5?1:0),f.front);back+='<g opacity=".13">'+'<path d="'+torsoPath(Jg)+'" fill="'+C.fig+'"/>'+cap(Jg.hipN,Jg.k1,15,10.5,C.fig)+cap(Jg.k1,Jg.an1,10.5,7,C.fig)+cap(Jg.shN,Jg.e1,10,8,C.fig)+cap(Jg.e1,Jg.w1,8,6.5,C.fig)+cir(Jg.head,FL.head,C.fig)+'</g>';}
  f.eq.forEach(q=>{
    if(q.t==='bench'){if(!q.noLegs){const a=q.pts[0],z=q.pts[q.pts.length-1];back+=lnS([a[0]+5,a[1]-3],[a[0]+5,0],4,C.eq)+lnS([z[0]-5,z[1]-3],[z[0]-5,0],4,C.eq)+lnS([a[0]+1,0],[a[0]+9,0],3,C.eq)+lnS([z[0]-9,0],[z[0]-1,0],3,C.eq);}back+=plS(q.pts,10,C.pad)+plS(q.pts,2.2,C.bg,' opacity=".22"');}
    if(q.t==='dip')back+=lnS([q.x1,q.y],[q.x2,q.y],5,C.eq)+lnS([q.x1+3,q.y],[q.x1+3,0],4,C.eq2)+lnS([q.x2-3,q.y],[q.x2-3,0],4,C.eq2);
    if(q.t==='pullbar')back+=lnS(q.at,add(q.at,[0,14]),3,C.eq2)+cir(q.at,4,C.eq);
    if(q.t==='box')back+='<rect x="'+q.x+'" y="'+(-q.h)+'" width="'+q.w+'" height="'+q.h+'" rx="2.5" fill="'+C.eq2+'" stroke="'+C.eq+'" stroke-width="1.2"/>';
    if(q.t==='plate')back+=lnS([q.x,q.y1],[q.x,q.y2],6,C.eq2);
    if(q.t==='cable'){const h=eqPoint(J,q);if(q.from[1]>24&&!f.front){const px=q.from[0]+(q.from[0]>=J.hip[0]?7:-7);back+=lnS([px,q.from[1]+6],[px,0],7,C.eq2)+lnS([px-6,0],[px+6,0],4,C.eq2);}else if(!f.front&&q.from[1]<=24){back+=lnS([q.from[0]+(q.from[0]>=J.hip[0]?7:-7),q.from[1]+8],[q.from[0]+(q.from[0]>=J.hip[0]?7:-7),0],7,C.eq2);}back+=lnS(q.from,h,1.4,C.eq)+cir(q.from,5,'none',' stroke="'+C.eq+'" stroke-width="2"');front+=cir(h,3.5,C.eq);}
    if(q.t==='pad'){const c=Array.isArray(q.at)?q.at:eqPoint(J,q);front+=cir(c,6.5,C.pad,' stroke="'+C.bg+'" stroke-width="1.2"');}
  });
  f.eq.forEach(q=>{
    if(q.t==='rail')back+=lnS(q.from,q.to,q.w||4,C.eq2);
    if(q.t==='rect')back+='<rect x="'+q.x+'" y="'+(-(q.y+q.h))+'" width="'+q.w+'" height="'+q.h+'" rx="3" fill="'+C.eq2+'"/>';
    if(q.t==='lever'){const h=eqPoint(J,q);back+=lnS(q.from,h,4,C.eq)+cir(q.from,4,C.eq);}
    if(q.t==='platform'){const c=add(J.an1,q.off||[0,0]);back+=lnS(add(c,dir(q.ang,q.len/2)),sub(c,dir(q.ang,q.len/2)),6,C.eq);}
    if(q.t==='backpad'){const pts=[];for(let i=0;i<=8;i++){const t=torsoFrame(J,-0.05+1.05*i/8);pts.push(add(t.p,mul(t.back,q.o||16)));}back+=plS(pts,9,C.pad);}
    if(q.t==='grip'){const c=eqPoint(J,q);front+=cir(c,3.6,C.eq,' stroke="'+C.bg+'" stroke-width="1"');}
  });
  // Each layer: outline pass (wider, line colour) then fill pass, so joints inside a layer show no seams.
  const layer=(parts,fill,line)=>parts.map(([a,b,w1,w2])=>cap(a,b,w1+2*OW,w2+2*OW,line)).join('')+parts.map(([a,b,w1,w2])=>cap(a,b,w1,w2,fill)).join('');
  // far limbs
  mid+=layer([[J.hipF,J.k2,14,10],[J.k2,J.an2,10,7],[J.shF,J.e2,9.5,7.5],[J.e2,J.w2,7.5,6],[J.w2,J.w2,8,8]],C.far,C.farLine)+cap(J.f2[1],J.f2[0],7,5.5,C.farLine);
  // torso, neck, near leg
  const tp=torsoPath(J);
  mid+='<path d="'+tp+'" fill="'+C.line+'" stroke="'+C.line+'" stroke-width="'+2*OW+'" stroke-linejoin="round"/>'+[[J.sh,J.neck,7.5,7],[J.hipN,J.k1,15,10.5],[J.k1,J.an1,10.5,7]].map(([a,b,w1,w2])=>cap(a,b,w1+2*OW,w2+2*OW,C.line)).join('');
  mid+=cap(J.sh,J.neck,7.5,7,C.fig)+'<path d="'+tp+'" fill="'+C.fig+'"/>'+cap(J.hipN,J.k1,15,10.5,C.fig)+cap(J.k1,J.an1,10.5,7,C.fig);
  mid+=cap(J.heel,J.toe,7.5+OW,6+OW,C.line)+cap(J.heel,J.toe,7.5,6,C.shoe);
  const arm=layer([[J.shN,J.e1,10,8],[J.e1,J.w1,8,6.5],[J.w1,J.w1,8.6,8.6]],C.fig,C.line);
  const [mBody,mArm]=o.noMuscles?['','']:muscleShapes(J,ex,C);
  f.eq.forEach(q=>{
    if(q.t==='bar'){const c=eqPoint(J,q);front+=cir(c,17,C.plate,' stroke="'+C.bg+'" stroke-width="1.5"')+cir(c,13.5,'none',' stroke="'+C.bg+'" stroke-width="1" opacity=".3"')+cir(c,7,'none',' stroke="'+C.bg+'" stroke-width="1" opacity=".3"')+cir(c,3.5,C.bg)+cir(c,1.6,C.eq);}
    if(q.t==='db'){const c=eqPoint(J,q);const r=q.r||8;front+=cir(c,r,C.plate,' stroke="'+C.bg+'" stroke-width="1.5"')+cir(c,r*0.62,'none',' stroke="'+C.bg+'" stroke-width="1" opacity=".3"')+cir(c,1.8,C.bg);}
  });
  const barFirst=f.eq.some(q=>q.t==='bar'&&q.at==='hip');
  let over='';
  if(o.marks)over+=marksSVG(ex,J,k,A,B,b,C);
  if(bd&&bd.j){const p=J[bd.j]||J.hip;const q=add(p,bd.d||[0,0]);over+=cir(q,9,C.bad,' stroke="'+C.bg+'" stroke-width="2"')+lnS(add(q,[-3.5,-3.5]),add(q,[3.5,3.5]),2.2,C.bg)+lnS(add(q,[-3.5,3.5]),add(q,[3.5,-3.5]),2.2,C.bg);}
  return'<svg viewBox="'+b.x0.toFixed(1)+' '+(-(b.y0+b.h)).toFixed(1)+' '+b.w.toFixed(1)+' '+b.h.toFixed(1)+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+ex.n+'">'+back+mid+mBody+(barFirst?front+arm+mArm:arm+mArm+front)+headSVG(J,C)+over+'</svg>';
}

export {FC,FL,figSVG,figBounds,visMark};
