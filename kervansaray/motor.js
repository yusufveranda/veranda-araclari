/* ============================================================
   Kervansaray · motor (v3; yildiz/motor.js'in kervan dönüşümü)
   Gerçek oyunlar kendi arayüzüyle iframe içinde çalışır; kabuk
   üstüne kese (altın) + su + sefer katmanı koyar. Oyun, ?meta=1
   kipinde ilerlemesini postMessage ile bildirir:
     oyun -> kabuk: {kaynak, dogru, toplam, hata, yildiz, bitti}
     kabuk -> oyun: {tip:'tema', tema:'gece'|'gunduz'}
   localStorage ad alanı: kervansaray:*  (oyunların kaydına dokunmaz;
   ilk açılışta yildiz:* kayıtları bir kez göç eder)
   Not: mesajdaki 'yildiz' alan adı tarihsel; arayüz "altın" der.
   ============================================================ */
(function(){
"use strict";

var META_MILAT = Date.UTC(2026,6,6);      // gün 0 = 6 Temmuz 2026 (yildiz ile aynı; göç uyumu)
var GUN_HEDEF  = 6;                        // yol parası
var GUN_TAVAN  = 12;                       // bereketli gün
var KART_CAN   = 3;                        // su
var AILE_SIRA  = ['kelime','eslestirme','obek','film','cografya','yuz','sanat','anlam'];
var AILE_AD    = { kelime:'kelime', eslestirme:'eşleştirme', obek:'öbek', film:'film',
                   cografya:'coğrafya', yuz:'yüz', sanat:'sanat', anlam:'anlam' };
var OYUN_EMOJI = { kur:'🪶', asi:'🌿', dortsuru:'🪶', dortdemet:'🌿', jenerik:'🎬',
                   karanlikoda:'🎞️', montaj:'🎬', atlas:'🗺️', sancak:'🚩',
                   cati:'🏠', cehre:'🎭', muzayede:'🖼️' };

/* her tezgahın oynanırken görünen kısa kuralı · kese neyle dolar, su neyle gider */
var KURALLAR = {
  kur:'Bir kuş ile bir adı eşle; <b>her doğru eş</b> keseni doldurur (<span class="ik">3·5·8</span> eş). <b>Yanlış eş</b> bir su döker.',
  asi:'Bir bitki ile bir adı eşle; <b>her doğru eş</b> keseni doldurur (<span class="ik">3·5·8</span> eş). <b>Yanlış eş</b> bir su döker.',
  dortsuru:'<b>Her doğru öbek</b> keseni doldurur (<span class="ik">2·3·4</span> öbek). <b>Yanlış öbek</b> bir su döker.',
  dortdemet:'<b>Her doğru öbek</b> keseni doldurur (<span class="ik">2·3·4</span> öbek). <b>Yanlış öbek</b> bir su döker.',
  jenerik:'Oyuncunun filmlerini say; hepsini bilmek gerekmez: kese <span class="ik">~%30·55·80</span> eşiklerinde dolar. <b>Yanlış film</b> bir su döker.',
  atlas:'<b>Her doğru hücre</b> keseni doldurur (<span class="ik">3·6·9</span> hücre). <b>Yanlış tahmin</b> bir su döker.',
  sancak:'⏳ <b>Pazarlık:</b> erken bil, çok altın al. 1. tahmin <b>3</b> · 2-3. → <b>2</b> · 4-5. → <b>1</b> altın. <b>Su yok</b>; geciktikçe altın düşer.',
  karanlikoda:'⏳ <b>Pazarlık:</b> erken bil, çok altın al. 1. kare <b>3</b> · 2-3. → <b>2</b> · 4-5. → <b>1</b> altın. <b>Su yok</b>; her pas ve yanlışta altın düşer.',
  cati:'Önce kelimeleri çöz. Altın, temayı <b>ne kadar erken</b> bulduğun: 1 kelimede <b>3</b> · 2-3 → <b>2</b> · 4-5 → <b>1</b>. <b>Yanlış tema tahmini</b> bir su döker; <b>3 hakkın</b> var.',
  cehre:'⏳ <b>Pazarlık:</b> yüzü erken tanı. 1. tahmin <b>3</b> · 2. → <b>2</b> · 3. → <b>1</b> altın. <b>Su yok</b>; her yanlışta yüz biraz daha açılır, altın düşer.',
  montaj:'Kareleri üçerli birleştirip <b>4 filmi ayır</b>; her ayrılan film keseni doldurur (<span class="ik">2·3·4</span>). <b>Yanlış birleştirme</b> bir su döker.',
  muzayede:'Tablonun <b>fiyatını çek</b>, sonra <b>ressamını bul</b>; puanın keseni doldurur. <b>Yanlış ressam</b> bir su döker.'
};

/* === oyun kaydı (gömülecek gerçek oyunlar) === */
var OYUNLAR=[];
function kayit(d){ OYUNLAR.push(d); }

/* === yardımcılar === */
var $=function(s,k){ return (k||document).querySelector(s); };
function el(t,c,h){ var e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e; }
function bugunUTC(){ var n=new Date(); return Date.UTC(n.getFullYear(),n.getMonth(),n.getDate()); }
function metaGun(){ return Math.floor((bugunUTC()-META_MILAT)/86400000); }
function hash32(s){ var h=2166136261>>>0; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function farkliIndex(id,gun,uz,std){
  if(!uz) return 0;
  var i=((hash32(id+':'+gun)%uz)+uz)%uz;
  if(std!=null && i===(((std%uz)+uz)%uz)) i=(i+1)%uz;
  return i;
}
function clampInt(v,lo,hi){ v=Math.floor(+v||0); return v<lo?lo:(v>hi?hi:v); }
function utcGun(){ return Math.floor(Date.now()/864e5); }

/* === SVG ikonlar === */
/* altın sikke: dış halka + iç yıldız motifi; kademeli dolum clip-rect ile */
var SIKKE_IC='M32 18 L35.5 27.5 L45 28 L37.5 34 L40 43.5 L32 38 L24 43.5 L26.5 34 L19 28 L28.5 27.5 Z';
var DAMLA='M32 8 C32 8 14 30 14 42 C14 52.5 22 59 32 59 C42 59 50 52.5 50 42 C50 30 32 8 32 8 Z';
var KANDIL='M14 40 C14 33 22 28 32 28 C42 28 50 33 50 40 L46 46 L18 46 Z M30 28 L34 28 L33 22 L31 22 Z';
var ALEV='M32 8 C36 13 38 16 36 20 C34.6 22.7 29.4 22.7 28 20 C26 16 28 13 32 8 Z';
var _uid=0;
function sikkeSVG(kesir,kucuk,parla,olasi){
  kesir=Math.max(0,Math.min(1,kesir)); var id='ks'+(++_uid); var yy=64*(1-kesir);
  return '<svg class="svg-ik'+(kucuk?' kucuk':'')+(parla?' sikke-yeni':'')+(olasi?' sikke-olasi':'')+'" viewBox="0 0 64 64" aria-hidden="true">'+
    '<defs><clipPath id="'+id+'"><rect x="0" y="'+yy.toFixed(1)+'" width="64" height="'+(64-yy).toFixed(1)+'"/></clipPath></defs>'+
    '<circle cx="32" cy="32" r="26" class="sikke-bos"/>'+
    (kesir>0?('<g clip-path="url(#'+id+')"><circle cx="32" cy="32" r="26" class="sikke-dolu"/>'+
      '<path d="'+SIKKE_IC+'" class="sikke-motif"/></g>'):'')+'</svg>';
}
function suSVG(dolu,gitti){
  return '<svg class="svg-ik kucuk'+(gitti?' su-gitti':'')+'" viewBox="0 0 64 64" aria-hidden="true">'+
    '<path d="'+DAMLA+'" class="'+(dolu?'su-dolu':'su-bos')+'"/></svg>';
}
function kandilSVG(gecikme){
  return '<svg class="svg-ik kandil" viewBox="0 0 64 64" aria-hidden="true" style="animation-delay:'+gecikme+'ms">'+
    '<path d="'+ALEV+'" class="kandil-alev" style="animation-delay:'+(gecikme+120)+'ms"/>'+
    '<path d="'+KANDIL+'" class="kandil-govde"/></svg>';
}
function kervanSVG(){
  /* iki deve + yükleriyle basit siluet (varış sekansı) */
  return '<svg class="kervan-siluet" viewBox="0 0 220 64" aria-hidden="true">'+
    '<g class="kervan-g">'+
    '<path d="M18 52 L24 40 C26 34 32 32 36 34 C38 28 46 27 49 31 C55 29 60 33 60 38 L62 52 L56 52 L54 44 L48 44 L46 52 L40 52 L38 45 L30 45 L28 52 Z"/>'+
    '<path d="M96 52 L102 40 C104 34 110 32 114 34 C116 28 124 27 127 31 C133 29 138 33 138 38 L140 52 L134 52 L132 44 L126 44 L124 52 L118 52 L116 45 L108 45 L106 52 Z"/>'+
    '<circle cx="76" cy="46" r="3"/><circle cx="170" cy="46" r="3"/>'+
    '<path d="M160 52 L164 42 L172 40 L178 44 L180 52 Z"/>'+
    '</g></svg>';
}
/* dogru sayısı + eşik → her sikkenin dolum kesri */
function sikkeKesirler(dogru,esik){
  var t=[0].concat(esik), r=[];
  for(var i=0;i<3;i++){ var lo=t[i],hi=t[i+1]; r.push(hi>lo?Math.max(0,Math.min(1,(dogru-lo)/(hi-lo))):0); }
  return r;
}
function tamAltin(dogru,esik){ var n=0; for(var i=0;i<esik.length;i++) if(dogru>=esik[i]) n++; return n; }
function esikCoz(def,kd){ return (typeof def.esik==='function') ? def.esik((kd&&kd.toplam)||1) : def.esik; }
function sikkeOlcerHTML(dogru,esik,kucuk,parla,olasi){
  var k=sikkeKesirler(dogru,esik),o='';
  for(var i=0;i<3;i++) o+=sikkeSVG(k[i],kucuk, parla&&k[i]>0&&k[i]<1, olasi);
  return o;
}
function suOlcerHTML(can){ var o=''; for(var i=0;i<KART_CAN;i++) o+=suSVG(i<can,false); return o; }
/* altın gösterimi: hız → tam sikke (kd.yildiz; bitmemişse 'olası' stili);
   Çatı (eşiksiz) → tam sikke; sayaç → kademeli dolum */
function altinGoster(def,kd,kucuk,parla){
  if(def.mod==='hiz'){
    var goster=(kd.dokunuldu||kd.bitti)?kd.yildiz:0;
    return sikkeOlcerHTML(goster,[1,2,3],kucuk,parla,!kd.bitti);
  }
  if(!def.esik) return sikkeOlcerHTML(kd.yildiz,[1,2,3],kucuk,parla,false);
  return sikkeOlcerHTML(kd.dogru,esikCoz(def,kd),kucuk,parla,false);
}

/* === gün durumu === */
var GUN,PLAN,DURUM,_ephemeral=false,_arsiv=false;
function anahtar(){ return _arsiv ? 'kervansaray:arsiv:g'+GUN : 'kervansaray:g'+GUN; }
function durumYukle(){ var h=null; try{ h=JSON.parse(localStorage.getItem(anahtar())); }catch(e){} return (h&&h.gun===GUN)?h:{gun:GUN,oyunlar:{},kazandi:false}; }
function durumKaydet(){
  if(_ephemeral) return;
  var d={gun:DURUM.gun,oyunlar:DURUM.oyunlar,kazandi:DURUM.kazandi,
         skorPuan:DURUM.skorPuan||0,istatYazildi:!!DURUM.istatYazildi};
  try{ localStorage.setItem(anahtar(),JSON.stringify(d)); }catch(e){}
}
function oyunKaydi(id){ if(!DURUM.oyunlar[id]) DURUM.oyunlar[id]={dogru:0,hata:0,yildiz:0,can:KART_CAN,bitti:false,kilit:false,dokunuldu:false}; return DURUM.oyunlar[id]; }
function gunToplam(){ var t=0; PLAN.forEach(function(o){ var kd=oyunKaydi(o.id); t+= (o.mod==='hiz'&&!kd.bitti)?0:kd.yildiz; }); return t; }
function gunCozuldu(){ return PLAN.every(function(o){ var kd=oyunKaydi(o.id); return kd.bitti||kd.kilit; }); }

/* === göç: yildiz:* -> kervansaray:* (bir kez) === */
function goc(){
  try{
    if(localStorage.getItem('kervansaray:goc')) return;
    Object.keys(localStorage).forEach(function(k){
      if(k.indexOf('yildiz:g')===0 && localStorage.getItem('kervansaray:g'+k.slice(8))==null)
        localStorage.setItem('kervansaray:g'+k.slice(8), localStorage.getItem(k));
    });
    ['tema','giris'].forEach(function(s){
      var v=localStorage.getItem('yildiz:'+s);
      if(v!=null && localStorage.getItem('kervansaray:'+s)==null) localStorage.setItem('kervansaray:'+s,v);
    });
    localStorage.setItem('kervansaray:goc','1');
  }catch(e){}
}

/* === günün seçkisi === */
function gununSecki(gun){
  var grup={}; OYUNLAR.forEach(function(o){ (grup[o.aile]=grup[o.aile]||[]).push(o); });
  var aileler=AILE_SIRA.filter(function(a){ return grup[a]; });
  if(!aileler.length) return [];
  var n=aileler.length, sonuc=[];
  for(var tur=0; tur<4 && sonuc.length<4; tur++){
    for(var i=0; i<n && sonuc.length<4; i++){
      var aile=aileler[(((gun+i)%n)+n)%n];
      var g=grup[aile], m=g.length;
      var oy=g[(((gun+tur)%m)+m)%m];
      if(sonuc.indexOf(oy)<0) sonuc.push(oy);
    }
  }
  return sonuc;
}
function metaIndex(def){
  var std=(typeof def.gunlukIndex==='function')?def.gunlukIndex():null;
  return farkliIndex(def.id,GUN,def.len,std);
}

/* === sefer (rota üst katmanı) === */
var ROTA=window.KERVAN_ROTA||[];
function kazanilanGunSayisi(){
  var n=0;
  try{
    Object.keys(localStorage).forEach(function(k){
      if(/^kervansaray:g\d+$/.test(k)){
        try{ var d=JSON.parse(localStorage.getItem(k)); if(d&&d.kazandi) n++; }catch(e){}
      }
    });
  }catch(e){}
  return n;
}
function konakVeri(i){                       /* i. varış (0 tabanlı) hangi konak */
  var L=ROTA.length; if(!L) return null;
  var tur=Math.floor(i/L), idx=i%L;
  return ROTA[(tur%2===0)?idx:(L-1-idx)];    /* çift sefer: dönüş yolu */
}
function seferBilgi(){
  var n=kazanilanGunSayisi(), L=ROTA.length||1;
  return { n:n, sefer:Math.floor(n/L)+1, adim:n%L, ters:(Math.floor(n/L)%2===1),
           son:(n>0?konakVeri(n-1):null), siradaki:konakVeri(n) };
}
function rotaSeritCiz(){
  var kap=$('#rotaSerit'); if(!kap||!ROTA.length) return;
  var sb=seferBilgi(), L=ROTA.length;
  var yon=sb.ters?'dönüş yolu':'Uzun Yol';
  var h='<div class="rota-bas"><span class="rota-sefer">'+sb.sefer+'. sefer · '+yon+'</span>'+
        '<span class="rota-siradaki">sıradaki: <b>'+(sb.siradaki?sb.siradaki.ad:'')+'</b></span></div>'+
        '<div class="rota-cizgi" role="list">';
  for(var i=0;i<L;i++){
    var k=konakVeri(Math.floor((sb.n)/L)*L + i);      /* bu seferin i. konağı */
    var gecti=i<sb.adim, sira=i===sb.adim;
    h+='<button type="button" role="listitem" class="rota-nokta'+(gecti?' gecti':'')+(sira?' sira':'')+
       (k&&k.tur==='kayip'?' kayip':'')+(k&&k.tur==='sehir'?' sehir':'')+'" data-ri="'+i+'"'+
       ' aria-label="'+(k?k.ad:'')+(gecti?' (varıldı)':sira?' (sıradaki)':'')+'" title="'+(k?k.ad:'')+'"></button>';
  }
  h+='</div>';
  kap.innerHTML=h;
  kap.querySelectorAll('.rota-nokta').forEach(function(b){
    b.onclick=function(){ var i=+b.dataset.ri; hanAc(konakVeri(Math.floor(seferBilgi().n/ROTA.length)*ROTA.length+i), i<seferBilgi().adim, i===seferBilgi().adim); };
  });
}
function hanAc(k,gecti,sira){
  if(!k) return;
  var p=$('#hanPerde'); if(!p) return;
  var tRozet = k.tur==='sehir'?'şehir durağı':(k.tur==='kayip'?'kayıp menzil':'kervansaray');
  $('#hanIcerik').innerHTML=
    '<div class="han-rozet '+k.tur+'">'+tRozet+(gecti?' · varıldı':(sira?' · sıradaki konak':''))+'</div>'+
    '<h3>'+k.ad+'</h3>'+
    '<div class="han-yer">'+k.yer+(k.tarih?' · '+k.tarih:'')+'</div>'+
    '<p class="han-not">'+k.not+'</p>';
  modalAc(p);
}

/* === seri (kervan kaç gündür yolda) === */
function seriOku(){ try{ return JSON.parse(localStorage.getItem('kervansaray:seri'))||{sonGun:-9,sayi:0,enUzun:0}; }catch(e){ return {sonGun:-9,sayi:0,enUzun:0}; } }
function seriGuncelle(){                     /* yalnız gerçek gün kazanımında çağrılır */
  var s=seriOku();
  if(s.sonGun===GUN) return s;
  s.sayi=(s.sonGun===GUN-1)?s.sayi+1:1;
  s.sonGun=GUN; s.enUzun=Math.max(s.enUzun||0,s.sayi);
  try{ localStorage.setItem('kervansaray:seri',JSON.stringify(s)); }catch(e){}
  return s;
}
function seriRozetCiz(){
  var e=$('#seriRozet'); if(!e) return;
  var s=seriOku();
  var aktif=(s.sonGun===GUN)||(s.sonGun===GUN-1);
  e.hidden=!(aktif&&s.sayi>=2);
  if(!e.hidden) e.textContent='🐪 '+s.sayi+' gündür yolda';
}

/* ============================================================
   GÜN PANOSU
   ============================================================ */
function tarihYaz(){
  var e=$('#tarih'); if(!e) return;
  if(_arsiv){ e.textContent='geçmiş konak · gün #'+(GUN+1); return; }
  e.textContent=new Date().toLocaleDateString('tr-TR',{day:'numeric',month:'long',weekday:'long'});
}
function gunOlcerCiz(){
  var t=gunToplam(),g=$('#gunOlcer'); if(!g)return;
  var s='';
  for(var i=0;i<GUN_HEDEF;i++) s+=sikkeSVG(i<Math.min(t,GUN_HEDEF)?1:0,true,false,false);
  if(t>GUN_HEDEF){
    s+='<span class="bereket-ayrac" aria-hidden="true"></span>';
    for(var j=GUN_HEDEF;j<Math.min(t,GUN_TAVAN);j++) s+=sikkeSVG(1,true,false,false);
  }
  g.innerHTML='<span class="g-yaz"><b>'+t+'</b>/'+GUN_HEDEF+(t>=GUN_TAVAN?' · bereketli gün':'')+'</span>'+s;
}
var cerceveler={};   // id -> iframe
function kartlarCiz(){
  var kap=$('#kartlar'); kap.innerHTML='';
  PLAN.forEach(function(def){
    var kd=oyunKaydi(def.id);
    var kart=el('button','kart'); kart.style.setProperty('--aksan','var(--a-'+def.aile+')');
    if(kd.bitti) kart.classList.add('bitti'); if(kd.kilit&&!kd.bitti) kart.classList.add('kilit');
    var hiz=def.mod==='hiz';
    var surdu = kd.dokunuldu && !kd.bitti && !kd.kilit;
    var rozet = kd.bitti?'<div class="kart-rozet tamam">bitti · '+kd.yildiz+' altın</div>'
      : (kd.kilit?'<div class="kart-rozet kilit">tezgah kapandı · '+kd.yildiz+' altın</div>'
      : (surdu?'<div class="kart-rozet">'+(hiz?'pazarlık sürüyor':'sürüyor')+'</div>':'<div class="kart-rozet">başlamadın</div>'));
    var altinHTML = altinGoster(def,kd,true,false);
    var suHTML = hiz ? '' : '<span class="olcer">'+suOlcerHTML(kd.can)+'</span>';
    var durumSoz = hiz ? ('altın '+((kd.dokunuldu||kd.bitti)?kd.yildiz:0)+'/3'+(kd.bitti?'':' (pazarlık)'))
                       : ('altın '+kd.yildiz+'/3, su '+kd.can+'/3');
    kart.setAttribute('aria-label', def.ad+', '+AILE_AD[def.aile]+', '+durumSoz);
    kart.innerHTML=
      '<div class="kart-kemer" aria-hidden="true"></div>'+
      '<div class="kart-govde"><div class="kart-aile">'+(AILE_AD[def.aile]||def.aile)+'</div>'+
        '<div class="kart-ad">'+def.ad+'</div><div class="kart-alt">'+def.alt+'</div></div>'+
      '<div class="kart-durum"><span class="olcer">'+altinHTML+'</span>'+
        suHTML+rozet+
        '<span class="kart-git">'+(kd.bitti?'tekrar bak →':'tezgaha git →')+'</span></div>';
    kart.onclick=function(){ oyunAc(def); };
    kap.appendChild(kart);
  });
  gunOlcerCiz(); rotaSeritCiz(); seriRozetCiz(); seritCiz(); safakCiz(); arsivCiz();
}

/* kalıcı "kervan yola koyuldu" şeridi */
function seritCiz(){
  var e=$('#kazandin'); if(!e) return;
  if(!DURUM.kazandi){ e.hidden=true; return; }
  var sb=seferBilgi();
  e.hidden=false;
  e.innerHTML='<div class="serit-sol"><h2>🐪 Kervan yola koyuldu</h2>'+
    '<p>Bugün <b>'+gunToplam()+' altın</b>'+(sb.son?' · <b>'+sb.son.ad+'</b>\'na varıldı':'')+
    (gunToplam()>=GUN_TAVAN?' · <b>bereketli gün!</b>':(gunCozuldu()?'':' · tezgahlar hâlâ açık'))+'</p></div>'+
    '<div class="serit-sag"><button class="dugme" id="seritPay">📋 paylaş</button></div>';
  var b=$('#seritPay'); if(b) b.onclick=paylas;
}

/* şafak geri sayımı + yarın önizlemesi */
var _safakT=null;
function safakCiz(){
  var e=$('#safak'); if(!e) return;
  if(_arsiv||!(DURUM.kazandi||gunCozuldu())){ e.hidden=true; if(_safakT){clearInterval(_safakT);_safakT=null;} return; }
  e.hidden=false;
  var yarin=gununSecki(GUN+1).map(function(o){ return (OYUN_EMOJI[o.id]||'')+' '+o.ad; }).join(' · ');
  function yaz(){
    var n=new Date(), g=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1);
    var ms=g-n, sa=Math.floor(ms/36e5), dk=Math.floor((ms%36e5)/6e4);
    e.innerHTML='<span class="safak-sayac">şafağa <b>'+sa+' sa '+dk+' dk</b></span>'+
      '<span class="safak-yarin">yarının tezgahları: '+yarin+'</span>';
  }
  yaz();
  if(!_safakT) _safakT=setInterval(yaz,30000);
}

/* arşiv: geride kalan konaklar (son 7 gün) */
function arsivCiz(){
  var kap=$('#arsiv'); if(!kap) return;
  if(_arsiv||_ephemeral||GUN<=0){ kap.hidden=true; return; }
  var h='',say=0;
  for(var g=GUN-1; g>=Math.max(0,GUN-7); g--){
    var d=null; try{ d=JSON.parse(localStorage.getItem('kervansaray:g'+g)); }catch(e){}
    var kazandi=d&&d.kazandi;
    if(kazandi) continue;                       /* kazanılan gün geride kalmadı */
    say++;
    h+='<a class="arsiv-satir" href="?gun='+g+'"><span>gün #'+(g+1)+'</span>'+
       '<span class="arsiv-oyun">'+gununSecki(g).map(function(o){return OYUN_EMOJI[o.id]||'';}).join(' ')+'</span>'+
       '<span class="arsiv-git">oyna →</span></a>';
  }
  if(!say){ kap.hidden=true; return; }
  kap.hidden=false;
  kap.innerHTML='<div class="arsiv-bas">geride kalan konaklar <span class="ince">(keyif için; sefer saymaz)</span></div>'+h;
}

/* ============================================================
   OYUN EKRANI · gerçek oyunu iframe'de göm (canlı tut)
   ============================================================ */
function oyunAc(def){
  DURUM._aktif=def.id;
  var kd=oyunKaydi(def.id);
  if(!kd.dokunuldu){ kd.dokunuldu=true; durumKaydet(); }
  $('#pano').hidden=true; var ek=$('#oyunEkran'); ek.hidden=false;
  $('#oyunAd').textContent=def.ad; $('#oyunAlt').textContent=def.alt;
  var kEl=$('#oyunKural'); if(kEl) kEl.innerHTML=KURALLAR[def.id]||'';
  var kapali=$('#oyunKapali'); if(kapali) kapali.hidden=!(kd.kilit&&!kd.bitti);
  hudTazele(def); window.scrollTo(0,0);
  var kap=$('#oyunKap');
  Object.keys(cerceveler).forEach(function(id){ cerceveler[id].style.display = (id===def.id)?'block':'none'; });
  if(!cerceveler[def.id]){
    var f=el('iframe','oyun-cerceve'); f.setAttribute('title',def.ad);
    f.src=def.src(metaIndex(def))+'&tema='+(document.documentElement.dataset.tema||'gunduz');
    kap.appendChild(f); cerceveler[def.id]=f;
  }
}
function oyunKapat(){
  DURUM._aktif=null;
  $('#oyunEkran').hidden=true;
  Object.keys(cerceveler).forEach(function(id){ cerceveler[id].style.display='none'; });
  $('#pano').hidden=false; kartlarCiz(); window.scrollTo(0,0);
}

/* === gömülü oyundan gelen ilerleme === */
window.addEventListener('message',function(e){
  if(e.origin!==location.origin) return;
  var d=e.data; if(!d||!d.kaynak) return;
  var def=OYUNLAR.find(function(o){ return o.id===d.kaynak; }); if(!def) return;
  var f=cerceveler[def.id];
  if(!f || e.source!==f.contentWindow) return;          /* yalnız kayıtlı iframe konuşur */
  var kd=oyunKaydi(def.id);
  if(def.mod==='hiz'){
    /* pazarlık: altın = hız kademesi, su yok. bitti olan tezgah bir daha güncellenmez
       (yenileme sonrası açılış mesajı bedava altın veremez). */
    if(!kd.bitti){
      if(typeof d.yildiz==='number') kd.yildiz=clampInt(d.yildiz,0,3);
      if(d.bitti===true) kd.bitti=true;
    }
  } else {
    var dogru=(typeof d.dogru==='number')?clampInt(d.dogru,0,999):kd.dogru;
    var hata =(typeof d.hata ==='number')?clampInt(d.hata ,0,99 ):kd.hata;
    if(typeof d.toplam==='number') kd.toplam=clampInt(d.toplam,1,999);
    if(kd.bitti||kd.kilit){                             /* düşürücü rapor reddedilir (reload koruması) */
      if(dogru<kd.dogru) dogru=kd.dogru;
      if(hata <kd.hata ) hata =kd.hata;
    }
    var oncedenKilit=kd.kilit;
    kd.dogru=dogru; kd.hata=hata;
    kd.can=Math.max(0,KART_CAN-hata); kd.kilit=hata>=KART_CAN;
    /* altın: oyun doğrudan bildirdiyse (Çatı) onu, yoksa eşikten; kapanınca DONAR */
    var yeni=(typeof d.yildiz==='number')?clampInt(d.yildiz,0,3):tamAltin(kd.dogru,esikCoz(def,kd));
    if(kd.bitti && yeni<kd.yildiz) yeni=kd.yildiz;
    if(!kd.kilit) kd.yildiz=yeni;
    else if(!oncedenKilit) kd.yildiz=yeni;
    if(d.bitti===true) kd.bitti=true;
    var kapali=$('#oyunKapali');
    if(kapali && DURUM._aktif===def.id) kapali.hidden=!(kd.kilit&&!kd.bitti);
  }
  metaBilgilendir(def,kd);
  durumKaydet();
  if(DURUM._aktif===def.id) hudTazele(def);
  kazanmaKontrol(); skorGuncelle(); gunSonuKontrol();
},false);

/* kese/su değişince oynayana anlık söyle (yalnız açık oyunda, ilk bildirimde sessiz) */
var _sonDeger={};
function metaBilgilendir(def,kd){
  var o=_sonDeger[def.id]; _sonDeger[def.id]={yildiz:kd.yildiz,can:kd.can,bitti:kd.bitti};
  if(!o || DURUM._aktif!==def.id) return;
  if(kd.bitti && !o.bitti){ toast(kd.yildiz>0?('bildin! '+kd.yildiz+' altın kesende'):'bitti · kese boş kaldı', kd.yildiz>0?'iyi':'kotu'); return; }
  if(def.mod==='hiz'){ if(kd.yildiz<o.yildiz) toast('⏳ pazarlık uzadı · artık en çok '+kd.yildiz+' altın','kotu'); }
  else { if(kd.can<o.can) toast(kd.can>0?('💧 su döküldü · '+kd.can+' su kaldı'):'💧 su bitti · tezgah kapandı, altının kesende','kotu');
         else if(kd.yildiz>o.yildiz) toast('🪙 kese doldu · '+kd.yildiz+'/3','iyi'); }
}
function hudTazele(def){
  var kd=oyunKaydi(def.id), hiz=def.mod==='hiz';
  var y=$('#oyunAltin'); if(y){
    var yeniHTML=altinGoster(def,kd,false,true);
    if(y.dataset.son!==JSON.stringify([kd.yildiz,kd.dogru])){ y.innerHTML=yeniHTML; y.dataset.son=JSON.stringify([kd.yildiz,kd.dogru]); }
  }
  var k=$('#oyunSu'); if(k) k.innerHTML = hiz ? '' : suOlcerHTML(kd.can);
  gunOlcerCiz();
}

/* ============================================================
   KAZANMA + SKOR
   ============================================================ */
function kazanmaKontrol(){
  if(_arsiv||_ephemeral) return;
  var t=gunToplam();
  if(t>=GUN_HEDEF && !DURUM.kazandi){
    DURUM.kazandi=true; durumKaydet();
    var s=seriGuncelle();
    varisAc(s);
    if(window.VF && VF.kullanici) VF.skorYaz('kervansaray', GUN, {puan:t, kazandi:true})
      .then(function(){ DURUM.skorPuan=t; durumKaydet(); }).catch(function(){});
  }
  if(t>=GUN_TAVAN && !DURUM.bereket){
    DURUM.bereket=true; durumKaydet();
    if(DURUM.kazandi) bereketAc();
  }
}
function skorGuncelle(){
  if(_arsiv||_ephemeral||!window.VF||!VF.kullanici) return;
  if(!DURUM.kazandi) return;
  var p=gunToplam();
  if(p===(DURUM.skorPuan||0)) return;
  /* update kuralı yayınlanana dek sunucu reddeder; sessiz geç */
  VF.skorYaz('kervansaray', GUN, {puan:p, kazandi:true})
    .then(function(){ DURUM.skorPuan=p; durumKaydet(); }).catch(function(){});
}
function gunSonuKontrol(){
  if(_arsiv||_ephemeral||!gunCozuldu()) return;
  var p=gunToplam();
  if(!DURUM.kazandi && !DURUM.skorPuan && window.VF && VF.kullanici){
    VF.skorYaz('kervansaray', GUN, {puan:p, kazandi:false})
      .then(function(){ DURUM.skorPuan=p; durumKaydet(); }).catch(function(){});
  }
  if(!DURUM.istatYazildi && window.VF){
    DURUM.istatYazildi=true; durumKaydet();
    VF.istatistikArttir('kervansaray', GUN, String(p));
  }
}
function varisAc(seri){
  var perde=$('#kazanPerde'); if(!perde) return;
  var sb=seferBilgi();
  var kandiller=''; for(var i=0;i<5;i++) kandiller+=kandilSVG(i*90);
  $('#kazanIcerik').innerHTML=
    '<div class="varis-kandiller">'+kandiller+'</div>'+
    '<div class="varis-yol"><div class="varis-cizgi"></div>'+kervanSVG()+'</div>'+
    '<h3>Yol parası çıktı! 🪙</h3>'+
    (sb.son?('<p class="varis-han">Kervan <b>'+sb.son.ad+'</b>\'na vardı.</p>'+
      '<p class="varis-not">'+sb.son.not+'</p>'):'<p class="varis-han">Kervan yola koyuldu.</p>')+
    (seri&&seri.sayi>=2?'<p class="varis-seri">🐪 '+seri.sayi+' gündür yolda</p>':'')+
    '<p class="varis-alt-not">Tezgahlar hâlâ açık; kese '+GUN_TAVAN+' altına kadar dolar.</p>'+
    '<div class="kazan-alt"><button class="dugme" id="kazanKapat2">devam</button>'+
      '<button class="baglanti" id="kazanPay">📋 paylaş</button></div>';
  modalAc(perde);
  $('#kazanKapat2').onclick=function(){ modalKapat(perde); seritCiz(); safakCiz(); };
  $('#kazanPay').onclick=paylas;
}
function bereketAc(){
  var perde=$('#kazanPerde'); if(!perde) return;
  var s=''; for(var i=0;i<GUN_TAVAN;i++) s+=sikkeSVG(1,false,i%3===0,false);
  $('#kazanIcerik').innerHTML=
    '<div class="kazan-sikkeler">'+s+'</div>'+
    '<h3>Bereketli gün! ✨</h3>'+
    '<p>Kese ağzına kadar dolu: <b>'+GUN_TAVAN+' altın</b>. Handa bu gece senin şerefine kandil yakılır.</p>'+
    '<div class="kazan-alt"><button class="dugme" id="kazanKapat2">devam</button>'+
      '<button class="baglanti" id="kazanPay">📋 paylaş</button></div>';
  modalAc(perde);
  $('#kazanKapat2').onclick=function(){ modalKapat(perde); seritCiz(); };
  $('#kazanPay').onclick=paylas;
}
function paylas(){
  var sb=seferBilgi(), s=seriOku();
  var satir=PLAN.map(function(def){
    var kd=oyunKaydi(def.id), sayilan=(def.mod==='hiz'&&!kd.bitti)?0:kd.yildiz, y='';
    for(var i=0;i<3;i++) y+= i<sayilan?'🟡':'⚪';
    return y+' '+(OYUN_EMOJI[def.id]||'')+' '+def.ad;
  }).join('\n');
  var metin='Kervansaray #'+(GUN+1)+' · '+gunToplam()+'/'+GUN_TAVAN+' altın'+
    (s.sayi>=2&&s.sonGun>=GUN-1?'\n🐪 '+s.sayi+' gündür yolda':'')+
    (sb.son&&DURUM.kazandi?'\n🏰 '+sb.son.ad+'\'na varıldı':'')+
    '\n'+satir+'\nverandatools.com/kervansaray';
  if(navigator.share){ navigator.share({text:metin}).catch(function(){}); return; }
  if(navigator.clipboard) navigator.clipboard.writeText(metin).then(function(){ toast('kopyalandı 📋','iyi'); },function(){ toast('kopyalanamadı'); });
}

/* ============================================================
   İSTATİSTİK
   ============================================================ */
function istatistikAc(){
  var p=$('#istatPerde'); if(!p) return;
  var oynanan=0,kazanilan=0,bereketli=0,toplamAltin=0,oyunT={};
  try{
    Object.keys(localStorage).forEach(function(k){
      var m=/^kervansaray:g(\d+)$/.exec(k); if(!m) return;
      var d=null; try{ d=JSON.parse(localStorage.getItem(k)); }catch(e){ return; }
      if(!d||!d.oyunlar) return;
      var gunAltin=0,dokundu=false;
      Object.keys(d.oyunlar).forEach(function(id){
        var kd=d.oyunlar[id]; if(!kd) return;
        if(kd.dokunuldu||kd.bitti||kd.dogru||kd.hata) dokundu=true;
        var oy=OYUNLAR.find(function(o){return o.id===id;});
        var sayilan=(oy&&oy.mod==='hiz'&&!kd.bitti)?0:(kd.yildiz||0);
        gunAltin+=sayilan;
        if(!oyunT[id]) oyunT[id]={altin:0,gun:0};
        if(kd.bitti||kd.kilit){ oyunT[id].altin+=sayilan; oyunT[id].gun++; }
      });
      if(dokundu) oynanan++;
      if(d.kazandi) kazanilan++;
      if(gunAltin>=GUN_TAVAN) bereketli++;
      toplamAltin+=gunAltin;
    });
  }catch(e){}
  var s=seriOku(), sb=seferBilgi();
  var aile={};
  Object.keys(oyunT).forEach(function(id){
    var oy=OYUNLAR.find(function(o){return o.id===id;}); if(!oy) return;
    if(!aile[oy.aile]) aile[oy.aile]={altin:0,gun:0};
    aile[oy.aile].altin+=oyunT[id].altin; aile[oy.aile].gun+=oyunT[id].gun;
  });
  var aileH=Object.keys(aile).sort(function(a,b){
    return (aile[b].altin/Math.max(1,aile[b].gun))-(aile[a].altin/Math.max(1,aile[a].gun));
  }).map(function(a){
    var o=(aile[a].altin/Math.max(1,aile[a].gun));
    return '<div class="ist-satir"><span>'+(AILE_AD[a]||a)+'</span><span class="ist-bar"><i style="width:'+Math.round(o/3*100)+'%"></i></span><span>'+o.toFixed(1)+'</span></div>';
  }).join('');
  $('#istatIcerik').innerHTML=
    '<h3>Kervan defteri</h3>'+
    '<div class="ist-kutular">'+
      '<div class="ist-kutu"><b>'+toplamAltin+'</b><span>toplam altın</span></div>'+
      '<div class="ist-kutu"><b>'+sb.n+'</b><span>varılan konak</span></div>'+
      '<div class="ist-kutu"><b>'+kazanilan+'/'+oynanan+'</b><span>kazanılan gün</span></div>'+
      '<div class="ist-kutu"><b>'+bereketli+'</b><span>bereketli gün</span></div>'+
      '<div class="ist-kutu"><b>'+(s.enUzun||0)+'</b><span>en uzun yol</span></div>'+
      '<div class="ist-kutu"><b>'+sb.sefer+'</b><span>sefer</span></div>'+
    '</div>'+
    (aileH?('<div class="ist-baslik">tezgah başına ortalama altın</div>'+aileH):'');
  modalAc(p);
}

/* ============================================================
   TANITIM
   ============================================================ */
var SLAYT=[
  { a:'<svg viewBox="0 0 64 64"><path d="M8 46 C8 30 20 20 32 20 C44 20 56 30 56 46 L52 46 C52 33 43 24 32 24 C21 24 12 33 12 46 Z" class="slayt-kemer"/><rect x="6" y="46" width="52" height="4" rx="2" class="slayt-kemer"/></svg>',
    bas:'Kervansaray', p:['Her gün kervan bir <b>konakta</b> durur.','Handa <b>4 tezgah</b> açıktır; her biri başka bir alandan.','Sevdiğin tezgaha uğra, gerisini atla.'] },
  { a:'<svg viewBox="0 0 64 64">'+skIkon(-14,4,.62,.66)+skIkon(12,4,.62,.33)+skIkon(38,4,.62,0)+'</svg>',
    bas:'Altın', p:['Her tezgahta <b>3 altın</b> kazanılabilir.','Doğru cevaplar keseyi <b>azar azar doldurur</b>.','Günde <b>6 altın</b> = yol parası çıktı, günü kazandın. Kese <b>12</b>\'ye kadar dolar.'] },
  { a:'<svg viewBox="0 0 64 64"><path d="'+DAMLA+'" class="su-dolu" transform="translate(-14,6) scale(.6)"/><path d="'+DAMLA+'" class="su-dolu" transform="translate(12,6) scale(.6)"/><path d="'+DAMLA+'" class="su-bos" transform="translate(38,6) scale(.6)"/></svg>',
    bas:'Su', p:['Çoğu tezgahta <b>3 su</b> ile başlarsın.','Her yanlış bir su döker.','Su biterse tezgah kapanır · <span class="k">kazandığın altın kesende kalır.</span>'] },
  { a:'<svg viewBox="0 0 64 64"><text x="32" y="42" text-anchor="middle" font-size="34">⏳</text></svg>',
    bas:'Pazarlık', p:['Bazı tezgahlar <b>pazarlıktır</b>: su yok.','Ne kadar <b>erken</b> bilirsen o kadar çok altın.','Geciktikçe altın düşer; acele et.'] },
  { a:'<svg viewBox="0 0 64 64"><circle cx="12" cy="32" r="4" class="slayt-nokta-dolu"/><circle cx="32" cy="32" r="4" class="slayt-nokta-dolu"/><circle cx="52" cy="32" r="4" class="slayt-nokta-bos"/><rect x="14" y="30.5" width="16" height="3" class="slayt-nokta-dolu"/><rect x="34" y="30.5" width="16" height="3" class="slayt-nokta-bos"/></svg>',
    bas:'Sefer', p:['Kazandığın her gün kervan <b>gerçek bir Selçuklu kervansarayına</b> varır.','Rota Akşehir\'den Kayseri\'ye tarihi <b>Uzun Yol</b>.','Yol bitince kervan <b>dönüş seferine</b> çıkar.'] }
];
function skIkon(x,y,s,kesir){ var id='ssk'+(++_uid),yy=64*(1-kesir);
  return '<defs><clipPath id="'+id+'"><rect x="0" y="'+(y+yy*s).toFixed(1)+'" width="64" height="64"/></clipPath></defs>'+
  '<circle cx="'+(x+32*s+16)+'" cy="'+(y+32*s)+'" r="'+(26*s)+'" class="sikke-bos"/>'+
  (kesir>0?'<circle cx="'+(x+32*s+16)+'" cy="'+(y+32*s)+'" r="'+(26*s)+'" class="sikke-dolu" clip-path="url(#'+id+')"/>':''); }
var slaytNo=0;
function slaytCiz(){ var s=SLAYT[slaytNo];
  $('#slaytAkis').innerHTML='<div class="slayt"><div class="slayt-amblem">'+s.a+'</div><h3>'+s.bas+'</h3>'+s.p.map(function(x){return '<p>'+x+'</p>';}).join('')+'</div>';
  $('#slaytNokta').innerHTML=SLAYT.map(function(_,i){ return '<i class="'+(i===slaytNo?'aktif':'')+'"></i>'; }).join('');
  $('#slaytGeri').hidden=slaytNo===0; $('#slaytIleri').textContent=slaytNo===SLAYT.length-1?'yola çıkalım':'ileri';
}
function girisAc(){ slaytNo=0; slaytCiz(); modalAc($('#girisPerde')); }
function girisKapat(){ modalKapat($('#girisPerde')); try{ localStorage.setItem('kervansaray:giris','1'); }catch(e){} }

/* ============================================================
   MODAL + TOAST + TEMA + GÜN DEĞİŞİMİ
   ============================================================ */
var _modalOnceki=null;
function modalAc(perde){
  if(!perde) return;
  perde.hidden=false;
  _modalOnceki=document.activeElement;
  var oda=perde.querySelector('button,[href],input'); if(oda) oda.focus();
}
function modalKapat(perde){
  if(!perde) return;
  perde.hidden=true;
  if(_modalOnceki&&_modalOnceki.focus){ try{ _modalOnceki.focus(); }catch(e){} }
}
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape') return;
  ['#hanPerde','#istatPerde','#kazanPerde','#girisPerde'].forEach(function(s){
    var p=$(s); if(p&&!p.hidden) modalKapat(p);
  });
});
function toast(m,snf){ var t=$('#toast'); if(!t)return; t.textContent=m; t.className='goster'+(snf?' '+snf:''); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.className=''; },2300); }
function temaUygula(t){
  document.documentElement.dataset.tema=t;
  var b=$('#temaBtn'); if(b) b.textContent=t==='gece'?'gündüz':'gece';
  try{ localStorage.setItem('kervansaray:tema',t); }catch(e){}
  Object.keys(cerceveler).forEach(function(id){
    try{ cerceveler[id].contentWindow.postMessage({tip:'tema',tema:t}, location.origin); }catch(e){}
  });
}
function gunKontrol(){
  if(_arsiv||_ephemeral) return;
  if(document.hidden) return;
  if(metaGun()===GUN) return;
  if($('#oyunEkran').hidden){ location.reload(); return; }
  var e=$('#gunDegisti'); if(e){ e.hidden=false; }
}

