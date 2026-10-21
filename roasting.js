const $=id=>document.getElementById(id);

/* ---------- 기준값 (학원 기록지 양식: 0~20분 / 60~250°C) ---------- */
const X_MIN_DEFAULT_MAX=20,Y_MIN=60,Y_MAX=250,START_ROWS=13,MAX_ROWS=31; // 0:00~12:00 13줄, 최대 30:00
const EVENTS=[
  {k:'tp',name:'Turning P',short:'TP',color:'#2368b2'},
  {k:'yp',name:'Yellow P',short:'YP',color:'#c28a00'},
  {k:'c1',name:'1st pop',short:'1st',color:'#c53b30'},
  {k:'c2',name:'2nd pop',short:'2nd',color:'#8a3fb0'},
  {k:'out',name:'배출 Output',short:'Out',color:'#111'}
];
let rows=0,current=null;

/* ---------- 입력 해석 ---------- */
// "8:30" 또는 "830" → 510초. 1~2자리 숫자는 분으로 본다. 잘못된 값은 NaN.
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

/* ---------- 1분 간격 입력 표 ---------- */
function buildHead(){$('rtable').innerHTML='<div class="trow thead"><span>시간</span><span>Exhaust</span><span>Drum</span><span>Fire</span><span>Damper</span></div>'}
function addRow(){
  if(rows>=MAX_ROWS)return;
  const d=document.createElement('div');d.className='trow';
  d.innerHTML=`<div class="tmin">${rows}:00</div>`+['ex','dr','fi','da'].map(k=>`<input data-k="${k}" data-r="${rows}" type="number" inputmode="decimal" step="any" aria-label="${rows}분 ${k}">`).join('');
  $('rtable').appendChild(d);rows++;
}
function delRow(){if(rows<=1)return;$('rtable').lastElementChild.remove();rows--}
const cell=(r,k)=>document.querySelector(`#rtable input[data-r="${r}"][data-k="${k}"]`);

/* ---------- 계산 ---------- */
function collect(){
  const list=[];
  for(let r=0;r<rows;r++){
    const ex=num(cell(r,'ex')),dr=num(cell(r,'dr')),fi=cell(r,'fi').value.trim(),da=cell(r,'da').value.trim();
    list.push({min:r,ex,dr,fi,da,ror:NaN});
  }
  for(let r=1;r<list.length;r++){if(ok(list[r].dr)&&ok(list[r-1].dr))list[r].ror=list[r].dr-list[r-1].dr} // 1분 간격 → °C/min
  const ev={};
  EVENTS.forEach(e=>{ev[e.k]={t:parseTime($(e.k+'_t').value),c:num($(e.k+'_c')),raw:$(e.k+'_t').value.trim()}});
  return{list,ev,wIn:num($('wIn')),wOut:num($('wOut')),agWB:num($('agWB')),agRGB:num($('agRGB')),inFire:$('inFire').value.trim(),inTemp:num($('inTemp'))};
}
function summarize(d){
  const out=d.ev.out.t,c1=d.ev.c1.t;
  const dt=(ok(out)&&ok(c1)&&out>c1)?out-c1:NaN;
  const dtr=(ok(dt)&&out>0)?dt/out*100:NaN;
  const loss=(d.wIn>0&&d.wOut>0&&d.wOut<=d.wIn)?(d.wIn-d.wOut)/d.wIn*100:NaN;
  return{dt,dtr,loss};
}

