# loc2 — Karşılık sözlüğü gloss Türkçeleştirme kuyruğu

Bu branch (`loc2`) bir toplu-iş kuyruğudur. Görev: `kuyruk/chunk_*.json`
dosyalarındaki sözlük girişlerinin İngilizce/boş anlam açıklamalarını (gloss)
Türkçe sözlük tanımına çevirip `sonuc/part_*.json` olarak yazmak.

## Her koşuda yapılacaklar

1. `kuyruk/` içindeki chunk'lardan, `sonuc/` içinde karşılığı (aynı numaralı
   `part_XXXX.json`) OLMAYAN ilk **15** tanesini al. Hepsi tamamsa hiçbir şey
   yapma ve "TAMAM" de.
2. Her chunk için `sonuc/part_XXXX.json` üret (numara chunk ile aynı).
3. Üretilen sonuç dosyalarını commit'le ve `origin loc2`'ye push'la.
   Commit mesajı: `loc2: part_XXXX–part_YYYY`. Kuyruk dosyalarını DEĞİŞTİRME.
   Alt-ajanlarla paralel işleyebilirsin; ama push'u tek sefer, en sonda yap.

## Girdi formatı (chunk)

Her chunk bir JSON dizisi; eleman:

```json
{"d":"en","l":"high","fix":[0,2],
 "s":[{"i":0,"pos":"adjective","dom":"general","tr":["yüksek"],
       "g":"Physically elevated, extending above a base or average level:"}, ...]}
```

- `d`: sözlük yönü (en=İngilizce başlık, tr=Türkçe başlık)
- `l`: madde başı (lemma)
- `s`: girişin TÜM anlamları (bağlam için) — `i` anlam indeksi, `tr` karşılıklar,
  `g` mevcut gloss (İngilizce ya da boş olabilir)
- `fix`: gloss'u yazılacak anlam indeksleri (SADECE bunlar için çıktı üret)

## Çıktı formatı (part)

```json
{"en": {"high": {"0": "Yerden yüksekte olan; taban veya ortalama düzeyin üstüne uzanan.",
                 "2": "..."}},
 "tr": {}}
```

Anahtarlar: yön → lemma → anlam indeksi (string) → Türkçe gloss.
GEÇERLİ JSON: çift tırnak, sondaki virgül yok, yorum yok.

## Gloss kuralları

- TEK cümle, kısa, SÖZLÜK üslubu; TAMAMEN Türkçe (tek bir İngilizce kelime bile
  sızmasın).
- Mevcut İngilizce `g` varsa onun anlamını Türkçeye aktar; `g` boşsa gloss'u
  `tr` karşılıkları + `dom` alanı + `pos` türünden türet.
- Ansiklopedik BİLGİ YOK: düşünür adı, tarih, "X'e göre…", atıf yok.
- Tanım madde başının kendisini içermesin (dairesellik yok); `d:"tr"` ise
  tanım Türkçe madde başını da tekrarlamasın.
- `dom` alan anlamıysa o alanın yerleşik Türkçe terimleriyle yaz
  (legal→hukuk, economics→iktisat vb.).
- Karşılıklar (`tr` listesi) SENİN çıktında yok — yalnız gloss yazıyorsun;
  karşılıklar olduğu gibi kalacak.

## Kalite > hız

Emin olmadığın nadir/teknik kelimede gloss'u mevcut İngilizce tanımın sadık
çevirisi olarak ver; uydurma etimoloji/anlam ekleme.