/* === debug: rastgele gün (yalnız admin) === */
function rastgeleGun(){
  _ephemeral=true;
  GUN=Math.floor(Math.random()*100000);
  DURUM={gun:GUN,oyunlar:{},kazandi:false}; _sonDeger={};
  Object.keys(cerceveler).forEach(function(id){ try{ cerceveler[id].remove(); }catch(e){} delete cerceveler[id]; });
  PLAN=gununSecki(GUN);
  var t=$('#tarih'); if(t) t.textContent='🎲 rastgele gün #'+GUN+' · debug';
  var kp=$('#kazanPerde'); if(kp) kp.hidden=true;
  kartlarCiz(); window.scrollTo(0,0);
}

/* ============================================================
   BAŞLAT
   ============================================================ */
function baslat(){
  goc();
  var q=new URLSearchParams(location.search);
  if(q.has('sifirla')){
    try{ localStorage.removeItem('kervansaray:g'+metaGun()); }catch(e){}
    q.delete('sifirla'); history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:''));
  }
  if(q.has('gun')){
    var g=parseInt(q.get('gun'),10);
    if(isFinite(g)&&g>=0&&g<metaGun()){ _arsiv=true; GUN=g; }
  }
  if(!_arsiv) GUN=metaGun();
  if(GUN<0) GUN=0;
  DURUM=durumYukle(); PLAN=gununSecki(GUN);
  temaUygula(localStorage.getItem('kervansaray:tema')||'gunduz');
  tarihYaz(); kartlarCiz();
  var ab=$('#arsivBanner'); if(ab) ab.hidden=!_arsiv;
  $('#geriBtn').onclick=oyunKapat;
  $('#nasilBtn').onclick=girisAc;
  $('#istatBtn').onclick=istatistikAc;
  $('#payBtn').onclick=paylas;
  $('#temaBtn').onclick=function(){ temaUygula(document.documentElement.dataset.tema==='gece'?'gunduz':'gece'); };
  $('#girisKapat').onclick=girisKapat; $('#slaytAtla').onclick=girisKapat;
  $('#slaytGeri').onclick=function(){ if(slaytNo>0){slaytNo--;slaytCiz();} };
  $('#slaytIleri').onclick=function(){ if(slaytNo<SLAYT.length-1){slaytNo++;slaytCiz();} else girisKapat(); };
  ['#girisPerde','#kazanPerde','#istatPerde','#hanPerde'].forEach(function(s){
    var p=$(s); if(p) p.addEventListener('click',function(e){ if(e.target===p) modalKapat(p); });
  });
  ['#istatKapat','#hanKapat'].forEach(function(s){
    var b=$(s); if(b) b.onclick=function(){ modalKapat(b.closest('.modal-perde')); };
  });
  var gd=$('#gunDegistiBtn'); if(gd) gd.onclick=function(){ location.reload(); };
  document.addEventListener('visibilitychange',gunKontrol);
  window.addEventListener('focus',gunKontrol);
  if(!localStorage.getItem('kervansaray:giris')) girisAc();
  /* SW yalnız canlıda: localhost'ta cache geliştirme akışını bozar */
  if('serviceWorker' in navigator && location.hostname!=='localhost' && location.hostname!=='127.0.0.1'){
    try{ navigator.serviceWorker.register('sw.js'); }catch(e){}
  }
}

