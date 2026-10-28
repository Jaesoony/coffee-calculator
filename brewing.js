const $=id=>document.getElementById(id);

/* ---------- 차트 기준값 (SCA Brewing Control Chart) ---------- */
const X_MIN=14,X_MAX=26,Y_MIN=0.8,Y_MAX=1.6;      // 추출수율 14~26%, TDS 0.80~1.60%
const LINE_DOSES=[135,128,121,113,106,99,92,85,78]; // 물 1.9 L 기준 원두 g
const REF_WATER=1900,ABSORB=2;                      // 원두 1g당 물 2g 흡수 가정(차트 선 계산용)

let current=null; // 마지막 계산 결과 {ey,t}

function readInputs(){return{d:parseFloat($('dose').value),w:parseFloat($('water').value),b:parseFloat($('beverage').value),t:parseFloat($('tds').value)}}

/* 입력 중에는 Brew Ratio 배지만 실시간 갱신 */
function updateRatio(){const{d,w}=readInputs();$('ratio').textContent=(d>0&&w>0)?'1 : '+(w/d).toFixed(2):'—'}

/* ---------- 차트 SVG 생성 ---------- */
function chartSVG(W,H,ey,t){
  const ml=46,mr=42,mb=44,pw=W-ml-mr,narrow=pw<300,mt=narrow?40:26,ph=H-mt-mb;
  const sx=x=>ml+(x-X_MIN)/(X_MAX-X_MIN)*pw, sy=y=>mt+(Y_MAX-y)/(Y_MAX-Y_MIN)*ph;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fs=pw<240?9:10;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="SCA Brewing Control Chart" font-family="inherit">`;
  s+=`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`;
  // 이상 구간 (추출수율 18~22%, TDS 1.15~1.35%)
  s+=`<rect x="${sx(18)}" y="${mt}" width="${sx(22)-sx(18)}" height="${ph}" fill="#c9a26a" fill-opacity=".38"/>`;
  s+=`<rect x="${ml}" y="${sy(1.35)}" width="${pw}" height="${sy(1.15)-sy(1.35)}" fill="#c9a26a" fill-opacity=".38"/>`;
  // 격자 + 눈금
  for(let x=X_MIN;x<=X_MAX;x++){
    s+=`<line x1="${sx(x)}" y1="${mt}" x2="${sx(x)}" y2="${mt+ph}" stroke="#e2e2e2"/>`;
    s+=`<text x="${sx(x)}" y="${mt+ph+15}" font-size="11" fill="#555" text-anchor="middle">${x}</text>`;
  }
  for(let i=0;i<=8;i++){
    const y=Y_MIN+i*0.1;
    s+=`<line x1="${ml}" y1="${sy(y)}" x2="${ml+pw}" y2="${sy(y)}" stroke="#e2e2e2"/>`;
    s+=`<text x="${ml-6}" y="${sy(y)+4}" font-size="11" fill="#555" text-anchor="end">${y.toFixed(2)}</text>`;
  }
  // Brew Ratio 사선 (원점을 지나는 직선: TDS = 기울기 × 추출수율)
  let topIdx=0;
  LINE_DOSES.forEach(D=>{
    const k=D/(REF_WATER-ABSORB*D);
    const x0=Math.max(X_MIN,Y_MIN/k), x1=Math.min(X_MAX,Y_MAX/k);
    s+=`<line x1="${sx(x0)}" y1="${sy(k*x0)}" x2="${sx(x1)}" y2="${sy(k*x1)}" stroke="#e07a4f" stroke-opacity=".85" stroke-width="1.2"/>`;
    if(Y_MAX/k<=X_MAX){const ty=mt-7-(narrow&&topIdx++%2?12:0);s+=`<text x="${sx(x1)}" y="${ty}" font-size="10" fill="#b4532a" text-anchor="middle">${D}g</text>`}
    else{s+=`<text x="${ml+pw+4}" y="${sy(k*X_MAX)+3}" font-size="10" fill="#b4532a">${D}g</text>`}
  });
  // 구역 이름
  const lab=(x,y,lines,boldFirst)=>{let o=`<text x="${sx(x)}" y="${sy(y)-(lines.length-1)*(fs+1)/2+fs/2-1}" font-size="${fs}" fill="#6b5a3e" text-anchor="middle">`;lines.forEach((l,i)=>{o+=`<tspan x="${sx(x)}" dy="${i?fs+2:0}"${boldFirst&&i===0?' font-weight="700"':''}>${l}</tspan>`});return o+`</text>`};
  s+=lab(16,1.48,['STRONG','UNDER-','DEVELOPED']);s+=lab(20,1.48,['STRONG']);s+=lab(24,1.48,['STRONG','BITTER']);
  s+=lab(16,1.25,['UNDER-','DEVELOPED']);s+=lab(20,1.25,['IDEAL','OPTIMUM','BALANCE'],true);s+=lab(24,1.25,['BITTER']);
  s+=lab(16,0.95,['WEAK','UNDER-','DEVELOPED']);s+=lab(20,0.95,['WEAK']);s+=lab(24,0.95,['WEAK','BITTER']);
  // 테두리 + 축 제목
  s+=`<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="none" stroke="#999"/>`;
  s+=`<text x="${ml+pw/2}" y="${H-6}" font-size="12" font-weight="700" fill="#333" text-anchor="middle">추출수율 Extraction (%)</text>`;
  s+=`<text transform="translate(12 ${mt+ph/2}) rotate(-90)" font-size="12" font-weight="700" fill="#333" text-anchor="middle">TDS (%)</text>`;
  // 현재 위치 (범위를 벗어나면 가장자리에 표시)
  if(ey>0&&t>0){
    const cx=sx(clamp(ey,X_MIN,X_MAX)),cy=sy(clamp(t,Y_MIN,Y_MAX));
    s+=`<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${mt+ph}" stroke="#111" stroke-opacity=".35" stroke-dasharray="3 3"/>`;
    s+=`<line x1="${cx}" y1="${cy}" x2="${ml}" y2="${cy}" stroke="#111" stroke-opacity=".35" stroke-dasharray="3 3"/>`;
    s+=`<circle cx="${cx}" cy="${cy}" r="8" fill="#111" stroke="#fff" stroke-width="3"/>`;
  }
  return s+`</svg>`;
}

