/* ============================================================
   Günün Yıldızları — motor (v2, gömülü/iframe mimarisi)
   Gerçek oyunlar kendi arayüzüyle iframe içinde çalışır; meta
   yalnızca üstüne kademeli-dolan yıldız + kalp + kazandın bildirimi
   koyar. Oyun, ?meta=1 kipinde ilerlemesini postMessage ile bildirir.
   localStorage ad alanı: yildiz:*  (oyunların kaydına dokunmaz)
   ============================================================ */
(function(){
"use strict";

var META_MILAT = Date.UTC(2026,6,6);      // gün 0 = 6 Temmuz 2026
var GUN_HEDEF  = 6;
var KART_CAN   = 3;
var AILE_SIRA  = ['kelime','eslestirme','obek','film','cografya','anlam'];
var AILE_AD    = { kelime:'kelime', eslestirme:'eşleştirme', obek:'öbek', film:'film', cografya:'coğrafya', anlam:'anlam' };

/* ——— oyun kaydı (gömülecek gerçek oyunlar) ——— */
var OYUNLAR=[];
function kayit(d){ OYUNLAR.push(d); }

/* ——— yardımcılar ——— */
var $=function(s,k){ return (k||document).querySelector(s); };
function el(t,c,h){ var e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e; }
function bugunUTC(){ var n=new Date(); return Date.UTC(n.getFullYear(),n.getMonth(),n.getDate()); }
function metaGun(){ return Math.floor((bugunUTC()-META_MILAT)/86400000); }
function hash32(s){ var h=2166136261>>>0; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function farkliIndex(id,gun,uz,std){ if(!uz)return 0; var i=hash32(id+':'+gun)%uz; if(std!=null && i===((std%uz)+uz)%uz) i=(i+1)%uz; return i; }

/* ——— yıldız (kademeli dolar) + kalp SVG ——— */
var STAR='M32 5 L39.9 23.4 L60 25.2 L44.8 38.4 L49.4 58 L32 47.2 L14.6 58 L19.2 38.4 L4 25.2 L24.1 23.4 Z';
var HEART='M32 56 C9 41 4 25 16.5 16.5 C25 10.7 31 17.5 32 21.5 C33 17.5 39 10.7 47.5 16.5 C60 25 55 41 32 56 Z';
var _uid=0;
function yildizSVG(kesir,kucuk,parla){
  kesir=Math.max(0,Math.min(1,kesir)); var id='yk'+(++_uid); var yy=64*(1-kesir);
  return '<svg class="svg-ik'+(kucuk?' kucuk':'')+(parla?' yildiz-yeni':'')+'" viewBox="0 0 64 64" aria-hidden="true">'+
    '<defs><clipPath id="'+id+'"><rect x="0" y="'+yy.toFixed(1)+'" width="64" height="'+(64-yy).toFixed(1)+'"/></clipPath></defs>'+
    '<path d="'+STAR+'" class="yildiz-bos"/>'+
    (kesir>0?'<path d="'+STAR+'" class="yildiz-dolu" clip-path="url(#'+id+')"/>':'')+'</svg>';
}
function kalpSVG(dolu,gitti){
  return '<svg class="svg-ik kucuk'+(gitti?' kalp-gitti':'')+'" viewBox="0 0 64 64" aria-hidden="true">'+
    '<path d="'+HEART+'" class="'+(dolu?'kalp-dolu':'kalp-bos')+'"/></svg>';
}
/* dogru sayısı + eşik → her yıldızın dolum kesri */
function yildizKesirler(dogru,esik){
  var t=[0].concat(esik), r=[];
  for(var i=0;i<3;i++){ var lo=t[i],hi=t[i+1]; r.push(hi>lo?Math.max(0,Math.min(1,(dogru-lo)/(hi-lo))):0); }
  return r;
}
function tamYildiz(dogru,esik){ var n=0; for(var i=0;i<esik.length;i++) if(dogru>=esik[i]) n++; return n; }
/* esik sabit dizi ya da toplam'a göre fonksiyon olabilir (ör. Jenerik: aktörün M filmi) */
function esikCoz(def,kd){ return (typeof def.esik==='function') ? def.esik((kd&&kd.toplam)||1) : def.esik; }
function yildizOlcerHTML(dogru,esik,kucuk,parla){
  var k=yildizKesirler(dogru,esik),o='';
  for(var i=0;i<3;i++) o+=yildizSVG(k[i],kucuk, parla&&k[i]>0&&k[i]<1);
  return o;
}
function kalpOlcerHTML(can){ var o=''; for(var i=0;i<KART_CAN;i++) o+=kalpSVG(i<can,false); return o; }
/* yıldız gösterimi: hız ya da eşiksiz (Çatı: yıldızı doğrudan bildirir) → tam yıldız (kd.yildiz);
   normal sayaç (eşikli) → dogru+eşikten kademeli dolan */
function yildizGoster(def,kd,kucuk,parla){
  if(def.mod==='hiz' || !def.esik) return yildizOlcerHTML(kd.yildiz,[1,2,3],kucuk,parla);
  return yildizOlcerHTML(kd.dogru,esikCoz(def,kd),kucuk,parla);
}

/* ——— gün durumu ——— */
var GUN,PLAN,DURUM,_ephemeral=false;   // _ephemeral: rastgele/debug günü — kaydedilmez
function anahtar(){ return 'yildiz:g'+GUN; }
function durumYukle(){ var h=null; try{ h=JSON.parse(localStorage.getItem(anahtar())); }catch(e){} return (h&&h.gun===GUN)?h:{gun:GUN,oyunlar:{},kazandi:false}; }
function durumKaydet(){ if(_ephemeral) return; try{ localStorage.setItem(anahtar(),JSON.stringify(DURUM)); }catch(e){} }
function oyunKaydi(id){ if(!DURUM.oyunlar[id]) DURUM.oyunlar[id]={dogru:0,hata:0,yildiz:0,can:KART_CAN,bitti:false,kilit:false}; return DURUM.oyunlar[id]; }
function gunToplam(){ var t=0; PLAN.forEach(function(o){ var kd=oyunKaydi(o.id); t+= (o.mod==='hiz'&&!kd.bitti)?0:kd.yildiz; }); return t; }

/* ——— günün seçkisi ——— */
function gununSecki(gun){
  var grup={}; OYUNLAR.forEach(function(o){ (grup[o.aile]=grup[o.aile]||[]).push(o); });
  var aileler=AILE_SIRA.filter(function(a){ return grup[a]; });
  if(!aileler.length) return [];
  // 4 yuvayı doldur: önce her aileden 1 (aile çeşitliliği), yetmezse aynı aileden 2.
  var sonuc=[];
  for(var tur=0; tur<4 && sonuc.length<4; tur++){
    for(var i=0; i<aileler.length && sonuc.length<4; i++){
      var aile=aileler[(gun+i)%aileler.length];   // gün-kaydırmalı aile başlangıcı
      var g=grup[aile];
      var oy=g[(gun+tur)%g.length];               // aile içi rotasyon
      if(sonuc.indexOf(oy)<0) sonuc.push(oy);
    }
  }
  return sonuc;
}
function metaIndex(def){
  var std=Math.floor(Date.now()/864e5)%def.len;
  return farkliIndex(def.id,GUN,def.len,std);
}

/* ============================================================
   GÜN PANOSU
   ============================================================ */
function tarihYaz(){ var e=$('#tarih'); if(e) e.textContent=new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'long'}); }
function gunOlcerCiz(){
  var t=gunToplam(),g=$('#gunOlcer'); if(!g)return; var dolu=Math.min(t,GUN_HEDEF),s='';
  for(var i=0;i<GUN_HEDEF;i++) s+=yildizSVG(i<dolu?1:0,true,false);
  g.innerHTML='<span class="g-yaz"><b>'+t+'</b>/'+GUN_HEDEF+'</span>'+s;
}
function kartlarCiz(){
  var kap=$('#kartlar'); kap.innerHTML='';
  PLAN.forEach(function(def){
    var kd=oyunKaydi(def.id);
    var kart=el('button','kart'); kart.style.setProperty('--aksan','var(--a-'+def.aile+')');
    if(kd.bitti) kart.classList.add('bitti'); if(kd.kilit&&!kd.bitti) kart.classList.add('kilit');
    var hiz=def.mod==='hiz', acilmis=!!cerceveler[def.id];
    var surdu = hiz ? acilmis : (kd.dogru||kd.hata);
    var rozet = kd.bitti?'<div class="kart-rozet tamam">bitti · '+kd.yildiz+' yıldız</div>'
      : kd.kilit?'<div class="kart-rozet kilit">kilit · '+kd.yildiz+' yıldız</div>'
      : surdu?'<div class="kart-rozet">sürüyor</div>':'<div class="kart-rozet">başlamadın</div>';
    var yildizHTML = yildizGoster(def,kd,true,false);
    var kalpHTML = hiz ? '' : '<span class="olcer">'+kalpOlcerHTML(kd.can)+'</span>';
    kart.innerHTML=
      '<div class="kart-govde"><div class="kart-aile">'+(AILE_AD[def.aile]||def.aile)+'</div>'+
        '<div class="kart-ad">'+def.ad+'</div><div class="kart-alt">'+def.alt+'</div></div>'+
      '<div class="kart-durum"><span class="olcer">'+yildizHTML+'</span>'+
        kalpHTML+rozet+
        '<span class="kart-git">'+(kd.bitti?'tekrar bak →':'oyna →')+'</span></div>';
    kart.onclick=function(){ oyunAc(def); };
    kap.appendChild(kart);
  });
  gunOlcerCiz();
}

/* ============================================================
   OYUN EKRANI — gerçek oyunu iframe'de göm (canlı tut)
   ============================================================ */
var cerceveler={};   // id -> iframe
function oyunAc(def){
  DURUM._aktif=def.id;
  $('#pano').hidden=true; var ek=$('#oyunEkran'); ek.hidden=false;
  $('#oyunAd').textContent=def.ad; $('#oyunAlt').textContent=def.alt;
  hudTazele(def); window.scrollTo(0,0);
  var kap=$('#oyunKap');
  Object.keys(cerceveler).forEach(function(id){ cerceveler[id].style.display = (id===def.id)?'block':'none'; });
  if(!cerceveler[def.id]){
    var f=el('iframe','oyun-cerceve'); f.setAttribute('title',def.ad);
    f.src=def.src(metaIndex(def)); kap.appendChild(f); cerceveler[def.id]=f;
  }
}
function oyunKapat(){
  $('#oyunEkran').hidden=true;
  Object.keys(cerceveler).forEach(function(id){ cerceveler[id].style.display='none'; });
  $('#pano').hidden=false; kartlarCiz(); window.scrollTo(0,0);
}

/* ——— gömülü oyundan gelen ilerleme ——— */
window.addEventListener('message',function(e){
  if(e.origin!==location.origin) return;
  var d=e.data; if(!d||!d.kaynak) return;
  var def=OYUNLAR.find(function(o){ return o.id===d.kaynak; }); if(!def) return;
  var kd=oyunKaydi(def.id);
  if(def.mod==='hiz'){
    /* tek-cevaplı oyun: yıldız = hız kademesi (oyun doğrudan bildirir), KALP YOK.
       gün toplamına yalnız bitince sayılır (oynarken gösterilen değer 'olası' kademe). */
    if(typeof d.yildiz==='number') kd.yildiz=Math.max(0,Math.min(3,d.yildiz|0));
    if(d.bitti) kd.bitti=true;
    durumKaydet(); if(DURUM._aktif===def.id) hudTazele(def); kazanmaKontrol(); return;
  }
  var oncedenKilit=kd.kilit;
  if(typeof d.dogru==='number') kd.dogru=d.dogru;
  if(typeof d.toplam==='number') kd.toplam=d.toplam;
  if(typeof d.hata==='number'){ kd.hata=d.hata; kd.can=Math.max(0,KART_CAN-d.hata); kd.kilit=d.hata>=KART_CAN; }
  /* yıldız: oyun doğrudan bildirdiyse (ör. Çatı: temayı kaç kelimede buldun) onu kullan,
     yoksa eşikten hesapla. Kilitliyken DONAR (kilit anındaki değeri sabitle). */
  var yeniYildiz = (typeof d.yildiz==='number') ? Math.max(0,Math.min(3,d.yildiz|0)) : tamYildiz(kd.dogru,esikCoz(def,kd));
  if(!kd.kilit) kd.yildiz=yeniYildiz;
  else if(!oncedenKilit) kd.yildiz=yeniYildiz;
  if(d.bitti) kd.bitti=true;
  durumKaydet();
  if(DURUM._aktif===def.id) hudTazele(def);
  kazanmaKontrol();
},false);

function hudTazele(def){
  var kd=oyunKaydi(def.id), hiz=def.mod==='hiz';
  var y=$('#oyunYildiz'); if(y) y.innerHTML = yildizGoster(def,kd,false,true);
  var k=$('#oyunKalp'); if(k) k.innerHTML = hiz ? '' : kalpOlcerHTML(kd.can);
  gunOlcerCiz();
}

/* ============================================================
   KAZANDIN bildirimi (açılır)
   ============================================================ */
function kazanmaKontrol(){
  if(gunToplam()>=GUN_HEDEF && !DURUM.kazandi){ DURUM.kazandi=true; durumKaydet(); kazandinAc(); }
}
function kazandinAc(){
  var perde=$('#kazanPerde'); if(!perde) return;
  var s=''; for(var i=0;i<GUN_HEDEF;i++) s+=yildizSVG(1,false,true);
  $('#kazanIcerik').innerHTML='<div class="kazan-yildizlar">'+s+'</div>'+
    '<h3>Günü kazandın! ✨</h3>'+
    '<p>Bugün '+gunToplam()+' yıldız topladın. İstersen kalan bulmacaları da bitir.</p>'+
    '<div class="kazan-alt"><button class="dugme" id="kazanKapat2">devam</button>'+
      '<button class="baglanti" id="kazanPay">sonucu kopyala</button></div>';
  perde.hidden=false;
  $('#kazanKapat2').onclick=function(){ perde.hidden=true; };
  $('#kazanPay').onclick=paylas;
}
function paylas(){
  var satir=PLAN.map(function(def){ var kd=oyunKaydi(def.id),y=''; for(var i=0;i<3;i++)y+= i<kd.yildiz?'★':'·'; return y+' '+def.ad; }).join('\n');
  var metin='Günün Yıldızları · '+gunToplam()+'/'+GUN_HEDEF+' ⭐\n'+satir+'\nverandatools.com/yildiz';
  if(navigator.clipboard) navigator.clipboard.writeText(metin).then(function(){ toast('kopyalandı 📋','iyi'); },function(){ toast('kopyalanamadı'); });
}

/* ============================================================
   TANITIM
   ============================================================ */
var SLAYT=[
  { a:cokYildiz(), bas:'Günün Yıldızları', p:['Her gün <b>4 farklı bulmaca</b>.','Farklı alanlar, farklı biçimler.','Sevdiğini oyna, gerisini atla.'] },
  { a:'<svg viewBox="0 0 64 64">'+yzOne(-14,4,.62,.66)+yzOne(12,4,.62,.33)+yzOne(38,4,.62,0)+'</svg>',
    bas:'Yıldızlar', p:['Her bulmacada <b>3 yıldız</b> var.','Doğru cevaplar onları <b>azar azar doldurur</b>.','Gün boyunca <b>6 yıldız</b> topla, günü kazan.'] },
  { a:'<svg viewBox="0 0 64 64"><path d="'+HEART+'" class="kalp-dolu" transform="translate(-14,4) scale(.6)"/><path d="'+HEART+'" class="kalp-dolu" transform="translate(12,4) scale(.6)"/><path d="'+HEART+'" class="kalp-bos" transform="translate(38,4) scale(.6)"/></svg>',
    bas:'Kalpler', p:['Her bulmaca <b>3 kalple</b> başlar.','Her yanlış bir kalp götürür.','Üçü de biterse o bulmaca kilitlenir — <span class="k">yıldızların kalır.</span>'] },
  { a:'<svg viewBox="0 0 64 64"><path d="'+STAR+'" class="yildiz-dolu" transform="translate(2,2) scale(.9)"/></svg>',
    bas:'İpuçları', p:['Her bulmaca <b>kendi oyunuyla</b> açılır.','Gir çık serbest; pes edip cevabı görmek yıldızını götürmez.','Sevdiğini oyna, gerisini atla.'] }
];
function yzOne(x,y,s,kesir){ var id='sy'+(++_uid),yy=64*(1-kesir); return '<defs><clipPath id="'+id+'"><rect x="0" y="'+(y+yy*s).toFixed(1)+'" width="64" height="64"/></clipPath></defs>'+
  '<path d="'+STAR+'" class="yildiz-bos" transform="translate('+x+','+y+') scale('+s+')"/>'+(kesir>0?'<path d="'+STAR+'" class="yildiz-dolu" transform="translate('+x+','+y+') scale('+s+')" clip-path="url(#'+id+')"/>':''); }
function cokYildiz(){ return '<svg viewBox="0 0 64 64">'+
  '<path d="'+STAR+'" class="yildiz-dolu" transform="translate(-8,-8) scale(.55)"/>'+
  '<path d="'+STAR+'" class="yildiz-dolu" transform="translate(36,-6) scale(.5)"/>'+
  '<path d="'+STAR+'" class="yildiz-dolu" transform="translate(-6,30) scale(.5)"/>'+
  '<path d="'+STAR+'" class="yildiz-dolu" transform="translate(34,32) scale(.55)"/></svg>'; }
var slaytNo=0;
function slaytCiz(){ var s=SLAYT[slaytNo];
  $('#slaytAkis').innerHTML='<div class="slayt"><div class="slayt-amblem">'+s.a+'</div><h3>'+s.bas+'</h3>'+s.p.map(function(x){return '<p>'+x+'</p>';}).join('')+'</div>';
  $('#slaytNokta').innerHTML=SLAYT.map(function(_,i){ return '<i class="'+(i===slaytNo?'aktif':'')+'"></i>'; }).join('');
  $('#slaytGeri').hidden=slaytNo===0; $('#slaytIleri').textContent=slaytNo===SLAYT.length-1?'anladım':'ileri';
}
function girisAc(){ slaytNo=0; slaytCiz(); $('#girisPerde').hidden=false; }
function girisKapat(){ $('#girisPerde').hidden=true; try{ localStorage.setItem('yildiz:giris','1'); }catch(e){} }

/* ============================================================
   BAŞLAT
   ============================================================ */
function toast(m,snf){ var t=$('#toast'); if(!t)return; t.textContent=m; t.className='goster'+(snf?' '+snf:''); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.className=''; },2300); }
function temaUygula(t){ document.documentElement.dataset.tema=t; var b=$('#temaBtn'); if(b) b.textContent=t==='gece'?'gündüz':'gece'; try{ localStorage.setItem('yildiz:tema',t); }catch(e){} }
/* DEBUG: rastgele bir güne atla — farklı oyun seçkisi + farklı bulmacalar. Kaydedilmez; yenileyince bugüne döner. */
function rastgeleGun(){
  _ephemeral=true;
  GUN=Math.floor(Math.random()*100000);
  DURUM={gun:GUN,oyunlar:{},kazandi:false};
  Object.keys(cerceveler).forEach(function(id){ try{ cerceveler[id].remove(); }catch(e){} delete cerceveler[id]; });
  PLAN=gununSecki(GUN);
  var t=$('#tarih'); if(t) t.textContent='🎲 rastgele gün #'+GUN+' · debug';
  var kp=$('#kazanPerde'); if(kp) kp.hidden=true;
  kartlarCiz(); window.scrollTo(0,0);
}

