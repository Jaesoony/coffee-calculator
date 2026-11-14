/* 방문 횟수: 이 기기(브라우저)에만 저장하는 개인 방문 횟수예요. 서버·외부 서비스를 쓰지 않아요.
   - 마지막 접속 후 30분 이내는 같은 방문으로 봐서, 홈 버튼·새로고침·다른 계산기 이동을 다시 세지 않아요.
   - 페이지를 열어 둔 동안에는 1분마다 접속 시각을 갱신해서, 오래 입력하다가 홈으로 와도 새 방문으로 세지 않아요. */
(function(){
  const KEY='cc:visits',SAME_MS=30*60*1000,box=document.getElementById('visitMsg');
  let st=null;
  try{localStorage.setItem('cc:t','1');localStorage.removeItem('cc:t');st=localStorage}catch(_){try{sessionStorage.setItem('cc:t','1');sessionStorage.removeItem('cc:t');st=sessionStorage}catch(__){}}
  if(!st)return;
  let rec=null;try{rec=JSON.parse(st.getItem(KEY)||'null')}catch(_){}
  const now=Date.now(),save=r=>{try{st.setItem(KEY,JSON.stringify(r))}catch(_){}};
  let n=rec&&rec.n>0?rec.n:0;
  if(!(rec&&n>0&&now-rec.last<=SAME_MS))n+=1;            // 새 방문일 때만 +1
  save({n,last:now});
  if(box){
    box.innerHTML=n===1?'처음 오셨네요! 반가워요.<br>즐거운 커피라이프 되세요 ☕':'<b>'+n.toLocaleString('ko-KR')+'</b>번째 오셨네요!<br>즐거운 커피라이프 되세요 ☕';
    box.hidden=false;
  }
  const touch=()=>{if(document.visibilityState==='hidden')return;save({n,last:Date.now()})};
  setInterval(touch,60000);document.addEventListener('visibilitychange',touch);
})();