/* === gömülecek oyunlar === */
kayit({ id:'kur', ad:'Kur', aile:'eslestirme', mod:'sayac', esik:[3,5,8], len:400,
  alt:'8 kuş, 8 ad · benzerler kandırır',
  gunlukIndex:function(){ return utcGun()%400; },
  src:function(i){ return '../kur/?meta=1&bulmaca='+i; } });
kayit({ id:'dortsuru', ad:'Dört Sürü', aile:'obek', mod:'sayac', esik:[2,3,4], len:400,
  alt:'16 kuş, 4 gizli öbek',
  gunlukIndex:function(){ return utcGun()%400; },
  src:function(i){ return '../dort-suru/?meta=1&bulmaca='+i; } });
kayit({ id:'asi', ad:'Aşı', aile:'eslestirme', mod:'sayac', esik:[3,5,8], len:400,
  alt:'8 bitki, 8 ad · benzeşenler kandırır',
  gunlukIndex:function(){ return utcGun()%400; },
  src:function(i){ return '../asi/?meta=1&bulmaca='+i; } });
kayit({ id:'dortdemet', ad:'Dört Demet', aile:'obek', mod:'sayac', esik:[2,3,4], len:400,
  alt:'16 bitki, 4 gizli öbek',
  gunlukIndex:function(){ return utcGun()%400; },
  src:function(i){ return '../dort-demet/?meta=1&bulmaca='+i; } });