/* ---------- 표 렌더링 ---------- */
const f1=n=>ok(n)?n.toFixed(1):'';
function renderROR(d){
  let last=-1;d.list.forEach((x,i)=>{if(ok(x.dr)||ok(x.ex)||x.fi||x.da)last=i});
  if(last<0){$('rorTable').innerHTML='<div class="small">1분 간격 기록이 입력되지 않았어요.</div>';return}
  let h='<table class="data"><tr><th>시간</th><th>Exhaust</th><th>Drum</th><th>Fire / Damper</th><th>ROR</th></tr>';
  for(let i=0;i<=last;i++){
    const x=d.list[i],fd=(x.fi||x.da)?`${x.fi||'-'} / ${x.da||'-'}`:'';
    const ror=ok(x.ror)?`<span class="${x.ror<0?'ror-down':''}">${x.ror>0?'+':''}${x.ror.toFixed(1)}</span>`:'';
    h+=`<tr><td>${x.min}:00</td><td>${f1(x.ex)}</td><td>${f1(x.dr)}</td><td>${fd}</td><td>${ror}</td></tr>`;
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
  const xMax=Math.max(X_MIN_DEFAULT_MAX,Math.ceil(Math.max(0,...allX)));
  const yMin=Math.min(Y_MIN,Math.floor(Math.min(Y_MIN,...allY)/10)*10),yMax=Math.max(Y_MAX,Math.ceil(Math.max(Y_MAX,...allY)/10)*10);
  const ml=46,mr=12,mt=16,mb=40,pw=W-ml-mr,ph=H-mt-mb;
  const sx=x=>ml+x/xMax*pw,sy=y=>mt+(yMax-y)/(yMax-yMin)*ph;
  const narrow=pw<300,yLab=(ph/((yMax-yMin)/10)>=15)?10:20,xLab=(pw/xMax>=26)?1:2;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="로스팅 프로파일" font-family="inherit"><rect width="${W}" height="${H}" fill="#fff"/>`;
  // DT 구간 (1차 크랙 ~ 배출)
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
  const d=collect(),msg=$('msg');
  const bad=EVENTS.filter(e=>d.ev[e.k].raw&&!ok(d.ev[e.k].t)).map(e=>e.name);
  document.querySelectorAll('.tin').forEach(el=>el.classList.toggle('bad',!!el.value.trim()&&!ok(parseTime(el.value))));
  if(bad.length){msg.textContent=bad.join(', ')+' 시간을 확인해 주세요. 예: 8:30 또는 830';msg.hidden=false;return}
  const any=d.list.some(x=>ok(x.dr)||ok(x.ex))||EVENTS.some(e=>ok(d.ev[e.k].t))||d.wIn>0||d.wOut>0;
  if(!any){msg.textContent='입력된 값이 없어요. 무게, 이벤트, 1분 기록 중 입력한 값이 있어야 결과를 볼 수 있어요.';msg.hidden=false;return}
  msg.hidden=true;current=d;
  const r=summarize(d);
  $('rDT').textContent=fmt(r.dt);$('rDTR').textContent=ok(r.dtr)?r.dtr.toFixed(1)+'%':'—';$('rLoss').textContent=ok(r.loss)?r.loss.toFixed(1)+'%':'—';
  const notes=[];
  if(!ok(r.dt))notes.push('DT는 1차 크랙 시간과 배출 시간을 모두 입력하면 계산돼요.');
  if(d.wIn>0&&d.wOut>0&&d.wOut>d.wIn)notes.push('배출 무게가 투입 무게보다 커서 중량 손실률을 계산할 수 없어요.');
  else if(!ok(r.loss))notes.push('중량 손실률은 투입·배출 무게를 입력하면 계산돼요.');
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
buildHead();for(let i=0;i<START_ROWS;i++)addRow();
document.querySelectorAll('.tin').forEach(el=>{
  el.addEventListener('blur',()=>{const s=parseTime(el.value);if(ok(s))el.value=fmt(s);el.classList.toggle('bad',!!el.value.trim()&&!ok(s))});
});
$('addRow').addEventListener('click',addRow);$('delRow').addEventListener('click',delRow);
$('calcBtn').addEventListener('click',showResults);$('backBtn').addEventListener('click',showInput);
$('modeScroll').addEventListener('click',()=>setMode('scroll'));$('modeSwipe').addEventListener('click',()=>setMode('swipe'));
$('prevBtn').addEventListener('click',()=>step(-1));$('nextBtn').addEventListener('click',()=>step(1));
$('pages').addEventListener('scroll',updateDots);
if('ResizeObserver' in window)new ResizeObserver(drawChart).observe($('chart'));
window.addEventListener('resize',drawChart);
