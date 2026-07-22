# Muzayede Faz 4 — Wikipedia Liste + Müze API Kaynaklı Genişletme (Tasarım)

## Neden

Faz 3 (Wikidata "ressam" meslek etiketi → ajan doğrulaması) 782 adaydan sadece
%16 verim verdi. Ret nedenleri: %39 "aslında ressam değil" (Wikidata meslek
etiketleme hatası), %33 "belgelenmiş gerçek satış bulunamadı", %11 görsel/diğer.
İki darboğaz da kaynağı Wikidata olmasından geliyor: hem meslek etiketi güvensiz,
hem fiyat bilgisi taşımıyor.

Faz 4, aday keşfini Wikipedia'nın "en pahalı tablolar" liste makalelerine
kaydırır (fiyat + ressam + tablo zaten satır satır, kaynaklı) ve görsel
kaynağını Wikimedia Commons'ın yanına ücretsiz müze API'lerini (Met, Art
Institute of Chicago, Rijksmuseum, NGA Washington, Smithsonian) ekler. Rapor:
[Görsel üretim/kaynak araştırması, bkz. konuşma geçmişi 2026-07-22] — Tate ve
Google Arts & Culture görsel kaynağı olarak elendi (API yok / ToS ihlali
gerektiriyor), WikiArt lisans belirsizliği yüzünden elendi.

## Ön Koşul: ressam_id / tablo_id Ayrımı

