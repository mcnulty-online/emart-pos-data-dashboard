/* 이마트 POS 대시보드 · 맥널티커피 — 대시보드 엔진
   데이터는 data/*.js 에서 불러옵니다 (index.html 로더가 먼저 읽음). 이 파일은 데이터가 바뀌어도 수정할 필요가 없습니다. */
// ===== 월별 데이터 파일 → 내부 구조 D 로 병합 =====
// D.months = [[YYYY-MM, 일수]], D.stores/prods = 마스터, D.rows = [점포idx, 상품idx, [일자idx(첫 달 1일=0), 수량, 금액, ...]]
const D=(()=>{const man=window.__EMART.manifest,mas=window.__EMART.master,mon=window.__EMART.months;
  const keys=[...new Set(man.months)].filter(k=>mon[k]).sort();
  const stores=mas.stores.map(x=>x.slice()),prods=mas.prods.map(x=>x.slice()),sI=new Map(),pI=new Map();
  stores.forEach((s,i)=>sI.set(String(s[0]),i));prods.forEach((p,i)=>pI.set(String(p[0]),i));
  const typeOf=n=>/가상점/.test(n)?'온라인 가상점':/^SFM/.test(n)?'스타필드마켓(SFM)':/^EMF/.test(n)?'EMF·EMFC':/^EMEO/.test(n)?'기타':/^EM/.test(n)?'이마트(EM)':'기타';
  const sid=c=>{c=String(c);let i=sI.get(c);if(i==null){i=stores.length;stores.push([c,c,typeOf(c)]);sI.set(c,i);console.warn('마스터에 없는 점포코드',c)}return i};
  const pid=c=>{c=String(c);let i=pI.get(c);if(i==null){i=prods.length;prods.push([c,c,'미분류','미분류','미분류']);pI.set(c,i);console.warn('마스터에 없는 상품코드',c)}return i};
  const rowMap=new Map(),months=[];let off=0;
  for(const k of keys){const M=mon[k];months.push([k,M.days]);
    for(const [sc,pc,f] of M.rows){const si=sid(sc),pi=pid(pc),key=si*100000+pi;let r=rowMap.get(key);if(!r){r=[si,pi,[]];rowMap.set(key,r)}
      for(let i=0;i<f.length;i+=3)r[2].push(off+f[i]-1,f[i+1],f[i+2])}
    off+=M.days}
  return{months,stores,prods,rows:[...rowMap.values()],holidays:mas.holidays||{},updated:man.updated}})();