function baslat(){
  /* ?sifirla=1 → o günün ilerlemesini temizle (test/kurtarma) */
  if(new URLSearchParams(location.search).has('sifirla')){
    try{ Object.keys(localStorage).forEach(function(k){ if(k.indexOf('yildiz:g')===0) localStorage.removeItem(k); }); }catch(e){}
  }
  GUN=metaGun(); DURUM=durumYukle(); PLAN=gununSecki(GUN);
  temaUygula(localStorage.getItem('yildiz:tema')||'gunduz');
  tarihYaz(); kartlarCiz();
  $('#geriBtn').onclick=oyunKapat;
  $('#nasilBtn').onclick=girisAc;
  $('#temaBtn').onclick=function(){ temaUygula(document.documentElement.dataset.tema==='gece'?'gunduz':'gece'); };
  $('#girisKapat').onclick=girisKapat; $('#slaytAtla').onclick=girisKapat;
  $('#slaytGeri').onclick=function(){ if(slaytNo>0){slaytNo--;slaytCiz();} };
  $('#slaytIleri').onclick=function(){ if(slaytNo<SLAYT.length-1){slaytNo++;slaytCiz();} else girisKapat(); };
  $('#girisPerde').addEventListener('click',function(e){ if(e.target===this) girisKapat(); });
  var kp=$('#kazanPerde'); if(kp) kp.addEventListener('click',function(e){ if(e.target===this) kp.hidden=true; });
  /* gizli debug tuşu: ?dev=1 ile aç (sonra bu tarayıcıda kalıcı). Normal kullanıcı görmez. */
  if(new URLSearchParams(location.search).get('dev')==='1'){ try{ localStorage.setItem('yildiz:dev','1'); }catch(e){} }
  if(localStorage.getItem('yildiz:dev')==='1'){ var rb=$('#rastgeleBtn'); if(rb){ rb.hidden=false; rb.onclick=rastgeleGun; } }
  if(!localStorage.getItem('yildiz:giris')) girisAc();
}

