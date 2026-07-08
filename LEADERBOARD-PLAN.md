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