const DOW='월화수목금토일';
/* ---------- 월 · 일자 모델 (월 추가 시 D.months 와 rows 일자 인덱스만 늘리면 됨) ---------- */
const MONTHS=(()=>{let off=0;return D.months.map(([key,days],i)=>{const [y,m]=key.split('-').map(Number);const o={i,key,y,m,days,cal:new Date(y,m,0).getDate(),off,dow0:(new Date(y,m-1,1).getDay()+6)%7,label:m+'월'};off+=days;return o})})();
const NM=MONTHS.length, ND=MONTHS.reduce((s,m)=>s+m.days,0);
const HOLI=D.holidays;  // data/master.js 의 holidays
const DAYS=[];MONTHS.forEach(M=>{let sun=0;for(let d=1;d<=M.days;d++){const dow=(M.dow0+d-1)%7;const ds=`${M.y}-${String(M.m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;const nt=[];if(HOLI[ds])nt.push(HOLI[ds]);if(dow===6){sun++;if(sun===2||sun===4)nt.push('의무휴업일(추정)')}DAYS.push({mi:M.i,m:M.m,d,dow,note:nt.join(' · '),red:dow>=5||nt.length>0})}});
const dLab=g=>`${DAYS[g].m}/${DAYS[g].d}(${DOW[DAYS[g].dow]})`;

const ROWS=D.rows.map(([s,p,f])=>{const q=new Float64Array(ND),a=new Float64Array(ND);for(let i=0;i<f.length;i+=3){q[f[i]]+=f[i+1];a[f[i]]+=f[i+2]}const mq=new Float64Array(NM),ma=new Float64Array(NM);MONTHS.forEach(M=>{for(let i=M.off;i<M.off+M.days;i++){mq[M.i]+=q[i];ma[M.i]+=a[i]}});const cq=new Float64Array(ND+1),ca=new Float64Array(ND+1);for(let i=0;i<ND;i++){cq[i+1]=cq[i]+q[i];ca[i+1]=ca[i]+a[i]}return{s,p,q,a,mq,ma,cq,ca}});
const STORES=D.stores.map(([code,name,type],i)=>({i,code,name,type,online:type==='온라인 가상점'}));
const PRODS=D.prods.map(([code,name,mid,sub,brand],i)=>({i,code,name,mid,sub,brand,grp:mid==='원두커피'?'원두커피':mid==='인스턴트커피'?'인스턴트커피':'차류'}));
const F={type:'all',store:'all',mid:'all',sub:'all',brand:'all',prod:'all'};
let METRIC='a', TAB='ov', DPROD=null, DSTORE=null, MXDIM='s';
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- 기간 ---------- */
// 월별: C=선택월, B=전월(비교)   누적: C=첫 달~선택월, B 없음
const rng=(s,e)=>s===e?`${DAYS[s].m}/${DAYS[s].d}`:`${DAYS[s].m}/${DAYS[s].d}~${DAYS[e].m}/${DAYS[e].d}`;
// 월 주차: 월요일 시작, 월 경계에서 자름 (1일이 속한 주 = 1주차)
const MWEEKS=MONTHS.map(M=>{const w=[];for(let d=0;d<M.days;d++){const g=M.off+d;if(d===0||DAYS[g].dow===0)w.push({s:g,e:g});else w[w.length-1].e=g}return w.map((o,i)=>({...o,n:i+1,mi:M.i,label:`${M.m}월 ${i+1}주차`,range:rng(o.s,o.e)}))});
// 기간: 월별(선택 월, 주차 선택 시 그 주) vs 직전 기간 · 누적(첫날 ~ 선택 월말 또는 선택 주차 끝)
const PER={mode:'m',mi:NM-1,wk:-1};
let SEGS=[],NSG=1,C=[],B=null,COLM=[],PAIR=null,CURR={s:0,e:0},BASER=null;
const mkSeg=(s,e,label,cmp)=>({s,e,off:s,days:e-s+1,label,cmp:cmp||label});
function setPeriod(){const mi=PER.mi,M=MONTHS[mi];if(PER.wk>=MWEEKS[mi].length)PER.wk=-1;const W=PER.wk>=0?MWEEKS[mi][PER.wk]:null;
  if(PER.mode==='m'){
    if(!W){const part=M.days<M.cal,cur=mkSeg(M.off,M.off+M.days-1,part?`${M.label}(1~${M.days}일)`:M.label),P_=mi>0?MONTHS[mi-1]:null;
      // 진행 중인 달이면 전월도 같은 날짜까지만 비교 (전월 동기간)
      const pd=P_?(part?Math.min(M.days,P_.days):P_.days):0;SEGS=P_?[mkSeg(P_.off,P_.off+pd-1,part?`${P_.label}(1~${pd}일)`:P_.label,part?`${P_.label} 동기간`:P_.label),cur]:[cur]}
    else{const len=W.e-W.s+1,cur=mkSeg(W.s,W.e,W.range),bs=W.s-len;SEGS=bs>=0?[mkSeg(bs,W.s-1,rng(bs,W.s-1),len===7?'전주':`직전 ${len}일`),cur]:[cur]}
    C=[SEGS.length-1];B=SEGS.length>1?[0]:null;
  }else{const end=W?W.e:M.off+M.days-1;SEGS=[];for(let k=0;k<=mi;k++){const Mk=MONTHS[k],me=Mk.off+Mk.days-1,e=Math.min(end,me);SEGS.push(mkSeg(Mk.off,e,(e<me||Mk.days<Mk.cal)?`${Mk.m}월(~${DAYS[e].d}일)`:Mk.label))}
    C=SEGS.map((_,i)=>i);B=null}
  NSG=SEGS.length;COLM=SEGS.map((_,i)=>i);PAIR=NSG>1?[NSG-2,NSG-1]:null;
  CURR={s:SEGS[C[0]].s,e:SEGS[C[C.length-1]].e};BASER=B?{s:SEGS[0].s,e:SEGS[0].e}:null;
  for(const r of ROWS){r.mq=new Float64Array(NSG);r.ma=new Float64Array(NSG);for(let k=0;k<NSG;k++){const g=SEGS[k];r.mq[k]=r.cq[g.e+1]-r.cq[g.s];r.ma[k]=r.ca[g.e+1]-r.ca[g.s]}}}
const CUM=()=>PER.mode==='c';
const isWk=()=>PER.wk>=0;
const MULTI=()=>CUM()&&C.length>1;
const ML=k=>SEGS[k].label;
const perLabel=()=>{const M=MONTHS[PER.mi];if(CUM())return isWk()?`${rng(0,CURR.e)} 누적`:(PER.mi>0?`${MONTHS[0].m}~${M.m}월 누적`:`${M.label} 누적`);return isWk()?`${MWEEKS[PER.mi][PER.wk].label}(${MWEEKS[PER.mi][PER.wk].range})`:(M.days<M.cal?`${M.label}(1~${M.days}일)`:M.label)};
const daysOf=ks=>ks.reduce((s,k)=>s+SEGS[k].days,0);
function hexMix(a,b,t){const p=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};const x=p(a),y=p(b);return'#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}
function mc(pos,n){if(pos===n-1)return css('--s9');const back=n-2-pos;return back<=0?css('--s8'):hexMix(css('--s8'),css('--surface'),Math.min(.65,back*.22))}
const colColor=k=>mc(COLM.indexOf(k),COLM.length);

/* ---------- format ---------- */
const nf=new Intl.NumberFormat('ko-KR');
const fInt=v=>v==null||isNaN(v)||!isFinite(v)?'-':nf.format(Math.round(v));
function fMan(v){if(v==null||isNaN(v)||!isFinite(v))return'-';const neg=v<0;v=Math.abs(v);let s;if(v>=1e8){const e=Math.floor(v/1e8),m=Math.round((v-e*1e8)/1e4);s=m?`${e}억 ${nf.format(m)}만`:`${e}억`}else if(v>=1e4){s=`${nf.format(Math.round(v/1e4))}만`}else s=nf.format(Math.round(v));return(neg?'-':'')+s}
const fAxis=v=>METRIC==='a'?(Math.abs(v)>=1e4?nf.format(Math.round(v/1e4))+'만':nf.format(v)):nf.format(Math.round(v));
const fVal=v=>METRIC==='a'?fInt(v)+'원':fInt(v)+'개';
const fValS=v=>METRIC==='a'?fMan(v)+'원':fInt(v)+'개';
const dv=(a,b)=>b?a/b:null;
function mom(a,b){if(!a&&!b)return null;if(!a)return Infinity;return b/a-1}
function momH(r){if(r==null)return'<span class="flat">-</span>';if(r===Infinity)return'<span class="up">신규</span>';if(r<=-1)return'<span class="down">판매중단</span>';const p=(r*100).toFixed(1);if(Math.abs(r)<0.0005)return'<span class="flat">0.0%</span>';return r>0?`<span class="up">▲${p}%</span>`:`<span class="down">▼${Math.abs(r*100).toFixed(1)}%</span>`}
function dH(v,fmt=fInt){if(!v)return'<span class="flat">0</span>';return v>0?`<span class="up">+${fmt(v)}</span>`:`<span class="down">${fmt(v)}</span>`}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- data ---------- */
function rowsFor(over={}){const f={...F,...over};return ROWS.filter(r=>{const s=STORES[r.s],p=PRODS[r.p];return SOK[r.s]&&(f.type==='all'||s.type===f.type)&&(f.store==='all'||r.s===+f.store)&&(f.mid==='all'||p.mid===f.mid)&&(f.sub==='all'||p.sub===f.sub)&&(f.brand==='all'||p.brand===f.brand)&&(f.prod==='all'||r.p===+f.prod)})}
const newO=()=>({mq:new Float64Array(NSG),ma:new Float64Array(NSG),qC:0,aC:0,qB:0,aB:0,n:new Float64Array(NSG),nC:0,nB:0,k:new Float64Array(NSG),kC:0,kB:0});
function addO(o,r,qC,aC,qB,aB){for(let k=0;k<NSG;k++){o.mq[k]+=r.mq[k];o.ma[k]+=r.ma[k]}o.qC+=qC;o.aC+=aC;o.qB+=qB;o.aB+=aB}
function agg(rows){const q=new Float64Array(ND),a=new Float64Array(ND),P=new Map(),S=new Map(),T=newO();
  for(const r of rows){for(let i=0;i<ND;i++){q[i]+=r.q[i];a[i]+=r.a[i]}
    let qC=0,aC=0,qB=0,aB=0;for(const k of C){qC+=r.mq[k];aC+=r.ma[k]}if(B)for(const k of B){qB+=r.mq[k];aB+=r.ma[k]}
    addO(T,r,qC,aC,qB,aB);
    let p=P.get(r.p);if(!p){p=newO();p.i=r.p;P.set(r.p,p)}addO(p,r,qC,aC,qB,aB);for(let k=0;k<NSG;k++)p.n[k]+=r.mq[k]>0;p.nC+=qC>0;p.nB+=qB>0;
    let s=S.get(r.s);if(!s){s=newO();s.i=r.s;S.set(r.s,s)}addO(s,r,qC,aC,qB,aB);for(let k=0;k<NSG;k++)s.k[k]+=r.mq[k]>0;s.kC+=qC>0;s.kB+=qB>0}
  const st=new Float64Array(NSG),sk=new Float64Array(NSG);let stC=0,stB=0,skC=0,skB=0;
  S.forEach(s=>{for(let k=0;k<NSG;k++)st[k]+=s.mq[k]>0;stC+=s.qC>0;stB+=s.qB>0});P.forEach(p=>{for(let k=0;k<NSG;k++)sk[k]+=p.mq[k]>0;skC+=p.qC>0;skB+=p.qB>0});
  return{q,a,P,S,T,st,sk,stC,stB,skC,skB}}
const VC=o=>METRIC==='a'?o.aC:o.qC, VB=o=>METRIC==='a'?o.aB:o.qB, VM=(o,k)=>METRIC==='a'?o.ma[k]:o.mq[k];
function storeUniverse(over={}){const f={...F,...over};return STORES.filter(s=>SOK[s.i]&&(f.type==='all'||s.type===f.type)&&(f.store==='all'||s.i===+f.store))}

/* ---------- tooltip ---------- */
const TT=document.getElementById('tt');
function tip(html,x,y){TT.innerHTML=html;TT.style.display='block';const w=TT.offsetWidth,h=TT.offsetHeight;let L=x+14,T=y+14;if(L+w>innerWidth-8)L=x-w-14;if(T+h>innerHeight-8)T=y-h-14;TT.style.left=Math.max(8,L)+'px';TT.style.top=Math.max(8,T)+'px'}
const untip=()=>TT.style.display='none';

/* ---------- charts ---------- */
function niceStep(r){const e=Math.pow(10,Math.floor(Math.log10(r)));const f=r/e;return(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e}
function scale(min,max,n=4){if(max<=min)max=min+1;const st=niceStep((max-min)/n);const lo=Math.floor(min/st)*st,hi=Math.ceil(max/st)*st;const t=[];for(let v=lo;v<=hi+st/2;v+=st)t.push(v);return{lo,hi,t}}
function legendH(series){return`<div class="legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>`}

function lineChart(el,{labels,series,tipF,height=250,fmt=fAxis,marks=[]}){
  const W=Math.max(280,el.clientWidth),H=height,m={l:52,r:12,t:marks.length?18:8,b:24},iw=W-m.l-m.r,ih=H-m.t-m.b,n=labels.length;
  const all=series.flatMap(s=>s.values.filter(v=>v!=null));const sc=scale(Math.min(0,...all),Math.max(1,...all));
  const x=i=>m.l+(n<2?iw/2:i*iw/(n-1)),y=v=>m.t+ih-(v-sc.lo)/(sc.hi-sc.lo)*ih;
  const step=n<=12?Math.max(1,Math.ceil(n*60/iw)):Math.max(1,Math.ceil(n*44/iw/5)*5);
  let g=`<g class="axis">`;for(const v of sc.t){g+=`<line class="${v===0?'base':'gridl'}" x1="${m.l}" x2="${W-m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l-6}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`}
  labels.forEach((l,i)=>{if(i%step===0&&(n-1-i>=step*.6||i===0))g+=`<text x="${x(i)}" y="${H-6}" text-anchor="middle">${l}</text>`});
  if(n>1)g+=`<text x="${x(n-1)}" y="${H-6}" text-anchor="end">${labels[n-1]}</text>`;g+='</g>';
  for(const k of marks)g+=`<line x1="${x(k.i)}" x2="${x(k.i)}" y1="${m.t-4}" y2="${m.t+ih}" stroke="var(--border-2)" stroke-dasharray="3 3"/><text class="mark-l" x="${x(k.i)+4}" y="${m.t-6}">${k.label}</text>`;
  let p='';for(const s of series){let d='',pen=false;s.values.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?'L':'M')+x(i).toFixed(1)+','+y(v).toFixed(1);pen=true});p+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`}
  let hv=`<line id="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t+ih}" stroke="var(--border-2)" stroke-width="1" style="display:none"/>`;series.forEach((s,k)=>hv+=`<circle data-k="${k}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2" style="display:none"/>`);
  el.innerHTML=legendH(series)+`<svg width="${W}" height="${H}">${g}${p}${hv}<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;
  const svg=el.querySelector('svg'),xh=svg.querySelector('#xh'),dots=svg.querySelectorAll('circle'),ov=svg.querySelector('rect:last-of-type');
  ov.addEventListener('mousemove',e=>{const b=svg.getBoundingClientRect();let i=n<2?0:Math.round((e.clientX-b.left-m.l)/(iw/(n-1)));i=Math.max(0,Math.min(n-1,i));xh.setAttribute('x1',x(i));xh.setAttribute('x2',x(i));xh.style.display='';
    dots.forEach((c,k)=>{const v=series[k].values[i];if(v==null){c.style.display='none'}else{c.setAttribute('cx',x(i));c.setAttribute('cy',y(v));c.style.display=''}});tip(tipF(i),e.clientX,e.clientY)});
  ov.addEventListener('mouseleave',()=>{xh.style.display='none';dots.forEach(c=>c.style.display='none');untip()});
}

function hbarChart(el,{cats,series,right,tipF,fmt=fAxis,labelW,rw=74}){
  const W=Math.max(280,el.clientWidth),bar=series.length>2?7:9,gap=2,grp=12,rh=series.length*bar+(series.length-1)*gap+grp;
  const lw=labelW||Math.min(150,W*.34),H=cats.length*rh+22,iw=W-lw-rw-8;
  const all=series.flatMap(s=>s.values);const sc=scale(Math.min(0,...all),Math.max(1,...all),3);const x=v=>lw+(v-sc.lo)/(sc.hi-sc.lo)*iw;
  let g=`<g class="axis">`;for(const v of sc.t)g+=`<line class="${v===0?'base':'gridl'}" x1="${x(v)}" x2="${x(v)}" y1="0" y2="${H-18}"/><text x="${x(v)}" y="${H-4}" text-anchor="middle">${fmt(v)}</text>`;g+='</g>';
  let b='';const maxc=Math.floor(lw/11.5);
  cats.forEach((c,ci)=>{const y0=ci*rh+grp/2;const lab=c.length>maxc?c.slice(0,maxc-1)+'…':c;b+=`<text class="lbl" x="${lw-8}" y="${y0+rh/2-grp/2+4}" text-anchor="end">${esc(lab)}</text>`;
    series.forEach((s,k)=>{const v=s.values[ci],yy=y0+k*(bar+gap),x0=x(Math.min(0,v)),w=Math.max(1,Math.abs(x(v)-x(0)));b+=`<rect x="${x0}" y="${yy}" width="${w}" height="${bar}" rx="3" fill="${s.color}"/>`});
    if(right)b+=`<foreignObject x="${W-rw}" y="${y0-2}" width="${rw}" height="${rh}"><div style="font-size:11.5px;text-align:right;line-height:${rh-grp+4}px;font-variant-numeric:tabular-nums;white-space:nowrap">${right(ci)}</div></foreignObject>`;
    b+=`<rect data-i="${ci}" class="hit" x="0" y="${ci*rh}" width="${W}" height="${rh}" fill="transparent"/>`});
  el.innerHTML=legendH(series)+`<svg width="${W}" height="${H}">${g}${b}</svg>`;
  el.querySelectorAll('.hit').forEach(r=>{r.addEventListener('mousemove',e=>{r.setAttribute('fill','rgba(127,127,127,.06)');tip(tipF(+r.dataset.i),e.clientX,e.clientY)});r.addEventListener('mouseleave',()=>{r.setAttribute('fill','transparent');untip()})});
}

function vbarChart(el,{cats,series,tipF,height=200,fmt=fAxis}){
  const W=Math.max(260,el.clientWidth),H=height,m={l:52,r:8,t:8,b:22},iw=W-m.l-m.r,ih=H-m.t-m.b;
  const all=series.flatMap(s=>s.values);const sc=scale(0,Math.max(1,...all));const y=v=>m.t+ih-(v-sc.lo)/(sc.hi-sc.lo)*ih;
  const cw=iw/cats.length,bw=Math.min(18,(cw-14)/series.length);
  let g=`<g class="axis">`;for(const v of sc.t)g+=`<line class="${v===0?'base':'gridl'}" x1="${m.l}" x2="${W-m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l-6}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`;
  cats.forEach((c,i)=>g+=`<text x="${m.l+cw*i+cw/2}" y="${H-5}" text-anchor="middle">${c}</text>`);g+='</g>';
  let b='';cats.forEach((c,i)=>{const cx=m.l+cw*i+cw/2-(series.length*bw+(series.length-1)*2)/2;series.forEach((s,k)=>{const v=s.values[i];b+=`<path d="${roundTop(cx+k*(bw+2),y(v),bw,y(0)-y(v))}" fill="${s.color}"/>`});b+=`<rect class="hit" data-i="${i}" x="${m.l+cw*i}" y="${m.t}" width="${cw}" height="${ih}" fill="transparent"/>`});
  el.innerHTML=legendH(series)+`<svg width="${W}" height="${H}">${g}${b}</svg>`;
  el.querySelectorAll('.hit').forEach(r=>{r.addEventListener('mousemove',e=>{r.setAttribute('fill','rgba(127,127,127,.06)');tip(tipF(+r.dataset.i),e.clientX,e.clientY)});r.addEventListener('mouseleave',()=>{r.setAttribute('fill','transparent');untip()})});
}
function roundTop(x,y,w,h){if(h<=0)return'';const r=Math.min(4,w/2,h);return`M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`}

function scatter(el,{pts,xl,yl,refX,refY,groups,tipF,labelIf}){
  const W=Math.max(280,el.clientWidth),H=360,m={l:58,r:16,t:12,b:38},iw=W-m.l-m.r,ih=H-m.t-m.b;
  const sx=scale(0,Math.max(1,...pts.map(p=>p.x))),sy=scale(0,Math.max(1,...pts.map(p=>p.y)));
  const x=v=>m.l+(v-sx.lo)/(sx.hi-sx.lo)*iw,y=v=>m.t+ih-(v-sy.lo)/(sy.hi-sy.lo)*ih;
  let g=`<g class="axis">`;for(const v of sy.t)g+=`<line class="${v===0?'base':'gridl'}" x1="${m.l}" x2="${W-m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l-6}" y="${y(v)+4}" text-anchor="end">${fAxis(v)}</text>`;
  for(const v of sx.t)g+=`<text x="${x(v)}" y="${m.t+ih+15}" text-anchor="middle">${v}</text>`;
  g+=`<text x="${m.l+iw/2}" y="${H-4}" text-anchor="middle">${xl}</text><text transform="translate(12,${m.t+ih/2}) rotate(-90)" text-anchor="middle">${yl}</text></g>`;
  g+=`<line x1="${x(refX)}" x2="${x(refX)}" y1="${m.t}" y2="${m.t+ih}" stroke="var(--muted)" stroke-dasharray="3 4"/><line x1="${m.l}" x2="${W-m.r}" y1="${y(refY)}" y2="${y(refY)}" stroke="var(--muted)" stroke-dasharray="3 4"/>`;
  g+=`<text class="lbl" x="${m.l+6}" y="${m.t+12}">입점 확대 기회</text><text class="lbl" x="${W-m.r-6}" y="${m.t+12}" text-anchor="end">핵심 상품</text><text class="lbl" x="${m.l+6}" y="${m.t+ih-6}">정리 검토</text><text class="lbl" x="${W-m.r-6}" y="${m.t+ih-6}" text-anchor="end">회전율 개선</text>`;
  let d='',lb='';const placed=[];pts.forEach((p,i)=>{d+=`<circle class="pt" data-i="${i}" cx="${x(p.x)}" cy="${y(p.y)}" r="5" fill="${p.color}" stroke="var(--surface)" stroke-width="2"/>`});
  pts.forEach(p=>placed.push([x(p.x)-5,y(p.y)-5,x(p.x)+5,y(p.y)+5]));placed.push([m.l,m.t,m.l+100,m.t+16],[W-m.r-80,m.t,W-m.r,m.t+16],[m.l,m.t+ih-18,m.l+80,m.t+ih],[W-m.r-90,m.t+ih-18,W-m.r,m.t+ih]);
  pts.filter(labelIf).sort((a,b)=>(b.p.aC||0)-(a.p.aC||0)).forEach(p=>{const nm=p.short,w=nm.length*10.5+4,px=x(p.x),py=y(p.y);
    const cands=[[px+8,py+4,'start',px+8],[px-8,py+4,'end',px-8-w],[px+6,py-9,'start',px+6],[px+6,py+17,'start',px+6],[px-6,py-9,'end',px-6-w],[px-6,py+17,'end',px-6-w]];
    for(const [tx,ty,an,bx1] of cands){const bx2=bx1+w,by1=ty-11,by2=ty+2;if(bx1<m.l||bx2>W-m.r||by1<m.t)continue;if(placed.some(b=>bx1<b[2]&&bx2>b[0]&&by1<b[3]&&by2>b[1]))continue;placed.push([bx1,by1,bx2,by2]);lb+=`<text class="lbl" x="${tx}" y="${ty}" text-anchor="${an}">${esc(nm)}</text>`;break}});
  el.innerHTML=`<div class="legend">${groups.map(g=>`<span><i style="background:${g.color}"></i>${g.name}</span>`).join('')}</div><svg width="${W}" height="${H}">${g}${lb}${d}</svg>`;
  el.querySelectorAll('.pt').forEach(c=>{c.addEventListener('mousemove',e=>{c.setAttribute('r',7);tip(tipF(pts[+c.dataset.i]),e.clientX,e.clientY)});c.addEventListener('mouseleave',()=>{c.setAttribute('r',5);untip()})});
}

/* ---------- table ---------- */
// col: {k,l,f,g,v(row),h(row),nm,tl,nf(합계행 비움)}
function table(el,opt){const{cols,data,key,sort,dir=-1,onClick,sel,foot,first}=opt;
  if(!el._st||!cols.some(c=>c.k===el._st.sort))el._st={sort,dir};const st=el._st;const c=cols.find(c=>c.k===st.sort)||cols[0];
  const val=(r,c)=>c.v?c.v(r):r[c.k];
  const rows=[...data].sort((a,b)=>{let x=val(a,c),y=val(b,c);if(typeof x==='string'||typeof y==='string')return st.dir*String(x??'').localeCompare(String(y??''),'ko');x=x==null||isNaN(x)?-Infinity:x;y=y==null||isNaN(y)?-Infinity:y;if(x===Infinity)x=1e15;if(y===Infinity)y=1e15;return st.dir*(x-y)});
  const fmt=(r,c)=>{const v=val(r,c);switch(c.f){case'int':return fInt(v);case'mom':return momH(v);case'pct':return v==null||isNaN(v)?'-':(v*100).toFixed(1)+'%';case'd':return v==null?'-':dH(v);case'html':return c.h(r);default:return esc(v??'')}};
  const tl=c=>c.f==='text'||c.tl?'tl':'';
  let h=`<table class="t"><thead>`;if(cols.some(c=>c.g)){h+='<tr>';let i=0;while(i<cols.length){const g=cols[i].g||'';let n=1;while(i+n<cols.length&&(cols[i+n].g||'')===g&&g)n++;h+=`<th class="grp ${i===0&&first?'first':''}" colspan="${n}">${g}</th>`;i+=n}h+='</tr>'}
  h+='<tr>'+cols.map((c,i)=>`<th data-k="${c.k}" class="${tl(c)} ${i===0&&first?'first':''}">${c.l}${st.sort===c.k?`<span class="ar">${st.dir<0?'▼':'▲'}</span>`:''}</th>`).join('')+'</tr></thead><tbody>';
  for(const r of rows)h+=`<tr class="${onClick?'click':''} ${sel!=null&&r[key]===sel?'sel':''}" data-id="${r[key]}">`+cols.map((c,i)=>`<td class="${tl(c)} ${c.nm?'nm':''} ${i===0&&first?'first':''}" ${c.nm?`title="${esc(val(r,c))}"`:''}>${fmt(r,c)}</td>`).join('')+'</tr>';
  h+='</tbody>';if(foot)h+=`<tfoot><tr>${cols.map((c,i)=>`<td class="${tl(c)} ${i===0&&first?'first':''}">${i===0?esc(foot.label):(c.nf||c.f==='text'||(c.f==='html'&&!c.ff))?'':fmt(foot,c)}</td>`).join('')}</tr></tfoot>`;
  el.innerHTML=h+'</table>';el._rows=rows;el._cols=cols;
  el.querySelectorAll('th[data-k]').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(st.sort===k)st.dir*=-1;else{st.sort=k;st.dir=cols.find(c=>c.k===k).f==='text'?1:-1}table(el,opt)});
  if(onClick)el.querySelectorAll('tbody tr').forEach(tr=>tr.onclick=()=>onClick(tr.dataset.id));
}
function csvDL(name,head,lines){const q=s=>{s=String(s??'');return/[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};const txt='﻿'+[head.map(q).join(','),...lines.map(l=>l.map(q).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'}));a.download=name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function csv(el,name,suf){const cols=el._cols,rows=el._rows;if(!cols)return;const v=(r,c)=>{const x=c.v?c.v(r):r[c.k];if(c.f==='mom'||c.f==='pct'){if(x==null||isNaN(x))return'';if(x===Infinity)return'신규';return(x*100).toFixed(1)+'%'}if(c.csv)return c.csv(r);return x??''};
  csvDL(suf===''?name:`${name}_${suf??perLabel().replace(/\s/g,'')}`,cols.map(c=>(c.g?c.g+' ':'')+c.l),rows.map(r=>cols.map(c=>v(r,c))))}

/* 기간 컬럼 묶음: 월별 = 전월/당월(+MoM), 누적 = 각 월(+누적) */
function perCols(g,key,get,{momKey,cumKey,diff}={}){const cols=COLM.map(k=>({k:key+k,l:ML(k),f:'int',g,v:r=>get(r,k)}));
  if(B&&momKey)cols.push(diff?{k:key+'d',l:'증감',f:'d',g,v:r=>r[momKey+'C']-r[momKey+'B']}:{k:key+'m',l:isWk()?'증감률':'MoM',f:'mom',g,v:r=>mom(r[momKey+'B'],r[momKey+'C'])});
  if(MULTI()&&cumKey)cols.push({k:key+'c',l:'누적',f:'int',g,v:r=>r[cumKey]});
  return cols}
const sortKey=(key)=>MULTI()?key+'c':key+C.at(-1);

/* ---------- filters / controls ---------- */
const $=id=>document.getElementById(id);
const uniq=a=>[...new Set(a)];
function opts(sel,list,cur,allLabel){sel.innerHTML=`<option value="all">${allLabel}</option>`+list.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join('');sel.value=list.some(([v])=>String(v)===String(cur))?cur:'all';return sel.value}
function buildFilters(){
  F.type=opts($('f-type'),uniq(STORES.filter(s=>SOK[s.i]).map(s=>s.type)).map(t=>[t,t]),F.type,'전체 유형');
  F.store=opts($('f-store'),STORES.filter(s=>SOK[s.i]&&(F.type==='all'||s.type===F.type)).sort((a,b)=>a.name.localeCompare(b.name,'ko')).map(s=>[s.i,s.name]),F.store,`전체 점포`);
  F.mid=opts($('f-mid'),uniq(PRODS.map(p=>p.mid)).sort().map(t=>[t,t]),F.mid,'전체');
  F.sub=opts($('f-sub'),uniq(PRODS.filter(p=>F.mid==='all'||p.mid===F.mid).map(p=>p.sub)).sort().map(t=>[t,t]),F.sub,'전체');
  F.brand=opts($('f-brand'),uniq(PRODS.map(p=>p.brand)).map(t=>[t,t]),F.brand,'전체');
  F.prod=opts($('f-prod'),PRODS.filter(p=>(F.mid==='all'||p.mid===F.mid)&&(F.sub==='all'||p.sub===F.sub)&&(F.brand==='all'||p.brand===F.brand)).sort((a,b)=>a.name.localeCompare(b.name,'ko')).map(p=>[p.i,p.name]),F.prod,'전체 상품');
  activeF()}
function activeF(){const act=[`<b>${perLabel()}</b>${cmpTxt()?` (${cmpTxt()})`:''}`];if(F.type!=='all')act.push(F.type);if(F.store!=='all')act.push(STORES[F.store].name);if(F.mid!=='all')act.push(F.mid);if(F.sub!=='all')act.push(F.sub);if(F.brand!=='all')act.push(F.brand);if(F.prod!=='all')act.push(PRODS[F.prod].name);
  $('active-f').innerHTML='보는 기간: '+act.map((a,i)=>i?`<b>${esc(a)}</b>`:a).join(' · ')}

/* ---------- 점포 범위: 채널 · 매출규모(Tier) · 매출 상위 — 전 시트 공통 ---------- */
// Tier A = 매출 누적 상위 50%까지, B = 50~80%, C = 나머지. 순위 기준 = 선택 월(누적이면 누적 기간) 맥널티 전 품목 판매금액, 선택한 채널 안에서 산정
const SF={ch:'all',tier:'all',top:'all'};
let TIER=new Map(),RANK=new Map(),SOK=new Uint8Array(STORES.length).fill(1),TCNT={A:0,B:0,C:0},SCOPE_N=0;
const chOK=st=>SF.ch==='all'||(SF.ch==='off'?!st.online:st.online);
function tierBasis(){if(CUM())return{s:CURR.s,e:CURR.e,label:perLabel()};const M=MONTHS[PER.mi];return{s:M.off,e:M.off+M.days-1,label:M.label}}
function computeTiers(){const {s,e}=tierBasis(),tot=new Float64Array(STORES.length);for(const r of ROWS)tot[r.s]+=r.ca[e+1]-r.ca[s];
  const list=STORES.filter(chOK).sort((a,b)=>tot[b.i]-tot[a.i]);const sum=list.reduce((x,st)=>x+Math.max(0,tot[st.i]),0);let run=0;
  TIER=new Map();RANK=new Map();TCNT={A:0,B:0,C:0};
  list.forEach((st,i)=>{const t=tot[st.i]>0?(run<sum*.5?'A':run<sum*.8?'B':'C'):'C';run+=Math.max(0,tot[st.i]);RANK.set(st.i,i+1);TIER.set(st.i,t);TCNT[t]++});
  SCOPE_N=0;STORES.forEach(st=>{const ok=chOK(st)&&(SF.tier==='all'||TIER.get(st.i)===SF.tier)&&(SF.top==='all'||RANK.get(st.i)<=+SF.top);SOK[st.i]=ok?1:0;SCOPE_N+=ok})}
const tierH=i=>{const t=TIER.get(i);return t?`<span class="tier ${t}" title="매출 ${RANK.get(i)}위">${t}</span>`:'-'};
const tierCol=()=>({k:'tier',l:'등급',f:'html',h:r=>tierH(r.id),v:r=>(TIER.get(r.id)||'Z')+String(RANK.get(r.id)||999).padStart(3,'0'),csv:r=>TIER.get(r.id)?`${TIER.get(r.id)}(${RANK.get(r.id)}위)`:''});
function buildScope(){$('sch').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===SF.ch));
  const nCh=STORES.filter(chOK).length;
  $('stier').innerHTML=`<option value="all">전체 등급</option><option value="A">Tier A · 매출 누적 50% (${TCNT.A}점)</option><option value="B">Tier B · 50~80% (${TCNT.B}점)</option><option value="C">Tier C · 하위 20% (${TCNT.C}점)</option>`;$('stier').value=SF.tier;
  $('stop').innerHTML=`<option value="all">전체 점포 (${nCh}점)</option><option value="30">Top 30</option><option value="50">Top 50</option>`;$('stop').value=SF.top;
  $('scur').innerHTML=`적용 점포 <b>${SCOPE_N}점</b> · 등급·순위 기준: <b>${tierBasis().label}</b> 맥널티 판매금액 (${SF.ch==='all'?'전체':SF.ch==='off'?'오프라인':'온라인 가상점'} 안에서 순위)`}
function applyScope(){computeTiers();buildScope();buildFilters();DPROD=null;DSTORE=null;NSF.store=null;NSF.prod=null;PRF.selP=null;PRF.selS=null;CUR=agg(rowsFor());renderKPIs(CUR);renderSheet()}
$('sch').querySelectorAll('button').forEach(b=>b.onclick=()=>{SF.ch=b.dataset.v;applyScope()});
$('stier').addEventListener('change',e=>{SF.tier=e.target.value;applyScope()});
$('stop').addEventListener('change',e=>{SF.top=e.target.value;applyScope()});
function cmpTxt(){return!CUM()&&B?`${SEGS[0].cmp}${isWk()?`(${ML(0)})`:''} 대비`:''}
function buildPeriod(){$('pmode').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===PER.mode));
  $('pmon-l').firstChild.textContent=CUM()?'누적 기간':'월 선택';
  $('pmon').innerHTML=MONTHS.map(M=>`<button data-i="${M.i}" class="${M.i===PER.mi?'on':''}">${CUM()&&M.i>0?`${MONTHS[0].m}~${M.m}월`:M.label}</button>`).join('');
  $('pmon').querySelectorAll('button').forEach(b=>b.onclick=()=>{PER.mi=+b.dataset.i;PER.wk=-1;applyPeriod()});
  const ws=MWEEKS[PER.mi];$('pwk').innerHTML=`<option value="-1">${CUM()?'월말까지':'월 전체'}</option>`+ws.map((w,i)=>`<option value="${i}">${CUM()?`~${w.n}주차 (~${DAYS[w.e].m}/${DAYS[w.e].d})`:`${w.n}주차 (${w.range})`}</option>`).join('');$('pwk').value=String(PER.wk);
  $('pcur').innerHTML=`보는 기간: <b>${perLabel()}</b>${cmpTxt()?' · '+cmpTxt():''}${!CUM()&&isWk()?' · 주차 = 월요일 시작, 월 경계에서 나눔':''}`;
  const first=MONTHS[0],last=MONTHS[NM-1];
  $('hdr-sub').textContent=`${first.y}년 ${first.m}월~${last.m}월 데이터 · 점포·상품별 일/주/월/누적 판매수량·판매금액 · 출처: 이마트 기간별매출(상품별) 일별상세`}
