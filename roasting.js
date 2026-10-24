const $=id=>document.getElementById(id);

/* ---------- 기준값 (세로축은 학원 기록지 양식 60~250°C, 가로축은 입력 길이에 맞춤) ---------- */
const X_FIT_MIN=5,Y_MIN=60,Y_MAX=250,START_ROWS=13,MAX_ROWS=31; // 0:00~12:00 13줄, 최대 30:00
const FIRE_C='#d9480f',DAMP_C='#1c7ed6';
const EVENTS=[
  {k:'tp',name:'Turning P',short:'TP',color:'#2368b2',req:true},
  {k:'yp',name:'Yellow P',short:'YP',color:'#c28a00',req:true},
  {k:'c1',name:'1st pop',short:'1st',color:'#c53b30',req:true},
  {k:'c2',name:'2nd pop',short:'2nd',color:'#8a3fb0',req:false},
  {k:'out',name:'배출 Output',short:'Out',color:'#111',req:true}
];
const BASIC=[['agWB','Agtron WB'],['agRGB','Agtron RGB'],['wIn','투입 무게'],['wOut','배출 무게'],['inFire','투입 화력'],['inDamper','투입 Damper'],['inTemp','투입 온도']];
let rows=0,current=null;

/* ---------- 입력 해석 ---------- */
// "8:30" 또는 "830" → 510초, "057" → 57초. 1~2자리 숫자는 분으로 본다. 잘못된 값은 NaN.
function parseTime(v){
  v=String(v||'').trim();if(!v)return NaN;
  let m,s;
  if(v.includes(':')){const p=v.split(':');if(p.length!==2||!/^\d+$/.test(p[0])||!/^\d*$/.test(p[1]))return NaN;m=+p[0];s=p[1]===''?0:+p[1]}
  else{if(!/^\d+$/.test(v))return NaN;if(v.length<=2){m=+v;s=0}else{m=+v.slice(0,-2);s=+v.slice(-2)}}
  return s>=60?NaN:m*60+s;
}
const fmt=sec=>isFinite(sec)?Math.floor(sec/60)+':'+String(Math.round(sec%60)).padStart(2,'0'):'—';
const num=el=>{const n=parseFloat(el.value);return isFinite(n)?n:NaN};
const ok=n=>Number.isFinite(n);
const empty=el=>el.value.trim()==='';
const nf=n=>ok(n)?(Number.isInteger(n)?String(n):String(+n.toFixed(2))):'';

/* ---------- 이벤트 입력칸 (항목 | 입력칸, 단위 표시) ---------- */
function buildEvents(){
  $('evInputs').innerHTML=EVENTS.map(e=>{
    const star=e.req?'<b class="req">*</b>':'';
    return `<div class="evbox"><div class="evtitle">${e.name}${e.req?'':'<span class="opt">(선택)</span>'}</div>
<div class="frow"><label class="flabel" for="${e.k}_t">시간 (분:초)${star}</label><input id="${e.k}_t" class="tin" inputmode="numeric" placeholder="예: 8:30 또는 830"></div>
<div class="frow"><label class="flabel" for="${e.k}_c">온도 (°C)${star}</label><input id="${e.k}_c" type="number" inputmode="decimal" step="0.1" placeholder="예: 196"></div></div>`;
  }).join('');
}

/* ---------- 1분 간격 입력 표 (Exhaust / Drum) ---------- */
const cell=(r,k)=>document.querySelector(`#rtable input[data-r="${r}"][data-k="${k}"]`);
function addRow(){
  if(rows>=MAX_ROWS)return;
  const r=rows,d=document.createElement('div');d.className='trow';
  const f=(k,name,unit,req)=>`<label class="tcell"><span class="tl">${name}${req?'<b class="req">*</b>':''}<i>${unit}</i></span><input data-k="${k}" data-r="${r}" type="number" inputmode="decimal" step="any"></label>`;
  d.innerHTML=`<div class="tmin">${r}:00</div>`+f('ex','Exhaust','°C · 선택',false)+f('dr','Drum','°C',true);
  $('rtable').appendChild(d);rows++;
}
function delRow(){if(rows<=1)return;$('rtable').lastElementChild.remove();rows--}