function chartHeight(W){
  if(window.innerWidth>=720)return Math.round(W<480?W*1.0:W*0.85);   // 가로·태블릿·PC
  const landscapePhone=window.matchMedia('(orientation:landscape) and (max-height:520px)').matches;
  if(landscapePhone)return Math.round(Math.max(220,Math.min(W*0.5,window.innerHeight-110)));
  return Math.round(W<480?W*1.1:W*0.85);
}

function drawChart(){
  if(!current)return;
  const box=$('chart'),W=Math.floor(box.clientWidth);
  if(W<100)return; // 숨겨져 있을 때는 그리지 않음
  box.innerHTML=chartSVG(W,chartHeight(W),current.ey,current.t);
}

/* ---------- 결과보기 ---------- */
function showResults(){
  const{d,w,b,t}=readInputs(),missing=[];
  Work.missing().forEach(m=>{missing.push(m.name);$(m.id).classList.add('miss')});
  if(!(d>0))missing.push('원두 무게');if(!(w>0))missing.push('투입 물 무게');
  if(!(b>0))missing.push('실제 추출된 커피 무게');if(!(t>0))missing.push('TDS');
  const msg=$('msg');
  if(missing.length){msg.textContent=missing.join(', ')+' 값을 입력해 주세요.';msg.hidden=false;msg.scrollIntoView({block:'center',behavior:'smooth'});return}
  msg.hidden=true;
  Work.renderHeads();
  const ey=b*t/d,ratio=w/d;
  current={ey,t};
  $('ey').textContent=ey.toFixed(2)+'%';
  $('ratioResult').textContent='1 : '+ratio.toFixed(2);
  let note=`현재 위치: TDS ${t.toFixed(2)}% · 추출수율 ${ey.toFixed(2)}%`;
  if(ey<X_MIN||ey>X_MAX||t<Y_MIN||t>Y_MAX)note+=' (차트 범위를 벗어나 가장자리에 표시됩니다)';
  $('chartNote').textContent=note;
  $('inputView').hidden=true;$('resultView').hidden=false;
  drawChart();
  setMode(mode);
  window.scrollTo(0,0);
}
function showInput(){$('resultView').hidden=true;$('inputView').hidden=false;window.scrollTo(0,0)}