function applyPeriod(){setPeriod();buildPeriod();computeTiers();buildScope();activeF();DPROD=null;DSTORE=null;CUR=agg(rowsFor());renderKPIs(CUR);renderSheet()}
$('pwk').addEventListener('change',e=>{PER.wk=+e.target.value;applyPeriod()});
$('pmode').querySelectorAll('button').forEach(b=>b.onclick=()=>{PER.mode=b.dataset.v;applyPeriod()});
['type','store','mid','sub','brand','prod'].forEach(k=>$('f-'+k).addEventListener('change',e=>{F[k]=e.target.value;if(k==='type')F.store='all';if(k==='mid')F.sub='all';buildFilters();DPROD=null;DSTORE=null;render()}));
$('reset').onclick=()=>{Object.keys(F).forEach(k=>F[k]='all');DPROD=null;DSTORE=null;buildFilters();render()};
$('metric').querySelectorAll('button').forEach(b=>b.onclick=()=>{METRIC=b.dataset.m;$('metric').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));render()});
$('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{TAB=b.dataset.t;$('tabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('#sh-sales .panel').forEach(p=>p.classList.toggle('on',p.id==='p-'+TAB));renderTab()});
$('sheets').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('sheets').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('.sheet').forEach(s=>s.classList.toggle('on',s.id==='sh-'+b.dataset.s));renderSheet()});

/* ---------- KPIs ---------- */
function renderKPIs(A){const T=A.T;const k=(l,v,c)=>`<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="c">${c}</div></div>`;
  if(!CUM()){const M=SEGS[C[0]],dd=M.days,pb=B?SEGS[B[0]]:null,db=pb?pb.days:0;const none=`<span class="flat">비교할 ${isWk()?'직전 기간':'전월'} 데이터 없음</span>`;const lab=perLabel();
    const cm=(cur,prev,f)=>pb?`${momH(mom(prev,cur))} · ${pb.cmp} ${f(prev)}`:none;
    const cd=(cur,prev,u)=>pb?`${dH(cur-prev)} · ${pb.cmp} ${fInt(prev)}${u}`:none;
    const ps=dv(T.aC,A.stC),psb=dv(T.aB,A.stB),asp=dv(T.aC,T.qC),aspb=dv(T.aB,T.qB);
    $('kpis').innerHTML=
     k(`${lab} 판매금액`,fMan(T.aC)+'원',cm(T.aC,T.aB,v=>fMan(v)+'원'))+
     k(`${lab} 판매수량`,fInt(T.qC)+'개',cm(T.qC,T.qB,v=>fInt(v)+'개'))+
     k('일평균 판매금액',fMan(T.aC/dd)+'원',pb?`${momH(mom(T.aB/db,T.aC/dd))} · ${pb.cmp} ${fMan(T.aB/db)}원 (${db}일/${dd}일)`:`${dd}일 기준`)+
     k('일평균 판매수량',fInt(T.qC/dd)+'개',pb?`${momH(mom(T.qB/db,T.qC/dd))} · ${pb.cmp} ${fInt(T.qB/db)}개`:`${dd}일 기준`)+
     k('판매(도입) 점포수',fInt(A.stC)+'점',cd(A.stC,A.stB,'점'))+
     k('판매 SKU수',fInt(A.skC)+'개',cd(A.skC,A.skB,'개'))+
     k('점당 판매금액',fMan(ps)+'원',pb?`${momH(mom(psb,ps))} · ${pb.cmp} ${fMan(psb)}원`:none)+
     k('평균 판매단가',fInt(asp)+'원',pb?`${momH(mom(aspb,asp))} · ${pb.cmp} ${fInt(aspb)}원`:none);
  }else{const nM=C.length,dd=daysOf(C);const brk=(get,f)=>C.map(i=>`${ML(i)} ${f(get(i))}`).join(' · ');
    $('kpis').innerHTML=
     k(`${perLabel()} 판매금액`,fMan(T.aC)+'원',brk(i=>T.ma[i],v=>fMan(v)))+
     k(`${perLabel()} 판매수량`,fInt(T.qC)+'개',brk(i=>T.mq[i],v=>fInt(v)+'개'))+
     k('월평균 판매금액',fMan(T.aC/nM)+'원',`${nM}개월 평균${C.some(k=>SEGS[k].days<MONTHS[k].cal)?' (진행 중인 달 포함)':''} · 월평균 수량 ${fInt(T.qC/nM)}개`)+
     k('일평균 판매금액',fMan(T.aC/dd)+'원',`${dd}일 기준 · 일평균 수량 ${fInt(T.qC/dd)}개`)+
     k('판매(도입) 점포수 · 누적',fInt(A.stC)+'점',nM>1?brk(i=>A.st[i],v=>fInt(v)+'점'):'기간 중 1회 이상 판매')+
     k('판매 SKU수 · 누적',fInt(A.skC)+'개',nM>1?brk(i=>A.sk[i],v=>fInt(v)+'개'):'기간 중 1회 이상 판매')+
     k('점당 판매금액',fMan(dv(T.aC,A.stC))+'원','누적 금액 ÷ 누적 판매 점포')+
     k('평균 판매단가',fInt(dv(T.aC,T.qC))+'원',brk(i=>dv(T.ma[i],T.mq[i]),v=>fInt(v)+'원'));
  }}

