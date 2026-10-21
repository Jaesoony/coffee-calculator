const $=id=>document.getElementById(id);

/* ---------- 기준값 (세로축은 학원 기록지 양식 60~250°C, 가로축은 입력 길이에 맞춤) ---------- */
const X_FIT_MIN=5,Y_MIN=60,Y_MAX=250,START_ROWS=13,MAX_ROWS=31; // 0:00~12:00 13줄, 최대 30:00
const EVENTS=[
  {k:'tp',name:'Turning P',short:'TP',color:'#2368b2',req:true},
  {k:'yp',name:'Yellow P',short:'YP',color:'#c28a00',req:true},
  {k:'c1',name:'1st pop',short:'1st',color:'#c53b30',req:true},
  {k:'c2',name:'2nd pop',short:'2nd',color:'#8a3fb0',req:false},
  {k:'out',name:'배출 Output',short:'Out',color:'#111',req:true}
];
const BASIC=[['agWB','Agtron WB'],['agRGB','Agtron RGB'],['wIn','투입 무게'],['wOut','배출 무게'],['inFire','투입 화력'],['inTemp','투입 온도']];
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

/* ---------- 이벤트 입력칸 (항목 | 입력칸, 단위 표시) ---------- */
function buildEvents(){
  $('evInputs').innerHTML=EVENTS.map(e=>{
    const star=e.req?'<b class="req">*</b>':'';
    return `<div class="evbox"><div class="evtitle">${e.name}${e.req?'':'<span class="opt">(선택)</span>'}</div>
<div class="frow"><label class="flabel" for="${e.k}_t">시간 (분:초)${star}</label><input id="${e.k}_t" class="tin" inputmode="numeric" placeholder="예: 8:30 또는 830"></div>
<div class="frow"><label class="flabel" for="${e.k}_c">온도 (°C)${star}</label><input id="${e.k}_c" type="number" inputmode="decimal" step="0.1" placeholder="예: 196"></div></div>`;
  }).join('');
}

/* ---------- 1분 간격 입력 표 ---------- */
const cell=(r,k)=>document.querySelector(`#rtable input[data-r="${r}"][data-k="${k}"]`);
function setAuto(c,v){c.value=v;c.dataset.auto='1';c.classList.add('auto');c.classList.remove('miss')}
function addRow(){
  if(rows>=MAX_ROWS)return;
  const r=rows,d=document.createElement('div');d.className='trow';
  const f=(k,name,unit,req)=>`<label class="tcell"><span class="tl">${name}${req?'<b class="req">*</b>':''}<i>${unit}</i></span><input data-k="${k}" data-r="${r}" type="number" inputmode="decimal" step="any"></label>`;
  d.innerHTML=`<div class="tmin">${r}:00</div>`+f('ex','Exhaust','°C · 선택',false)+f('dr','Drum','°C',true)+f('fi','Fire','',true)+f('da','Damper','',true);
  $('rtable').appendChild(d);rows++;
  if(r>0)['fi','da'].forEach(k=>{const p=cell(r-1,k).value;if(p!=='')setAuto(cell(r,k),p)}); // 위 칸 값 이어받기
}
function delRow(){if(rows<=1)return;$('rtable').lastElementChild.remove();rows--}
// Fire/Damper: 직접 입력한 값을 아래 칸으로 이어서 채운다. 직접 입력한 칸을 만나면 멈춘다.
function propagate(r,k){
  const v=cell(r,k).value;
  for(let j=r+1;j<rows;j++){const c=cell(j,k);if(c.value!==''&&c.dataset.auto!=='1')break;setAuto(c,v)}
}

