/* 공통 작업 정보 (Memo · 원두/생두 · 날짜) + 인쇄 + Enter 이동 — 에스프레소 · 브루잉 · 로스팅 공용 */
(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
  const DOW='일월화수목금토';
  function fmtDate(v){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return v||'';
    const [y,m,d]=v.split('-').map(Number);
    return `${y}.${pad(m)}.${pad(d)} (${DOW[new Date(y,m-1,d).getDay()]})`;
  }
  // 상세 정보: 스페셜티 원두 표기 기준
  const DETAIL=[['country','국가','예: 브라질'],['region','지역 · 농장','예: 세하도 / ○○ 농장'],['variety','품종 Variety','예: 버번, 게이샤'],['process','가공 Process','예: 워시드, 내추럴, 허니'],['altitude','고도 (m)','예: 1200','number'],['crop','수확연도','예: 2025','number']];
  const EXTRA={moisture:['moisture','생두 수분 (%)','예: 10.5','number'],density:['density','밀도 (g/L)','예: 700','number']};
  let cfg={title:'',kind:'원두',extra:[]};

  function field(f){
    const [k,label,ph,type]=f;
    return `<div class="field"><label for="wk_${k}">${label}</label><input id="wk_${k}" ${type==='number'?'type="number" inputmode="decimal" step="any"':'type="text" maxlength="60"'} placeholder="${ph}" autocomplete="off" data-keep></div>`;
  }
  function init(){
    const box=$('workInfo');if(!box)return;
    cfg.title=box.dataset.title||document.title;
    cfg.kind=box.dataset.kind||'원두';
    cfg.extra=(box.dataset.extra||'').split(',').filter(k=>EXTRA[k]);
    const all=DETAIL.concat(cfg.extra.map(k=>EXTRA[k]));
    box.innerHTML=`<section class="card" id="wkCard"><h2>작업 정보</h2>
<div class="field"><label for="wk_memo">Memo<b class="req">*</b></label><input id="wk_memo" type="text" maxlength="60" placeholder="이 작업의 키워드 (예: 케냐 로스팅 테스트 3차)" autocomplete="off"></div>
<div class="field"><label for="wk_bean">${cfg.kind==='생두'?'생두':'원두'}<b class="req">*</b></label><input id="wk_bean" type="text" maxlength="80" placeholder="예: 브라질 세하도 / 콜롬비아 엘 디비소 내추럴" autocomplete="off" data-keep></div>
<div class="field"><label for="wk_date">날짜</label><input id="wk_date" type="date" value="${today()}"></div>
<details class="wk-more"><summary>상세 정보 (국가 · 지역 · 품종 · 가공 …)</summary><div class="wk-grid">${all.map(field).join('')}</div></details>
<div id="wkMsg" class="input-alert high" hidden></div></section>`;
  }

  function info(){
    const v=id=>{const e=$(id);return e?e.value.trim():''};
    const o={memo:v('wk_memo'),bean:v('wk_bean'),date:v('wk_date')||today(),title:cfg.title};
    DETAIL.concat(cfg.extra.map(k=>EXTRA[k])).forEach(f=>{o[f[0]]=v('wk_'+f[0])});
    return o;
  }
  function missing(){
    const r=[];
    if(!$('wk_memo'))return r;
    if(!$('wk_memo').value.trim())r.push({id:'wk_memo',name:'Memo'});
    if(!$('wk_bean').value.trim())r.push({id:'wk_bean',name:cfg.kind==='생두'?'생두':'원두'});
    return r;
  }
  function detailLine(o){
    const p=[];
    ['country','region','variety','process'].forEach(k=>{if(o[k])p.push(esc(o[k]))});
    if(o.altitude)p.push('고도 '+esc(o.altitude)+' m');
    if(o.crop)p.push('수확 '+esc(o.crop));
    if(o.moisture)p.push('수분 '+esc(o.moisture)+'%');
    if(o.density)p.push('밀도 '+esc(o.density)+' g/L');
    return p.join(' · ');
  }
  function headHTML(){
    const o=info(),d=detailLine(o);
    return `<div class="rh-title">${esc(o.memo||o.title)}</div>`+
      (o.bean?`<div class="rh-bean">${esc(o.bean)}</div>`:'')+
      (d?`<div class="rh-detail">${d}</div>`:'')+
      `<div class="rh-meta">${esc(fmtDate(o.date))} · ${esc(o.title)}</div>`;
  }
  function renderHeads(){document.querySelectorAll('.rhead').forEach(el=>{el.innerHTML=headHTML()})}

  function fileTitle(){const o=info();return (o.date.replace(/-/g,'')+' '+(o.memo||o.title)).trim()}
  // 기본 정보(Memo·원두/생두)가 비어 있으면 안내 (인쇄·공유 공통)
  function ensureInfo(){
    const miss=missing(),msg=$('wkMsg');
    if(miss.length){
      miss.forEach(m=>$(m.id).classList.add('miss'));
      if(msg){msg.textContent=miss.map(m=>m.name).join(', ')+' 항목을 입력해 주세요.';msg.hidden=false}
      const card=$('wkCard');if(card)card.scrollIntoView({block:'center',behavior:'smooth'});
      return false;
    }
    if(msg)msg.hidden=true;
    return true;
  }
  function print(){
    if(!ensureInfo())return false;
    renderHeads();
    const old=document.title;document.title=fileTitle();           // PDF 기본 파일명
    const restore=()=>{document.title=old;window.removeEventListener('afterprint',restore)};
    window.addEventListener('afterprint',restore);setTimeout(restore,8000);
    window.print();
    return true;
  }
  // 공유: 기기의 공유 창(메신저·문자 등)으로 결과 요약을 보낸다. 공유 창이 없으면 복사.
  async function share(){
    if(!ensureInfo())return;
    const o=info(),kind=cfg.title.replace(/\s*추출\s*계산기/,''),lines=window.ShareHook?window.ShareHook():[];
    const text=[o.memo||o.title,[o.bean,fmtDate(o.date),kind].filter(Boolean).join(' · ')].concat(lines).join('\n');
    const url=location.href.split(/[?#]/)[0].replace(/[^/]*$/,'');
    try{if(navigator.share){await navigator.share({title:o.memo||o.title,text,url});return}}
    catch(e){if(e&&e.name==='AbortError')return}
    const full=text+'\n'+url;
    try{await navigator.clipboard.writeText(full);toast('결과 요약을 복사했어요')}
    catch(_){
      const ta=document.createElement('textarea');ta.value=full;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');toast('결과 요약을 복사했어요')}catch(__){toast('이 환경에서는 공유할 수 없어요')}
      ta.remove();
    }
  }

  // Enter → 다음 입력칸 (보이는 입력칸만, 한글 입력 중에는 제외)
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.isComposing||e.keyCode===229)return;
    const t=e.target;if(!(t instanceof HTMLInputElement))return;
    const list=Array.from(document.querySelectorAll('input,select')).filter(el=>!el.disabled&&el.type!=='hidden'&&el.tabIndex>=0&&el.offsetParent!==null);
    const i=list.indexOf(t);if(i<0)return;
    e.preventDefault();
    const n=list[i+1];
    if(n){n.focus();if(n.tagName==='INPUT'&&n.type!=='date'){try{n.select()}catch(_){}}}else t.blur();
  });
  // 입력하면 빨간 표시 해제
  document.addEventListener('input',e=>{if(e.target.classList)e.target.classList.remove('miss','bad')});
  document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#printBtn'))print();if(e.target.closest&&e.target.closest('#shareBtn'))share();if(e.target.id==='resetKeep')resetKeep();const id=e.target.id;if(id==='draftBtn')draftSave();else if(id==='draftLoad')draftLoad();else if(id==='draftDel')draftDel()});



  // 임시저장 — 입력창 전체(동적인 줄 포함)를 이 기기의 브라우저에 저장. 다음에 열면 불러올지 물어본다.
  const DKEY='cc:draft:'+(location.pathname.split('/').pop()||'index').replace('.html','');
  let toastTimer=0;
  function toast(msg){
    let t=$('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}
    t.textContent=msg;t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),2600);
  }
  const hhmm=d=>pad(d.getHours())+':'+pad(d.getMinutes());
  function draftSave(){
    try{
      const f={};document.querySelectorAll('#inputView input[id],#inputView select[id]').forEach(el=>{f[el.id]=el.value});
      const o={t:Date.now(),f};if(window.DraftHooks)o.x=window.DraftHooks.collect();
      localStorage.setItem(DKEY,JSON.stringify(o));
      const bar=$('draftBar');if(bar)bar.remove();
      toast('임시저장했어요 · '+hhmm(new Date()));
    }catch(_){toast('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.')}
  }
  function readDraft(){try{return JSON.parse(localStorage.getItem(DKEY)||'null')}catch(_){return null}}
  function showDraftBar(){
    const o=readDraft(),box=$('workInfo');if(!o||!box||!$('draftBtn'))return;
    const d=new Date(o.t),memo=(o.f&&o.f.wk_memo)||'';
    const bar=document.createElement('div');bar.id='draftBar';bar.className='restored';
    bar.innerHTML=`<span><b>임시저장된 작업이 있어요</b><br><small>${d.getMonth()+1}.${pad(d.getDate())} ${hhmm(d)}${memo?' · '+esc(memo):''}</small></span><span class="btns"><button type="button" id="draftLoad">불러오기</button><button type="button" id="draftDel">삭제</button></span>`;
    box.parentNode.insertBefore(bar,box);
  }
  function draftLoad(){
    const o=readDraft();if(!o)return;
    Object.keys(o.f||{}).forEach(id=>{const el=$(id);if(el){el.value=o.f[id];fire(el)}});
    if(window.DraftHooks&&o.x)window.DraftHooks.apply(o.x);
    const bar=$('draftBar');if(bar)bar.remove();
    toast('임시저장한 작업을 불러왔어요');
  }
  function draftDel(){try{localStorage.removeItem(DKEY)}catch(_){}const bar=$('draftBar');if(bar)bar.remove();toast('임시저장을 삭제했어요')}

  // 마지막 입력값 기억 — 이 기기의 브라우저 안에만 저장 (로그인 불필요). 저장 대상은 data-keep 표시가 있는 칸.
  const KEY='cc:keep:'+(location.pathname.split('/').pop()||'index').replace('.html','');
  const keepEls=()=>Array.from(document.querySelectorAll('[data-keep]'));
  const fire=el=>{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
  function saveKeep(){try{const o={};keepEls().forEach(el=>{o[el.id]=el.value});localStorage.setItem(KEY,JSON.stringify(o))}catch(_){}}
  function showBanner(){
    const box=$('workInfo');if($('restoredBar')||!box)return;
    const bar=document.createElement('div');bar.id='restoredBar';bar.className='restored';
    bar.innerHTML='<span>지난번 입력값을 불러왔어요.</span><button type="button" id="resetKeep">입력 초기화</button>';
    box.parentNode.insertBefore(bar,box);
  }
  function restoreKeep(){
    let o=null;try{o=JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){}
    if(!o)return;
    let n=0;
    keepEls().forEach(el=>{const v=o[el.id];if(v!==undefined&&v!==''&&el.value!==v){el.value=v;fire(el);n++}});
    if(n)showBanner();
  }
  function resetKeep(){
    try{localStorage.removeItem(KEY)}catch(_){}
    keepEls().forEach(el=>{if(el.tagName==='SELECT')el.selectedIndex=0;else el.value='';fire(el)});
    const b=$('restoredBar');if(b)b.remove();
    saveKeep();
  }
  ['input','change'].forEach(t=>document.addEventListener(t,e=>{if(e.target.matches&&e.target.matches('[data-keep]'))saveKeep()}));
  const boot=()=>{showDraftBar();restoreKeep()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();

  window.Work={info,missing,renderHeads,print,share,fmtDate,fileTitle};
  init();
})();