/* ---------- 추이 시리즈 ---------- */
function trend(A,cum){const arr=METRIC==='a'?A.a:A.q;
  if(!CUM()){const cur=SEGS[C[0]],prev=B?SEGS[B[0]]:null,n=Math.max(cur.days,prev?prev.days:0);
    const take=M=>{const v=[];let t=0;for(let d=0;d<n;d++){if(d<M.days){t+=arr[M.off+d];v.push(cum?t:arr[M.off+d])}else v.push(null)}return v};
    const series=[];if(prev)series.push({name:(isWk()?prev.cmp+' '+prev.label:prev.label)+(cum?' 누계':''),color:mc(0,2),values:take(prev),M:prev});series.push({name:cur.label+(cum?' 누계':''),color:mc(1,2),values:take(cur),M:cur});
    const tipF=i=>{let h=`<div class="h">${isWk()?`${i+1}번째 날`:`${i+1}일`}${cum?' 누계':''}</div>`;const nts=[];series.forEach(s=>{if(i<s.M.days){h+=`<div class="r"><span><i style="background:${s.color}"></i>${dLab(s.M.off+i)}</span><b>${fVal(s.values[i])}</b></div>`;const nt=DAYS[s.M.off+i].note;if(nt)nts.push(`${dLab(s.M.off+i)}: ${nt}`)}});
      if(prev&&i<cur.days&&i<prev.days)h+=`<div class="r"><span>MoM</span><b>${momH(mom(series[0].values[i],series[1].values[i]))}</b></div>`;if(nts.length)h+=`<div class="n">${nts.join(' · ')}</div>`;return h};
    return{labels:Array.from({length:n},(_,i)=>isWk()?(i<cur.days?`${DAYS[cur.off+i].m}/${DAYS[cur.off+i].d}(${DOW[DAYS[cur.off+i].dow]})`:''):i+1),series,tipF,marks:[]}}
  const s0=CURR.s,e=CURR.e+1;const vals=[];let t=0;for(let g=s0;g<e;g++){t+=arr[g];vals.push(cum?t:arr[g])}
  const labels=[];for(let g=s0;g<e;g++)labels.push(`${DAYS[g].m}/${DAYS[g].d}`);
  const marks=C.slice(1).map(k=>({i:SEGS[k].off-s0,label:MONTHS[DAYS[SEGS[k].off].mi].label}));
  const series=[{name:cum?`${perLabel()} 누계`:'일별 판매',color:css('--s9'),values:vals}];
  const tipF=i=>{const g=s0+i;let run=0;for(let x=s0;x<=g;x++)run+=arr[x];return`<div class="h">${dLab(g)}</div><div class="r"><span>일 판매</span><b>${fVal(arr[g])}</b></div><div class="r"><span>기간 누계</span><b>${fVal(run)}</b></div>${DAYS[g].note?`<div class="n">${DAYS[g].note}</div>`:''}`};
  return{labels,series,tipF,marks}}

/* ---------- overview ---------- */
function renderOV(A){
  $('ov-t1').textContent=CUM()?`일별 추이 (${perLabel()})`:isWk()?`일별 추이 (${perLabel()} vs ${SEGS[0].cmp})`:'일별 추이 (같은 일자 MoM)';
  $('ov-d1').textContent=CUM()?'선택 기간의 모든 일자를 이어서 봅니다. 점선은 월 경계. 마우스를 올리면 요일·공휴일·의무휴업(추정) 정보가 표시됩니다.':isWk()?(B?`같은 일차끼리 ${SEGS[0].cmp}(${ML(0)})와 겹쳐 비교합니다. 가로축은 선택 주의 날짜입니다.`:'선택 주차 일별 판매. 직전 기간 데이터가 없어 비교선은 없습니다.'):(B?`같은 일자끼리 ${ML(B[0])}과 ${ML(C[0])}을 겹쳐 비교합니다. 마우스를 올리면 요일·공휴일·의무휴업(추정) 정보가 표시됩니다.`:`${ML(C[0])} 일별 판매. 이전 달 데이터가 없어 비교선은 없습니다.`);
  $('ov-t2').textContent=CUM()?`기간 누계 추이 (${perLabel()})`:isWk()?'주간 누계 추이':'월 누계(MTD) 추이';
  $('ov-d2').textContent=CUM()?'첫 달 1일부터 쌓아 올린 누계입니다.':isWk()?'선택 주의 일자별 누계. 같은 일차 기준으로 직전 기간 누계와 비교.':'일자별 월 누계. 같은 일자 기준 누계 비교.';
  $('ov-d3').textContent=CUM()?(MULTI()?'막대 = 월별, 오른쪽 숫자 = 기간 누적':'오른쪽 숫자 = 기간 누적'):(B?`오른쪽 숫자는 ${cmpTxt()} 증감률`:'오른쪽 숫자 = 선택 기간 실적');
  const t1=trend(A,false),t2=trend(A,true);lineChart($('c-daily'),t1);lineChart($('c-cum'),t2);
  // sub
  const subs=new Map();A.P.forEach(p=>{const s=PRODS[p.i].sub;let o=subs.get(s);if(!o){o=newO();subs.set(s,o)}for(let k=0;k<NSG;k++){o.mq[k]+=p.mq[k];o.ma[k]+=p.ma[k]}o.qC+=p.qC;o.aC+=p.aC;o.qB+=p.qB;o.aB+=p.aB});
  const sl=[...subs.entries()].sort((a,b)=>VC(b[1])-VC(a[1]));
  if(!sl.length){$('c-sub').innerHTML='<div class="empty">데이터 없음</div>'}else
  hbarChart($('c-sub'),{cats:sl.map(s=>s[0]),series:COLM.map(k=>({name:ML(k),color:colColor(k),values:sl.map(s=>VM(s[1],k))})),right:i=>B?momH(mom(VB(sl[i][1]),VC(sl[i][1]))):fValS(VC(sl[i][1])),labelW:96,
    tipF:i=>{const o=sl[i][1];return`<div class="h">${sl[i][0]}</div>`+COLM.map(k=>`<div class="r"><span><i style="background:${colColor(k)}"></i>${ML(k)}</span><b>${fVal(VM(o,k))}</b></div>`).join('')+(B?`<div class="r"><span>MoM</span><b>${momH(mom(VB(o),VC(o)))}</b></div>`:MULTI()?`<div class="r"><span>누적</span><b>${fVal(VC(o))}</b></div>`:'')}});
  // dow
  const arr=METRIC==='a'?A.a:A.q;const dowS=COLM.map(k=>{const M=SEGS[k],sum=Array(7).fill(0),cnt=Array(7).fill(0);for(let d=0;d<M.days;d++){const w=DAYS[M.off+d].dow;sum[w]+=arr[M.off+d];cnt[w]++}return{k,v:sum.map((v,i)=>cnt[i]?v/cnt[i]:0),cnt}});
  vbarChart($('c-dow'),{cats:DOW.split(''),series:dowS.map(o=>({name:ML(o.k),color:colColor(o.k),values:o.v})),tipF:i=>`<div class="h">${DOW[i]}요일 일평균</div>`+dowS.map(o=>`<div class="r"><span><i style="background:${colColor(o.k)}"></i>${ML(o.k)} (${o.cnt[i]}일)</span><b>${fVal(o.v[i])}</b></div>`).join('')+(B?`<div class="r"><span>MoM</span><b>${momH(mom(dowS[0].v[i],dowS[1].v[i]))}</b></div>`:'')});
  // type table
  const ty=new Map();A.S.forEach(s=>{const t=STORES[s.i].type;let o=ty.get(t);if(!o){o=newO();o.t=t;o.stC=0;ty.set(t,o)}for(let k=0;k<NSG;k++){o.mq[k]+=s.mq[k];o.ma[k]+=s.ma[k]}o.qC+=s.qC;o.aC+=s.aC;o.qB+=s.qB;o.aB+=s.aB;o.stC+=s.qC>0});
  const tot=A.T.aC||1;
  table($('t-type'),{key:'t',sort:sortKey('a'),data:[...ty.values()],cols:[{k:'t',l:'점포유형',f:'text'},{k:'stC',l:'점포',f:'int'},...perCols('','a',(r,k)=>r.ma[k],{momKey:'a',cumKey:'aC'}).map(c=>({...c,g:undefined,l:c.l==='누적'?'누적 금액':c.l==='MoM'?'MoM':c.l+' 금액'})),{k:'sh',l:'구성비',f:'pct',v:r=>r.aC/tot},{k:'ps',l:'점당',f:'int',v:r=>dv(r.aC,r.stC)}]});
}

/* ---------- product tab ---------- */
function prodRows(A){const tot=A.T.aC||1;return[...A.P.values()].map(p=>{const P=PRODS[p.i];return Object.assign(p,{id:p.i,name:P.name,sub:P.sub,brand:P.brand,sh:p.aC/tot})})}
function prodCols(){return[{k:'name',l:'상품명',f:'text',nm:1},{k:'sub',l:'소분류',f:'text'},
  ...perCols('판매수량','q',(r,k)=>r.mq[k],{momKey:'q',cumKey:'qC'}),
  ...perCols('판매금액(원)','a',(r,k)=>r.ma[k],{momKey:'a',cumKey:'aC'}),{k:'sh',l:'구성비',f:'pct',g:'판매금액(원)'},
  ...perCols('도입 점포수','n',(r,k)=>r.n[k],{momKey:'n',cumKey:'nC',diff:1}),
  {k:'per',l:CUM()?'점당매출(누적)':`점당매출 ${ML(C[0])}`,f:'int',g:'효율',v:r=>dv(r.aC,r.nC)},
  ...(B?[{k:'aspb',l:`단가 ${ML(B[0])}`,f:'int',g:'효율',v:r=>dv(r.aB,r.qB)}]:[]),
  {k:'asp',l:CUM()?'단가(누적)':`단가 ${ML(C[0])}`,f:'int',g:'효율',v:r=>dv(r.aC,r.qC)}]}
function totRow(A,label,cnt){const T=A.T;return Object.assign({},T,{label,sh:T.aC?1:null,n:cnt==='sku'?A.sk:A.st,nC:cnt==='sku'?A.skC:A.stC,nB:cnt==='sku'?A.skB:A.stB,k:A.sk,kC:A.skC,kB:A.skB})}
function renderPR(A){const q=$('s-prod').value.trim();let d=prodRows(A);if(q)d=d.filter(r=>r.name.includes(q));
  table($('t-prod'),{cols:prodCols(),data:d,key:'id',sort:sortKey(METRIC),onClick:id=>{DPROD=+id;renderPR(A);$('d-prod').scrollIntoView({behavior:'smooth',block:'start'})},sel:DPROD,first:1,foot:totRow(A,'합계')});
  renderDProd()}
function lostLabel(){return PAIR?`${ML(PAIR[0])} 판매 → ${ML(PAIR[1])} 미판매`:null}
function renderDProd(){const el=$('d-prod');if(DPROD==null){el.innerHTML='';return}
  const P=PRODS[DPROD];const rows=rowsFor({prod:DPROD,mid:'all',sub:'all',brand:'all'});const A=agg(rows);const T=A.T;
  const uni=storeUniverse().filter(s=>!s.online);
  const size=agg(rowsFor({prod:'all',mid:'all',sub:'all',brand:'all'})).S;
  const soldK=k=>new Set(rows.filter(r=>r.mq[k]>0).map(r=>r.s));
  const bySize=(a,b)=>((size.get(b.i)||{}).aC||0)-((size.get(a.i)||{}).aC||0);
  const lost=PAIR?(()=>{const a=soldK(PAIR[0]),b=soldK(PAIR[1]);return uni.filter(s=>a.has(s.i)&&!b.has(s.i)).sort(bySize)})():null;
  const anyS=new Set();COLM.forEach(k=>soldK(k).forEach(s=>anyS.add(s)));const none=uni.filter(s=>!anyS.has(s.i)).sort(bySize);
  const chip=s=>`<span class="chip"><b>${esc(s.name)}</b> ${fMan((size.get(s.i)||{}).aC||0)}</span>`;
  const nTxt=B?`${A.stB}→${A.stC}점`:MULTI()?`${A.stC}점 (월별 ${C.map(k=>A.st[k]).join('·')})`:`${A.stC}점`;
  el.innerHTML=`<div class="card detail"><button class="btn sm x" id="dp-x">닫기 ✕</button><h3>${esc(P.name)}</h3><p class="desc">${P.mid} › ${P.sub} · ${P.brand} · 상품코드 ${P.code} · 보는 기간 ${perLabel()}</p>
   <div class="mini-kpis"><span>${perLabel()} 금액 <b>${fInt(T.aC)}원</b> ${B?momH(mom(T.aB,T.aC)):''}</span><span>${perLabel()} 수량 <b>${fInt(T.qC)}개</b> ${B?momH(mom(T.qB,T.qC)):''}</span><span>도입 점포 <b>${nTxt}</b></span><span>점당 <b>${fInt(dv(T.aC,A.stC))}원</b></span><span>단가 <b>${B?fInt(dv(T.aB,T.qB))+'→':''}${fInt(dv(T.aC,T.qC))}원</b></span></div>
   <div class="grid g2"><div><div class="chart" id="dp-c"></div></div><div><div class="note" style="margin-bottom:4px">점포별 실적</div><div class="tbl-wrap" id="dp-t" style="max-height:290px"></div></div></div>
   <div class="grid g2" style="margin-top:12px">${lost?`<div><h3 style="font-size:13px;margin:0 0 6px">${lostLabel()} (이탈) <span class="pill">${lost.length}점</span></h3><div class="chips">${lost.map(chip).join('')||'<span class="note">없음</span>'}</div></div>`:'<div><h3 style="font-size:13px;margin:0 0 6px">이탈 점포</h3><span class="note">비교할 전월이 없습니다</span></div>'}
   <div><h3 style="font-size:13px;margin:0 0 6px">기간 내 미판매 (입점 확대 후보, 점포 총매출순) <span class="pill">${none.length}점</span></h3><div class="chips">${none.slice(0,40).map(chip).join('')||'<span class="note">없음</span>'}${none.length>40?`<span class="note">외 ${none.length-40}점</span>`:''}</div></div></div>
   <p class="note" style="margin-top:8px">오프라인 점포 기준. 칩 옆 금액은 해당 점포의 ${perLabel()} 맥널티 전체 판매금액(점포 규모 참고)입니다.</p></div>`;
  $('dp-x').onclick=()=>{DPROD=null;renderTab()};
  lineChart($('dp-c'),{...trend(A,false),height:270});
  table($('dp-t'),{key:'id',sort:sortKey('a'),data:[...A.S.values()].map(s=>Object.assign(s,{id:s.i,name:STORES[s.i].name})),cols:[{k:'name',l:'점포',f:'text'},...perCols('수량','q',(r,k)=>r.mq[k],{cumKey:'qC'}),...perCols('금액','a',(r,k)=>r.ma[k],{momKey:'a',cumKey:'aC'})]});
}

