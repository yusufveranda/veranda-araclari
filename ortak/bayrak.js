// bayrak.js — "bu kelime olmalı" bildirimi
// Oyunlar bilinmeyen kelime mesajı gösterdikten sonra kelimeBayrak(kelime, oyun, gun)
// çağırır; #mesaj kutusuna bir 🚩 düğmesi ekler. Basılınca kelime Google Sheets'teki
// "bayraklar" sayfasına yazılır (leaderboard ile aynı Apps Script, fn=flag).
(function(){
  const URL='https://script.google.com/macros/s/AKfycbyVCs6SvfkJSOjunXd7HWnhDeNH7-M9udtLovpo7Wh_vdTTz9sc31ccdZ050IJdgqt2/exec';
  const LS='vt_bayraklar';   // bu tarayıcıdan zaten bildirilenler — aynı kelimeyi tekrar gönderme

  const st=document.createElement('style');
  st.textContent='.bayrakBtn{display:inline-block;margin-left:8px;padding:2px 9px;font:inherit;font-size:12px;'+
    'color:inherit;background:transparent;border:1px solid currentColor;border-radius:11px;opacity:.85;'+
    'cursor:pointer;vertical-align:baseline}.bayrakBtn:hover{opacity:1}.bayrakBtn:disabled{opacity:.6;cursor:default}';
  document.head.appendChild(st);

  function eski(){ try{ return JSON.parse(localStorage.getItem(LS))||{}; }catch(e){ return {}; } }

  window.kelimeBayrak=function(kelime, oyun, gun){
    const el=document.getElementById('mesaj'); if(!el) return;
    const k=String(kelime||'').trim(); if(!k) return;
    const anah=oyun+'|'+k;
    const b=document.createElement('button');
    b.type='button'; b.className='bayrakBtn';
    if(eski()[anah]){ b.textContent='🚩 bildirildi'; b.disabled=true; }
    else b.textContent='🚩 bu kelime olmalı';
    b.onclick=function(){
      b.disabled=true; b.textContent='🚩 gönderiliyor…';
      fetch(URL+'?fn=flag&oyun='+encodeURIComponent(oyun)+'&kelime='+encodeURIComponent(k)+
            (gun!==''&&gun!=null?'&gun='+encodeURIComponent(gun):''))
        .then(r=>r.json())
        .then(j=>{
          if(j&&j.ok){ b.textContent='🚩 bildirildi ✓';
            const g=eski(); g[anah]=1; try{ localStorage.setItem(LS,JSON.stringify(g)); }catch(e){} }
          else { b.textContent='🚩 olmadı — tekrar dene'; b.disabled=false; }
        })
        .catch(()=>{ b.textContent='🚩 olmadı — tekrar dene'; b.disabled=false; });
    };
    el.appendChild(b);
  };
})();
