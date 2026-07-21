# Çehre — ünlü tanıma oyunu (uygulama henüz YOK)

Yüz kesitinden ünlü tanıma oyunu. Üç bağımsız günlük bulmaca sekmesi: **Burun / Gözler / Ağız**.

## Kavram

Her sekmenin kendi günün ünlüsü var (üç sekme = üç farklı kişi, aynı gün). Sekme adı aynı zamanda o bulmacanın başlangıç ipucu organı.

## Tek bulmaca döngüsü

Örnek: Burun sekmesi.

1. Bağlamsal kesit gösterilir — yalnız burun değil, çevresindeki yanak/kaş payı da dahil (dar/soyut kesit değil, tanınabilir ama zor).
2. Otomatik tamamlamalı arama kutusuyla tahmin girilir (diğer oyunlardaki gibi, ünlü havuzundan öneri düşer).
3. 3 yanlıştan sonra ikinci organ (gözler) da açılır, ekrana eklenir.
4. 2 yanlış daha (toplam 5) sonra üçüncü organ (ağız) da açılır.
5. 1 hak daha (toplam 6 deneme) — bulunamazsa bulmaca kapanır, cevap gösterilir.

Puan ölçeği (deneme sırasına göre): **100 / 80 / 60 / 40 / 25 / 15**.

Gözler ve Ağız sekmeleri aynı mantıkla çalışır, sadece başlangıç organı değişir (Gözler sekmesi gözle başlar, kalan iki organ sırayla açılır; Ağız sekmesi ağızla başlar).

## Ünlü havuzu ve görsel kaynağı

- Kaynak: Wikidata + Wikipedia, ticari-güvenli lisanslı (CC-BY/CC0, NC hariç) fotoğraflar — bitki/kuş oyunlarındaki `_harvest.py` kalıbının aynısı.
- Kapsam geniş: oyuncu/sporcu/müzisyen vb. sınırlı değil, film-dışı ünlüler de dahil.
- Üç sekme aynı genel havuzdan besleniyor ama günlük seçilen üç kişi birbirinden farklı (çakışma yok).

## Teknik: organ kesiti çıkarma

- Yüz nirengi noktası tespiti (Karanlık Oda'da kullanılan YuNet gibi — 5 nokta: iki göz, burun ucu, iki ağız köşesi) ile kesitler otomatik çıkarılır.
- Wikipedia fotoğrafları TMDB oyuncu portreleri kadar standart değil (yan profil, düşük çözünürlük, grup fotoğrafından kırpma ihtimali) — bu yüzden **otomatik kalite filtresi** şart: netlik/boyut/frontal-lik eşiğini geçemeyen kişiler havuzdan otomatik elenir. Bu havuzu biraz küçültür ama kaliteyi garanti eder.
- Kürasyon turu (grid + ajan onayı, Karanlık Oda'daki gibi) v1'de yok; gerekirse sonradan eklenir.

## Paylaşım

Wordle-tarzı emoji ızgarası + puan, panoya kopyalanabilir (üç sekme için ayrı satır ya da birleşik — uygulama sırasında netleşir).

## Kapsam dışı (v1)

- Leaderboard yok (site genelindeki Firestore altyapısı ileride eklenebilir, bkz. [LEADERBOARD-PLAN.md](LEADERBOARD-PLAN.md)).
- Görsel kimlik (renk paleti, tipografi) bu planda karara bağlanmadı — Montaj'daki gibi ayrı bir görsel kimlik turu ile sonradan belirlenecek.
- Kürasyon/manuel QC turu yok, otomatik filtreyle başlanıyor.

## Açık sorular (uygulama planında netleşecek)

- Wikidata harvest ölçütleri (kaç kişi, hangi meslek/kategori sorguları, minimum fotoğraf çözünürlüğü).
- Aynı kişinin farklı günlerde tekrar çıkmaması için havuz-tükenme stratejisi (diğer oyunlardaki EPOCH + sıra-karıştırma kalıbı muhtemelen yeterli).
- Paylaşım ızgarasının tam formatı.