/* ---------- 보기 방식: 세로 스크롤 / 가로 넘기기 ---------- */
let mode='scroll';
const pages=()=>Array.from(document.querySelectorAll('#pages .page'));

function setMode(m){
  mode=m;
  $('pages').className='pages '+m;
  $('modeScroll').setAttribute('aria-pressed',m==='scroll');
  $('modeSwipe').setAttribute('aria-pressed',m==='swipe');
  $('pager').hidden=(m!=='swipe');
  $('pages').scrollLeft=0;
  updateDots();
  drawChart();
}
function updateDots(){
  const box=$('pages'),n=pages().length;
  const idx=mode==='swipe'?Math.round(box.scrollLeft/Math.max(1,box.clientWidth)):0;
  $('dots').innerHTML=Array.from({length:n},(_,i)=>`<span class="dot${i===idx?' on':''}"></span>`).join('');
  $('prevBtn').disabled=idx<=0;$('nextBtn').disabled=idx>=n-1;
}
function step(dir){const box=$('pages');box.scrollBy({left:dir*box.clientWidth,behavior:'smooth'})}

/* ---------- 이벤트 ---------- */
['dose','water','beverage','tds'].forEach(id=>$(id).addEventListener('input',updateRatio));
$('calcBtn').addEventListener('click',showResults);
$('backBtn').addEventListener('click',showInput);
$('modeScroll').addEventListener('click',()=>setMode('scroll'));
$('modeSwipe').addEventListener('click',()=>setMode('swipe'));
$('prevBtn').addEventListener('click',()=>step(-1));
$('nextBtn').addEventListener('click',()=>step(1));
$('pages').addEventListener('scroll',updateDots);
if('ResizeObserver' in window)new ResizeObserver(drawChart).observe($('chart'));
window.addEventListener('resize',drawChart);
updateRatio();

/* 공유: 결과 요약 문구 (common.js가 호출) */
window.ShareHook=function(){
  const{d,w,b,t}=readInputs();if(!(d>0&&b>0&&t>0))return[];
  return[`추출수율 ${(b*t/d).toFixed(2)}% · Brew Ratio 1 : ${(w/d).toFixed(2)}`,`원두 ${d}g · 물 ${w}g · 추출량 ${b}g · TDS ${t}%`];
};

/* 결과지 이미지: 이미지에 담을 내용 (sheet.js가 그림) */
window.SheetHook=function(){
  const{d,w,b,t}=readInputs();if(!(d>0&&b>0&&t>0))return[];
  const ey=b*t/d;
  return[[{t:'metrics',items:[{label:'추출수율',value:ey.toFixed(2)+'%'},{label:'Brew Ratio',value:'1 : '+(w/d).toFixed(2)},{label:'TDS',value:t.toFixed(2)+'%'}]},
          {t:'lines',lines:[{text:`원두 ${d} g · 물 ${w} g · 추출량 ${b} g`}]}],
         [{t:'chart',title:'SCA Brewing Control Chart',svg:chartSVG(400,460,ey,t),w:400,h:460}]];
};