/* ---------- 수집·계산 ---------- */
function collect(){
  const list=[];
  for(let r=0;r<rows;r++)list.push({min:r,ex:num(cell(r,'ex')),dr:num(cell(r,'dr')),fi:cell(r,'fi').value.trim(),da:cell(r,'da').value.trim(),ror:NaN,flag:false});
  for(let r=1;r<list.length;r++){if(ok(list[r].dr)&&ok(list[r-1].dr))list[r].ror=list[r].dr-list[r-1].dr} // 1분 간격 → °C/min
  const ev={};
  EVENTS.forEach(e=>{ev[e.k]={t:parseTime($(e.k+'_t').value),c:num($(e.k+'_c')),raw:$(e.k+'_t').value.trim()}});
  // ROR이 직전 1분보다 올라간 구간 표시 (터닝 포인트 이전 구간은 제외)
  const p=ok(ev.tp.t)?Math.ceil(ev.tp.t/60):1;
  for(let r=p+2;r<list.length;r++){if(ok(list[r].ror)&&ok(list[r-1].ror)&&list[r].ror>list[r-1].ror)list[r].flag=true}
  return{list,ev,wIn:num($('wIn')),wOut:num($('wOut')),agWB:num($('agWB')),agRGB:num($('agRGB')),inFire:$('inFire').value.trim(),inTemp:num($('inTemp'))};
}
function summarize(d){
  const out=d.ev.out.t,c1=d.ev.c1.t;
  const dt=(ok(out)&&ok(c1)&&out>c1)?out-c1:NaN;
  const dtr=(ok(dt)&&out>0)?dt/out*100:NaN;
  const loss=(d.wIn>0&&d.wOut>0&&d.wOut<=d.wIn)?(d.wIn-d.wOut)/d.wIn*100:NaN;
  return{dt,dtr,loss};
}

/* ---------- 필수 입력 확인 ---------- */
const ranges=a=>{const o=[];let s=a[0],p=a[0];for(let i=1;i<=a.length;i++){if(a[i]===p+1){p=a[i];continue}o.push(s===p?`${s}분`:`${s}~${p}분`);s=a[i];p=a[i]}return o.join(', ')};
function checkRequired(){
  document.querySelectorAll('.miss,.bad').forEach(el=>el.classList.remove('miss','bad'));
  const lines=[];
  const mark=el=>{el.classList.add('miss');return el};
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
  // 시간 형식
  const badT=EVENTS.filter(x=>!empty($(x.k+'_t'))&&!ok(parseTime($(x.k+'_t').value)));
  badT.forEach(x=>$(x.k+'_t').classList.add('bad'));
  if(badT.length)lines.push(`시간 형식 확인: ${badT.map(x=>x.name).join(', ')} (예: 8:30 또는 830, 초는 59까지)`);
  // 1분 간격 기록: 배출 시간의 분(예: 10:30이면 10분)까지 Drum·Fire·Damper 필수, Exhaust는 선택
  const outT=parseTime($('out_t').value);
  const last=ok(outT)?Math.min(rows-1,Math.floor(outT/60)):0;
  [['dr','Drum 온도'],['fi','Fire'],['da','Damper']].forEach(([k,name])=>{
    const m=[];for(let r=0;r<=last;r++){if(empty(cell(r,k))){mark(cell(r,k));m.push(r)}}
    if(m.length)lines.push(`1분 간격 기록 ${name}: ${ranges(m)}`);
  });
  const msg=$('msg');
  if(lines.length){msg.innerHTML='<b>아직 입력되지 않았거나 확인이 필요한 항목이 있어요</b>'+lines.map(l=>'· '+l).join('<br>');msg.hidden=false;msg.scrollIntoView({block:'center',behavior:'smooth'});return false}
  msg.hidden=true;return true;
}

/* ---------- 표 렌더링 ---------- */
const f1=n=>ok(n)?n.toFixed(1):'';
function renderROR(d){
  let last=-1;d.list.forEach((x,i)=>{if(ok(x.dr)||ok(x.ex)||x.fi||x.da)last=i});
  if(last<0){$('rorTable').innerHTML='<div class="small">1분 간격 기록이 입력되지 않았어요.</div>';return}
  let h='<table class="data"><tr><th>시간</th><th>Exhaust</th><th>Drum</th><th>Fire / Damper</th><th>ROR</th></tr>';
  for(let i=0;i<=last;i++){
    const x=d.list[i],fd=(x.fi||x.da)?`${x.fi||'-'} / ${x.da||'-'}`:'';
    const txt=ok(x.ror)?`${x.ror>0?'+':''}${x.ror.toFixed(1)}`:'';
    h+=`<tr><td>${x.min}:00</td><td>${f1(x.ex)}</td><td>${f1(x.dr)}</td><td>${fd}</td><td>${x.flag?`<span class="ror-flag">${txt}</span>`:txt}</td></tr>`;
  }
  $('rorTable').innerHTML=h+'</table>';
}
function renderEvents(d){
  let h='<table class="data"><tr><th>이벤트</th><th>시간</th><th>온도</th></tr>';
  EVENTS.forEach(e=>{const v=d.ev[e.k];if(ok(v.t)||ok(v.c))h+=`<tr><td>${e.name}</td><td>${ok(v.t)?fmt(v.t):''}</td><td>${f1(v.c)}</td></tr>`});
  if(d.inFire||ok(d.inTemp))h+=`<tr><td>투입</td><td></td><td>${f1(d.inTemp)}</td></tr>`;
  h+='</table>';
  const info=[];
  if(d.wIn>0)info.push('투입 '+d.wIn+' g');if(d.wOut>0)info.push('배출 '+d.wOut+' g');
  if(ok(d.agWB))info.push('Agtron WB '+d.agWB);if(ok(d.agRGB))info.push('RGB '+d.agRGB);
  if(info.length)h+=`<div class="small">${info.join(' · ')}</div>`;
  $('evTable').innerHTML=h;
}