/* ---------- Fire / Damper 조작 기록 (바꾼 순간만, 시간 + 항목 + 값) ---------- */
function addCtl(focus){
  const d=document.createElement('div');d.className='crow';
  d.innerHTML=`<label class="tcell"><span class="tl">시간<i>분:초</i></span><input class="tin c-t" inputmode="numeric" placeholder="예: 3:20"></label>`+
  `<label class="tcell"><span class="tl">항목<i></i></span><select class="c-k"><option value="fire">Fire</option><option value="damper">Damper</option></select></label>`+
  `<label class="tcell"><span class="tl">값<i></i></span><input class="c-v" type="number" inputmode="decimal" step="any" placeholder="예: 4"></label>`+
  `<button class="xbtn" type="button" tabindex="-1" aria-label="이 조작 삭제">✕</button>`;
  $('ctlList').appendChild(d);
  if(focus)d.querySelector('.c-t').focus();
}
function readCtl(){
  return Array.from(document.querySelectorAll('#ctlList .crow')).map((el,i)=>{
    const tE=el.querySelector('.c-t'),vE=el.querySelector('.c-v');
    return{el,tE,vE,i:i+1,tRaw:tE.value.trim(),t:parseTime(tE.value),k:el.querySelector('.c-k').value,vRaw:vE.value.trim(),v:parseFloat(vE.value)};
  });
}
// 시점별 값: 가장 최근에 조작한 값이 이어진다.
const valueAt=(s,t)=>{let v=s[0][1];for(const p of s){if(p[0]<=t)v=p[1];else break}return v};

/* ---------- 수집·계산 ---------- */
function collect(){
  const list=[];
  for(let r=0;r<rows;r++)list.push({min:r,ex:num(cell(r,'ex')),dr:num(cell(r,'dr')),ror:NaN,flag:false});
  for(let r=1;r<list.length;r++){if(ok(list[r].dr)&&ok(list[r-1].dr))list[r].ror=list[r].dr-list[r-1].dr} // 1분 간격 → °C/min
  const ev={};
  EVENTS.forEach(e=>{ev[e.k]={t:parseTime($(e.k+'_t').value),c:num($(e.k+'_c')),raw:$(e.k+'_t').value.trim()}});
  // ROR이 직전 1분보다 올라간 구간 표시 (터닝 포인트 이전 구간은 제외)
  const p=ok(ev.tp.t)?Math.ceil(ev.tp.t/60):1;
  for(let r=p+2;r<list.length;r++){if(ok(list[r].ror)&&ok(list[r-1].ror)&&list[r].ror>list[r-1].ror)list[r].flag=true}
  // Fire / Damper 시계열: 0초(투입 설정) + 이후 조작
  const ctl=readCtl().filter(c=>ok(c.t)&&ok(c.v));
  const mk=(k,init)=>[[0,init]].concat(ctl.filter(c=>c.k===k).sort((a,b)=>a.t-b.t).map(c=>[c.t,c.v]));
  return{list,ev,fire:mk('fire',num($('inFire'))),damper:mk('damper',num($('inDamper'))),
    wIn:num($('wIn')),wOut:num($('wOut')),agWB:num($('agWB')),agRGB:num($('agRGB')),inTemp:num($('inTemp'))};
}
function summarize(d){
  const out=d.ev.out.t,c1=d.ev.c1.t,yp=d.ev.yp.t;
  const dt=(ok(out)&&ok(c1)&&out>c1)?out-c1:NaN;
  const dtr=(ok(dt)&&out>0)?dt/out*100:NaN;
  const loss=(d.wIn>0&&d.wOut>0&&d.wOut<=d.wIn)?(d.wIn-d.wOut)/d.wIn*100:NaN;
  // 구간 비율: 수분날리기(투입~YP) + Roasting Phase(YP~1st) + DT(1st~배출) = 100%
  let dry=NaN,phase=NaN,dtp=NaN,sum=NaN;
  if(ok(yp)&&ok(c1)&&ok(out)&&yp>0&&yp<c1&&c1<out){
    dry=+(yp/out*100).toFixed(1);dtp=+dtr.toFixed(1);   // DT 비율 = DTR (같은 값)
    phase=+(100-dry-dtp).toFixed(1);                     // 반올림 어긋남은 Roasting Phase에 맞춰 합계 100.0%
    sum=dry+phase+dtp;
  }
  return{dt,dtr,loss,dry,phase,dtp,sum};
}