Mevcut veri modeli `ressam_id`'yi hem ressam kimliği hem bulmaca/gün kimliği
olarak kullanıyor (`veri/muzayede_uret.py`: `dogrula()` tekrar eden
`ressam_id`'yi hata sayıyor, `gunler.js` sırası doğrudan `ressam_id` listesi).
Sonuç: aynı ressamdan ikinci bir tablo eklenemiyor — 129 kayıtta hâlâ hiçbir
ressamın birden fazla tablosu yok. Faz 4 öncesi bu ayrım yapılmalı:

- `ressamlar.json` → `ressam_id` bazında tekil kalır (ipucu alanları — dönem,
  ülke, akım — ressam başına bir kez yeterli)
- `tablolar.json` → her satırın kendi benzersiz `tablo_id`'si olur, `ressam_id`
  foreign key olarak tekrarlanabilir
- Geriye dönük uyumluluk: mevcut 129 kaydın hepsi hâlâ tekil ressam-tablo
  olduğundan `tablo_id = ressam_id` korunur (gün sırası/URL'ler değişmez).
  Yeni eklenen ikinci/üçüncü tablo için `tablo_id = "{ressam_id}-2"` gibi
  sonek üretilir.
- `dogrula()` artık `tablo_id` tekilliğini kontrol eder, `ressam_id` tekrarına
  izin verir.
- `gunler.js` sırası `tablo_id` listesine döner.
- İpucu mantığı (`site/muzayede/index.html`'deki `ipucuAc()` vb.) ressam
  alanlarını `ressam_id` üzerinden `ressamlar.json`'dan çeker — bu kısım
  değişmez, çünkü ressam verisi zaten tekil.

## Kapsam

**Aday + fiyat keşfi** — artık ajan gerektirmeden script ile:
- Hedef sayfalar: `List of most expensive paintings`, `...by living artists`,
  `...by women`, `...sold in the 21st century`, ülke/ressam bazlı benzer liste
  makaleleri (ör. `List of most expensive Picasso paintings`)
- Wikipedia REST API'den sayfa HTML'i çekilir, tablo satırları parse edilir:
  ressam adı, tablo adı, fiyat (dolar), satış yılı, müzayede evi, kaynak linki
  — hepsi tablonun kendi sütunlarında zaten mevcut
- Mevcut 129 kayıtla (ressam_id slug + tablo adı) dedup

**Mevcut 129 ressamın ek tabloları** — yeni ressam keşfiyle eşit öncelikli,
ayrı bir kaynak akışı:
- Her mevcut `ressam_id` için ressama özel Wikipedia liste makalesi var mı
  kontrol edilir (ör. `List of most expensive Picasso paintings`,
  `...van Gogh paintings`); yoksa ressamın kendi Wikipedia sayfasındaki
  "en pahalı satışları" bölümü taranır
- Aynı script (`muzayede_wiki_listeleri.py`) hem yeni ressam hem mevcut
  ressamın ek tablosu için kullanılır — fark sadece dedup adımında: burada
  `ressam_id` zaten var olabilir, sadece `tablo_id` benzersiz olmalı (bkz.
  Ön Koşul)
- Öncelik büyük isimlerde: Cézanne, Van Gogh, Picasso, Monet gibi zaten
  listede olup çok sayıda belgelenmiş yüksek-fiyatlı satışı olan ressamlarda
  en az 2-3 ek tablo hedeflenir

**Görsel keşfi** — ajan veya script (API'ler yapısal, ajan gerekmeyebilir):
1. Wikimedia Commons'ta ressam/tablo adıyla ara (mevcut yöntem, ilk tercih)
2. Bulunamazsa sırayla: Art Institute of Chicago (IIIF, `is_public_domain`
   bayrağı) → Met Open Access (keysiz, CC0) → Rijksmuseum (ücretsiz key) →
   NGA Washington (GitHub open data + IIIF) → Smithsonian Open Access
   (api.data.gov key)
3. Hiçbirinde yoksa aday elenir (mevcut kural: görselsiz veri yok)

**risk_seviyesi eşlemesi** — bu 5 müze API'sinin PD/CC0 olarak işaretlediği
her eser doğrudan `public_domain`; Commons'tan gelen ve ressam 1956 sonrası
ölmüşse mevcut kural gibi `dikkat`.

## Pipeline

```
veri/
  muzayede_wiki_listeleri.py   → Wikipedia liste makalelerini parse eder,
                                  ham aday havuzu üretir (ressam, tablo, fiyat,
                                  yıl, müzayede evi, kaynak_url) — SCRIPT, ajan yok
  muzayede_dedup.py            → mevcut 129 kayıtla çakışanları eler
  muzayede_faz4_gorsel.js      → Workflow: her adayın görselini Commons →
                                  AIC → Met → Rijksmuseum → NGA → Smithsonian
                                  sırayla dener, risk_seviyesi atar, dogrulanamayan
                                  elenir — ajan (görsel arama/karşılaştırma
                                  muhakeme gerektiriyor)
  muzayede_faz4_data.py        → onaylanan kayıtlar (Faz 3 formatıyla aynı tuple)
```

Faz 3'ten fark: fiyat doğrulaması artık ajana değil doğrudan Wikipedia liste
tablosuna dayanıyor (kaynak zaten liste makalesinin kendisi), bu yüzden ajan
sadece görsel bulma/lisans sınıflandırma adımında kullanılır — beklenen verim
Faz 3'ten çok daha yüksek.

## Tahmini Hacim

- Wikipedia liste makalelerinden ~150-250 yeni ressam
- Mevcut 129 ressamdan çok satışlı olanlar (Cézanne, Van Gogh, Picasso, Monet
  vb.) için tahmini +50-100 ek tablo
- Görsel darboğazı: 5 müze API'si + Commons kombinasyonu, tahmini görsel
  bulunamama oranı düşük (<%10) çünkü hepsi büyük, iyi taranmış PD koleksiyonları

## Kabul Kriterleri

- `veri/muzayede_uret.py` ressam_id/tablo_id ayrımına geçmiş olur (Ön Koşul
  bölümü), aynı ressamdan birden fazla tablo artık hata vermez
- Yeni kayıtlar mevcut 13 alanlı tuple formatına uyar (+ gerekirse ayrı
  `tablo_id` alanı), `veri/muzayede_uret.py` yeni `FAZ4_DATA`'yı da
  DATA + FAZ3_DATA + CAKMA_DATA ile birlikte birleştirir
- Görsel URL'leri HTTP 200 doğrulanmış (mevcut kural)
- Fiyat rakamı uydurulmamış: Wikipedia liste makalesinin tablo satırından
  doğrudan alınmış, ek doğrulama gerekmiyor (kaynak zaten liste makalesi)
- Dedup: tablo_id (ressam_id + tablo adı bazlı) üzerinden, hem mevcut 129
  kayıtla hem Faz 4 içi kendi arasında; aynı ressamdan farklı tablo eklenmesi
  artık kasıtlı olarak izinli
