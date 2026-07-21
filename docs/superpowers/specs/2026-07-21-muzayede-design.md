# Muzayede — Ressam & Fiyat Bilme Oyunu (Tasarım)

## Özet

Günlük bulmaca: bir tablo gösterilir, oyuncu (1) ressamı ve (2) tablonun gerçekte
sattığı müzayede fiyatını tahmin eder. Eskiden (Rönesans) güncele (çağdaş) geniş bir
ressam yelpazesi hedeflenir; v1 hedefi 300-500 ressam.

## Oyun Akışı

1. Tablo görseli gösterilir, isim/tarih/ressam gizli.
2. Oyuncu serbest yazım + otomatik tamamlama ile ressam ismini tahmin eder.
3. Her yanlış tahminde oyuncu **kendi seçtiği** bir ipucu kategorisini açar (puan
   kırılımı ile):
   - Dönem/yüzyıl
   - Ülke/milliyet
   - Sanat akımı/tarzı
   - Tablo adı/yılı + ressam isminin baş harfi (birlikte, son ipucu)
4. Ressam doğru bilinince (veya pes edilince) tablonun gerçek satış fiyatı sayısal
   olarak (dolar) tahmin edilir.
5. Sonuç ekranı: gerçek fiyat, müzayede evi, satış yılı, kaynak linki, kısa bilgi.
6. Toplam skor = ressam puanı (açılan ipucu sayısına göre azalan) + fiyat puanı.
7. Paylaşım metni (diğer oyunlardaki emoji-özet formatına benzer).

Günde 1 tablo, herkes aynısını çözer. Admin girişiyle sınırsız geçmiş bulmacaya
bakılabilir (debug/önizleme amaçlı, genel kullanıcıya kapalı). V1'de ayrı bir pratik
modu yok.

## Fiyat Puan Eğrisi

Log10 farkına göre kısmi puan: fark 0 → tam puan, 10 kat fark (1 log birimi) → düşük
ama sıfır olmayan puan, 10 kattan fazla fark → puansıza yakın. Gevşek tolerans
seçildi (sanat piyasasının doğal oynaklığı nedeniyle).

## Leaderboard

V1'de yok. Sadece kişisel skor/streak (localStorage, diğer oyunlardaki desene benzer).

## Veri Modeli

```
site/muzayede/
  index.html, app.js, style.css, icon.svg, manifest.json
  gorsel/                → optimize edilmiş tablo görselleri (webp)
  data/
    ressamlar.json       → {id, isim, dönem, ülke, akım, doğum-ölüm, risk_seviyesi}
    tablolar.json        → {ressam_id, tablo_adı, yıl, görsel, satış_fiyatı,
                             satış_yılı, müzayede_evi, kaynak_url}
veri/
  ressam_harvest.py      → Wikipedia listelerinden çekirdek liste çıkarır
  ressam_genislet.py     → Wikidata sorgusuyla aday havuzunu büyütür
  ressam_arastir.py      → ajan destekli: her aday için belgelenmiş satış fiyatı +
                            görsel lisansı doğrular, elenenleri loglar
  muzayede_uret.py       → günlük bulmaca sırasını üretir (filmler.txt deseni gibi,
                            sıra = gün sırası, değiştirilmez)
```

### risk_seviyesi katmanları (görsel telif)

- `public_domain` — 70+ yıl önce ölmüş ressam, Commons'tan direkt kullanılabilir.
  Ana gövde bu katmandan oluşur.
- `dogrulanmis_serbest` — CC0/CC-BY lisanslı modern/çağdaş eser.
- `dikkat` — hâlâ hayatta olan veya aktif hukuki takip yapan ünlü isim. En son,
  en az sayıda ve elle tek tek onaylanarak eklenir. Bu katman en riskli olduğu için
  havuzun küçük bir kuyruğu olarak kalır, asla otomatik toplu eklenmez.

## Veri Toplama Süreci

1. **Faz 1 — Çekirdek liste:** Wikipedia'nın "List of most expensive paintings",
   "List of most expensive paintings by living artists" gibi zaten kaynaklı
   sayfalarından ~150-250 ressam/tablo/fiyat/kaynak çekilir.
2. **Faz 2 — Genişletme:** Wikidata SPARQL sorgusuyla (ressam + Commons'ta görseli
   olan tanınmış eser) aday havuzu 300-500'e çıkarılır (fiyat/lisans henüz
   doğrulanmamış).
3. **Faz 3 — Ajanlı doğrulama:** Her aday için paralel ajan: belgelenmiş bir
   müzayede satışı arar (kaynak linkiyle) + görsel lisansını/risk seviyesini
   kontrol eder. Fiyat bulunamayan veya lisansı belirsiz adaylar havuzdan elenir;
   elenenler sessizce atılmaz, loglanır.

**Aşamalı çalıştırma:** Faz 1 ve 2 önce çalıştırılıp gerçek aday sayısı/kalitesi
görülür, Faz 3'e (pahalı, ajan-yoğun) o sonuca göre karar verilir.

### Kaba ölçek tahmini (Faz 3)

- 200-350 agent çağrısı (aday başına 1)
- Workflow eşzamanlılık sınırı ~16 → 13-22 tur
- Tahmini duvar saati: 30-60 dakika
- Tahmini token maliyeti: ~1-2 milyon çıktı token (girdi/arama önbelleği hariç)

## Kapsam Dışı (v1)

- Ayrı pratik/serbest oynama modu
- Leaderboard
- Otomatik toplu "dikkat" katmanı ekleme (her zaman elle onay)
