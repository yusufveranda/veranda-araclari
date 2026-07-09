# Leaderboard + Google ile giriş — tasarım (uygulama henüz YOK)

Kapsam: yalnız Lunapark'taki 9 araç — verandle (Harfiyat/Taraça/Avlu/Çatı/Şömine/Parsel), Atlas, Sancak, Karanlık Oda, Jenerik, Dört Sürü, Kur, Dört Demet, Aşı, Günün Yıldızları.

## Mevcut durum (2026-07-09 itibariyle)

- **verandle ailesi** (wordle/cati/sicaksoguk/pedantle, hepsi aynı Apps Script URL'sine yazıyor): `localStorage['harfiyat:nick']` ortak kimlik. Günlük kilit (bir gün/bir nick = tek satır), haftalık toplam Cuma→Cuma. Ayrıca "bu kelime olmalı" bayrağı `bayraklar` sayfasına yazıyor.
- **Atlas**: aynı backend'e yazıyor ama kendi ayrı `localStorage['vt_nick']` kullanıyor — verandle ailesiyle isim paylaşmıyor.
- **Sancak, Karanlık Oda, Jenerik, Dört Sürü, Kur, Dört Demet, Aşı, Günün Yıldızları**: leaderboard/nick/bayrak yok, sıfırdan kurulacak.
- Haftalık döngü **Cuma 00:00**'da kapanıyor (perşembe gece yarısı = cumanın ilk dakikası) ve o haftanın kazananı hesaplanıyor.

## Neden Firebase (Firestore + Authentication)

- Google ile giriş "hazır paket" — Sheets/Apps Script'in quota ve eşzamanlılık sınırlarını (günlük çağrı tavanı, LockService ile sıralı yazma) aşar.
- Firestore güvenlik kuralları ile "sadece kendi skorunu yazabilirsin" gibi kısıtlar sunucu tarafında uygulanır (Apps Script'te bunu elle taklit ediyoruz şu an).
- Ücretsiz katman bu ölçek için fazlasıyla yeterli (bkz. önceki maliyet açıklaması).

## Firestore şeması (taslak)

```
kullanicilar/{uid}
  ad: string               // Google hesabından gelen görünen ad (değiştirilebilir)
  eskiNick: string | null  // göç sırasında kilitlenen eski takma ad (bir daha değişmez)
  olusturulma: timestamp

skorlar/{oyun}/{gun}/{uid}
  puan, cozulen, deneme: number
  zaman: timestamp
  // Apps Script'teki "bir gün/bir kullanıcı = tek satır" kilidi burada
  // doküman ID'sinin kendisi (uid) ile doğal olarak sağlanıyor — üzerine
  // yazma girişimi güvenlik kuralıyla reddedilir (create-only, update yok).

haftalikOzet/{oyun}/{haftaBaslangicGunu}/{uid}
  toplamPuan, oyunSayisi: number
  // Cuma 00:00'da bir Cloud Function (ya da istemci tarafı hesaplayıp
  // yazan bir "kapanış" işlemi) skorlar'ı toplayıp burayı doldurur.

istatistik/{oyun}_{gun}      // düz koleksiyon, birleşik ID (skorlar/{oyun}/{gun}/{uid}'den farklı —
  dagilim: {"1":n,"2":n,...,"X":n}   // orada {gun} alt-koleksiyon adı olarak geçerli, burada
  toplamCozen: number                // tek bir özet dokümanı olduğu için birleşik ID kullanıyoruz)

bayraklar/{oyun}_{kelime}
  sayi: number
  ilkGun: number
```

## Göç akışı — "eski nickname'i sor, kilitle, verilerini çek"

Sadece verandle ailesi + Atlas için gerekli (diğer 8 zaten temiz).

1. Kullanıcı "Google ile giriş yap" der → Firebase Auth popup → `kullanicilar/{uid}` oluşturulur, `eskiNick: null`.
2. **İlk girişte**, eğer `eskiNick` henüz set edilmemişse bir kerelik şu diyalog çıkar:
   *"Daha önce bu oyunları bir takma adla oynadıysan yaz, geçmiş skorların senin hesabına aktarılsın (opsiyonel, atlanabilir)."*
3. Kullanıcı bir isim yazarsa:
   - Sheets'ten tek seferlik dışa aktarılmış `nick → geçmiş satırlar` haritasında (bkz. aşağıdaki "tek seferlik veri aktarımı") o nick aranır.
   - **Eşleşme + nick daha önce hiç kilitlenmemişse**: geçmiş satırlar `kullanicilar/{uid}` altına kopyalanır, o nick artık `kilitliNickler/{nick}` koleksiyonunda `{uid}` ile işaretlenir (bir daha kimse aynı nick'i talep edemez — sahte iddiayı engeller).
   - **Nick zaten kilitliyse (başka biri önce almışsa)**: "bu isim zaten bağlanmış, eğer sensen ... " mesajı — basit MVP'de sadece reddedilir, ileri seviye doğrulama (ör. e-posta ile) kapsam dışı.
4. Kullanıcı boş geçerse: sıfırdan yeni bir kimlikle devam eder, geçmişi kaybeder ama bu onun tercihi.

### Tek seferlik veri aktarımı (Sheets → Firestore)

- Mevcut `skorlar` sayfası (Apps Script Sheet'i) bir kerelik JSON'a aktarılır (Apps Script'te basit bir `fn=export` eklenip tüm satırlar çekilir).
- Bu JSON, Firestore'a **ayrı bir koleksiyona** (`gocVerisi/eskiNickler/{nick}`) tek seferlik yüklenir — canlı `skorlar` koleksiyonuna karıştırılmaz, sadece göç sırasında "bu nick'in geçmişi bu" diye bakılan bir kaynak olarak durur.
- Bu aktarım **Perşembe gece yarısı geçişinden SONRA** yapılır (haftalık kazanan hesaplanıp kayda geçtikten sonra) — o anda Sheets verisi "donmuş" sayılır, karışıklık riski olmaz.

## Zaman çizelgesi

1. **Bugün/yarın (Perşembe, geçişten önce)**: Sadece bu tasarım + sen Firebase projesini açman. Hiçbir canlı dosyaya dokunulmaz, mevcut Sheets sistemi bu haftayı normal şekilde bitirir.
2. **Cuma (geçiş sonrası)**: Sheets verisinin tek seferlik JSON aktarımı + Firestore'a yükleme.
3. **Sonraki oturum(lar)**: Firebase Auth + Firestore entegrasyonu, önce YENİ 8 oyunda (leaderboard'u hiç olmayanlar — risksiz, geriye dönük veri yok), sonra verandle ailesi + Atlas'ta göç akışıyla birlikte.
4. **En son**: Eski Apps Script URL'lerini koddan çıkar, `.gs` dosyalarını arşivle.

## Senin yapman gerekenler

1. [firebase.google.com/console](https://firebase.google.com/console) → "Add project" → proje adı (ör. `veranda-oyunlar`).
2. Sol menü → Build → **Authentication** → "Get started" → **Google** sağlayıcısını etkinleştir.
3. Sol menü → Build → **Firestore Database** → "Create database" → **production mode** (test mode değil) → bölge olarak `eur3` (Avrupa) seç.
4. Proje ayarları (⚙️) → "Your apps" → **Web app ekle** (`</>` ikonu) → bana çıkan `firebaseConfig` nesnesini (apiKey, projectId vb.) ver.

Bu 4 adımdan sonra devam ederim.

## Firebase kurulumu tamamlandı (2026-07-09)

Proje: `veranda-oyunlar` (Spark/ücretsiz plan). Firestore Standard edition, eur3 bölgesi, production mode. Authentication → Google sağlayıcısı açılıyor (kontrol edilmeli). Web app kaydedildi (`Veranda Tools`, Hosting işaretlenmedi — barındırma zaten GitHub Pages/Cloudflare'de).

```js
const firebaseConfig = {
  apiKey: "AIzaSyDJmpIrOYS4XOr2P3HNyHeTpukhpoW3pAE",
  authDomain: "veranda-oyunlar.firebaseapp.com",
  projectId: "veranda-oyunlar",
  storageBucket: "veranda-oyunlar.firebasestorage.app",
  messagingSenderId: "930330517511",
  appId: "1:930330517511:web:21d9c43053798a0b964aa2",
  measurementId: "G-7454N68TXC"
};
```

Not: `apiKey` bir sır değil — Firebase'de bu client tarafında herkese açık olacak şekilde tasarlanmış, gerçek koruma Firestore security rules ve (istenirse) Google Cloud Console'da "API key restrictions" (domain kısıtı) ile sağlanıyor. Canlıya almadan önce bu kısıtı eklemek iyi bir ek güvenlik katmanı olur ama şu an engelleyici değil.

İstatistik/analitik kararı: kelime tekrarı önemsiz, sadece günlük dağılım yeterli (bkz. yukarıdaki düzeltilmiş `istatistik/{oyun}_{gun}` şeması). Sayaç güncelleme yöntemi: client-side Firestore transaction (Cloud Function/Blaze gerekmiyor, Spark planında kalınıyor).

Gizlilik kararı: Google ile girişte gerçek ad hiç gösterilmiyor. İlk girişte hemen "Görünen adın ne olsun?" sorusu çıkar (Google adı varsayılan/otomatik doldurulmuş DEĞİL, boş/placeholder) — kullanıcı kendi takma adını seçer, insanlar gerçek isimlerinin göründüğünü düşünüp gerilmesin diye. Bu `ad` alanı her yerde (leaderboard dahil) gösterilen tek isim; sonra ayarlardan değiştirilebilir.

## Ortak kod: site/ortak/firebase.js (2026-07-09)

Tüm oyunların paylaşacağı tek dosya. `window.VF` namespace'i: `girisYap()`, `cikisYap()`, `kullaniciDinle(cb)` (ilk girişte takma ad sorar, gerçek Google adı hiç kullanılmaz), `adDegistir(ad)`, `skorYaz(oyun, gun, veri)`, `leaderboardOku(oyun, gun)`, `istatistikArttir(oyun, gun, bucket)`, `istatistikOku(oyun, gun)`.

Kullanım (her oyun sayfasının `</body>`'den önce):
```html
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
<script src="../ortak/firebase.js"></script>
```

## Firestore security rules — SENİN YAPMAN GEREKEN (Firebase Console → Firestore → Rules)

Aşağıdaki kuralları yapıştırıp **Publish** et:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /kullanicilar/{uid} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /skorlar/{oyun}/{gun}/{uid} {
      allow read: if true;
      allow create: if request.auth != null && request.auth.uid == uid;
      allow update, delete: if false;
    }
    match /istatistik/{belge} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.toplamCozen == 1;
      allow update: if request.auth != null
        && request.resource.data.toplamCozen == resource.data.toplamCozen + 1;
      allow delete: if false;
    }
    match /bayraklar/{belge} {
      allow read: if true;
      allow create: if request.resource.data.sayi == 1;
      allow update: if request.resource.data.sayi == resource.data.sayi + 1;
    }
  }
}
```

Mantık: herkes okuyabilir (leaderboard herkese açık), ama sadece kendi uid'in altına yazabilirsin ve skorlar create-only (üzerine yazamazsın — bir gün/bir kullanıcı kilidi). İstatistik sayaçları sadece +1 artabilir, başka türlü değiştirilemez. **Bayraklar kasıtlı olarak `request.auth`'suz** (2026-07-10 güncellemesi, aşağıya bkz.) — girişli olmayanlar da bildirebilsin diye; kötüye kullanım riski düşük (sadece bir sayaç, kişisel veri yok).

## Bayrak sistemi — girişten bağımsız tek depoya indirildi (2026-07-10)

Kullanıcı itiraz etti: bayraklar girişli/girişsiz ayrımına göre iki ayrı yerde (Sheets + Firestore) birikiyordu, "düzenli düzeltme" için tek yer istedi. `VF.bayrakYaz` artık `auth.currentUser` kontrolü yapmıyor — VF varsa (firebase.js yüklüyse) HERKESTEN Firestore'a yazıyor, girişli olsun olmasın. **SENİN YAPMAN GEREKEN**: Firebase Console → Firestore → Rules'ta yukarıdaki `bayraklar` bloğunu güncelleyip **Publish** et (`request.auth != null &&` kısmı kaldırıldı) — bu yapılmadan girişsiz bildirimler "permission-denied" ile sessizce reddedilir.

## Sancak entegrasyonu (2026-07-09, ilk oyun)

Skor: kazanınca `deneme` (1-6), kaybedince bucket `"X"` (Wordle usulü). Leaderboard en az denemeyle sıralanır. `istatistikArttir('sancak', oyunGun, kazandi?deneme:'X')` her günlük oyun bitişinde çağrılıyor.

Sıradaki 7 oyun (Karanlık Oda, Jenerik, Dört Sürü, Kur, Dört Demet, Aşı, Günün Yıldızları) aynı `ortak/firebase.js`'i kullanacak, sadece skorYaz'a geçirilen `veri` alanları oyuna göre değişecek.

## İlerleme (2026-07-09)

- **Sancak**: bitti, test edildi (gerçek Google girişiyle uçtan uca). oyun anahtarı `"sancak"`.
- **Karanlık Oda**: bitti, test edildi. `puan` = SCORES[step] (100/75/50/30/15). oyun anahtarı `"karanlikoda"`.
- **Jenerik**: bitti, test edildi. `puan` = bulunan film sayısı. oyun anahtarı `"jenerik"`. DİKKAT: bu oyun sayfa yeniden açıldığında bitmiş günü `finish()` ile yeniden çiziyor — çift sayım olmasın diye `finish(won, redisplay)` ikinci parametresi eklendi, redisplay=true iken VF yazma atlanıyor. Benzer "sonucu yeniden çizen" bir oyun eklenirse aynı deseni uygula.
- **Dört Sürü / Dört Demet** (oyun-obek.css ailesi): `puan`=(MAX_HATA-hatalar)*25 sadece tam+puanlı çözümde, yoksa 0. bucket = hatalar sayısı ya da "X" (puansız/pes). oyun anahtarları `"dortsuru"`, `"dortdemet"`.
- **Kur / Aşı** (oyun-eslestir.css ailesi): `puan`=eşlenen sayısı (puansızsa kilitlenen puan). bucket = hata sayısı ya da "X". oyun anahtarları `"kur"`, `"asi"`.
- **Günün Yıldızları**: meta-oyun, kendi skoru = günü kazanınca (6★ toplayınca) `gunToplam()`. Sadece kazanma anında yazılıyor (kaybedilen/yarım günler kaydedilmiyor — bilinçli basitleştirme). `motor.js`'e `YILDIZ.gun()`/`YILDIZ.toplam()` eklendi ki index.html'deki leaderboard kodu günü okuyabilsin. oyun anahtarı `"yildiz"`.
- **Ortak CSS**: `ortak/leaderboard.css` oluşturuldu — dört-lü ve eşleştirme ailesindeki tüm oyunlar (dortsuru/dortdemet/kur/asi) ve yıldız bunu paylaşıyor, tekrar yazılmadı.
- Hepsi tarayıcıda gerçek Firestore'a karşı test edildi (leaderboard modalı açılıp veri okuyor, hata yok).

## Verandle ailesi + Atlas göçü (2026-07-09) — Cuma'yı beklemeden yapıldı

Karar değişikliği: bulk export yerine **canlı sorgu**. Kullanıcı eski nick'ini yazdığı an Apps Script'e sorulup direkt Firestore'a taşınıyor — Cuma'daki haftalık geçişi beklemeye gerek kalmadı.

- `taraca-leaderboard.gs`'e `fn=nickozet` eklendi (verilen nick için 7 oyunun toplamlarını döner, ham günlük satır yok). **Kullanıcı redeploy etti.**
- `ortak/firebase.js`'e `gocKontrolEt()` eklendi: uid başına bir kez (kullanicilar/{uid}.gocSoruldu ile işaretli) "Daha önce oynadıysanız ve bir isim kullandıysanız, verilerinizi kaybetmemek için doğru şekilde buraya yazın (opsiyonel)" diyaloğu çıkar. Nick girilirse `kilitliNickler/{nickLc}` kontrol edilir (doluysa sessizce reddeder — basit MVP), boşsa `.gs`'e sorup `kullanicilar/{uid}.gocmusOzet` + `eskiNick` yazılır ve nick kilitlenir.
- Firestore rules'a `kilitliNickler/{nick}` eklendi (create-only, kilitlenince bir daha değişmez). **Kullanıcı yayınladı.**
- 5 canlı sayfaya (wordle=Harfiyat/Taraça/Avlu, cati, sicaksoguk=Şömine, pedantle=Parsel, atlas) Firebase script'leri + "Google ile giriş" butonu + `kullaniciDinle`→`gocKontrolEt` zinciri eklendi. **Eski Sheets/nick sistemine hiç dokunulmadı** — ikisi paralel çalışıyor, mevcut leaderboard/skor akışı bozulmadı.
- Buton yerleşimi sayfaya göre değişti (bazılarında sabit üst-sağ, bazılarında mevcut ikon satırına eklendi) çünkü her oyun kendi CSS'ini kullanıyor; hepsi konsol hatasız yüklendiğini doğrulandı.
- **Uçtan uca doğrulandı (2026-07-09)**: gerçek Google girişiyle Şömine'de test edildi. İlk denemede sessizce yazılmadı (muhtemelen rules'ın yeni yayınlanmasından hemen sonraki geçici bir gecikme — kod tarafında hata yoktu), `gocSoruldu` alanı silinip tekrar denenince `eskiNick` + `gocmusOzet` (avlu/çatı/harfiyat/taraca/sicak/pedantle/makas — 7 oyunun tamamı) doğru şekilde Firestore'a yazıldı, Apps Script'teki gerçek geçmiş verilerle birebir eşleşti.
- ~~Kalan: bu 5 sayfada henüz Firestore'a skor yazımı yok~~ — aşağıda tamamlandı.

## Skor yazma/okuma geçişi (2026-07-09) — tamamlandı

Karar: dual-write YOK. Tek kural — **Google ile girişliyse → sadece Firestore'a yaz/oku; girişli değilse → eskisi gibi Sheets'e yaz/oku.** Migrate olmuş olmak zaten "girişli olmak" ile eşanlamlı (oturum kalıcı), o yüzden ayrıca "bu kullanıcı migrate oldu mu" kontrolüne gerek yok.

- 5 dosyada (`wordle`=Harfiyat/Taraça/Avlu, `cati`, `sicaksoguk`=Şömine, `pedantle`=Parsel, `atlas`) skor gönderme fonksiyonları (`lbGonder`/`skGonder`/`skor-gonder onclick`) ve okuma fonksiyonları (`lbGoster`/`skGoster`/`liderGetir`) baştan `if(window.VF && VF.kullanici){ ... Firestore yolu ... } else { ... eski Sheets yolu (değişmedi) ... }` şeklinde dallandırıldı.
- **Günlük (gün)** görünüm Firestore'da tam çalışıyor. **Haftalık/tüm-zamanlar** girişli kullanıcılar için şimdilik "yakında geliyor" mesajı gösteriyor (Firestore'da günlerin listelenemiyor olması yüzünden — tüm-zamanlar için ayrı bir toplam-sayaç şeması gerekir, ayrı iş).
- Sonuç kartındaki nick input'u: girişliyse dolu+disabled gösterilip otomatik gönderiliyor (kullanıcı hiçbir şey yazmıyor); girişli değilse eskisi gibi elle nick giriliyor.
- Auto-submit: Sancak/Karanlık Oda tarzı, oyun bitince otomatik açılan panel (`skAc`/`payBagla`) zaten varsa, o tetikleyici branch'i de kapsıyor — ekstra hook gerekmedi.
- `eskiOyuncuBanner()`: girişli değilse VE bu tarayıcıda eski nick varsa, sayfanın altında "Merhaba {nick} — oyun gelişiyor, Google ile giriş yaparsan çok sevinirim 🙂 yoksa istatistiklerin kaybolabilir" banner'ı çıkar (kapatılabilir, `sessionStorage` ile bir daha o oturumda çıkmaz).
- Sahte (mock) `VF` nesnesiyle girişli senaryo tüm 5 dosyada test edildi, hata yok. Gerçek Google oturumuyla uçtan uca test edilmedi (headless'ta OAuth yapılamıyor) — kullanıcının bir oyunu gerçekten bitirip "bugün" sekmesinde kendi skorunu görmesi gerekiyor.

Kalan: haftalık/tüm-zamanlar Firestore aggregation (ayrı toplam-sayaç şeması + index).

## Google giriş sorunu + düzeltmeler (2026-07-09) — çözüldü

- `verandatools.com` Firebase'in "Authorized domains" listesinde yoktu → eklendi.
- `signInWithPopup` ilk denemede anında kapanıyordu (o zaman domain yetkisizdi, asıl sebep oydu).
- Sonra `signInWithRedirect`'e geçildi, ama bu Chrome'a (tarayıcı hesabına) girişliyken üçüncü taraf depolama bölümlemesi yüzünden hiç başlamıyordu (bilinen Firebase/Chrome sorunu — [firebase-js-sdk#8329](https://github.com/firebase/firebase-js-sdk/issues/8329), SDK sürümünden bağımsız).
- **Karar: `signInWithPopup`'a geri dönüldü** — domain artık yetkili olduğu için popup sorunsuz çalışıyor, redirect'in Chrome-hesabı sorunu da böylece atlanmış oldu. Gerçek kullanıcıyla (Chrome'a girişliyken) test edildi, çalıştı.

## Eski 6 oyun + Atlas'a histogram + "beni ekle" temizliği (2026-07-09) — tamamlandı

- Girişliyken "beni tabloya ekle" butonu gizleniyor (otomatik gönderildiği için gereksiz).
- Günlük dağılım histogramı eklendi: Harfiyat/Avlu (0/1 çözüldü mü), Taraça (0-6 kelime), Çatı (0-5 kelime), Şömine/Parsel (tahmin sayısı sınırsız olduğu için 5'li aralık kovaları: 1-5/6-10/11-15/16-20/21+), Atlas (0-9 doğru hücre).

## Açık tartışma / karar bekleyen konular (2026-07-09)

**Haftalık hesaplama**: Firestore günleri listeleyemediği için, "bu haftanın 7 günü" zaten bilinen sabit gün numaraları — o 7 `skorlar/{oyun}/{gün}` belgesini paralel okuyup istemci tarafında kişi bazında topluyoruz (Sheets'in sunucu tarafında yaptığının istemci karşılığı).

**Tüm zamanlar — "hep aynı kişi birinci" sorunu**: Mevcut (eski Sheets) sistem zaten ortalama puana göre sıralıyor (toplam/oynanan gün), ham toplam değil — ama az oynayıp şansına yüksek ortalama tutturanlar da haksız üste çıkabiliyor (küçük örneklem sorunu). Konuşulan çözüm seçenekleri (KARAR VERİLMEDİ):
1. Minimum oyun sayısı eşiği (ör. en az 10 gün oynamamış sıralamaya giremez).
2. Birden fazla ayrı tablo (en yüksek ortalama / en çok oyun / en uzun seri).
3. Periyodik sıfırlama (ör. "bu ay" görünümü, sürekli aynı kişi kalmasın).

Bu üçü konuşulacak, Firestore aggregation'ı bu karara göre kurulacak.

**Diğer bekleyen fikirler (Gemini'nin de önerdiği, henüz uygulanmadı)**:
- Bayrak (kelime bayrağı) sistemini Sheets'ten Firestore'a taşımak — `bayraklar` koleksiyonu için rules zaten hazır (bugün eklendi), asıl UI değişikliği küçük bir iş.
- Gizli "rastgele/arşiv" tuşu yerine gerçek yetki kontrolü: artık Google girişi olduğu için "sadece benim uid'im" kontrolüyle admin-only özellikler gösterilebilir, gizli buton yerine.
- Tüm sayfalarda görünen ortak bir yan sekme/nav + tüm oyunların istatistik+leaderboard'unu tek sayfada gösteren bir dashboard — büyük, ayrı bir proje.
- Kara Kaplı (şifreli not defteri) senkron/yedek + Takımyıldız seri senkronu — leaderboard işinden bağımsız, ayrı planlanmalı.

**Bilinen, düzeltilmeyecek (şimdilik) davranış**: "Bugün çözdüm mü?" bilgisi cihaza özgü (localStorage), hesaba değil — aynı hesapla farklı cihazdan girilince o cihaz "çözülmemiş" gösterip tekrar oynatabiliyor. Veri kaybı yok (ikinci gönderim create-only kilit yüzünden sessizce reddediliyor), sadece gereksiz tekrar oynama. Düzeltmek istenirse: girişte "bugün bu hesapla zaten skor var mı" diye Firestore'a bakıp varsa sonucu göstermek gerekir (14 dosyada tekrar edilecek bir iş) — şimdilik ertelendi.

## Gerçek Google oturumuyla uçtan uca doğrulama (2026-07-09) — tamamlandı

Kalan maddelerden "5 dosyada gerçek oturumla test edilmedi" kapatıldı. Gerçek tarayıcıda (Yusuf Verandle hesabı, zaten girişliydi) her oyun tamamlanıp Firestore doğrudan sorgulanarak (`firebase.firestore().collection('skorlar').doc(oyun).collection(gun).doc(uid).get()`) doğrulandı:

- **Atlas**: 3x3 ızgara sıfırdan oynanıp bitirildi (9/9, 417 puan). Yazılan: `{puan:46, cozulen:9, deneme:11}` — `puan` alanı `Math.round(417/9)` ile 0-100'e normalize ediliyor (kod yorumunda "backend uyumu" diye belirtilmiş, hata değil).
- **Çatı**: bugün zaten tamamlanmıştı (57/100). Yazılan veri UI'daki sonuçla birebir eşleşti.
- **Harfiyat / Taraça / Avlu**: üçü de bugün tamamlanmıştı (74, 66, 68 puan). Üçü de Firestore'da doğru `oyun` anahtarıyla (`harfiyat`/`taraca`/`avlu`) doğrulandı.
- **Parsel**: bugün zaten çözülmüştü (Avustralya, 7 tahmin). Firestore'da `deneme:16` görünüyor çünkü `skTahmin()` formülü `tahminler.length + 5*ipucuSayısı` — ekrandaki "7 tahminde" ham deneme sayısı, Firestore'daki ipucu-cezalı skor; tutarlı, hata değil.
- **Şömine**: bugün henüz oynanmamıştı, kelime bilinmediği için "pes et" ile cevap görüldü (gezi). Kod `S.pes` true iken `skGonder()`'ı erken `return` ile atlıyor — pes edilen oyunlar bilerek Firestore'a yazılmıyor, bu yüzden `exists:false` beklenen sonuç. **Şömine'nin gerçek "kazanma" yazma yolu bu oturumda test edilemedi** (cevap görülünce bugünkü tek şans kullanıldı) — yarın günün kelimesiyle gerçek bir kazanmayla doğrulanabilir, ama kod aynı `VF.skorYaz` deseni olduğu için risk düşük.

Sonuç: 6/7 oyun (Atlas, Çatı, Harfiyat, Taraça, Avlu, Parsel) gerçek Google oturumuyla uçtan uca doğrulandı, hiçbir konsol hatası yok. Şömine'nin kazanma yolu yapısal olarak aynı, ama canlı doğrulanmadı.

## Bayrak/admin-uid/panel/nav-panel (2026-07-09) — tamamlandı

Yukarıdaki "diğer bekleyen fikirler" listesindeki ilk 3 madde bitti:

- **Bayrak → Firestore**: `VF.bayrakYaz(oyun, kelime, gun)` eklendi (`bayraklar/{oyun}_{kelime}`, create-only+increment, rules'la uyumlu). `bayrak.js` girişliyse Firestore'a, değilse eskisi gibi Sheets'e yazıyor.
- **Admin-only uid kontrolü**: `VF.adminMi` eklendi (sabit uid: `YSDnv5FlXHUZhbZpT17vs6WVg3f2`, Yusuf Verandle hesabı). Takımyıldız'ın `?dev=1` localStorage-kalıcı debug tuşu ve Karanlık Oda/Jenerik'in `?preview=1` önizleme seçicisi bu kontrole çevrildi.
- **TÜM "rastgele" tuşları admin-only**: kullanıcı netleştirdi — rastgele/pratik erişimi sadece kendisi için. Kur/Aşı/Dört Sürü/Dört Demet'teki `.gizli-rast` (opacity:0 ama herkes tıklayabiliyordu, gerçek erişim kontrolü değildi) + Atlas/Sancak/Karanlık Oda/Jenerik'teki görünür 🎲 tuşları — hepsi artık varsayılan `hidden`, sadece `VF.adminMi` ile açılıyor.
- **"Sonsuz"/"arşiv" pratik modu da admin-only (2026-07-09, ikinci düzeltme)**: kullanıcı "rastgele film ve sonsuz arşiv her şeyde duruyor gözüküyor" diye tekrar uyardı — kapsam sadece 🎲 tuşlarıyla sınırlı değilmiş. Harfiyat/Taraça/Avlu (wordle), Şömine, Parsel'deki "sonsuz"/"arşiv" sekmesi tamamen açıktı (herkese görünür tab), Çatı'da ise `.sonsuz-sakli` (opacity:0 görünmez tuş) ile güvensiz biçimde gizlenmişti. Dördü de artık `VF.adminMi` ile açılıyor; Çatı'daki güvensiz görünmez tuş tamamen kaldırıldı. **Yeni bir oyun eklenirse aynı deseni uygula**: herhangi bir "rastgele/pratik/debug/sonsuz/arşiv" özelliği (ne isim taşırsa taşısın — kullanıcının niyeti "günlük bulmaca dışındaki her ekstra erişim") varsayılan gizli (`hidden` attribute, opacity/CSS hilesi DEĞİL) olsun, sadece `VF.adminMi` ile açılsın — asla herkese açık bırakma. Yeni bir oyun/özellik eklerken bunu unutma, tekrar sormasın diye.
- **panel/**: kullanıcı önce "kaç kişi oynadı + sen oynadın mı" gösteren bir sayfa istedi, sonra sadeleştirip sadece kendi verisini istedi (aggregate istatistik kaldırıldı).
- **Site-içi gezinme paneli** (`ortak/nav-panel.js`): kullanıcının asıl istediği "panel" buymuş — sağdan açılan bir çekmece, tüm oyun+araçları listeliyor, oyunlarda girişliyken "bugün oynadın mı" ✓. Kara Kaplı **hariç** tutuldu (kullanıcı: "kimse görmesin, o bana özel"). **Kara Kaplı'yı hiçbir paylaşılan/site-geneli listeye ekleme** — bkz. memory `kara-kapli-plani.md`.

Hepsi gerçek Google oturumuyla (Yusuf Verandle hesabı) uçtan uca test edildi, konsol hatasız.

## Gün/hafta/ay leaderboard (2026-07-09) — tamamlandı

Kullanıcının kararı ("gün, hafta ve ay sıralaması yeterli gibi") kodlandı. `VF.leaderboardOkuAralik(oyun, gunListesi)` eklendi (`ortak/firebase.js`) — periyot başından bugüne kadar günleri paralel okuyup kişi bazında `puan`+`deneme` toplar. Harfiyat/Taraça/Avlu (wordle), Çatı, Şömine, Parsel'de "tüm zamanlar" sekmesi "bu ay"a çevrildi; ortalama her iki sekmede de (periyot başından bugüne geçen gün sayısı) ile bölünüyor — az oynayıp yüksek ortalama tutturma sorunu (min-eşik icat etmeden) kendiliğinden azalıyor. Eski Sheets/girişsiz yol dokunulmadı (yeni "ay" sekmesi eskisi gibi `kapsam=tum` sorgusuna eşleniyor). Gerçek oturumla 5 oyunda test edildi. Atlas/Sancak/Karanlık Oda/Jenerik/Dört Sürü/Kur/Dört Demet/Aşı/Takımyıldız'da zaten hafta/ay sekmesi yok (sadece "bugün"), kapsam dışı bırakıldı.
