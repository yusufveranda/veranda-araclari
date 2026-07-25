/* ===================== Veranda Oyunlar — ortak Firebase katmanı ===================== */
/* Kullanım: sayfaya sırayla şu <script> etiketlerini ekle (bu dosyadan önce):
     <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
     <script src="../ortak/firebase.js"></script>
   Sonra window.VF üzerinden kullan: VF.girisYap(), VF.kullaniciDinle(cb), VF.skorYaz(...), vb. */
(function(){
  const firebaseConfig = {
    apiKey: "AIzaSyDJmpIrOYS4XOr2P3HNyHeTpukhpoW3pAE",
    authDomain: "veranda-oyunlar.firebaseapp.com",
    projectId: "veranda-oyunlar",
    storageBucket: "veranda-oyunlar.firebasestorage.app",
    messagingSenderId: "930330517511",
    appId: "1:930330517511:web:21d9c43053798a0b964aa2"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const provider = new firebase.auth.GoogleAuthProvider();

  let kullaniciAdi = null;
  let kullaniciStreak = 0;   // günde ≥3 farklı oyun bitirilince artan üst üste gün sayısı
  /* skorYaz, kullaniciAdi Firestore'dan yüklenmeden (ilk auth çözümü tamamlanmadan) asla
     yazmasın diye — auth.currentUser hemen (yerel önbellekten) dolarken kullaniciAdi'nin
     kendisi ayrı bir Firestore okumasıyla geliyor; sayfa yeni açılıp oyun zaten bitmiş
     durumda hemen skorYaz çağrılırsa bu ikisi arasında yarış oluşup ad:null yazılabiliyordu
     (create-only kural yüzünden sonra düzeltilemiyor). */
  let ilkAuthCozuldu = false, ilkAuthCozulduResolve;
  const kullaniciHazir = new Promise(res=>{ ilkAuthCozulduResolve=res; });
  function authHazirIsaretle(){ if(!ilkAuthCozuldu){ ilkAuthCozuldu=true; ilkAuthCozulduResolve(); } }

  /* gizli tuş/URL-parametresi yerine gerçek yetki kontrolü — sadece bu uid'e admin-only
     özellikler (önizleme seçicisi, rastgele-gün debug modu vb.) gösterilir. */
  const ADMIN_UID = 'YSDnv5FlXHUZhbZpT17vs6WVg3f2';

  /* ikinci kişiye giriş gerektirmeden aynı erişimi vermek için: ?vip=TOKEN ile açılan
     link bu tarayıcıda kalıcı bir localStorage bayrağı bırakır, adminMi bunu da sayar.
     Token sızarsa buradaki string'i değiştirip yeniden deploy etmek gerekir (eski link ölür). */
  const VIP_TOKEN = 'NsFO49CTs4KlD5Cf4nSp0cw5';
  try{
    if(new URLSearchParams(location.search).get('vip') === VIP_TOKEN) localStorage.setItem('vfVip','1');
  }catch(e){}

  /* signInWithRedirect DEĞİL: Chrome tarayıcı hesabına girişliyken üçüncü taraf depolama
     bölümlemesi redirect akışının başlamasını sessizce engelliyor (bilinen Firebase/Chrome
     sorunu, SDK sürümünden bağımsız — authDomain firebaseapp.com kaldığı sürece geçerli).
     Popup bu sorunu atlıyor; ilk denemedeki "hemen kapanma" asıl domain yetkisiz olduğu
     içindi (o zaman düzeltildi), COOP uyarısı zararsız görünüyor. */
  function girisYap(){
    const u = auth.currentUser;
    /* anonim (nick'li) oturum Google'a BAĞLANIR, yeni hesap açılmaz — uid ve o uid'e
       yazılmış skorlar aynen kalır. Google hesabı zaten başka bir uid'e bağlıysa link
       reddedilir → o hesaba normal giriş yapılır (anonim skorlar eski uid'de kalır). */
    if(u && u.isAnonymous){
      return u.linkWithPopup(provider)
        .then(r=>{ location.reload(); return r; })   // onAuthStateChanged link'te tetiklenmez → temiz durum için tazele
        .catch(e=>{
          if(e.code==='auth/credential-already-in-use') return auth.signInWithCredential(e.credential);
          throw e;
        });
    }
    return auth.signInWithPopup(provider);
  }
  function cikisYap(){ return auth.signOut(); }

  /* Girişsiz (nick'li) oyuncu skor gönderirken çağrılır: kalıcı anonim Firebase oturumu
     açar (uid bu tarayıcıda kalıcı), görünen ad = nick. Böylece create-only günlük kilit
     ve rules (auth != null) Google'sız da çalışır; skorlar tek depoda (Firestore) birikir.
     Konsolda Anonymous sağlayıcısı kapalıysa auth/admin-restricted-operation ile reddeder —
     çağıran taraf eski Sheets yoluna düşmeli. Zaten girişliyse (Google ya da anonim) no-op. */
  let bekleyenAd = null, bekleyenAdResolve = null;
  function anonimGiris(ad){
    ad = (ad||'').trim().slice(0,16);
    if(!ad) return Promise.reject(new Error('ad gerekli'));
    if(auth.currentUser) return Promise.resolve();
    bekleyenAd = ad;
    const adHazir = new Promise(res=>{ bekleyenAdResolve = res; });
    return auth.signInAnonymously().then(()=>adHazir);   // kullaniciDinle ad'ı yazınca çözülür
  }

  const esc = s=>String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ilk girişte gerçek Google adını hiç göstermeden takma ad sorar.
     Bu tarayıcıda daha önce (Firebase'den ÖNCEKİ localStorage nick sisteminde) oynadıysa,
     o nick zaten orada duruyor — soru sormadan direkt onu kullanırız (yazım hatası/uyumsuzluk
     olmasın, göç kesin tutsun diye kullanıcı bunu değiştiremez; istersen sonra "adını değiştir"
     ile elle güncelleyebilirsin). */
  function adSor(){
    const eskiNick = (localStorage.getItem('harfiyat:nick')||localStorage.getItem('vt_nick')||'').trim();
    return new Promise((resolve)=>{
      const kapak=document.createElement('div');
      kapak.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
      if(eskiNick){
        kapak.innerHTML =
          '<div style="background:var(--card,#1f1912);color:var(--ink,#efe3c6);padding:26px;border-radius:14px;'+
          'max-width:340px;width:100%;font-family:Georgia,serif;box-shadow:0 20px 60px rgba(0,0,0,.5)">'+
            '<div style="font-size:16px;margin-bottom:4px;font-weight:600">Görünen adın</div>'+
            '<div style="font-size:13px;color:var(--muted,#a6977a);margin-bottom:14px">Bu tarayıcıda daha önce <b style="color:var(--ink,#efe3c6)">'+esc(eskiNick)+'</b> adıyla oynamışsın — geçmiş skorların kaybolmasın diye bu adı kullanıyoruz.</div>'+
            '<button id="vfAdTamam" style="padding:10px 20px;border-radius:8px;border:none;'+
            'background:var(--acc,#4fa08c);color:#fff;font-size:14px;cursor:pointer">tamam</button>'+
          '</div>';
        document.body.appendChild(kapak);
        kapak.querySelector('#vfAdTamam').onclick = ()=>{ document.body.removeChild(kapak); resolve(eskiNick.slice(0,16)); };
        return;
      }
      kapak.innerHTML =
        '<div style="background:var(--card,#1f1912);color:var(--ink,#efe3c6);padding:26px;border-radius:14px;'+
        'max-width:340px;width:100%;font-family:Georgia,serif;box-shadow:0 20px 60px rgba(0,0,0,.5)">'+
          '<div style="font-size:16px;margin-bottom:4px;font-weight:600">Görünen adın ne olsun?</div>'+
          '<div style="font-size:13px;color:var(--muted,#a6977a);margin-bottom:14px">Leaderboard\'da bu görünecek — gerçek adın hiçbir yerde gösterilmiyor.</div>'+
          '<input id="vfAdGir" maxlength="16" placeholder="takma adın" style="width:100%;padding:10px 12px;'+
          'border-radius:8px;border:1px solid var(--line,#3a2f22);background:var(--bg,#15110d);color:var(--ink,#efe3c6);font-size:15px;box-sizing:border-box">'+
          '<button id="vfAdTamam" style="margin-top:14px;padding:10px 20px;border-radius:8px;border:none;'+
          'background:var(--acc,#4fa08c);color:#fff;font-size:14px;cursor:pointer">tamam</button>'+
        '</div>';
      document.body.appendChild(kapak);
      const inp = kapak.querySelector('#vfAdGir');
      setTimeout(()=>inp.focus(),50);
      function bitir(){
        const v = inp.value.trim().slice(0,16) || 'isimsiz';
        document.body.removeChild(kapak);
        resolve(v);
      }
      kapak.querySelector('#vfAdTamam').onclick = bitir;
      inp.addEventListener('keydown', e=>{ if(e.key==='Enter') bitir(); });
    });
  }

  /* cb(null) → çıkış yapılmış; cb({uid, ad}) → giriş yapılmış */
  function kullaniciDinle(cb){
    auth.onAuthStateChanged(async (u)=>{
      if(!u){ kullaniciAdi=null; authHazirIsaretle(); cb(null); return; }
      try{
        const ref = db.collection('kullanicilar').doc(u.uid);
        const snap = await ref.get();
        if(!snap.exists){
          const ad = bekleyenAd || await adSor();   // anonimGiris nick'i verdiyse sorma
          await ref.set({ad, olusturulma: firebase.firestore.FieldValue.serverTimestamp()});
          kullaniciAdi = ad;
          kullaniciStreak = 0;
        } else {
          kullaniciAdi = snap.data().ad;
          kullaniciStreak = snap.data().streak || 0;
        }
        if(bekleyenAdResolve){ bekleyenAdResolve(); bekleyenAdResolve=null; bekleyenAd=null; }
        authHazirIsaretle();
        cb({uid:u.uid, ad:kullaniciAdi});
      }catch(e){ console.error('VF kullanici hata', e); authHazirIsaretle(); cb(null); }
    });
  }

  function adDegistir(yeniAd){
    const u = auth.currentUser; if(!u) return Promise.resolve();
    yeniAd = (yeniAd||'').trim().slice(0,16) || 'isimsiz';
    kullaniciAdi = yeniAd;
    return db.collection('kullanicilar').doc(u.uid).set({ad:yeniAd}, {merge:true})
      .then(()=>gocKontrolEt());   // adını değiştirdiyse, yeni adla da bir kez daha eski veriyi dener
  }

  /* günün skorunu yaz — create-only, bir gün/bir kullanıcı tek satır (doküman ID = uid).
     streak, skorYaz anındaki bilinen değer (yazma anında) — leaderboard satırlarında ayrı
     okuma yapmadan 🔥 rozeti göstermek için gömülü tutulur, aynı gün içindeki 3. oyunun
     streak'i artırması bir sonraki skorYaz çağrısına yansır (bkz. streakGuncelle). */
  function skorYaz(oyun, gun, veri){
    if(!auth.currentUser) return Promise.resolve();
    return kullaniciHazir.then(()=>{
      const u = auth.currentUser; if(!u) return;   // bu arada çıkış yapıldıysa yazma
      const ref = db.collection('skorlar').doc(oyun).collection(String(gun)).doc(u.uid);
      return ref.set(Object.assign({ad:kullaniciAdi, streak:kullaniciStreak}, veri, {zaman: firebase.firestore.FieldValue.serverTimestamp()}));
    });
  }

  /* günde ≥3 farklı oyun bitirilince çağrılır (bkz. ortak/nav-panel.js tikleriDoldur).
     bugunGun: takvim gününü tekilleştiren herhangi bir sayı (oyundan bağımsız, aynı gün
     hep aynı değeri üretmeli — nav-panel.js'teki g2026utc() kullanılıyor). Aynı gün
     tekrar çağrılırsa no-op (idempotent); dünden bugüne art arda geldiyse +1, aradan
     gün atlandıysa 1'e sıfırlanır. */
  function streakGuncelle(bugunGun){
    if(!auth.currentUser) return Promise.resolve();
    const u = auth.currentUser;
    const ref = db.collection('kullanicilar').doc(u.uid);
    return ref.get().then(snap=>{
      const veri = snap.exists ? snap.data() : {};
      const oncekiGun = veri.streakGun;
      if(oncekiGun === bugunGun) return;   // bugün zaten sayıldı
      const oncekiStreak = veri.streak || 0;
      const yeni = (oncekiGun === bugunGun - 1) ? oncekiStreak + 1 : 1;
      kullaniciStreak = yeni;
      return ref.set({streak:yeni, streakGun:bugunGun}, {merge:true});
    }).catch(()=>{});
  }

  /* aynı GÜN içinde aynı görünen ada sahip birden çok uid (ör. bir kişinin Google +
     anonim/ikinci-cihaz hesabı) tek satıra iner — en iyi skor kalır (yüksek puan;
     eşitse az deneme). Eski nick sisteminin "bir gün/bir isim" kilidinin uid
     dünyasındaki karşılığı; haftalık toplamdaki çift sayımı da önler. */
  function gunTekille(arr){
    const k={};
    arr.forEach(r=>{
      const ad=(r.ad||'isimsiz').trim();
      const e=k[ad];
      if(!e || (r.puan||0)>(e.puan||0) || ((r.puan||0)===(e.puan||0) && (r.deneme||0)<(e.deneme||0))) k[ad]=r;
    });
    return Object.values(k);
  }
  function leaderboardOku(oyun, gun){
    return db.collection('skorlar').doc(oyun).collection(String(gun)).get()
      .then(qs=>{ const arr=[]; qs.forEach(d=>arr.push(d.data())); return gunTekille(arr); });
  }

  /* haftalık/aylık leaderboard — Firestore günleri listeleyemediği için verilen gün
     numaralarını (periyot başından bugüne) paralel okuyup kişi bazında (ad alanına göre)
     toplar. Dönen satır: {ad, puan, deneme (ikisi de periyot toplamı), oyunSayisi
     (kaç farklı günde oynamış)} — oyuna göre puan (yüksek iyi) ya da deneme (düşük iyi)
     kullanılır. */
  function leaderboardOkuAralik(oyun, gunListesi){
    return Promise.all(gunListesi.map(g=>leaderboardOku(oyun, g))).then(gunler=>{
      const kisi = {};
      gunler.forEach(gun=>gun.forEach(k=>{
        const ad = k.ad || 'isimsiz';
        if(!kisi[ad]) kisi[ad] = {ad, puan:0, deneme:0, oyunSayisi:0, streak:0};
        kisi[ad].puan += (k.puan||0);
        kisi[ad].deneme += (k.deneme||0);
        kisi[ad].oyunSayisi += 1;
        kisi[ad].streak = Math.max(kisi[ad].streak, k.streak||0);
      }));
      return Object.values(kisi);
    });
  }

  /* günlük deneme-dağılımı sayaçları — client-side transaction, Cloud Function/Blaze gerekmez.
     bucket: kazandıysa deneme sayısı (1..MAKS), kaybettiyse "X" */
  function istatistikArttir(oyun, gun, bucket){
    const ref = db.collection('istatistik').doc(oyun+'_'+gun);
    const b = String(bucket);
    return db.runTransaction(async (t)=>{
      const snap = await t.get(ref);
      if(!snap.exists){
        t.set(ref, {dagilim:{[b]:1}, toplamCozen:1});
      } else {
        const veri = snap.data();
        const dagilim = Object.assign({}, veri.dagilim||{});
        dagilim[b] = (dagilim[b]||0)+1;
        t.update(ref, {dagilim, toplamCozen:(veri.toplamCozen||0)+1});
      }
    }).catch(e=>console.error('VF istatistik hata', e));
  }

  function istatistikOku(oyun, gun){
    return db.collection('istatistik').doc(oyun+'_'+gun).get()
      .then(s=>s.exists?s.data():{dagilim:{},toplamCozen:0});
  }

  /* "bu kelime olmalı" bayrağı — Firestore'a (bayraklar/{oyun}_{kelime}) yazar,
     GİRİŞLİ OLMASA BİLE — tek bir bayrak deposu, iki ayrı yerde (Sheets+Firestore)
     bakmak zorunda kalınmasın. Aynı oyun+kelime tekrar bildirilirse sayaç +1
     (dedup, satır çoğalmaz). Rules'ta bu koleksiyon girişsiz create/update'e
     açık olmalı (bkz. LEADERBOARD-PLAN.md'deki güncellenmiş rules). */
  function bayrakYaz(oyun, kelime, gun){
    const k = String(kelime||'').trim().toLowerCase(); if(!k) return Promise.resolve({ok:false});
    const ref = db.collection('bayraklar').doc(oyun+'_'+k);
    return db.runTransaction(async (t)=>{
      const snap = await t.get(ref);
      if(!snap.exists) t.set(ref, {sayi:1, ilkGun: (gun!=null && gun!=='') ? gun : null});
      else t.update(ref, {sayi:(snap.data().sayi||0)+1});
    }).then(()=>({ok:true})).catch(e=>{ console.error('VF bayrak hata', e); return {ok:false}; });
  }

  /* ===================== eski Sheets verisinin göçü (yalnız verandle ailesi + Atlas) ===================== */
  /* canlı sorgu — bulk export YOK; kullanıcı nick yazdığı an Apps Script'e sorulur */
  const GOC_LB_URL = 'https://script.google.com/macros/s/AKfycbyVCs6SvfkJSOjunXd7HWnhDeNH7-M9udtLovpo7Wh_vdTTz9sc31ccdZ050IJdgqt2/exec';

  /* Kullanıcıya hiçbir şey sormaz — doğrudan o anki görünen adla (kullaniciAdi) canlı sorgu
     yapar; tutarsa sessizce aktarır. Bir kez başarıyla aktarılınca (gocmusOzet set olunca)
     bir daha denenmez; ama tutmazsa (ör. adı henüz eski nick'iyle eşleşmiyorsa) her girişte
     ve her ad değişikliğinde tekrar dener — adını sonradan eski nick'ine çevirirse de yakalar. */
  async function gocKontrolEt(){
    const u = auth.currentUser; if(!u) return;
    const ref = db.collection('kullanicilar').doc(u.uid);
    const snap = await ref.get();
    if(snap.exists && snap.data().gocmusOzet) return;   // zaten aktarılmış, bir daha dokunma
    const eskiNick = kullaniciAdi;
    const nickLc = (eskiNick||'').trim().toLowerCase();
    if(!nickLc) return;
    try{
      const lockRef = db.collection('kilitliNickler').doc(nickLc);
      const lockSnap = await lockRef.get();
      if(lockSnap.exists) return;   // başka biri bu ismi zaten bağlamış — basit MVP: sessizce reddet
      const r = await fetch(GOC_LB_URL+'?fn=nickozet&nick='+encodeURIComponent(nickLc));
      const j = await r.json();
      if(!j.ok || !Object.keys(j.oyunlar||{}).length) return;   // bu isimle geçmiş veri bulunamadı
      await lockRef.set({uid:u.uid, nick:eskiNick});
      await ref.set({gocmusOzet:j.oyunlar, eskiNick}, {merge:true});
    }catch(e){ console.error('VF goc hata', e); }
  }

  /* girişli değilse ama bu tarayıcıda eski nick varsa, Google'a davet eden küçük bir kart gösterir.
     Sayfa girişli değilse çağır (VF.kullaniciDinle(u=>{ if(!u) VF.eskiOyuncuBanner(); })). */
  function eskiOyuncuBanner(){
    const eskiNick = (localStorage.getItem('harfiyat:nick')||localStorage.getItem('vt_nick')||'').trim();
    if(!eskiNick) return;
    if(sessionStorage.getItem('vfBannerKapali')) return;
    const kutu=document.createElement('div');
    /* ÜSTTE, bottom'da DEĞİL: harfiyat ailesinde mobil ekran klavyesi de position:fixed;bottom:0
       kullanıyor (z-index:30) — banner altta olursa klavyenin üstüne biner, oyunu kilitler. */
    kutu.style.cssText='position:fixed;left:0;right:0;top:0;z-index:9998;background:#1f1912;color:#efe3c6;'+
      'padding:12px 16px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;'+
      'font-family:Georgia,serif;font-size:13.5px;box-shadow:0 6px 24px rgba(0,0,0,.3)';
    kutu.innerHTML =
      '<span>Merhaba '+esc(eskiNick)+' — oyun gelişiyor. Google ile giriş yaparsan çok sevinirim 🙂 yoksa istatistiklerin kaybolabilir.</span>'+
      '<button id="vfBannerGiris" style="padding:8px 16px;border:none;border-radius:8px;background:#4fa08c;color:#fff;font-size:14px;cursor:pointer;flex:none">Google ile giriş</button>'+
      '<button id="vfBannerKapat" style="padding:8px 12px;border:1px solid #3a2f22;border-radius:8px;background:transparent;color:#a6977a;font-size:13px;cursor:pointer;flex:none">kapat</button>';
    document.body.appendChild(kutu);
    kutu.querySelector('#vfBannerGiris').onclick=()=>girisYap().catch(e=>console.error(e));
    kutu.querySelector('#vfBannerKapat').onclick=()=>{ sessionStorage.setItem('vfBannerKapali','1'); kutu.remove(); };
  }

  window.VF = {
    girisYap, cikisYap, anonimGiris, kullaniciDinle, adDegistir, gocKontrolEt, eskiOyuncuBanner,
    skorYaz, leaderboardOku, leaderboardOkuAralik, istatistikArttir, istatistikOku, bayrakYaz,
    streakGuncelle,
    get kullanici(){ return auth.currentUser; },
    get ad(){ return kullaniciAdi; },
    get streak(){ return kullaniciStreak; },
    get anonimMi(){ return !!(auth.currentUser && auth.currentUser.isAnonymous); },
    get adminMi(){ return !!(auth.currentUser && auth.currentUser.uid===ADMIN_UID) || localStorage.getItem('vfVip')==='1'; }
  };
})();