/* ---------- store tab ---------- */
function storeRows(A){const tot=A.T.aC||1;return[...A.S.values()].map(s=>{const S=STORES[s.i];return Object.assign(s,{id:s.i,name:S.name,type:S.type,sh:s.aC/tot})})}
function storeCols(){return[{k:'name',l:'점포',f:'text'},{k:'type',l:'유형',f:'text'},tierCol(),
  ...perCols('판매금액(원)','a',(r,k)=>r.ma[k],{momKey:'a',cumKey:'aC'}),...(B?[{k:'ad',l:'증감액',f:'d',g:'판매금액(원)',v:r=>r.aC-r.aB}]:[]),{k:'sh',l:'구성비',f:'pct',g:'판매금액(원)'},
  ...perCols('판매수량','q',(r,k)=>r.mq[k],{momKey:'q',cumKey:'qC'}),
  ...perCols('판매 SKU','k',(r,k)=>r.k[k],{momKey:'k',cumKey:'kC',diff:1})]}
function renderST(A){const q=$('s-store').value.trim();let d=storeRows(A);if(q)d=d.filter(r=>r.name.includes(q));
  table($('t-store'),{cols:storeCols(),data:d,key:'id',sort:sortKey(METRIC),onClick:id=>{DSTORE=+id;renderST(A);$('d-store').scrollIntoView({behavior:'smooth',block:'start'})},sel:DSTORE,first:1,foot:totRow(A,`합계 (${d.length}점)`)});
  renderDStore()}
function renderDStore(){const el=$('d-store');if(DSTORE==null){el.innerHTML='';return}
  const S=STORES[DSTORE];const rows=rowsFor({store:DSTORE,type:'all'});const A=agg(rows);const T=A.T;
  const net=agg(rowsFor({store:'all',type:'all'}).filter(r=>!STORES[r.s].online));const nOff=STORES.filter(s=>!s.online&&SOK[s.i]).length||1;
  const hasK=k=>new Set(rows.filter(r=>r.mq[k]>0).map(r=>r.p));
  const lost=PAIR?(()=>{const a=hasK(PAIR[0]),b=hasK(PAIR[1]);return[...a].filter(p=>!b.has(p)).map(p=>PRODS[p])})():null;
  const hasC=new Set(rows.filter(r=>C.reduce((s,k)=>s+r.mq[k],0)>0).map(r=>r.p));
  const miss=[...net.P.values()].filter(p=>p.nC>=nOff*0.4&&!hasC.has(p.i)).map(p=>({...p,per:p.aC/p.nC})).sort((a,b)=>b.per-a.per);
  const kTxt=B?`${A.skB}→${A.skC}개`:MULTI()?`${A.skC}개 (월별 ${C.map(k=>A.sk[k]).join('·')})`:`${A.skC}개`;
  el.innerHTML=`<div class="card detail"><button class="btn sm x" id="ds-x">닫기 ✕</button><h3>${esc(S.name)}</h3><p class="desc">${S.type} · 점포코드 ${S.code} · 보는 기간 ${perLabel()}</p>
   <div class="mini-kpis"><span>${perLabel()} 금액 <b>${fInt(T.aC)}원</b> ${B?momH(mom(T.aB,T.aC)):''}</span><span>${perLabel()} 수량 <b>${fInt(T.qC)}개</b> ${B?momH(mom(T.qB,T.qC)):''}</span><span>판매 SKU <b>${kTxt}</b></span></div>
   <div class="grid g2"><div><div class="chart" id="ds-c"></div></div><div><div class="note" style="margin-bottom:4px">상품별 실적</div><div class="tbl-wrap" id="ds-t" style="max-height:290px"></div></div></div>
   <div class="grid g2" style="margin-top:12px">${lost?`<div><h3 style="font-size:13px;margin:0 0 6px">${lostLabel()} SKU <span class="pill">${lost.length}개</span></h3><div class="chips">${lost.map(p=>`<span class="chip">${esc(p.name)}</span>`).join('')||'<span class="note">없음</span>'}</div></div>`:'<div><h3 style="font-size:13px;margin:0 0 6px">이탈 SKU</h3><span class="note">비교할 전월이 없습니다</span></div>'}
   <div><h3 style="font-size:13px;margin:0 0 6px">미판매 주력 SKU (오프라인 40% 이상 점포에서 판매, 점당매출순) <span class="pill">${miss.length}개</span></h3><div class="chips">${miss.map(p=>`<span class="chip"><b>${esc(PRODS[p.i].name)}</b> 점당 ${fMan(p.per)} · ${p.nC}점</span>`).join('')||'<span class="note">없음</span>'}</div></div></div></div>`;
  $('ds-x').onclick=()=>{DSTORE=null;renderTab()};
  lineChart($('ds-c'),{...trend(A,false),height:270});
  table($('ds-t'),{key:'id',sort:sortKey('a'),data:[...A.P.values()].map(p=>Object.assign(p,{id:p.i,name:PRODS[p.i].name})),cols:[{k:'name',l:'상품',f:'text',nm:1},...perCols('수량','q',(r,k)=>r.mq[k],{cumKey:'qC'}),...perCols('금액','a',(r,k)=>r.ma[k],{momKey:'a',cumKey:'aC'})]});
}

/* ---------- daily tab ---------- */
function renderDY(A){const T=A.T;const RQ=new Float64Array(ND),RF=new Uint8Array(ND);for(const r of rowsFor())for(let g=CURR.s-(BASER?CURR.s-BASER.s:0);g<=CURR.e;g++)if(r.q[g]<0||r.a[g]<0){RF[g]=1;if(r.q[g]<0)RQ[g]-=r.q[g]}
  const rbH=g=>g!=null&&RF[g]?`<span class="rbadge" title="이날 반품(음수 매출) 발생 · 반품 수량 ${fInt(RQ[g])}개">${RQ[g]?"반품 "+fInt(RQ[g]):"반품(금액)"}</span>`:'';
  if(!CUM()){const n=Math.max(...COLM.map(k=>SEGS[k].days)),wk=isWk();const d=[];const run={};COLM.forEach(k=>run[k]={q:0,a:0});
    for(let i=0;i<n;i++){const r={id:i,day:i+1,note:[]};COLM.forEach(k=>{const M=SEGS[k];if(i<M.days){const g=M.off+i;r['w'+k]=wk?dLab(g):DOW[DAYS[g].dow];r['g'+k]=g;r['q'+k]=A.q[g];r['a'+k]=A.a[g];run[k].q+=A.q[g];run[k].a+=A.a[g];r['cq'+k]=run[k].q;r['ca'+k]=run[k].a;if(DAYS[g].note)r.note.push(`${DAYS[g].m}/${DAYS[g].d} ${DAYS[g].note}`)}else{r['w'+k]='';}});
      const v=k=>METRIC==='a'?r['a'+k]:r['q'+k],cv=k=>METRIC==='a'?r['ca'+k]:r['cq'+k];
      if(B){const b=B[0],c=C[0];r.dm=r['q'+c]!=null&&r['q'+b]!=null?mom(v(b),v(c)):null;r.cm=r['q'+c]!=null&&r['q'+b]!=null?mom(cv(b),cv(c)):null}
      r.note=r.note.join(' / ');d.push(r)}
    const cols=[{k:'day',l:wk?'일차':'일',f:'int'}];COLM.forEach(k=>{const g=wk&&k===0&&B?`${SEGS[0].cmp} (${ML(k)})`:ML(k);cols.push({k:'w'+k,l:wk?'날짜':'요일',f:'text',g},{k:'q'+k,l:'수량',f:'html',g,ff:1,h:r=>r['q'+k]==null?'':fInt(r['q'+k])+rbH(r['g'+k]),v:r=>r['q'+k],csv:r=>r['q'+k]??''},{k:'a'+k,l:'금액',f:'int',g},{k:'cq'+k,l:'누계 수량',f:'int',g,nf:1},{k:'ca'+k,l:'누계 금액',f:'int',g,nf:1})});
    if(B){const gl=`${wk?'전주 대비':'MoM'} (${METRIC==='a'?'금액':'수량'})`;cols.push({k:'dm',l:'일 증감',f:'mom',g:gl,nf:1},{k:'cm',l:'누계 증감',f:'mom',g:gl})}
    cols.push({k:'note',l:'비고',f:'text'});
    const foot={label:'합계',cm:B?mom(VB(T),VC(T)):null};COLM.forEach(k=>{foot['q'+k]=T.mq[k];foot['a'+k]=T.ma[k]});
    $('dy-d1').textContent=`현재 필터 기준. ${B?(wk?`${perLabel()}와 ${SEGS[0].cmp}(${ML(0)})를 같은 일차끼리 비교, 기간 누계 비교`:`같은 일자의 ${ML(B[0])} vs ${ML(C[0])}, 월 누계 비교`):`${perLabel()} 일자별 판매와 누계`}`;
    table($('t-day'),{key:'id',sort:'day',dir:1,data:d,cols,foot});
  }else{const s0=CURR.s,e=CURR.e+1;const d=[];let cq=0,ca=0;
    for(let g=s0;g<e;g++){cq+=A.q[g];ca+=A.a[g];d.push({id:g,date:`${DAYS[g].m}/${DAYS[g].d}`,mon:MONTHS[DAYS[g].mi].label,w:DOW[DAYS[g].dow],q:A.q[g],a:A.a[g],cq,ca,note:DAYS[g].note})}
    $('dy-d1').textContent=`현재 필터 기준. ${perLabel()} 기간의 일자별 판매와 기간 누계 (첫 달 1일부터)`;
    table($('t-day'),{key:'id',sort:'date',dir:1,data:d,cols:[{k:'date',l:'날짜',f:'html',tl:1,h:r=>r.date,v:r=>r.id,csv:r=>r.date},{k:'mon',l:'월',f:'text'},{k:'w',l:'요일',f:'text'},{k:'q',l:'수량',f:'html',ff:1,h:r=>fInt(r.q)+rbH(r.id),v:r=>r.q,csv:r=>r.q},{k:'a',l:'금액',f:'int'},{k:'cq',l:'누계 수량',f:'int',nf:1},{k:'ca',l:'누계 금액',f:'int',nf:1},{k:'note',l:'비고',f:'text'}],
      foot:{label:'합계',q:T.qC,a:T.aC}});
  }
  renderMX()}
function renderMX(){const rows=rowsFor();const s0=CURR.s,e=CURR.e+1,n=e-s0;const by=new Map();
  for(const r of rows){const k=MXDIM==='s'?r.s:r.p;let o=by.get(k);if(!o){o={id:k,v:new Float64Array(n),t:0,rq:new Float64Array(n),rf:new Uint8Array(n)};by.set(k,o)}const arr=METRIC==='a'?r.a:r.q;for(let i=0;i<n;i++){const g=s0+i;o.v[i]+=arr[g];o.t+=arr[g];if(r.q[g]<0||r.a[g]<0){o.rf[i]=1;o.rq[i]+=r.q[g]<0?-r.q[g]:0}}}
  const list=[...by.values()].filter(o=>o.t!==0).sort((a,b)=>b.t-a.t);let mx=0;list.forEach(o=>o.v.forEach(v=>{if(v>mx)mx=v}));
  const heat=css('--heat');let nRet=0;const cell=(v,i,o)=>{const rf=o.rf[i];if(rf)nRet++;const rb=rf?`<span class="rbadge">반품${o.rq[i]?' '+fInt(o.rq[i]):''}</span>`:'',rt=rf?` title="반품(음수) 발생 · 반품 수량 ${fInt(o.rq[i])}개"`:'';if(!v)return`<td class="${rf?'ret':''}" style="color:var(--muted)"${rt}>${rf?'0':'·'}${rb}</td>`;const a=Math.max(.06,Math.min(1,v/mx));return`<td class="${rf?'ret':''}" style="background:rgba(${heat},${(Math.max(0,a)*.85).toFixed(2)});${a>.55?'color:#fff':''}"${rt}>${METRIC==='a'?fInt(v/1000):fInt(v)}${rb}</td>`};
  let h=`<table class="t heat"><thead><tr><th class="tl first">${MXDIM==='s'?'점포':'상품'}</th><th>합계</th>`;for(let i=0;i<n;i++){const D_=DAYS[s0+i];h+=`<th class="${D_.red?'we':''}" title="${D_.note}">${D_.d===1&&C.length>1?D_.m+'/':''}${D_.d}<br>${DOW[D_.dow]}</th>`}h+='</tr></thead><tbody>';
  for(const o of list){const nm=MXDIM==='s'?STORES[o.id].name:PRODS[o.id].name;h+=`<tr><td class="tl first nm" title="${esc(nm)}">${esc(nm)}</td><td><b>${METRIC==='a'?fInt(o.t/1000):fInt(o.t)}</b></td>${Array.from(o.v).map((v,i)=>cell(v,i,o)).join('')}</tr>`}
  h+='</tbody></table>';$('t-mx').innerHTML=list.length?h:'<div class="empty">데이터 없음</div>';$('t-mx')._mx={list,n,s0};
  $('mx-desc').innerHTML=`${perLabel()} · 행: 점포 또는 상품 · 열: 일자 (빨간 요일 = 주말·공휴일·의무휴업 추정일). ${METRIC==='a'?'<b>단위: 천원</b>':'<b>단위: 개</b>'} · 진할수록 값이 큽니다. <span class="rbadge">반품</span> 붉은 테두리 = 그날 반품(음수 매출) 발생 (${fInt(nRet)}칸)`}
$('mx-dim').querySelectorAll('button').forEach(b=>b.onclick=()=>{MXDIM=b.dataset.v;$('mx-dim').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderMX()});
$('x-mx').onclick=()=>{const m=$('t-mx')._mx;if(!m)return;csvDL(`이마트_${perLabel().replace(/\s/g,'')}_${MXDIM==='s'?'점포':'상품'}x일자_${METRIC==='a'?'금액':'수량'}`,[MXDIM==='s'?'점포':'상품','합계',...Array.from({length:m.n},(_,i)=>`${DAYS[m.s0+i].m}/${DAYS[m.s0+i].d}`)],m.list.map(o=>[MXDIM==='s'?STORES[o.id].name:PRODS[o.id].name,o.t,...o.v]))};