/* ---------- 필수 입력 확인 ---------- */
const ranges=a=>{const o=[];let s=a[0],p=a[0];for(let i=1;i<=a.length;i++){if(a[i]===p+1){p=a[i];continue}o.push(s===p?`${s}분`:`${s}~${p}분`);s=a[i];p=a[i]}return o.join(', ')};
function checkRequired(){
  document.querySelectorAll('.miss,.bad').forEach(el=>el.classList.remove('miss','bad'));
  const lines=[],mark=el=>{el.classList.add('miss');return el};
  const wm=Work.missing();
  if(wm.length){wm.forEach(x=>mark($(x.id)));lines.push(`작업 정보: ${wm.map(x=>x.name).join(', ')}`)}
  // 기본 정보
  const b=BASIC.filter(([id])=>empty($(id))).map(([id,name])=>{mark($(id));return name});
  if(b.length)lines.push(`기본 정보: ${b.join(', ')}`);
  // 이벤트 (2nd pop은 선택)
  const e=[];
  EVENTS.filter(x=>x.req).forEach(x=>{
    if(empty($(x.k+'_t'))){mark($(x.k+'_t'));e.push(x.name+' 시간')}
    if(empty($(x.k+'_c'))){mark($(x.k+'_c'));e.push(x.name+' 온도')}
  });
  if(e.length)lines.push(`이벤트: ${e.join(', ')}`);
  const badT=EVENTS.filter(x=>!empty($(x.k+'_t'))&&!ok(parseTime($(x.k+'_t').value)));
  badT.forEach(x=>$(x.k+'_t').classList.add('bad'));
  if(badT.length)lines.push(`시간 형식 확인: ${badT.map(x=>x.name).join(', ')} (예: 8:30 또는 830, 초는 59까지)`);
  // Fire/Damper 조작 기록: 완전히 비어 있으면 무시, 일부만 채웠으면 알림
  const cl=[];
  readCtl().forEach(c=>{
    if(!c.tRaw&&!c.vRaw)return;
    const prob=[];
    if(!c.tRaw){mark(c.tE);prob.push('시간')}else if(!ok(c.t)){c.tE.classList.add('bad');prob.push('시간 형식')}
    if(!c.vRaw||!ok(c.v)){mark(c.vE);prob.push('값')}
    if(prob.length)cl.push(`${c.i}번째(${prob.join(', ')})`);
  });
  if(cl.length)lines.push(`Fire/Damper 조작 기록: ${cl.join(', ')}`);
  // 1분 간격 기록: 배출 시간의 분(예: 10:30이면 10분)까지 Drum 필수, Exhaust는 선택
  const outT=parseTime($('out_t').value),last=ok(outT)?Math.min(rows-1,Math.floor(outT/60)):0,m=[];
  for(let r=0;r<=last;r++){if(empty(cell(r,'dr'))){mark(cell(r,'dr'));m.push(r)}}
  if(m.length)lines.push(`1분 간격 기록 Drum 온도: ${ranges(m)}`);
  const msg=$('msg');
  if(lines.length){msg.innerHTML='<b>아직 입력되지 않았거나 확인이 필요한 항목이 있어요</b>'+lines.map(l=>'· '+l).join('<br>');msg.hidden=false;msg.scrollIntoView({block:'center',behavior:'smooth'});return false}
  msg.hidden=true;return true;
}