kayit({ id:'jenerik', ad:'Jenerik', aile:'film', mod:'sayac', len:359,
  esik:function(m){ var b=Math.min(m,12); return [Math.max(1,Math.round(b*0.3)), Math.max(2,Math.round(b*0.55)), Math.max(3,Math.min(m,Math.round(b*0.8)))]; },
  alt:'bu oyuncunun kaç filmini bilirsin?',
  gunlukIndex:function(){ var d=Math.floor((Date.now()-new Date('2026-07-06T00:00:00'))/864e5); return ((d%359)+359)%359; },
  src:function(i){ return '../karanlik-oda/jenerik.html?meta=1&bulmaca='+i; } });
kayit({ id:'karanlikoda', ad:'Karanlık Oda', aile:'film', mod:'hiz', len:1310,
  alt:'bulanık kareden filmi bul',
  gunlukIndex:function(){ var d=Math.floor((Date.now()-new Date('2026-07-02T00:00:00'))/864e5); return ((d%1310)+1310)%1310; },
  src:function(i){ return '../karanlik-oda/?meta=1&bulmaca='+i; } });
kayit({ id:'montaj', ad:'Montaj', aile:'film', mod:'sayac', esik:[2,3,4], len:180,
  alt:'12 kare, 4 gizli film',
  gunlukIndex:function(){ var g=Math.max(0,Math.floor((Date.now()-new Date(2026,6,14))/864e5)); return g%180; },
  src:function(i){ return '../montaj/?meta=1&bulmaca='+i; } });