/* ---------- coverage ---------- */
function renderCV(A){const uni=storeUniverse();const N=uni.length||1;const d=prodRows(A).filter(p=>p.nC||p.nB);
  const per=d.filter(p=>p.nC>0);const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0};
  const yv=p=>METRIC==='a'?p.aC/p.nC:p.qC/p.nC;
  const rx=med(per.map(p=>p.nC)),ry=med(per.map(yv));
  const quad=p=>!p.nC?'판매중단':(p.nC>=rx?(yv(p)>=ry?'핵심 상품':'회전율 개선'):(yv(p)>=ry?'입점 확대 기회':'정리 검토'));
  const gc={인스턴트커피:css('--g1'),원두커피:css('--g2'),차류:css('--g3')};
  const shortN=n=>n.replace(/^맥널티(커피)?\s?/,'').replace(/^행복을주는커피\s?/,'행복 ').replace(/\(.*$/,'').slice(0,14);
  $('cv-t1').textContent=`도입 점포수 × 점당매출 (${perLabel()})`;
  if(per.length<2){$('c-sc').innerHTML='<div class="empty">상품이 2개 이상일 때 표시됩니다</div>'}else{const top3=[...per.map(yv)].sort((a,b)=>b-a)[2];
  scatter($('c-sc'),{pts:per.map(p=>({x:p.nC,y:yv(p),color:gc[PRODS[p.id].grp],short:shortN(p.name).replace(/^스테비아\s?/,'').replace(/^노브랜드/,'NB ').replace(/\s?\d+(g|입|개입|kg|ml)\b.*$/,'').replace(/\s?\d+$/,'').slice(0,12),p})),xl:`${CUM()?'기간 누적 ':''}도입 점포수`,yl:METRIC==='a'?'점당 판매금액':'점당 판매수량',refX:rx,refY:ry,
   groups:[{name:'인스턴트커피',color:gc['인스턴트커피']},{name:'원두커피',color:gc['원두커피']},{name:'차류(분말·액상·침출)',color:gc['차류']}],
   labelIf:pt=>(pt.x<rx&&pt.y>=ry)||pt.y>=top3,
   tipF:pt=>`<div class="h">${esc(pt.p.name)}</div><div class="r"><span>도입 점포</span><b>${COLM.map(k=>pt.p.n[k]).join('→')}점${MULTI()?` (누적 ${pt.p.nC})`:''}</b></div><div class="r"><span>점당 (${perLabel()})</span><b>${fVal(pt.y)}</b></div><div class="r"><span>판매금액</span><b>${fInt(pt.p.aC)}원</b></div><div class="r"><span>구분</span><b>${quad(pt.p)}</b></div>`})}
  // 증감
  if(!PAIR){$('cv-t2').textContent='도입 점포수 증감';$('cv-d2').textContent='';$('c-cvd').innerHTML='<div class="empty">비교할 직전 기간 데이터가 없습니다</div>'}else{const [a,b]=PAIR;
   $('cv-t2').textContent=`도입 점포수 증감 (${ML(a)} → ${ML(b)})`;$('cv-d2').textContent=CUM()?'누적 기간의 마지막 두 달을 비교합니다':'도입 점포가 늘거나 줄어든 상품';
   const ch=d.map(p=>({p,dd:p.n[b]-p.n[a]})).filter(o=>o.dd!==0).sort((x,y)=>y.dd-x.dd);
   if(!ch.length)$('c-cvd').innerHTML='<div class="empty">도입 점포수 변화 없음</div>';else{const top=[...ch.slice(0,8),...ch.slice(-8)].filter((v,i,ar)=>ar.indexOf(v)===i);
    hbarChart($('c-cvd'),{cats:top.map(o=>shortN(o.p.name)),series:[{name:ML(a),color:mc(0,2),values:top.map(o=>o.p.n[a])},{name:ML(b),color:mc(1,2),values:top.map(o=>o.p.n[b])}],right:i=>dH(top[i].dd),fmt:v=>v,labelW:170,rw:50,
     tipF:i=>`<div class="h">${esc(top[i].p.name)}</div><div class="r"><span>${ML(a)}</span><b>${top[i].p.n[a]}점</b></div><div class="r"><span>${ML(b)}</span><b>${top[i].p.n[b]}점</b></div><div class="r"><span>증감</span><b>${dH(top[i].dd)}</b></div>`})}}
  $('cv-d3').textContent=`커버리지 = 도입 점포수 ÷ 현재 필터 내 전체 점포수(${N}점).${CUM()?' 누적 = 기간 중 한 번이라도 판매된 점포 수.':''} 행을 클릭하면 상품 상세로 이동합니다.`;
  table($('t-cv'),{key:'id',sort:sortKey('n'),first:1,onClick:id=>{DPROD=+id;$('tabs').querySelector('[data-t=pr]').click()},data:d,
   cols:[{k:'name',l:'상품명',f:'text',nm:1},{k:'sub',l:'소분류',f:'text'},...perCols('도입 점포수','n',(r,k)=>r.n[k],{momKey:'n',cumKey:'nC',diff:1}),
    ...COLM.map(k=>({k:'cov'+k,l:ML(k),f:'pct',g:'커버리지',v:r=>r.n[k]/N})),...(MULTI()?[{k:'covc',l:'누적',f:'pct',g:'커버리지',v:r=>r.nC/N}]:[]),
    ...(B?[{k:'yb',l:ML(B[0]),f:'int',g:METRIC==='a'?'점당 판매금액':'점당 판매수량',v:r=>r.nB?(METRIC==='a'?r.aB/r.nB:r.qB/r.nB):null}]:[]),
    {k:'yc',l:CUM()?perLabel():ML(C[0]),f:'int',g:METRIC==='a'?'점당 판매금액':'점당 판매수량',v:r=>r.nC?yv(r):null},
    {k:'q',l:'구분',f:'html',tl:1,h:r=>{const q=quad(r);return`<span class="${q==='핵심 상품'?'q-core':q==='입점 확대 기회'?'q-exp':q==='회전율 개선'?'q-fix':'flat'}">${q}</span>`},v:r=>quad(r),csv:r=>quad(r)}]});
}

/* ---------- render ---------- */
let CUR=null;
function render(){CUR=agg(rowsFor());renderKPIs(CUR);renderTab()}
function renderTab(){untip();const A=CUR;if(!$('sh-sales').classList.contains('on'))return;if(TAB==='ov')renderOV(A);else if(TAB==='pr')renderPR(A);else if(TAB==='st')renderST(A);else if(TAB==='dy')renderDY(A);else if(TAB==='cv')renderCV(A)}
$('s-prod').addEventListener('input',()=>renderPR(CUR));$('s-store').addEventListener('input',()=>renderST(CUR));
$('x-prod').onclick=()=>csv($('t-prod'),'이마트_상품별');$('x-store').onclick=()=>csv($('t-store'),'이마트_점포별');$('x-day').onclick=()=>csv($('t-day'),'이마트_일자별');$('x-cv').onclick=()=>csv($('t-cv'),'이마트_도입점포현황');
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>renderSheet(),150)});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',renderTab);

/* ================= 시트: 미매출현황 ================= */
let NS_DAYS=7;
const NSF={type:'all',mid:'all',brand:'all',store:null,prod:null,strong:false};
const LAST=(()=>{let L=0;for(const r of ROWS)for(let i=ND-1;i>L;i--)if(r.q[i]!==0){L=i;break}return L})();
let NS_WE,NS_WS,NS_PE,NS_PS;
function nsWin(){NS_WE=Math.min(CURR.e,LAST);NS_WS=NS_WE-NS_DAYS+1;NS_PE=NS_WS-1;NS_PS=Math.max(0,NS_WS-30)}
function nsBuildFilters(){
  const t=$('ns-type');t.innerHTML=`<option value="all">전체 유형</option>`+uniq(STORES.map(s=>s.type)).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');t.value=NSF.type;
  NSF.mid=opts($('ns-mid'),uniq(PRODS.map(p=>p.mid)).sort().map(x=>[x,x]),NSF.mid,'전체');
  NSF.brand=opts($('ns-brand'),uniq(PRODS.map(p=>p.brand)).map(x=>[x,x]),NSF.brand,'전체');}

['type','mid','brand'].forEach(k=>$('ns-'+k).addEventListener('change',e=>{NSF[k]=e.target.value;NSF.store=null;NSF.prod=null;renderNS()}));

function nsCompute(){
  const rows=ROWS.filter(r=>{const s=STORES[r.s],p=PRODS[r.p];return SOK[r.s]&&(NSF.type==='all'||s.type===NSF.type)&&(NSF.mid==='all'||p.mid===NSF.mid)&&(NSF.brand==='all'||p.brand===NSF.brand)});
  const S=new Map(),P=new Map(),pairs=[],SUBV={};let hist=0;
  const get=(m,k)=>{let o=m.get(k);if(!o){o={id:k,hist:0,stall:0,stallA:0,stallQ:0,preA:0,preQ:0,dq:new Float64Array(NS_WE+1)};m.set(k,o)}return o};
  for(const r of rows){const s=get(S,r.s),p=get(P,r.p);for(let i=0;i<=NS_WE;i++){s.dq[i]+=r.q[i];p.dq[i]+=r.q[i]}
    let preQ=0,preA=0;for(let i=NS_PS;i<=NS_PE;i++){preQ+=r.q[i];preA+=r.a[i]}s.preA+=preA;s.preQ+=preQ;p.preA+=preA;p.preQ+=preQ;
    let last=-1;for(let i=NS_WE;i>=0;i--)if(r.q[i]>0){last=i;break}
    let h=false;for(let i=0;i<NS_WS;i++)if(r.q[i]>0){h=true;break}
    if(h){hist++;s.hist++;p.hist++;const sb=PRODS[r.p].sub;(SUBV[sb]||(SUBV[sb]=[])).push(preQ/(NS_PE-NS_PS+1))}
    if(last>=0&&last<NS_WS){s.stall++;p.stall++;s.stallA+=preA;p.stallA+=preA;s.stallQ+=preQ;p.stallQ+=preQ;
      const St=STORES[r.s],Pr=PRODS[r.p];pairs.push({id:pairs.length,s:r.s,p:r.p,store:St.name,type:St.type,prod:Pr.name,sub:Pr.sub,last,streak:NS_WE-last,preQ,preA,avg:preQ/(NS_PE-NS_PS+1)})}}
  const lastOf=o=>{for(let i=NS_WE;i>=0;i--)if(o.dq[i]>0)return i;return-1};
  const fin=(m,info)=>[...m.values()].map(o=>{const l=lastOf(o);return Object.assign(o,info(o.id),{last:l,dead:l>=0&&l<NS_WS,streak:l>=0?NS_WE-l:null})});
  const ss=fin(S,i=>({name:STORES[i].name,type:STORES[i].type})),ps=fin(P,i=>({name:PRODS[i].name,sub:PRODS[i].sub,brand:PRODS[i].brand}));
  return{ss,ps,pairs,hist,SUBV,nSt:ss.filter(o=>o.last>=0).length,nPr:ps.filter(o=>o.last>=0).length}}

function nsRec(R){const opt=[3,5,7,14];const rows=Object.entries(R.SUBV).map(([sb,a])=>{a.sort((x,y)=>x-y);const med=a[Math.floor(a.length/2)]||0;const need=med>0?2/med:Infinity;const rec=opt.find(d=>d>=need);return{sb,med,rec,n:a.length}}).sort((a,b)=>b.med-a.med);
  $('ns-rec').innerHTML='<span class="note">회전 속도별 권장 기준 (점포당 일평균 판매량 중앙값 → 평소 2개 팔리는 데 걸리는 일수):</span> '+rows.map(o=>`<span class="chip" style="${o.rec===NS_DAYS?'border-color:var(--accent);color:var(--accent)':''}"><b>${esc(o.sb)}</b> ${o.med.toFixed(2)}개/일 → ${o.rec?o.rec+'일':'14일 이상'}</span>`).join('')}
const lastTxt=r=>r.last>=0?dLab(r.last):'-';
function nsWinText(){
  const nts=[];for(let g=NS_WS;g<=NS_WE;g++)if(DAYS[g].note)nts.push(`${DAYS[g].m}/${DAYS[g].d} ${DAYS[g].note}`);
  $('ns-win').innerHTML=`미매출 기간: <b>${dLab(NS_WS)} ~ ${dLab(NS_WE)}</b> (선택 기간 마지막 날 기준 ${NS_DAYS}일) · 비교 실적: 직전 ${NS_PE-NS_PS+1}일 ${dLab(NS_PS)} ~ ${dLab(NS_PE)}${nts.length?`<br><span class="down">※ 이 기간에 ${nts.join(', ')}이 포함되어 있어 평소보다 미매출이 많게 나올 수 있습니다.</span>`:''}`}
function renderNS(){document.querySelectorAll('.ns-n').forEach(e=>e.textContent=NS_DAYS);nsWin();if(NS_WS<1){$('ns-win').innerHTML='';['ns-kpis','ns-dead-s','ns-dead-p','ns-t-s','ns-t-p','ns-t-d'].forEach(id=>$(id).innerHTML='');$('ns-kpis').innerHTML=`<div class="empty" style="grid-column:1/-1">선택 기간 마지막 날(${dLab(NS_WE)}) 이전 데이터가 ${NS_DAYS}일보다 짧아 ${NS_DAYS}일 연속 미매출을 판단할 수 없습니다. 더 뒤의 기간을 선택해 주세요.</div>`;return}nsWinText();const R=nsCompute();nsRec(R);
  const dS=R.ss.filter(o=>o.dead).sort((a,b)=>b.preA-a.preA),dP=R.ps.filter(o=>o.dead).sort((a,b)=>b.preA-a.preA);
  const pA=R.pairs.reduce((s,p)=>s+p.preA,0);
  const k=(l,v,c)=>`<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="c">${c}</div></div>`;
  $('ns-kpis').innerHTML=
    k(`${NS_DAYS}일+ 전 품목 미매출 점포`,`${dS.length}점`,`판매 점포 ${R.nSt}점 중 · 맥널티 상품 0건`)+
    k(`${NS_DAYS}일+ 전 점포 미매출 품목`,`${dP.length}개`,`판매 품목 ${R.nPr}개 중 · 어느 점포에서도 0건`)+
    k('점포×품목 미매출',`${fInt(R.pairs.length)}건`,`판매 이력 ${fInt(R.hist)}건 중 ${R.hist?(R.pairs.length/R.hist*100).toFixed(1):0}%`)+
    k('미매출 건의 직전 30일 매출',`${fMan(pA)}원`,'평소 팔리던 규모 (놓치고 있는 매출 참고)');
  const chip=(o,kind)=>`<span class="chip ns-chip" data-k="${kind}" data-i="${o.id}" style="cursor:pointer"><b>${esc(o.name)}</b> ${o.streak}일째 · 직전30일 ${fMan(o.preA)}</span>`;
  $('ns-dead-s').innerHTML=dS.length?`<div class="chips">${dS.map(o=>chip(o,'s')).join('')}</div>`:'<div class="empty">해당 점포 없음</div>';
  $('ns-dead-p').innerHTML=dP.length?`<div class="chips">${dP.map(o=>chip(o,'p')).join('')}</div>`:'<div class="empty">해당 품목 없음</div>';
  document.querySelectorAll('.ns-chip').forEach(c=>c.onclick=()=>{if(c.dataset.k==='s'){NSF.store=+c.dataset.i;NSF.prod=null}else{NSF.prod=+c.dataset.i;NSF.store=null}nsDetail(R);$('ns-t-d').scrollIntoView({behavior:'smooth',block:'center'})});
  const dead=r=>r.dead?' <span class="pill" style="color:var(--down)">전체 미매출</span>':'';
  const qs=$('ns-s-s').value.trim(),qp=$('ns-s-p').value.trim();
  table($('ns-t-s'),{key:'id',sort:'stall',first:1,sel:NSF.store,data:R.ss.filter(o=>o.stall>0&&(!qs||o.name.includes(qs))),onClick:id=>{NSF.store=+id;NSF.prod=null;renderNS()},
    cols:[{k:'name',l:'점포',f:'html',tl:1,h:r=>esc(r.name)+dead(r),v:r=>r.name,csv:r=>r.name},{k:'type',l:'유형',f:'text'},tierCol(),{k:'stall',l:'미매출 품목',f:'int'},{k:'hist',l:'판매 이력 품목',f:'int'},{k:'rt',l:'미매출 비중',f:'pct',v:r=>dv(r.stall,r.hist)},{k:'stallA',l:'미매출 품목 직전30일 매출',f:'int'},{k:'lastd',l:'점포 마지막 판매일',f:'html',tl:1,h:lastTxt,v:r=>r.last,csv:lastTxt}]});
  table($('ns-t-p'),{key:'id',sort:'stall',first:1,sel:NSF.prod,data:R.ps.filter(o=>o.stall>0&&(!qp||o.name.includes(qp))),onClick:id=>{NSF.prod=+id;NSF.store=null;renderNS()},
    cols:[{k:'name',l:'상품명',f:'html',tl:1,nm:1,h:r=>esc(r.name)+dead(r),v:r=>r.name,csv:r=>r.name},{k:'sub',l:'소분류',f:'text'},{k:'stall',l:'미매출 점포',f:'int'},{k:'hist',l:'판매 이력 점포',f:'int'},{k:'rt',l:'미매출 비중',f:'pct',v:r=>dv(r.stall,r.hist)},{k:'stallA',l:'미매출 점포 직전30일 매출',f:'int'},{k:'lastd',l:'품목 마지막 판매일',f:'html',tl:1,h:lastTxt,v:r=>r.last,csv:lastTxt}]});
  nsDetail(R)}