/* ---------- 표 렌더링 ---------- */
const f1=n=>ok(n)?n.toFixed(1):'';
function renderROR(d){
  let last=-1;d.list.forEach((x,i)=>{if(ok(x.dr)||ok(x.ex))last=i});
  if(last<0){$('rorTable').innerHTML='<div class="small">1분 간격 기록이 입력되지 않았어요.</div>';return}
  let h='<table class="data"><tr><th>시간</th><th>Exhaust</th><th>Drum</th><th>Fire / Damper</th><th>ROR</th></tr>';
  for(let i=0;i<=last;i++){
    const x=d.list[i],fd=`${nf(valueAt(d.fire,x.min*60))} / ${nf(valueAt(d.damper,x.min*60))}`;
    const txt=ok(x.ror)?`${x.ror>0?'+':''}${x.ror.toFixed(1)}`:'';
    h+=`<tr><td>${x.min}:00</td><td>${f1(x.ex)}</td><td>${f1(x.dr)}</td><td>${fd}</td><td>${x.flag?`<span class="ror-flag">${txt}</span>`:txt}</td></tr>`;
  }
  $('rorTable').innerHTML=h+'</table>';
}
// 구간 막대: 각 구간의 가로 폭이 비율(%)에 맞게 달라진다. 막대 안에는 % + 시간(줄바꿈), 아래 범례에는 이름·권장값.
function renderPhases(r,d){
  const bar=$('phaseBar'),lg=$('phaseLegend');
  if(!ok(r.dry)){bar.innerHTML='';lg.innerHTML='';$('rSum').textContent='';return}
  const t=d.ev;
  const P=[
    {cls:'s1',name:'Drying phase',ko:'수분날리기',pct:r.dry,sec:t.yp.t,tgt:35},
    {cls:'s2',name:'Maillard phase',ko:'Roasting Phase',pct:r.phase,sec:t.c1.t-t.yp.t,tgt:45},
    {cls:'s3',name:'Development phase',ko:'DT',pct:r.dtp,sec:t.out.t-t.c1.t,tgt:20}
  ];
  bar.innerHTML=P.map(p=>`<div class="ps ${p.cls}${p.pct<12?' sm':''}" style="width:${p.pct}%"${p.pct<6?' title="'+p.name+' '+p.pct.toFixed(1)+'%"':''}>${p.pct>=6?`<b>${p.pct.toFixed(1)}%</b><span>${fmt(p.sec)}</span>`:''}</div>`).join('');
  lg.innerHTML=P.map(p=>`<div class="lg"><i class="dot ${p.cls}"></i><span class="nm">${p.name}<em>${p.ko}</em></span><span class="vv">${p.pct.toFixed(1)}% · ${fmt(p.sec)}</span><span class="tg">권장 ${p.tgt}%</span></div>`).join('');
  $('rSum').textContent=`Total Duration Time ${fmt(t.out.t)} · 합계 ${r.sum.toFixed(1)}%`;
}
function renderEvents(d){
  let h='<table class="data"><tr><th>이벤트</th><th>시간</th><th>온도</th></tr>';
  EVENTS.forEach(e=>{const v=d.ev[e.k];if(ok(v.t)||ok(v.c))h+=`<tr><td>${e.name}</td><td>${ok(v.t)?fmt(v.t):''}</td><td>${f1(v.c)}</td></tr>`});
  if(ok(d.inTemp))h+=`<tr><td>투입</td><td>0:00</td><td>${f1(d.inTemp)}</td></tr>`;
  h+='</table>';
  const info=[];
  if(d.wIn>0)info.push('투입 '+d.wIn+' g');if(d.wOut>0)info.push('배출 '+d.wOut+' g');
  if(ok(d.agWB))info.push('Agtron WB '+d.agWB);if(ok(d.agRGB))info.push('RGB '+d.agRGB);
  if(info.length)h+=`<div class="small">${info.join(' · ')}</div>`;
  $('evTable').innerHTML=h;
}
function renderControls(d){
  const items=[];
  d.fire.forEach((p,i)=>items.push({t:p[0],k:'Fire',v:p[1],init:i===0}));
  d.damper.forEach((p,i)=>items.push({t:p[0],k:'Damper',v:p[1],init:i===0}));
  items.sort((a,b)=>a.t-b.t||(a.init===b.init?0:a.init?-1:1)||(a.k===b.k?0:a.k==='Fire'?-1:1));
  let h='<table class="data"><tr><th>시간</th><th>항목</th><th>값</th></tr>';
  items.forEach(x=>{h+=`<tr><td>${fmt(x.t)}${x.init?' <span style="color:#999;font-size:11px">투입</span>':''}</td><td>${x.k}</td><td>${nf(x.v)}</td></tr>`});
  $('ctlTable').innerHTML=h+'</table>';
}