kayit({ id:'atlas', ad:'Atlas', aile:'cografya', mod:'sayac', esik:[3,6,9], len:160,
  alt:'3×3 ızgara · satır × sütun ölçütü',
  gunlukIndex:function(){ var n=new Date(); return Math.floor((Date.UTC(n.getFullYear(),n.getMonth(),n.getDate())-Date.parse('2026-01-01T00:00:00'))/864e5); },
  src:function(i){ return '../atlas/?meta=1&bulmaca='+i; } });
kayit({ id:'sancak', ad:'Sancak', aile:'cografya', mod:'hiz', len:119,
  alt:'bulanık bayrak · ne kadar erken bilirsen',
  gunlukIndex:function(){ return Math.floor((new Date()-new Date(2026,6,6))/864e5); },
  src:function(i){ return '../sancak/?meta=1&bulmaca='+i; } });
kayit({ id:'cati', ad:'Çatı', aile:'kelime', mod:'sayac', len:150,
  alt:'5 kelime + gizli tema',
  gunlukIndex:function(){ var g=Math.floor((Date.now()-new Date(2026,0,1))/864e5); return ((g-184)%150+150)%150; },
  src:function(i){ return '../cati/?meta=1&bulmaca='+i; } });
kayit({ id:'muzayede', ad:'Muzayede', aile:'sanat', mod:'sayac', len:600,
  esik:function(t){ return [Math.max(1,Math.round(.35*t)), Math.max(2,Math.round(.60*t)), Math.max(3,Math.round(.85*t))]; },
  alt:'günün tablosu: fiyatı çek, ressamı bul',
  gunlukIndex:function(){ var n=new Date(); var g=Math.floor((Date.UTC(n.getFullYear(),n.getMonth(),n.getDate())-Date.parse('2026-07-21T00:00:00'))/864e5); return ((g%600)+600)%600; },
  src:function(i){ return '../muzayede/?meta=1&bulmaca='+i; } });
kayit({ id:'cehre', ad:'Çehre', aile:'yuz', mod:'hiz', len:347,
  alt:'sansürlü yüzden günün ünlüsü',
  gunlukIndex:function(){ var g=Math.floor((Date.now()-new Date('2026-07-21T00:00:00'))/864e5); return ((g%347)+347)%347; },
  src:function(i){ return '../cehre/?meta=1&bulmaca='+i; } });

window.KERVANSARAY={ kayit:kayit, baslat:baslat, toast:toast,
  gun:function(){ return GUN; }, toplam:function(){ return gunToplam(); },
  sefer:seferBilgi, rastgeleGun:rastgeleGun };
})();