function nsDetail(R){const q=$('ns-s-d').value.trim();
  let d=R.pairs.filter(p=>(NSF.store==null||p.s===NSF.store)&&(NSF.prod==null||p.p===NSF.prod)&&(!q||p.store.includes(q)||p.prod.includes(q))&&(!NSF.strong||p.avg*NS_DAYS>=2));
  const sel=NSF.store!=null?STORES[NSF.store].name:NSF.prod!=null?PRODS[NSF.prod].name:null;
  $('ns-sel').innerHTML=sel?`<span class="chip">선택: <b>${esc(sel)}</b></span> <button class="btn sm" id="ns-clr">전체 보기</button>`:`<span class="note">${fInt(d.length)}건</span>`;
  if(sel)$('ns-clr').onclick=()=>{NSF.store=null;NSF.prod=null;renderNS()};
  table($('ns-t-d'),{key:'id',sort:'preA',first:1,data:d,cols:[{k:'store',l:'점포',f:'text'},{k:'type',l:'유형',f:'text'},{k:'prod',l:'상품명',f:'text',nm:1},{k:'sub',l:'소분류',f:'text'},
    {k:'streak',l:'연속 미매출',f:'html',h:r=>`<b class="${r.streak>=14?'up':''}">${r.streak}일</b>`,v:r=>r.streak,csv:r=>r.streak},{k:'lastd',l:'마지막 판매일',f:'html',tl:1,h:lastTxt,v:r=>r.last,csv:lastTxt},
    {k:'preQ',l:'수량',f:'int',g:'직전 30일 실적'},{k:'preA',l:'금액',f:'int',g:'직전 30일 실적'},{k:'avg',l:'일평균 수량',f:'html',g:'직전 30일 실적',h:r=>r.avg.toFixed(1),v:r=>r.avg,csv:r=>r.avg.toFixed(2)},{k:'exp',l:`${NS_DAYS}일 기대 수량`,f:'html',g:'직전 30일 실적',h:r=>{const e=r.avg*NS_DAYS;return`<span class="${e>=2?'up':'flat'}">${e.toFixed(1)}개</span>`},v:r=>r.avg*NS_DAYS,csv:r=>(r.avg*NS_DAYS).toFixed(1)}]});
  // 다른 표의 선택 표시 갱신
  $('ns-t-s').querySelectorAll('tbody tr').forEach(tr=>tr.classList.toggle('sel',NSF.store!=null&&+tr.dataset.id===NSF.store));
  $('ns-t-p').querySelectorAll('tbody tr').forEach(tr=>tr.classList.toggle('sel',NSF.prod!=null&&+tr.dataset.id===NSF.prod))}
$('ns-str').querySelectorAll('button').forEach(b=>b.onclick=()=>{NSF.strong=b.dataset.v==='1';$('ns-str').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));nsWin();nsDetail(nsCompute())});
$('ns-days').querySelectorAll('button').forEach(b=>b.onclick=()=>{NS_DAYS=+b.dataset.v;$('ns-days').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));NSF.store=null;NSF.prod=null;renderNS()});
$('ns-s-s').addEventListener('input',renderNS);$('ns-s-p').addEventListener('input',renderNS);$('ns-s-d').addEventListener('input',()=>{nsWin();nsDetail(nsCompute())});
const nsSuffix=()=>`${DAYS[NS_WS].m}${String(DAYS[NS_WS].d).padStart(2,'0')}-${DAYS[NS_WE].m}${String(DAYS[NS_WE].d).padStart(2,'0')}`;
$('ns-x-s').onclick=()=>csv($('ns-t-s'),'이마트_미매출_점포별',nsSuffix());$('ns-x-p').onclick=()=>csv($('ns-t-p'),'이마트_미매출_품목별',nsSuffix());$('ns-x-d').onclick=()=>csv($('ns-t-d'),'이마트_미매출_점포x품목',nsSuffix());
function renderSheet(){if($('sh-ns').classList.contains('on'))renderNS();else if($('sh-pr').classList.contains('on'))renderPRO();else renderTab()}
nsBuildFilters();

/* ================= 시트: 행사현황 ================= */
// 판매금액 = 이마트 매입원가. 단위원가 = 금액 ÷ 수량. 정상원가보다 3% 이상 낮으면 행사 원가로 판정.
const PR_TH=0.97, PR_MINSHARE=0.03;
const PRF={type:'all',mid:'all',brand:'all',view:'p',vprod:'all',only:true,selP:null,selS:null};
const WEEKS=MWEEKS.flat().map((w,i)=>({...w,i}));  // 월 주차 (월요일 시작, 월 경계에서 나눔)
const NW=WEEKS.length,WK=new Int16Array(ND);WEEKS.forEach(w=>{for(let g=w.s;g<=w.e;g++)WK[g]=w.i});
// 정상원가: 품목별로 수량 비중 3% 이상인 원가 중 가장 높은 값
const NORMAL=(()=>{const cnt=PRODS.map(()=>new Map());for(const r of ROWS)for(let g=0;g<ND;g++){const q=r.q[g];if(q>0){const u=Math.round(r.a[g]/q),m=cnt[r.p];m.set(u,(m.get(u)||0)+q)}}
  return cnt.map(m=>{let tot=0;m.forEach(v=>tot+=v);if(!tot)return null;let best=0;m.forEach((v,u)=>{if(v/tot>=PR_MINSHARE&&u>best)best=u});return best||null})})();
// 행사일: 전 점포 합산 그날 원가 ≤ 정상원가×97%. 판매 없는 날은 앞·뒤 판매일이 모두 행사면 행사로 봄
const PROMO=PRODS.map(()=>new Uint8Array(ND)),inCur=g=>g>=CURR.s&&g<=CURR.e,PDAYS=new Float64Array(PRODS.length),PERIODS=PRODS.map(()=>[]);
(()=>{const q=PRODS.map(()=>new Float64Array(ND)),a=PRODS.map(()=>new Float64Array(ND));
  for(const r of ROWS)for(let g=0;g<ND;g++)if(r.q[g]>0){q[r.p][g]+=r.q[g];a[r.p][g]+=r.a[g]}
  PRODS.forEach((P,p)=>{const N=NORMAL[p];if(!N)return;const st=new Int8Array(ND).fill(-1),f=PROMO[p];
    for(let g=0;g<ND;g++)if(q[p][g]>0)st[g]=a[p][g]/q[p][g]<=N*PR_TH?1:0;
    let prev=-1;for(let g=0;g<ND;g++){if(st[g]>=0){prev=g;f[g]=st[g];continue}let nx=g+1;while(nx<ND&&st[nx]<0)nx++;f[g]=(prev>=0&&st[prev]===1&&nx<ND&&st[nx]===1)?1:0}
    for(let g=0;g<ND;g++){if(f[g]){PDAYS[p]++;const L=PERIODS[p].at(-1);if(L&&L.e===g-1)L.e=g;else PERIODS[p].push({s:g,e:g})}}})})();
const perTxt=p=>PERIODS[p].filter(o=>o.e>=CURR.s&&o.s<=CURR.e).map(o=>({s:Math.max(o.s,CURR.s),e:Math.min(o.e,CURR.e)})).map(o=>o.s===o.e?`${DAYS[o.s].m}/${DAYS[o.s].d}`:`${DAYS[o.s].m}/${DAYS[o.s].d}~${DAYS[o.e].m}/${DAYS[o.e].d}`).join(', ')||'-';
const pctTxt=v=>v==null||isNaN(v)?'-':(v*100).toFixed(1)+'%';

function prBuildFilters(){
  const t=$('pr-type');t.innerHTML=`<option value="all">전체 유형</option>`+uniq(STORES.map(s=>s.type)).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');t.value=PRF.type;
  PRF.mid=opts($('pr-mid'),uniq(PRODS.map(p=>p.mid)).sort().map(x=>[x,x]),PRF.mid,'전체');
  PRF.brand=opts($('pr-brand'),uniq(PRODS.map(p=>p.brand)).map(x=>[x,x]),PRF.brand,'전체');
  $('pr-note').innerHTML=`<b>원가</b> = 판매금액(이마트 매입원가) ÷ 판매수량 · <b>정상원가</b> = 품목별 주요 원가(수량 비중 3% 이상) 중 가장 높은 값 · <b>행사</b> = 전 점포 합산 원가가 정상원가보다 3% 이상 낮은 날 · <b>평시</b> = 데이터 기간(${dLab(0)}~${dLab(ND-1)}) 중 행사가 아닌 날<br><span class="flat">※ 평시와 행사 기간의 계절·명절 차이(여름 아이스티, 추석 연휴 등)가 증감률에 함께 섞여 있습니다.</span>`}
['type','mid','brand'].forEach(k=>$('pr-'+k).addEventListener('change',e=>{PRF[k]=e.target.value;PRF.selP=null;PRF.selS=null;if(k!=='type')PRF.vprod='all';renderPRO()}));

function prCompute(){
  const rows=ROWS.filter(r=>{const s=STORES[r.s],p=PRODS[r.p];return NORMAL[r.p]&&SOK[r.s]&&(PRF.type==='all'||s.type===PRF.type)&&(PRF.mid==='all'||p.mid===PRF.mid)&&(PRF.brand==='all'||p.brand===PRF.brand)});
  const P=new Map(),S=new Map(),pairs=[];
  const gP=k=>{let o=P.get(k);if(!o){o={id:k,qw:new Float64Array(NW),aw:new Float64Array(NW),pq:0,nq:0,tq:0,ppq:0,ppa:0,stores:new Set()};P.set(k,o)}return o};
  const gS=k=>{let o=S.get(k);if(!o){o={id:k,nw:new Float64Array(NW),aw:new Float64Array(NW),pAvg:0,nAvg:0,pq:0,np:0};S.set(k,o)}return o};
  const T={pq:0,tq:0,ppq:0,ppa:0};
  const pdC=p=>{let n=0;for(let g=CURR.s;g<=CURR.e;g++)n+=PROMO[p][g];return n};const PDC=new Map();
  for(const r of rows){const N=NORMAL[r.p],f=PROMO[r.p];let pd=PDC.get(r.p);if(pd==null){pd=pdC(r.p);PDC.set(r.p,pd)}const nd=ND-PDAYS[r.p];const po=gP(r.p),so=gS(r.s);
    let pq=0,nq=0,ppq=0,ppa=0,cq=0;
    for(let g=0;g<ND;g++){const q=r.q[g];if(!q)continue;const ic=inCur(g);if(ic)cq+=q;
      if(q>0){const w=WK[g];po.qw[w]+=q;po.aw[w]+=r.a[g];so.nw[w]+=N*q;so.aw[w]+=r.a[g]}
      if(f[g]){if(ic){pq+=q;if(q>0){ppq+=q;ppa+=r.a[g]}}}else nq+=q}
    po.pq+=pq;po.nq+=nq;po.tq+=cq;po.ppq+=ppq;po.ppa+=ppa;T.pq+=pq;T.tq+=cq;T.ppq+=ppq;T.ppa+=ppa*1;T.ppn=(T.ppn||0)+ppq*N;
    if(pd>0&&pq>0)po.stores.add(r.s);
    if(pd>0&&nd>0&&(pq>0||nq>0)){const pa=pq/pd,na=nq/nd;so.pAvg+=pa;so.nAvg+=na;so.pq+=pq;so.np++;
      const St=STORES[r.s],Pr=PRODS[r.p];pairs.push({id:pairs.length,s:r.s,p:r.p,store:St.name,type:St.type,prod:Pr.name,pq,nq,pa,na,ch:mom(na,pa),cost:ppq?ppa/ppq:null,N,disc:ppq?1-ppa/ppq/N:null,period:perTxt(r.p)})}}
  const ps=[...P.values()].map(o=>{const pd=PDC.get(o.id)||0,nd=ND-PDAYS[o.id];return Object.assign(o,{name:PRODS[o.id].name,sub:PRODS[o.id].sub,N:NORMAL[o.id],pd,nd,period:perTxt(o.id),
    pa:pd?o.pq/pd:null,na:nd?o.nq/nd:null,ch:pd&&nd?mom(o.nq/nd,o.pq/pd):null,cost:o.ppq?o.ppa/o.ppq:null,disc:o.ppq?1-o.ppa/o.ppq/NORMAL[o.id]:null,share:o.tq?o.pq/o.tq:null,nst:o.stores.size,
    wc:Array.from(o.qw,(q,w)=>q>0?o.aw[w]/q:null)})});
  const ss=[...S.values()].map(o=>Object.assign(o,{name:STORES[o.id].name,type:STORES[o.id].type,ch:o.np?mom(o.nAvg,o.pAvg):null,wd:Array.from(o.nw,(n,w)=>n>0?(n-o.aw[w])/n:null)}));
  return{ps,ss,pairs,T,rows}}

/* --- 주차 매트릭스 --- */
let PR_MX=null;
function prCell(cost,N){if(cost==null)return'<td style="color:var(--muted)">·</td>';const d=1-cost/N;
  if(d>=1-PR_TH){const al=Math.min(.9,.18+d*1.6);return`<td style="background:rgba(${css('--heat')},${al.toFixed(2)});${al>.55?'color:#fff':''}" title="정상 ${fInt(N)}원 대비 -${(d*100).toFixed(1)}%">${fInt(cost)}<br><small>-${Math.round(d*100)}%</small></td>`}
  if(d<=-(1-PR_TH))return`<td title="정상 ${fInt(N)}원 대비 +${(-d*100).toFixed(1)}%">${fInt(cost)}<br><small class="up">+${Math.round(-d*100)}%</small></td>`;
  return`<td>${fInt(cost)}</td>`}