/* ---------- 부드러운 곡선 (단조 3차 보간: 값을 넘나들지 않는 둥근 곡선) ---------- */
function smoothPath(p){
  const n=p.length;if(n<2)return '';
  if(n===2)return `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}L${p[1][0].toFixed(1)},${p[1][1].toFixed(1)}`;
  const dx=[],m=[];
  for(let i=0;i<n-1;i++){dx[i]=p[i+1][0]-p[i][0];m[i]=(p[i+1][1]-p[i][1])/dx[i]}
  const t=[m[0]];for(let i=1;i<n-1;i++)t[i]=(m[i-1]*m[i]<=0)?0:(m[i-1]+m[i])/2;t[n-1]=m[n-2];
  for(let i=0;i<n-1;i++){
    if(m[i]===0){t[i]=t[i+1]=0;continue}
    const a=t[i]/m[i],b=t[i+1]/m[i],s=a*a+b*b;
    if(s>9){const k=3/Math.sqrt(s);t[i]=k*a*m[i];t[i+1]=k*b*m[i]}
  }
  let s=`M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for(let i=0;i<n-1;i++){
    const h=dx[i]/3;
    s+=`C${(p[i][0]+h).toFixed(1)},${(p[i][1]+t[i]*h).toFixed(1)} ${(p[i+1][0]-h).toFixed(1)},${(p[i+1][1]-t[i+1]*h).toFixed(1)} ${p[i+1][0].toFixed(1)},${p[i+1][1].toFixed(1)}`;
  }
  return s;
}
const niceMax=v=>{const mag=Math.pow(10,Math.floor(Math.log10(v)));for(const m of [1,2,2.5,5,10]){if(m*mag>=v*1.1)return m*mag}return 10*mag};
const hit=(a,b)=>a[0]<b[0]+b[2]&&b[0]<a[0]+a[2]&&a[1]<b[1]+b[3]&&b[1]<a[1]+a[3];

// Damper 값은 기록자마다 150 / 1.5 처럼 자릿수가 달라서, Fire와 같은 눈금에 보이도록 10의 거듭제곱 배율을 자동으로 고른다.
function damperScale(d){
  const mx=a=>Math.max(0,...a.map(p=>Math.abs(p[1])).filter(ok));
  const f=mx(d.fire),m=mx(d.damper);
  return(f>0&&m>0)?Math.pow(10,Math.round(Math.log10(f/m))):0.01;
}
const scaleTxt=k=>k>=1?`×${+k.toPrecision(3)}`:`÷${+(1/k).toPrecision(3)}`;

/* ---------- 프로파일 그래프 (SVG): 위 = 온도, 아래 = Fire(계단) + Damper(점) ---------- */
function chartSVG(W,H,d){
  const pts=k=>d.list.filter(x=>ok(x[k])).map(x=>[x.min,x[k]]);
  const dr=pts('dr'),ex=pts('ex');
  const evs=EVENTS.filter(e=>ok(d.ev[e.k].t)&&ok(d.ev[e.k].c));
  const ctlT=d.fire.concat(d.damper).map(p=>p[0]/60);
  const allX=[...dr,...ex].map(p=>p[0]).concat(evs.map(e=>d.ev[e.k].t/60),ctlT),allY=[...dr,...ex].map(p=>p[1]).concat(evs.map(e=>d.ev[e.k].c));
  const xMax=Math.max(X_FIT_MIN,Math.ceil(Math.max(0,...allX))+1); // 입력한 데이터 길이에 맞춰 가로축 자동 조정
  const yMin=Math.min(Y_MIN,Math.floor(Math.min(Y_MIN,...allY)/10)*10),yMax=Math.max(Y_MAX,Math.ceil(Math.max(Y_MAX,...allY)/10)*10);
  const dk=damperScale(d);
  const subVals=d.fire.map(p=>p[1]).concat(d.damper.map(p=>p[1]*dk)).filter(ok);
  const subMax=niceMax(Math.max(1,...subVals));
  // 배치
  const ml=46,mr=12,mt=16,mb=40,gap=20,pw=W-ml-mr,inner=H-mt-mb-gap;
  const phM=Math.round(inner*0.7),phS=inner-phM,subTop=mt+phM+gap;
  const sx=x=>ml+x/xMax*pw,syM=y=>mt+(yMax-y)/(yMax-yMin)*phM,syS=v=>subTop+phS-v/subMax*phS;
  const narrow=pw<300,yLab=(phM/((yMax-yMin)/10)>=15)?10:20,xLab=(pw/xMax>=26)?1:2;
  const xEnd=ok(d.ev.out.t)?d.ev.out.t/60:Math.max(0,...allX);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="로스팅 프로파일" font-family="inherit"><rect width="${W}" height="${H}" fill="#fff"/>`;
  // DT 구간 (1차 크랙 ~ 배출)
  const c1=d.ev.c1.t,out=d.ev.out.t;
  if(ok(c1)&&ok(out)&&out>c1){s+=`<rect x="${sx(c1/60)}" y="${mt}" width="${sx(out/60)-sx(c1/60)}" height="${phM}" fill="#c9a26a" fill-opacity=".28"/><text x="${(sx(c1/60)+sx(out/60))/2}" y="${mt+13}" font-size="11" font-weight="700" fill="#6b5a3e" text-anchor="middle">DT</text>`;
    s+=`<rect x="${sx(c1/60)}" y="${subTop}" width="${sx(out/60)-sx(c1/60)}" height="${phS}" fill="#c9a26a" fill-opacity=".28"/>`}
  // 격자(위·아래 공통 세로선) + 눈금
  for(let x=0;x<=xMax;x++){
    s+=`<line x1="${sx(x)}" y1="${mt}" x2="${sx(x)}" y2="${mt+phM}" stroke="#e6e6e6"/><line x1="${sx(x)}" y1="${subTop}" x2="${sx(x)}" y2="${subTop+phS}" stroke="#e6e6e6"/>`;
    if(x%xLab===0)s+=`<text x="${sx(x)}" y="${subTop+phS+15}" font-size="11" fill="#555" text-anchor="middle">${x}</text>`;
  }
  for(let y=yMin;y<=yMax;y+=10){s+=`<line x1="${ml}" y1="${syM(y)}" x2="${ml+pw}" y2="${syM(y)}" stroke="${y%50===0?'#d2d2d2':'#ececec'}"/>`;if((y-yMin)%yLab===0)s+=`<text x="${ml-6}" y="${syM(y)+4}" font-size="11" fill="#555" text-anchor="end">${y}</text>`}
  [0,subMax/2,subMax].forEach(v=>{s+=`<line x1="${ml}" y1="${syS(v)}" x2="${ml+pw}" y2="${syS(v)}" stroke="#ececec"/><text x="${ml-6}" y="${syS(v)+4}" font-size="10" fill="#777" text-anchor="end">${+v.toFixed(1)}</text>`});
  s+=`<rect x="${ml}" y="${mt}" width="${pw}" height="${phM}" fill="none" stroke="#999"/><rect x="${ml}" y="${subTop}" width="${pw}" height="${phS}" fill="none" stroke="#999"/>`;
  s+=`<text x="${ml+pw/2}" y="${H-6}" font-size="12" font-weight="700" fill="#333" text-anchor="middle">시간 (분)</text><text transform="translate(10 ${mt+phM/2}) rotate(-90)" font-size="12" font-weight="700" fill="#333" text-anchor="middle">온도 (°C)</text>`;
  s+=`<text x="${ml}" y="${subTop-6}" font-size="10" fill="#666"><tspan fill="${FIRE_C}" font-weight="700">Fire</tspan> (계단) · <tspan fill="${DAMP_C}" font-weight="700">Damper</tspan> ${scaleTxt(dk)} (점)</text>`;

  /* 위: Drum(실선) · Exhaust(점선) — 둥근 곡선 */
  const px=p=>p.map(q=>[sx(q[0]),syM(q[1])]);
  if(ex.length>=2)s+=`<path d="${smoothPath(px(ex))}" fill="none" stroke="#8a8a8a" stroke-width="2.2" stroke-dasharray="5 4" stroke-linecap="round"/>`;
  if(dr.length>=2)s+=`<path d="${smoothPath(px(dr))}" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  dr.forEach(q=>{s+=`<circle cx="${sx(q[0])}" cy="${syM(q[1])}" r="2.6" fill="#111"/>`});
  // 이벤트 점 + 글자(겹치면 아래·옆으로 피함)
  const P=evs.map(e=>({e,x:sx(d.ev[e.k].t/60),y:syM(d.ev[e.k].c)}));
  const taken=P.map(q=>[q.x-8,q.y-8,16,16]);
  P.forEach(q=>{
    s+=`<circle cx="${q.x}" cy="${q.y}" r="6" fill="${q.e.color}" stroke="#fff" stroke-width="2"/>`;
  });
  P.forEach(q=>{
    const w=q.e.short.length*6.6+4,h=12;
    const cand=[[q.x-w/2,q.y-9-h],[q.x-w/2,q.y+9],[q.x+9,q.y-h/2],[q.x-9-w,q.y-h/2]];
    let pick=cand.find(r=>{const b=[r[0],r[1],w,h];return r[0]>=ml&&r[0]+w<=ml+pw&&r[1]>=mt-6&&r[1]+h<=mt+phM&&!taken.some(t=>hit(b,t))})||cand[0];
    taken.push([pick[0],pick[1],w,h]);
    s+=`<text x="${pick[0]+w/2}" y="${pick[1]+h-2}" font-size="${narrow?10:11}" font-weight="700" fill="${q.e.color}" text-anchor="middle" stroke="#fff" stroke-width="3" paint-order="stroke" stroke-linejoin="round">${q.e.short}</text>`;
  });

  /* 아래: Fire = 계단형, Damper = 동그란 점을 이은 선 (값÷100) */
  let fp=`M${sx(0)},${syS(d.fire[0][1])}`,prev=d.fire[0][1];
  d.fire.slice(1).forEach(p=>{fp+=`H${sx(p[0]/60)}V${syS(p[1])}`;prev=p[1]});
  fp+=`H${sx(Math.max(xEnd,d.fire[d.fire.length-1][0]/60))}`;
  s+=`<path d="${fp}" fill="none" stroke="${FIRE_C}" stroke-width="2.4" stroke-linejoin="round"/>`;
  const dp=d.damper.map(p=>[sx(p[0]/60),syS(p[1]*dk)]);
  if(dp.length>=2)s+=`<polyline points="${dp.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')}" fill="none" stroke="${DAMP_C}" stroke-width="1.8" stroke-linejoin="round"/>`;
  const lastD=dp[dp.length-1],endX=sx(Math.max(xEnd,d.damper[d.damper.length-1][0]/60));
  if(endX>lastD[0]+1)s+=`<line x1="${lastD[0]}" y1="${lastD[1]}" x2="${endX}" y2="${lastD[1]}" stroke="${DAMP_C}" stroke-width="1.4" stroke-dasharray="3 3" stroke-opacity=".7"/>`;
  dp.forEach(q=>{s+=`<circle cx="${q[0]}" cy="${q[1]}" r="4" fill="${DAMP_C}" stroke="#fff" stroke-width="1.5"/>`});
  // 값 표시 (가까우면 생략)
  const lab=[];const put=(x,y,txt,color)=>{if(lab.some(l=>Math.abs(l[0]-x)<26&&Math.abs(l[1]-y)<12))return;lab.push([x,y]);s+=`<text x="${x}" y="${y}" font-size="9.5" font-weight="700" fill="${color}" text-anchor="middle" stroke="#fff" stroke-width="2.5" paint-order="stroke">${txt}</text>`};
  d.damper.forEach((p,i)=>put(dp[i][0]+(i===0?8:0),dp[i][1]-8,nf(p[1]),DAMP_C));
  d.fire.forEach(p=>put(sx(p[0]/60)+(p[0]===0?8:0),syS(p[1])-6,nf(p[1]),FIRE_C));
  return{svg:s+'</svg>',points:dr.length+ex.length};
}
function chartHeight(W){
  if(window.matchMedia('(orientation:landscape) and (max-height:520px)').matches)return Math.round(Math.max(250,Math.min(W*0.55,window.innerHeight-110)));
  return Math.round(W<480?W*1.15:W*0.8);
}
function drawChart(){
  if(!current)return;const box=$('chart'),W=Math.floor(box.clientWidth);if(W<100)return;
  const r=chartSVG(W,chartHeight(W),current);box.innerHTML=r.svg;
  $('chartNote').textContent=r.points<2?'Drum 온도를 2개 이상 입력하면 곡선이 그려져요.':'';
}

/* ---------- 결과보기 ---------- */
function showResults(){
  if(!checkRequired())return;
  const d=collect();current=d;Work.renderHeads();
  const r=summarize(d);
  $('rDT').textContent=fmt(r.dt);$('rDTR').textContent=ok(r.dtr)?r.dtr.toFixed(1)+'%':'—';$('rLoss').textContent=ok(r.loss)?r.loss.toFixed(1)+'%':'—';
  renderPhases(r,d);
  const notes=[];
  if(!ok(r.dt))notes.push('배출 시간이 1차 크랙 시간보다 늦어야 DT를 계산할 수 있어요.');
  else if(!ok(r.dry))notes.push('Yellow P → 1st pop → 배출 순서의 시간이어야 구간 비율을 계산할 수 있어요.');
  if(d.wIn>0&&d.wOut>0&&d.wOut>d.wIn)notes.push('배출 무게가 투입 무게보다 커서 중량 손실률을 계산할 수 없어요.');
  $('rNote').textContent=notes.join(' ');
  renderROR(d);renderEvents(d);renderControls(d);
  $('inputView').hidden=true;$('resultView').hidden=false;
  drawChart();setMode(mode);window.scrollTo(0,0);
}
function showInput(){$('resultView').hidden=true;$('inputView').hidden=false;window.scrollTo(0,0)}

/* ---------- 보기 방식 (브루잉 계산기와 동일) ---------- */
let mode='scroll';
const pages=()=>Array.from(document.querySelectorAll('#pages .page'));
function setMode(m){
  mode=m;$('pages').className='pages '+m;
  $('modeScroll').setAttribute('aria-pressed',m==='scroll');$('modeSwipe').setAttribute('aria-pressed',m==='swipe');
  $('pager').hidden=(m!=='swipe');$('pages').scrollLeft=0;updateDots();drawChart();
}
function updateDots(){
  const box=$('pages'),n=pages().length,idx=mode==='swipe'?Math.round(box.scrollLeft/Math.max(1,box.clientWidth)):0;
  $('dots').innerHTML=Array.from({length:n},(_,i)=>`<span class="dot${i===idx?' on':''}"></span>`).join('');
  $('prevBtn').disabled=idx<=0;$('nextBtn').disabled=idx>=n-1;
}
function step(dir){const box=$('pages');box.scrollBy({left:dir*box.clientWidth,behavior:'smooth'})}

/* ---------- 이벤트 연결 ---------- */
buildEvents();for(let i=0;i<START_ROWS;i++)addRow();
// 시간 칸(이벤트·조작 기록 공통): 칸을 벗어나면 분:초로 정리 (057 → 0:57)
document.addEventListener('focusout',e=>{const el=e.target;if(el.classList&&el.classList.contains('tin')){const s=parseTime(el.value);if(ok(s))el.value=fmt(s)}});
document.addEventListener('input',e=>{if(e.target.classList)e.target.classList.remove('miss','bad')});
$('ctlList').addEventListener('click',e=>{const b=e.target.closest('.xbtn');if(b)b.closest('.crow').remove()});
$('ctlList').addEventListener('change',e=>{if(e.target.classList.contains('c-k')){e.target.closest('.crow').querySelector('.c-v').placeholder=e.target.value==='damper'?'1000':'예: 4'}});
$('addCtl').addEventListener('click',()=>addCtl(true));
$('addRow').addEventListener('click',addRow);$('delRow').addEventListener('click',delRow);
$('calcBtn').addEventListener('click',showResults);$('backBtn').addEventListener('click',showInput);
$('modeScroll').addEventListener('click',()=>setMode('scroll'));$('modeSwipe').addEventListener('click',()=>setMode('swipe'));
$('prevBtn').addEventListener('click',()=>step(-1));$('nextBtn').addEventListener('click',()=>step(1));
$('pages').addEventListener('scroll',updateDots);
if('ResizeObserver' in window)new ResizeObserver(drawChart).observe($('chart'));
window.addEventListener('resize',drawChart);