/* ---------- 프로파일 그래프 (SVG) ---------- */
function chartSVG(W,H,d){
  const pts=(k)=>d.list.filter(x=>ok(x[k])).map(x=>[x.min,x[k]]);
  const dr=pts('dr'),ex=pts('ex');
  const evs=EVENTS.filter(e=>ok(d.ev[e.k].t)&&ok(d.ev[e.k].c));
  const allX=[...dr,...ex].map(p=>p[0]).concat(evs.map(e=>d.ev[e.k].t/60)),allY=[...dr,...ex].map(p=>p[1]).concat(evs.map(e=>d.ev[e.k].c));
  const xMax=Math.max(X_FIT_MIN,Math.ceil(Math.max(0,...allX))+1); // 입력한 데이터 길이에 맞춰 가로축 자동 조정
  const yMin=Math.min(Y_MIN,Math.floor(Math.min(Y_MIN,...allY)/10)*10),yMax=Math.max(Y_MAX,Math.ceil(Math.max(Y_MAX,...allY)/10)*10);
  const ml=46,mr=12,mt=16,mb=40,pw=W-ml-mr,ph=H-mt-mb;
  const sx=x=>ml+x/xMax*pw,sy=y=>mt+(yMax-y)/(yMax-yMin)*ph;
  const narrow=pw<300,yLab=(ph/((yMax-yMin)/10)>=15)?10:20,xLab=(pw/xMax>=26)?1:2;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="로스팅 프로파일" font-family="inherit"><rect width="${W}" height="${H}" fill="#fff"/>`;
  const c1=d.ev.c1.t,out=d.ev.out.t;
  if(ok(c1)&&ok(out)&&out>c1){s+=`<rect x="${sx(c1/60)}" y="${mt}" width="${sx(out/60)-sx(c1/60)}" height="${ph}" fill="#c9a26a" fill-opacity=".28"/><text x="${(sx(c1/60)+sx(out/60))/2}" y="${mt+13}" font-size="11" font-weight="700" fill="#6b5a3e" text-anchor="middle">DT</text>`}
  for(let x=0;x<=xMax;x++){s+=`<line x1="${sx(x)}" y1="${mt}" x2="${sx(x)}" y2="${mt+ph}" stroke="#e6e6e6"/>`;if(x%xLab===0)s+=`<text x="${sx(x)}" y="${mt+ph+15}" font-size="11" fill="#555" text-anchor="middle">${x}</text>`}
  for(let y=yMin;y<=yMax;y+=10){s+=`<line x1="${ml}" y1="${sy(y)}" x2="${ml+pw}" y2="${sy(y)}" stroke="${y%50===0?'#d2d2d2':'#ececec'}"/>`;if((y-yMin)%yLab===0)s+=`<text x="${ml-6}" y="${sy(y)+4}" font-size="11" fill="#555" text-anchor="end">${y}</text>`}
  s+=`<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="none" stroke="#999"/>`;
  s+=`<text x="${ml+pw/2}" y="${H-6}" font-size="12" font-weight="700" fill="#333" text-anchor="middle">시간 (분)</text><text transform="translate(10 ${mt+ph/2}) rotate(-90)" font-size="12" font-weight="700" fill="#333" text-anchor="middle">온도 (°C)</text>`;
  const line=(p,color,dash)=>p.length>=2?`<polyline points="${p.map(q=>sx(q[0]).toFixed(1)+','+sy(q[1]).toFixed(1)).join(' ')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"${dash?' stroke-dasharray="5 4"':''}/>`:'';
  s+=line(ex,'#8a8a8a',true)+line(dr,'#111',false);
  dr.forEach(q=>{s+=`<circle cx="${sx(q[0])}" cy="${sy(q[1])}" r="2.6" fill="#111"/>`});
  evs.forEach(e=>{const x=sx(d.ev[e.k].t/60),y=sy(d.ev[e.k].c);
    s+=`<circle cx="${x}" cy="${y}" r="6" fill="${e.color}" stroke="#fff" stroke-width="2"/><text x="${x}" y="${y-10}" font-size="${narrow?10:11}" font-weight="700" fill="${e.color}" text-anchor="middle">${e.short}</text>`});
  return{svg:s+'</svg>',points:dr.length+ex.length};
}
function chartHeight(W){
  if(window.matchMedia('(orientation:landscape) and (max-height:520px)').matches)return Math.round(Math.max(220,Math.min(W*0.5,window.innerHeight-110)));
  return Math.round(W<480?W*0.9:W*0.62);
}
function drawChart(){
  if(!current)return;const box=$('chart'),W=Math.floor(box.clientWidth);if(W<100)return;
  const r=chartSVG(W,chartHeight(W),current);box.innerHTML=r.svg;
  $('chartNote').textContent=r.points<2?'Drum 온도를 2개 이상 입력하면 곡선이 그려져요.':'';
}

/* ---------- 결과보기 ---------- */
function showResults(){
  if(!checkRequired())return;
  const d=collect();current=d;
  const r=summarize(d);
  $('rDT').textContent=fmt(r.dt);$('rDTR').textContent=ok(r.dtr)?r.dtr.toFixed(1)+'%':'—';$('rLoss').textContent=ok(r.loss)?r.loss.toFixed(1)+'%':'—';
  const notes=[];
  if(!ok(r.dt))notes.push('배출 시간이 1차 크랙 시간보다 늦어야 DT를 계산할 수 있어요.');
  if(d.wIn>0&&d.wOut>0&&d.wOut>d.wIn)notes.push('배출 무게가 투입 무게보다 커서 중량 손실률을 계산할 수 없어요.');
  $('rNote').textContent=notes.join(' ');
  renderROR(d);renderEvents(d);
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
document.querySelectorAll('.tin').forEach(el=>{
  el.addEventListener('blur',()=>{const s=parseTime(el.value);if(ok(s))el.value=fmt(s)});
});
// 입력하면 빨간 표시 해제, Fire/Damper는 아래 칸으로 이어서 채움
document.addEventListener('input',e=>{
  const c=e.target;if(!c.classList)return;c.classList.remove('miss','bad');
  if(c.dataset&&(c.dataset.k==='fi'||c.dataset.k==='da')&&c.value!==''){c.dataset.auto='0';c.classList.remove('auto');propagate(+c.dataset.r,c.dataset.k)}
});
// 칸을 비운 채 벗어나면 위 칸 값을 다시 이어받음
$('rtable').addEventListener('focusout',e=>{
  const c=e.target,k=c.dataset&&c.dataset.k,r=+c.dataset.r;
  if((k==='fi'||k==='da')&&c.value===''&&r>0){const p=cell(r-1,k).value;if(p!==''){setAuto(c,p);propagate(r,k)}}
});
$('addRow').addEventListener('click',addRow);$('delRow').addEventListener('click',delRow);
$('calcBtn').addEventListener('click',showResults);$('backBtn').addEventListener('click',showInput);
$('modeScroll').addEventListener('click',()=>setMode('scroll'));$('modeSwipe').addEventListener('click',()=>setMode('swipe'));
$('prevBtn').addEventListener('click',()=>step(-1));$('nextBtn').addEventListener('click',()=>step(1));
$('pages').addEventListener('scroll',updateDots);
if('ResizeObserver' in window)new ResizeObserver(drawChart).observe($('chart'));
window.addEventListener('resize',drawChart);
