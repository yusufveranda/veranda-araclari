// nav-panel.js: site içi gezinme, soldan açılan panel, tüm araçlar + tüm oyunlar listeli.
// Tek satır <script> ile her sayfaya eklenir, kendi CSS'ini ve DOM'unu enjekte eder.
// Oyun sayfalarında (window.VF varsa) girişliyken her oyunun yanında "bugün oynadın mı" ✓'ü gösterir.
(function(){
  const derin = location.pathname !== '/' && location.pathname !== '/index.html';
  const B = derin ? '../' : '';

  const ARACLAR = [
    {ad:'Dilimin Ucunda', href:B+'sozluk/'},
    {ad:'Karşılık',       href:B+'karsilik/'},
    {ad:'Güverte',        href:B+'harita/'},
    {ad:'Bulmaca Yardımcısı', href:B+'bulmaca/'},
    {ad:'Siyaset Bilimi', href:B+'politika/'},
    {ad:'Bitki Bilimi',   href:B+'bitki/'},
    {ad:'Kuş Bilimi',     href:B+'kus/'},
    {ad:'Veranda Band',   href:B+'nota/'},
    {ad:'Bitmeyen Şiir',  href:B+'siir-defteri/'},
    {ad:'Akrostiş',       href:B+'akrostis/'}
  ];

  const OYUNLAR = [
    {ad:'Harfiyat',     href:B+'wordle/?oyun=harfiyat', oyun:'harfiyat', gun:function(){ return g2026(); }},
    {ad:'Taraça',       href:B+'wordle/?oyun=taraca',   oyun:'taraca',   gun:function(){ return g2026(); }},
    {ad:'Avlu',         href:B+'wordle/?oyun=avlu',     oyun:'avlu',     gun:function(){ return g2026(); }},
    {ad:'Aralık',       href:B+'wordle/?oyun=aralik',   oyun:'aralik',   gun:function(){ return g2026(); }},
    {ad:'Çatı',         href:B+'cati/',                 oyun:'cati',     gun:function(){ return g2026(); }},
    {ad:'Şömine',       href:B+'sicaksoguk/',           oyun:'sicak',    gun:function(){ return g2026utc(); }},
    {ad:'Parsel',       href:B+'pedantle/',             oyun:'pedantle', gun:function(){ return g2026utc(); }},
    {ad:'Atlas',        href:B+'atlas/',                oyun:'atlas',    gun:function(){ return gAtlas()*2; }},
    {ad:'Sancak',       href:B+'sancak/',               oyun:'sancak',   gun:function(){ return Math.floor((new Date()-new Date(2026,6,6))/86400000); }},
    {ad:'Karanlık Oda', href:B+'karanlik-oda/',         oyun:null},
    {ad:'Jenerik',      href:B+'karanlik-oda/jenerik.html', oyun:null},
    {ad:'Dört Sürü',    href:B+'dort-suru/',            oyun:'dortsuru', gun:function(){ return Math.floor(Date.now()/864e5)%400; }},
    {ad:'Kur',          href:B+'kur/',                  oyun:'kur',      gun:function(){ return Math.floor(Date.now()/864e5)%400; }},
    {ad:'Dört Demet',   href:B+'dort-demet/',           oyun:'dortdemet',gun:function(){ return Math.floor(Date.now()/864e5)%400; }},
    {ad:'Aşı',          href:B+'asi/',                  oyun:'asi',      gun:function(){ return Math.floor(Date.now()/864e5)%400; }},
    {ad:'Kervansaray',  href:B+'kervansaray/',          oyun:'kervansaray', gun:function(){ const n=new Date(); return Math.floor((Date.UTC(n.getFullYear(),n.getMonth(),n.getDate())-Date.UTC(2026,6,6))/86400000); }},
    {ad:'Muzayede',     href:B+'muzayede/',             oyun:null}
  ];

  function g2026(){ return Math.floor((Date.now()-new Date(2026,0,1))/86400000); }
  function g2026utc(){ const n=new Date(); return Math.floor((Date.UTC(n.getFullYear(),n.getMonth(),n.getDate())-Date.UTC(2026,0,1))/86400000); }
  function gAtlas(){
    const n=new Date(); const bugun=Date.UTC(n.getFullYear(),n.getMonth(),n.getDate());
    const ep = (window.ATLAS_BULMACA && ATLAS_BULMACA.epoch) ? Date.parse(ATLAS_BULMACA.epoch+'T00:00:00') : Date.parse('2026-01-01T00:00:00');
    return Math.floor((bugun-ep)/86400000);
  }

  const st = document.createElement('style');
  st.textContent = `
    #vfNavAc{position:fixed;top:76px;left:18px;z-index:9990;width:48px;height:48px;border-radius:50%;
      background:#1C1510;color:#F2E6CE;border:1px solid #3a2f22;font-size:20px;cursor:pointer;
      box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center}
    #vfNavAc:hover{background:#2b2117}
    /* mobilde oyunların ekran altına sabit klavyesiyle çakışıyordu, mobilde panele
       zaten gerek yok, düğmeyi tamamen gizle */
    @media(max-width:640px){
      #vfNavAc{display:none}
    }
    #vfNavPerde{position:fixed;inset:0;background:rgba(10,8,5,.5);z-index:9991;opacity:0;pointer-events:none;transition:opacity .25s}
    #vfNavPerde.acik{opacity:1;pointer-events:auto}
    #vfNavPanel{position:fixed;top:0;left:0;bottom:0;width:min(84vw,330px);background:#1C1510;color:#F2E6CE;
      z-index:9992;transform:translateX(-100%);transition:transform .28s cubic-bezier(.34,1,.45,1);
      overflow-y:auto;font-family:Georgia,'Times New Roman',serif;box-shadow:6px 0 24px rgba(0,0,0,.35)}
    #vfNavPanel.acik{transform:translateX(0)}
    #vfNavPanel .vfnp-ust{display:flex;justify-content:space-between;align-items:center;padding:18px 18px 10px}
    #vfNavPanel .vfnp-ust b{font-family:'Playfair Display',serif;font-size:20px;color:#F2E6CE}
    #vfNavPanel .vfnp-kapat{background:none;border:none;color:#a6977a;font-size:20px;cursor:pointer;padding:4px 8px}
    #vfNavPanel h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#a6977a;
      margin:18px 18px 6px;font-family:Georgia,serif}
    #vfNavPanel ul{list-style:none;margin:0;padding:0}
    #vfNavPanel li a{display:flex;justify-content:space-between;align-items:center;gap:8px;
      padding:9px 18px;color:#F2E6CE;text-decoration:none;font-size:15px;border-top:1px solid #2b2117}
    #vfNavPanel li a:hover{background:#241c14}
    #vfNavPanel .tik{font-size:12.5px;color:#7fae8e;flex:none}
    #vfNavPanel .anasayfa{padding:0 18px 8px}
    #vfNavPanel .anasayfa a{color:#c8a878;font-size:13.5px;text-decoration:underline}
  `;
  document.head.appendChild(st);

  const ac = document.createElement('button');
  ac.id='vfNavAc'; ac.type='button'; ac.title='tüm araçlar ve oyunlar'; ac.textContent='☰';
  const perde = document.createElement('div'); perde.id='vfNavPerde';
  const panel = document.createElement('div'); panel.id='vfNavPanel';

  function liHTML(o){
    return '<li><a href="'+o.href+'">'+o.ad+(o.oyun?' <span class="tik" data-oyun="'+o.oyun+'"></span>':'')+'</a></li>';
  }

  panel.innerHTML =
    '<div class="vfnp-ust"><b>veranda</b><button class="vfnp-kapat" type="button" aria-label="kapat">✕</button></div>'+
    '<div class="anasayfa"><a href="'+B+'">‹ ana sayfa</a> · <a href="'+B+'oyunlar/">Lunapark</a></div>'+
    '<h3>Oyunlar</h3><ul>'+OYUNLAR.map(liHTML).join('')+'</ul>'+
    '<h3>Araçlar</h3><ul>'+ARACLAR.map(liHTML).join('')+'</ul>';

  document.body.appendChild(perde);
  document.body.appendChild(panel);
  document.body.appendChild(ac);

  function ac_(){ perde.classList.add('acik'); panel.classList.add('acik'); }
  function kapa(){ perde.classList.remove('acik'); panel.classList.remove('acik'); }
  ac.onclick = ac_;
  perde.onclick = kapa;
  panel.querySelector('.vfnp-kapat').onclick = kapa;

  /* girişliyse her oyunun yanına bugün oynadın mı ✓'ü koy, sadece bu sayfa zaten
     firebase.js yüklediyse (window.VF) çalışır, araç sayfalarında sessizce atlanır.
     Aynı taramada bugün bitirilen oyun sayısı da toplanır: 3'e ulaşınca streak günü
     sayılır (VF.streakGuncelle); eşik burada kontrol ediliyor çünkü zaten her oyun
     için "bugün oynadın mı" sorgusu bu fonksiyonda tek tek yapılıyor. */
  function tikleriDoldur(){
    if(!window.VF || !VF.kullanici) return;
    const u = VF.kullanici;
    const sorgular = OYUNLAR.filter(function(o){ return !!o.oyun; }).map(function(o){
      const gun = o.gun();
      return firebase.firestore().collection('skorlar').doc(o.oyun).collection(String(gun)).doc(u.uid).get().then(function(snap){
        const el = panel.querySelector('.tik[data-oyun="'+o.oyun+'"]');
        const bitti = snap.exists;
        if(el && bitti) el.textContent = '✓';
        return bitti;
      }).catch(function(){ return false; });
    });
    Promise.all(sorgular).then(function(sonuclar){
      const bugunSayisi = sonuclar.filter(Boolean).length;
      if(bugunSayisi >= 3) VF.streakGuncelle(g2026utc());
    });
  }
  if(window.VF) VF.kullaniciDinle(tikleriDoldur); else document.addEventListener('DOMContentLoaded', function(){ if(window.VF) VF.kullaniciDinle(tikleriDoldur); });
})();
