# Cila listesi (Phase 1 backlog)

2026-07-08 üç ajanlı taramadan (site altyapısı, 8 oyun karşılaştırması, dış AdSense/SEO/PWA/erişilebilirlik araştırması) çıkan, bu oturumda YAPILMAYAN maddeler. Sırayla, her oyunda önizleme kontrolüyle ilerlensin — hepsini aynı anda değiştirmek görsel kırılma riski taşıyor.

## Yüksek öncelik

- ~~`gorsel/harita.jpg` üzerinde "AI-generated content" filigranı~~ — düzeltildi (kırpıldı + cache-bust eklendi).

- **CSS token konsolidasyonu — devam ediyor.** Tamamlanan dilimler: `dort-suru`+`dort-demet` (öbekleme ailesi) → `ortak/oyun-obek.css`; `kur`+`asi` (eşleştirme ailesi) → `ortak/oyun-eslestir.css`; `wordle`+`cati`+`sicaksoguk`+`pedantle` (harfiyat ailesi) → `ortak/oyun-harfiyat.css` (9 birebir aynı renk değişkeni: oyun-bg/mat/mat-golge/mur/soluk/ince/kirmizi/kirmizi-yum + gece modu paylaşılan araç paleti). Üçü de aynı ilkeyle: paylaşılan dosya SIFIR oyuna-özel renk tanımlamaz, her oyun kendi ek değişkenlerini yerel tutar. Hepsi tarayıcıda gündüz+gece doğrulandı.
  **Kontrol edildi, gerçek duplikasyon YOK (yanlış alarm):** `karakapli`/`atlas` — sadece değişken isimlendirme stili benziyor (--kagit/--murekkep gibi), gerçek renk değerleri ve yapı tamamen farklı (karakapli kendi not-defteri temaları, atlas kendi harita-ızgara temaları); iki farklı, karmaşık, işlevsel olarak alakasız uygulama, zorla birleştirmeye değmez.
  Kalan aday gruplar: `karine` (Avlu bulmaca — henüz incelenmedi), `bulmaca`/`politika`/`sozluk` grubu (`--bg`/`--card`/`--ink`/`--acc` paylaşıyorlar ama zaten `ortak/stil.css` üzerinden ortak taban kullanıyorlar — `ortak/stil.css`'in kendi `:root`'u ESKİ/bayat palet, bunu güncellemek riskli çünkü hub dahil çok sayfayı etkiler; şimdilik dokunulmadı). `siir-defteri` kullanıcı isteğiyle bu turda hariç tutuldu. `karanlik-oda` kasıtlı olarak dışarıda bırakılmalı — kendine özgü noir tasarım dili var, paylaşılan "kağıt" estetiğine zorlanmamalı.