/* ——— gömülecek oyunlar ——— */
kayit({ id:'kur', ad:'Kur', aile:'eslestirme', mod:'sayac', esik:[3,5,8], len:400,
  alt:'8 kuş, 8 ad — benzerler kandırır', src:function(i){ return '../kur/?meta=1&bulmaca='+i; } });
kayit({ id:'dortsuru', ad:'Dört Sürü', aile:'obek', mod:'sayac', esik:[2,3,4], len:400,
  alt:'16 kuş, 4 gizli öbek', src:function(i){ return '../dort-suru/?meta=1&bulmaca='+i; } });
kayit({ id:'asi', ad:'Aşı', aile:'eslestirme', mod:'sayac', esik:[3,5,8], len:400,
  alt:'8 bitki, 8 ad — benzeşenler kandırır', src:function(i){ return '../asi/?meta=1&bulmaca='+i; } });
kayit({ id:'dortdemet', ad:'Dört Demet', aile:'obek', mod:'sayac', esik:[2,3,4], len:400,
  alt:'16 bitki, 4 gizli öbek', src:function(i){ return '../dort-demet/?meta=1&bulmaca='+i; } });
kayit({ id:'jenerik', ad:'Jenerik', aile:'film', mod:'sayac', len:359,
  esik:function(m){ return [Math.max(1,Math.round(m*0.3)), Math.max(2,Math.round(m*0.55)), Math.max(3,Math.min(m,Math.round(m*0.8)))]; },
  alt:'bu oyuncunun kaç filmini bilirsin?', src:function(i){ return '../karanlik-oda/jenerik.html?meta=1&bulmaca='+i; } });
kayit({ id:'atlas', ad:'Atlas', aile:'cografya', mod:'sayac', esik:[3,6,9], len:160,
  alt:'3×3 ızgara — satır × sütun ölçütü', src:function(i){ return '../atlas/?meta=1&bulmaca='+i; } });
kayit({ id:'sancak', ad:'Sancak', aile:'cografya', mod:'hiz', len:119,
  alt:'bulanık bayrak — ne kadar erken bilirsen', src:function(i){ return '../sancak/?meta=1&bulmaca='+i; } });
kayit({ id:'karanlikoda', ad:'Karanlık Oda', aile:'film', mod:'hiz', len:1310,
  alt:'bulanık kareden filmi bul', src:function(i){ return '../karanlik-oda/?meta=1&bulmaca='+i; } });
kayit({ id:'cati', ad:'Çatı', aile:'kelime', mod:'sayac', len:150,
  alt:'5 kelime + gizli tema', src:function(i){ return '../cati/?meta=1&bulmaca='+i; } });

window.YILDIZ={ kayit:kayit, baslat:baslat, toast:toast };
})();