function renderPRMX(R){const M_=MONTHS[PER.mi],VW=(!CUM()&&isWk())?WEEKS.filter(w=>w.mi===PER.mi):WEEKS.filter(w=>w.e>=CURR.s&&w.s<=CURR.e),vis=a=>VW.map(w=>a[w.i]);const TH=VW.map(w=>{const on=isWk()&&!CUM()&&w.s===CURR.s;return`<th style="${on?'background:var(--accent);color:#fff':''}">${w.label}<br><small>${w.range}</small></th>`}).join(''),CH=VW.map(w=>`${w.label} ${w.range}`);let h,csvH,csvL;
  const moved=arr=>arr.some(v=>v!=null&&Math.abs(v)>=1-PR_TH);
  $('pr-vprod-l').style.display=PRF.view==='s'?'':'none';
  if(PRF.view==='p'){let list=R.ps.filter(o=>o.tq);if(PRF.only)list=list.filter(o=>moved(vis(o.wc).map(c=>c==null?null:1-c/o.N)));list.sort((a,b)=>b.pd-a.pd||b.tq-a.tq);
    h=`<table class="t heat"><thead><tr><th class="tl first">품목</th><th>정상원가</th><th>기간 내<br>행사일수</th>${TH}</tr></thead><tbody>`;
    for(const o of list)h+=`<tr class="click" data-p="${o.id}"><td class="tl first nm" title="${esc(o.name)}">${esc(o.name)}</td><td><b>${fInt(o.N)}</b></td><td>${o.pd?o.pd+'일'+(o.pd>ND/2?' <span class="pill" title="정상원가 추정 확인 필요">장기</span>':''):'-'}</td>${vis(o.wc).map(c=>prCell(c,o.N)).join('')}</tr>`;
    csvH=['품목','정상원가','행사일수',...CH];csvL=list.map(o=>[o.name,o.N,o.pd,...vis(o.wc).map(c=>c==null?'':Math.round(c))]);
    $('pr-mx-desc').innerHTML='칸 = 그 주의 평균 원가(전 점포 합산), 아래 % = 정상원가 대비. 파랗게 칠해진 칸이 원가가 낮아진(행사) 주입니다. 품목 행을 클릭하면 그 품목의 <b>점포 × 주차</b> 원가로 이동합니다.';
  }else{const vp=PRF.vprod;
    if(vp==='all'){let list=R.ss.filter(o=>o.nw.some(v=>v>0));list=list.map(o=>({...o,vwd:vis(o.wd)}));if(PRF.only)list=list.filter(o=>moved(o.vwd));list.sort((a,b)=>b.vwd.reduce((s,v)=>s+(v||0),0)-a.vwd.reduce((s,v)=>s+(v||0),0));
      const cell=v=>{if(v==null)return'<td style="color:var(--muted)">·</td>';if(v>=1-PR_TH){const al=Math.min(.9,.18+v*1.6);return`<td style="background:rgba(${css('--heat')},${al.toFixed(2)});${al>.55?'color:#fff':''}">-${(v*100).toFixed(1)}%</td>`}return`<td class="${v<=-(1-PR_TH)?'up':'flat'}">${v<0?'+':v>0?'-':''}${Math.abs(v*100).toFixed(1)}%</td>`};
      h=`<table class="t heat"><thead><tr><th class="tl first">점포</th>${TH}</tr></thead><tbody>`;
      for(const o of list)h+=`<tr><td class="tl first nm">${esc(o.name)}</td>${o.vwd.map(cell).join('')}</tr>`;
      csvH=['점포',...CH.map(x=>x+' 원가인하율')];csvL=list.map(o=>[o.name,...o.vwd.map(v=>v==null?'':(v*100).toFixed(1)+'%')]);
      $('pr-mx-desc').innerHTML='칸 = 그 점포에서 그 주에 팔린 전 품목의 <b>원가 인하율</b> (정상원가 기준 매입액 대비 실제 매입액, 수량 가중). 특정 품목을 고르면 그 품목의 점포별 원가가 보입니다.';
    }else{const p=+vp,N=NORMAL[p];const by=new Map();for(const r of R.rows){if(r.p!==p)continue;let o=by.get(r.s);if(!o){o={s:r.s,q:new Float64Array(NW),a:new Float64Array(NW),t:0};by.set(r.s,o)}for(let g=0;g<ND;g++)if(r.q[g]>0){o.q[WK[g]]+=r.q[g];o.a[WK[g]]+=r.a[g];if(inCur(g))o.t+=r.q[g]}}
      let list=[...by.values()].map(o=>({...o,wc:vis(Array.from(o.q,(q,w)=>q>0?o.a[w]/q:null))}));if(PRF.only)list=list.filter(o=>moved(o.wc.map(c=>c==null?null:1-c/N)));list.sort((a,b)=>b.t-a.t);
      h=`<table class="t heat"><thead><tr><th class="tl first">점포</th><th>판매수량</th>${TH}</tr></thead><tbody>`;
      for(const o of list)h+=`<tr><td class="tl first nm">${esc(STORES[o.s].name)}</td><td>${fInt(o.t)}</td>${o.wc.map(c=>prCell(c,N)).join('')}</tr>`;
      csvH=['점포','판매수량',...CH];csvL=list.map(o=>[STORES[o.s].name,o.t,...o.wc.map(c=>c==null?'':Math.round(c))]);
      $('pr-mx-desc').innerHTML=`<b>${esc(PRODS[p].name)}</b> · 정상원가 ${fInt(N)}원 · 행사 기간 ${perTxt(p)} · 칸 = 그 점포 그 주 평균 원가(판매가 있던 날 기준). 같은 주에 정상원가로 잡힌 점포는 행사 원가가 적용되지 않은 점포입니다.`}}
  h+='</tbody></table>';$('pr-mx').innerHTML=csvL.length?h:'<div class="empty">원가 변동이 있는 행이 없습니다</div>';PR_MX={csvH,csvL};
  $('pr-mx').querySelectorAll('tr[data-p]').forEach(tr=>tr.onclick=()=>{PRF.view='s';PRF.vprod=tr.dataset.p;prSyncView();renderPRMX(R)})}
function prSyncView(){$('pr-view').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===PRF.view));
  const sel=$('pr-vprod');sel.innerHTML=`<option value="all">전체 품목 (원가 인하율)</option>`+PRODS.filter(p=>NORMAL[p.i]&&(PRF.mid==='all'||p.mid===PRF.mid)&&(PRF.brand==='all'||p.brand===PRF.brand)).sort((a,b)=>PDAYS[b.i]-PDAYS[a.i]||a.name.localeCompare(b.name,'ko')).map(p=>`<option value="${p.i}">${esc(p.name)}${PDAYS[p.i]?' · 행사':''}</option>`).join('');sel.value=PRF.vprod;if(sel.value!==String(PRF.vprod)){PRF.vprod='all';sel.value='all'}}
$('pr-view').querySelectorAll('button').forEach(b=>b.onclick=()=>{PRF.view=b.dataset.v;prSyncView();renderPRMX(PR_R)});
$('pr-vprod').addEventListener('change',e=>{PRF.vprod=e.target.value;renderPRMX(PR_R)});
$('pr-only').querySelectorAll('button').forEach(b=>b.onclick=()=>{PRF.only=b.dataset.v==='1';$('pr-only').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));renderPRMX(PR_R)});
$('pr-x-mx').onclick=()=>{if(PR_MX)csvDL(`이마트_주차별원가_${PRF.view==='p'?'품목':'점포'}${PRF.view==='s'&&PRF.vprod!=='all'?'_'+PRODS[+PRF.vprod].name:''}`,PR_MX.csvH,PR_MX.csvL)};

/* --- 판매량 증감 --- */
let PR_R=null;
const chCol=(k,l)=>({k,l,f:'mom',v:r=>r.ch});
function renderPRO(){const R=prCompute();PR_R=R;const T=R.T;
  const promo=R.ps.filter(o=>o.pd>0&&o.tq),sold=R.ps.filter(o=>o.tq);
  const both=promo.filter(o=>o.nd>0);const sp=both.reduce((s,o)=>s+o.pa,0),sn=both.reduce((s,o)=>s+o.na,0);
  const k=(l,v,c)=>`<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="c">${c}</div></div>`;
  $('pr-kpis').innerHTML=
    k('행사 원가 품목',`${promo.length}개`,`판매 품목 ${sold.length}개 중 · 정상원가보다 3% 이상 낮은 기간이 있었던 품목`)+
    k('행사 기간 판매량 증감률',momH(mom(sn,sp)),`행사 품목 합산 일평균 ${fInt(sp)}개 vs 평시 ${fInt(sn)}개`)+
    k('행사 기간 평균 원가 인하율',T.ppn?pctTxt(1-T.ppa/T.ppn):'-','정상원가 대비 (수량 가중)')+
    k('행사 원가 판매 비중',T.tq?pctTxt(T.pq/T.tq):'-',`전체 판매수량 ${fInt(T.tq)}개 중 행사 기간 ${fInt(T.pq)}개`);
  prSyncView();renderPRMX(R);
  const lim=(o,s)=>s!=null&&o===s;
  table($('pr-t-p'),{key:'id',sort:'pq',first:1,sel:PRF.selP,data:promo,onClick:id=>{PRF.selP=+id;PRF.selS=null;prDetail();prMarkSel()},
    cols:[{k:'name',l:'상품명',f:'text',nm:1},{k:'period',l:'행사 기간',f:'html',tl:1,h:r=>esc(r.period)+(r.pd>ND/2?' <span class="pill" title="행사 원가 기간이 정상원가 기간보다 길어 정상원가 추정이 불확실합니다">장기·정상원가 확인</span>':''),v:r=>r.period,csv:r=>r.period},{k:'pd',l:'행사일수',f:'int'},{k:'N',l:'정상원가',f:'int'},{k:'cost',l:'행사원가',f:'int'},{k:'disc',l:'인하율',f:'pct'},
      {k:'pa',l:'행사 일평균',f:'html',h:r=>r.pa==null?'-':r.pa.toFixed(1),v:r=>r.pa,csv:r=>r.pa?.toFixed(2)},{k:'na',l:'평시 일평균',f:'html',h:r=>r.na==null?'-':r.na.toFixed(1),v:r=>r.na,csv:r=>r.na?.toFixed(2)},chCol('ch','판매량 증감률'),
      {k:'pq',l:'행사기간 수량',f:'int'},{k:'nst',l:'행사기간 판매 점포',f:'int'}]});
  renderPRS();prDetail()}
function renderPRS(){const R=PR_R,q=$('pr-s-s').value.trim();
  table($('pr-t-s'),{key:'id',sort:'pq',first:1,sel:PRF.selS,data:R.ss.filter(o=>o.np&&(!q||o.name.includes(q))),onClick:id=>{PRF.selS=+id;PRF.selP=null;prDetail();prMarkSel()},
    cols:[{k:'name',l:'점포',f:'text'},{k:'type',l:'유형',f:'text'},tierCol(),{k:'np',l:'행사 품목',f:'int'},
      {k:'pAvg',l:'행사 일평균',f:'html',h:r=>r.pAvg.toFixed(1),v:r=>r.pAvg,csv:r=>r.pAvg.toFixed(2)},{k:'nAvg',l:'평시 일평균',f:'html',h:r=>r.nAvg.toFixed(1),v:r=>r.nAvg,csv:r=>r.nAvg.toFixed(2)},chCol('ch','판매량 증감률'),{k:'pq',l:'행사기간 수량',f:'int'}]})}
function prMarkSel(){$('pr-t-p').querySelectorAll('tbody tr').forEach(tr=>tr.classList.toggle('sel',PRF.selP!=null&&+tr.dataset.id===PRF.selP));$('pr-t-s').querySelectorAll('tbody tr').forEach(tr=>tr.classList.toggle('sel',PRF.selS!=null&&+tr.dataset.id===PRF.selS));$('pr-t-d').scrollIntoView({behavior:'smooth',block:'center'})}
function prDetail(){const R=PR_R,q=$('pr-s-d').value.trim();
  const d=R.pairs.filter(o=>(PRF.selP==null||o.p===PRF.selP)&&(PRF.selS==null||o.s===PRF.selS)&&(!q||o.store.includes(q)||o.prod.includes(q)));
  const sel=PRF.selS!=null?STORES[PRF.selS].name:PRF.selP!=null?PRODS[PRF.selP].name:null;
  $('pr-sel').innerHTML=sel?`<span class="chip">선택: <b>${esc(sel)}</b></span> <button class="btn sm" id="pr-clr">전체 보기</button>`:`<span class="note">${fInt(d.length)}건</span>`;
  if(sel)$('pr-clr').onclick=()=>{PRF.selP=null;PRF.selS=null;prDetail();$('pr-t-p').querySelectorAll('tr.sel').forEach(t=>t.classList.remove('sel'));$('pr-t-s').querySelectorAll('tr.sel').forEach(t=>t.classList.remove('sel'))};
  table($('pr-t-d'),{key:'id',sort:'pq',first:1,data:d,cols:[{k:'store',l:'점포',f:'text'},{k:'type',l:'유형',f:'text'},{k:'prod',l:'상품명',f:'text',nm:1},{k:'period',l:'행사 기간',f:'text'},
    {k:'N',l:'정상원가',f:'int'},{k:'cost',l:'점포 행사원가',f:'html',h:r=>r.cost==null?'<span class="flat">판매 없음</span>':(r.disc<1-PR_TH?`<span class="up" title="행사 원가 미적용">${fInt(r.cost)}</span>`:fInt(r.cost)),v:r=>r.cost,csv:r=>r.cost==null?'':Math.round(r.cost)},
    {k:'disc',l:'인하율',f:'pct'},
    {k:'pa',l:'행사 일평균',f:'html',h:r=>r.pa.toFixed(2),v:r=>r.pa,csv:r=>r.pa.toFixed(2)},{k:'na',l:'평시 일평균',f:'html',h:r=>r.na.toFixed(2),v:r=>r.na,csv:r=>r.na.toFixed(2)},chCol('ch','판매량 증감률'),
    {k:'pq',l:'행사기간 수량',f:'int'},{k:'nq',l:'평시 수량',f:'int'}]})}
$('pr-s-s').addEventListener('input',renderPRS);$('pr-s-d').addEventListener('input',prDetail);
$('pr-x-p').onclick=()=>csv($('pr-t-p'),'이마트_행사_품목별','');$('pr-x-s').onclick=()=>csv($('pr-t-s'),'이마트_행사_점포별','');$('pr-x-d').onclick=()=>csv($('pr-t-d'),'이마트_행사_점포x품목','');
prBuildFilters();

setPeriod();buildPeriod();computeTiers();buildScope();buildFilters();render();