- **PWA — tamamlandı.** Lunapark'taki 9 araca (verandle, Atlas, Sancak, Karanlık Oda, Jenerik, Dört Sürü, Kur, Dört Demet, Aşı, Günün Yıldızları) zaten vardı. Sonraki oturumda 11 oyuna daha eklendi: bitki, cati, karakapli, kus, nota, pedantle, politika, sicaksoguk, sozluk, bulmaca. 2026-07-09'da `karsilik` de eklendi (aynı desen: `icon.svg` + `manifest.json`, `start_url`/`scope` "./", mevcut favicon SVG'sinden ikon türetildi). Kalan: `siir-defteri` (kullanıcı isteğiyle dokunulmadı), `karine` (kod hazır ama dizin hâlâ commitlenmemiş WIP — başka bir oturumun işi, dokunulmadı), `harita`/`oyunlar` (hub sayfaları — bilinçli olarak atlandı, PWA kurulum hedefi değiller). PNG 192/512 fallback + service worker/offline hiçbir yerde yok (mevcut desen sadece SVG "any" size kullanıyor, tutarlılık için aynı desen izlendi).
- **Dark mode standardizasyonu — kontrol edildi, gerçek durum netleşti.** `karsilik` ve `pedantle`'da gece modu zaten VARMIŞ (yanlış alarmdı — `body.classList.toggle('gece')` deseni kullanıyorlar). Lunapark'taki 9 araçta gerçek durum: `body.gece` class (wordle/cati/sicaksoguk/pedantle/Atlas — 5 oyun) vs `data-tema` attribute (Dört Sürü/Kur/Dört Demet/Aşı/Günün Yıldızları — 5 oyun); Karanlık Oda+Jenerik kasıtlı olarak her zaman koyu (toggle yok, doğru tasarım). **Sancak'ta hiç gece modu yoktu** — gerçek eksiklik buydu, düzeltildi (`body.gece` + 🌙/☀️ buton + `sancak:gece` localStorage, tarayıcıda doğrulandı). İki mekanizmayı (class vs attribute) tek yönteme indirmek hâlâ bekliyor ama bu daha büyük/riskli bir CSS taraması gerektiriyor — kullanıcıya görünür bir sorun değil, geliştirici tutarlılığı meselesi.
- **localStorage namespace göçü — tamamlandı.** `karakapli`'nin `kk-*` anahtarları önceki oturumda `karakapli:*`'ye taşınmıştı. Bu oturumda kalan 11 oyun da `oyun:anahtar` biçimine getirildi (her biri: yeni anahtar yoksa eskiyi bir kere oku → yeni anahtara yaz → eskiyi sil): `asi` (`esbitki-tema`→`asi:tema`), `dort-demet` (`herbaryum-tema`→`dort-demet:tema`), `dort-suru` (`obek-tema`→`dort-suru:tema`), `karine` (`karine-tema`→`karine:tema`), `kur` (`es-tema`→`kur:tema`), `sozluk` (`tema`/`defter`→`sozluk:tema`/`sozluk:defter`, kaynak `veri/template.html`'den `build.py` ile yeniden üretildi), `nota` (`nota-favoriler`/`nota-loops`→`nota:favoriler`/`nota:loops`), `bitki` (`bitki-*` 7 anahtar→`bitki:*`), `kus` (`kus-*` 7 anahtar→`kus:*`), `karsilik` (`karsilik-*`→`karsilik:*`), `atlas` (`atlas_mod_gun`→`atlas:mod:gun`, eski isim kalıntısı `vt_nick`/`vt_gece`→`atlas:nick`/`atlas:gece`), `siir-defteri` (`siir_defteri_v1`→`siir-defteri:v1`, `siir_drive_cid`/`siir_drive_on`→`siir-defteri:drive-cid`/`siir-defteri:drive-on`). Her sayfa tarayıcıda eski-anahtar→yeni-anahtar göçü test edilerek doğrulandı (konsol hatası yok). Bilinçli olarak dokunulmadı: `siir-defteri`'nin dahili teşhis/yedek anahtarları (`siir_defteri_goconcesi`, `siir_defteri_yedek_*`) — bunlar kurtarma amaçlı tek seferlik yan kanallar, birincil durum değil.

## Düzeltme (önceki taramanın hatası)

- `cati`, `sicaksoguk`, `wordle` (klavye tabanlı Wordle ailesi) `user-scalable=no` kullanıyor — kullanıcı kararı: **kalsın**, klavye-tap UX'i erişilebilirlikten öncelikli tutuldu. Değişiklik yapılmayacak, kapandı.
- Araştırma ajanı karakapli'de "sidebar mobilde collapse olmuyor" demişti — kod incelemesinde (`#uygulama` grid + `.yan{position:fixed;transform:translateX(-100%)}` + `.acik-yan`/`.perde` toggle, `@media(max-width:860px)`) bunun zaten doğru bir off-canvas menü olarak kurulu olduğu görüldü; mobil önizlemede kilit ekranı da tam genişlikte, ortalanmış render oluyor (DOM inceleme ile doğrulandı). Bu madde de yanlış alarmdı, kod değişikliği yapılmadı.

## Orta öncelik

- ~~Font-weight 800 (Playfair Display) `cati` ve `yildiz`'de var, eski oyunlarda yok~~ — düzeltildi, ikisi de 700'e indirildi (aile standardı), tarayıcıda doğrulandı.
- ~~Footer yazar atıfı bazı oyunlarda eksik~~ — Fable'la danışılarak 3 sınıfa ayrıldı (lisans-atıflı/hub/dinamik footer'lara dokunulmadı); tek gerçek tutarsızlık (`cati`'nin `data-ad="cati"` yerine kardeşleri gibi `data-ad="verandle"` olması) düzeltildi.
- ~~Paylaşım/emoji-kopyalama butonu bazı oyunlarda göze çarpıyor, bazılarında JS-lazy~~ — incelendi: hepsi aslında aynı zamanlamada gösteriliyor (oyun bitince), gerçek fark sadece etiket metniydi ("sonucu kopyala"/"Sonucu Kopyala"/"Sonucu kopyala" karışıklığı). 10 oyun "📋 kopyala"ya (Harfiyat/Taraça/Avlu/Çatı deseni) standardize edildi. Sancak hariç tutuldu — o `navigator.share` ile gerçek native paylaşım açıyor, "sonucu paylaş" etiketi doğru ve farklı kalmalı.
- ~~`og:image` şu an sadece hub + 2 oyunda eklendi~~ — 22 oyuna eklendi (kendi markalı görseli olanlar kendi görselini, diğerleri `doku.jpg` fallback'ini kullanıyor).
- ~~Google Fonts preload yok~~ — 23 oyuna `rel="preload"` eklendi, çift istek olmadığı doğrulandı.

## Düşük öncelik

- ~~Favicon `.png` fallback yok~~ — 24 oyuna (sözlük dahil, favicon'u hiç yoktu) 32×32+180×180 PNG eklendi, tarayıcı canvas ile native kütüphane gerekmeden üretildi.
- **`og:image` kırpma testi — incelendi, sonuç raporlandı (görsel düzenleme YAPILMADI).** Facebook/Twitter/LinkedIn genelde 1.91:1'e (1200×630) zorla kırpar. Mevcut 11 görselin oranları hesaplandı: 8 tanesi (bitki/bulmaca/dilimin-ucunda/kara-kapli/karsilik/politika/siir/verandle, hepsi 800×410, oran 1.95:1) ve `harita.jpg` (760×380, 2:1) ve `doku.jpg` (1200×672, 1.79:1) için gerekli kırpma **~%1-6.5 arası ve merkezi** — göz ardı edilebilir, konudan bir şey kaybetmez.
  **`nota.jpg` (1200×530, oran 2.26:1) istisna**: 1.91:1'e sığdırmak için toplam ~188px (kenar başına ~%7.8) kırpılması gerekiyor; görseli açıp baktım — gitar zaten sol kenara yakın duruyor, düz merkezi kırpma gitarın sol/gövde kısmını kesebilir. Görseli kendim kırpmadım (marka görseli, senin estetik kararın) — öneri: sağdaki boş gökyüzünden asimetrik kırp (gitardan değil). `doku.jpg`'ye hiç dokunulmadı — 20'den fazla sayfada arkaplan dokusu olarak kullanılıyor, kırpmak oradaki görünümü bozar.

## Yapıldı (bu oturumda referans)

- `nota`/`karakapli` pinch-zoom düzeltmesi, `karakapli` mobil sidebar collapse — bkz. git geçmişi.
- 23 oyun + hub'a tek satır GA4 include (`ortak/analitik.js`) — ID henüz placeholder, hesap açılınca tek dosyadan aktif olacak. `karakapli` bilinçli olarak analitikten muaf tutuldu (özel not defteri).
- `robots.txt`, `sitemap.xml`, `manifest.json` (hub), `ads.txt` placeholder, `/gizlilik/`, `/kosullar/` eklendi.

## Doğrulama notu

Bu oturumda gerçek Lighthouse/PageSpeed/Core Web Vitals ölçümü yapılmadı (deploy sonrası, canlı sitede yapılmalı). AdSense başvurusundan önce en az bir kez çalıştır.
