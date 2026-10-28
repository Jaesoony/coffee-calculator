/* 결과지 이미지: 블록 목록 → SVG → PNG (세 계산기 공용). 계산식은 넣지 않고 결과·지표·그래프만 담는다. */
(function(){
  const FONT="'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
  const SW=1080,PAD=40,GAP=22,CP=36,IN=SW-PAD*2-CP*2;   // 이미지 폭 · 바깥 여백 · 카드 간격 · 카드 안쪽 여백 · 카드 안 폭
  const COLORS=['#cdeed3','#ffe0b0','#ffc7bb'];
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let cx=null;
  const mw=(t,s,w)=>{cx=cx||document.createElement('canvas').getContext('2d');cx.font=`${w||400} ${s}px ${FONT}`;return cx.measureText(String(t)).width};
  function wrap(t,s,w,max){const out=[];let cur='';for(const ch of String(t)){const n=cur+ch;if(cur&&mw(n,s,w)>max){out.push(cur.trimEnd());cur=ch===' '?'':ch}else cur=n}if(cur)out.push(cur);return out.length?out:['']}
  const fit=(t,s,w,max)=>{while(s>16&&mw(t,s,w)>max)s-=2;return s};
  const T=(x,y,t,s,w,f,a)=>`<text x="${x}" y="${y}" font-size="${s}" font-weight="${w||400}" fill="${f||'#222'}"${a?` text-anchor="${a}"`:''}>${esc(t)}</text>`;
  const L=(y,c)=>`<line x1="0" y1="${y}" x2="${IN}" y2="${y}" stroke="${c||'#eee'}"/>`;

  function bHeader(o){
    const tl=wrap(o.memo,54,800,IN),bl=o.bean?wrap(o.bean,36,700,IN):[],dl=o.detail?wrap(o.detail,26,400,IN):[];let y=0,s='';
    tl.forEach(l=>{y+=54;s+=T(0,y,l,54,800,'#111');y+=14});
    if(bl.length){y+=8;bl.forEach(l=>{y+=36;s+=T(0,y,l,36,700,'#222');y+=12})}
    if(dl.length){y+=6;dl.forEach(l=>{y+=26;s+=T(0,y,l,26,400,'#666');y+=12})}
    y+=12+26;s+=T(0,y,o.meta,26,500,'#888');return{h:y,s};
  }
  function bMetrics(c){
    const cols=c.cols||c.items.length,gw=16,bw=(IN-gw*(cols-1))/cols,bh=150,rows=Math.ceil(c.items.length/cols);let s='';
    c.items.forEach((it,i)=>{const x=(i%cols)*(bw+gw),y=Math.floor(i/cols)*(bh+gw);
      s+=`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="22" fill="#f1f1f1"/>`+T(x+24,y+42,it.label,24,600,'#666')+T(x+24,y+110,it.value,fit(it.value,56,800,bw-48),800,'#111')});
    return{h:rows*bh+(rows-1)*gw,s};
  }
  function bLines(c){let y=0,s='';c.lines.forEach(l=>{wrap(l.text,28,500,IN).forEach(t=>{y+=28;s+=T(0,y,t,28,l.bold?700:500,l.color||'#444');y+=12})});return{h:y,s}}
  function bPhase(c){
    let s=T(0,24,'로스팅 구간 (Total Duration Time 기준)',24,700,'#777'),y=40;const bh=116;
    s+=`<clipPath id="pbclip"><rect x="0" y="${y}" width="${IN}" height="${bh}" rx="22"/></clipPath><g clip-path="url(#pbclip)">`;
    let x=0;c.parts.forEach((q,i)=>{const w=IN*q.pct/100,m=x+w/2;s+=`<rect x="${x}" y="${y}" width="${w}" height="${bh}" fill="${COLORS[i]}"/>`;
      if(w>=150)s+=T(m,y+54,q.pct.toFixed(1)+'%',38,800,'#222','middle')+T(m,y+92,q.time,28,600,'#555','middle');
      else if(w>=70)s+=T(m,y+70,q.pct.toFixed(1)+'%',26,800,'#222','middle');x+=w});
    s+='</g>';y+=bh+14;
    c.parts.forEach((q,i)=>{s+=`<rect x="0" y="${y+14}" width="24" height="24" rx="7" fill="${COLORS[i]}"/>`+T(40,y+34,q.name,28,700,'#222')+T(40+mw(q.name,28,700)+12,y+34,q.ko,22,500,'#888')+
      T(IN-150,y+34,q.pct.toFixed(1)+'% · '+q.time,28,700,'#222','end')+T(IN,y+34,'권장 '+q.tgt+'%',22,500,'#888','end');y+=58;s+=L(y)});
    y+=34;s+=T(IN,y,`Total Duration Time ${c.total} · 합계 ${c.sum}`,26,800,'#444','end');return{h:y+8,s};
  }
  function bChart(c){
    const H=Math.round(c.h*IN/c.w);
    const svg=c.svg.replace(/^<svg[^>]*>/,tag=>tag.replace(/ width="[^"]*"/,` width="${IN}"`).replace(/ height="[^"]*"/,` height="${H}"`).replace('<svg ','<svg x="0" y="48" ').replace('font-family="inherit"',`font-family="${FONT}"`));
    return{h:48+H,s:T(0,30,c.title,28,800,'#222')+svg};
  }
  function bStrip(c){
    const per=c.perRow||10,cw=IN/per;let s=T(0,26,c.title,26,800,'#222'),y=44;
    for(let i=0;i<c.items.length;i+=per){c.items.slice(i,i+per).forEach((it,k)=>{const x=k*cw+cw/2,w=it.flag?800:600;
      s+=T(x,y+22,it.label,22,500,'#888','middle')+T(x,y+62,it.value,fit(it.value,28,w,cw-6),w,it.flag?'#c53b30':'#222','middle')});y+=84}
    if(c.note){s+=T(0,y+10,c.note,22,500,'#888');y+=30}return{h:y,s};
  }
  function bTable(c){
    const w=c.widths||[.46,.27,.27],xs=[0];w.forEach((f,i)=>xs.push(xs[i]+IN*f));const px=i=>i===0?0:xs[i]+IN*w[i]/2;
    let s=T(0,26,c.title,26,800,'#222'),y=44;
    c.head.forEach((h,i)=>{s+=T(px(i),y+26,h,22,700,'#888',i?'middle':null)});y+=40;s+=L(y,'#ddd');
    c.rows.forEach(r=>{r.forEach((v,i)=>{s+=T(px(i),y+36,v,28,i===0?700:500,'#222',i?'middle':null)});y+=54;s+=L(y)});return{h:y,s};
  }
  function bGauge(c){
    let s=T(0,26,c.title,26,800,'#222');const y0=84,bh=30,sx=v=>(Math.max(c.min,Math.min(c.max,v))-c.min)/(c.max-c.min)*IN;
    s+=`<rect x="0" y="${y0}" width="${IN}" height="${bh}" rx="15" fill="#e8e8e8"/><rect x="${sx(c.lo)}" y="${y0}" width="${sx(c.hi)-sx(c.lo)}" height="${bh}" fill="#9ad5a6"/>`;
    const m=sx(c.value);s+=`<circle cx="${m}" cy="${y0+bh/2}" r="20" fill="#111" stroke="#fff" stroke-width="5"/>`+T(m,y0-14,c.value+'%',28,800,'#111','middle');
    s+=T(0,y0+bh+36,c.min+'%',22,500,'#888')+T(IN,y0+bh+36,c.max+'%',22,500,'#888','end')+T((sx(c.lo)+sx(c.hi))/2,y0+bh+36,`권장 ${c.lo}~${c.hi}%`,22,600,'#3b8a4d','middle');
    return{h:y0+bh+48,s};
  }
  const FN={header:b=>bHeader(b.info),metrics:bMetrics,lines:bLines,phase:bPhase,chart:bChart,strip:bStrip,table:bTable,gauge:bGauge};

  function siteUrl(){return location.host?(location.host+location.pathname.replace(/[^/]*$/,'').replace(/\/$/,'')):'커피 계산기'}
  // info: {memo,bean,detail,meta} / cards: [[블록,…],…] — 첫 카드는 작업 정보 헤더가 자동으로 붙는다.
  function build(info,cards){
    let y=PAD,body='';
    [[{t:'header',info}]].concat(cards).forEach(card=>{
      let h=0,inner='';const parts=card.map(b=>FN[b.t](b));
      parts.forEach((p,i)=>{inner+=`<g transform="translate(0,${h})">${p.s}</g>`;h+=p.h+(i<parts.length-1?28:0)});
      const ch=h+CP*2;body+=`<rect x="${PAD}" y="${y}" width="${SW-PAD*2}" height="${ch}" rx="28" fill="#fff"/><g transform="translate(${PAD+CP},${y+CP})">${inner}</g>`;y+=ch+GAP;
    });
    body+=T(SW/2,y+30,siteUrl(),24,500,'#999','middle');const H=y+30+40;
    return{svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${H}" viewBox="0 0 ${SW} ${H}" font-family="${FONT}"><rect width="${SW}" height="${H}" fill="#f4f4f4"/>${body}</svg>`,w:SW,h:H};
  }
  async function toPng(r){
    const scale=Math.min(1.5,Math.sqrt(10e6/(r.w*r.h))),img=new Image();
    await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(new Error('svg'));img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(r.svg)});
    const cv=document.createElement('canvas');cv.width=Math.round(r.w*scale);cv.height=Math.round(r.h*scale);
    const c2=cv.getContext('2d');c2.fillStyle='#f4f4f4';c2.fillRect(0,0,cv.width,cv.height);c2.drawImage(img,0,0,cv.width,cv.height);
    return new Promise((ok,no)=>cv.toBlob(b=>b?ok(b):no(new Error('png')),'image/png'));
  }
  window.Sheet={build,toPng};
})();
