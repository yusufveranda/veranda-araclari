# Cila listesi (Phase 1 backlog)

2026-07-08 üç ajanlı taramadan (site altyapısı, 8 oyun karşılaştırması, dış AdSense/SEO/PWA/erişilebilirlik araştırması) çıkan, bu oturumda YAPILMAYAN maddeler. Sırayla, her oyunda önizleme kontrolüyle ilerlensin — hepsini aynı anda değiştirmek görsel kırılma riski taşıyor.

## Yüksek öncelik

- ~~`gorsel/harita.jpg` üzerinde "AI-generated content" filigranı~~ — düzeltildi (kırpıldı + cache-bust eklendi).

- **CSS token konsolidasyonu — devam ediyor.** İlk dilim tamamlandı: `dort-suru`+`dort-demet` (öbekleme ailesi) → `ortak/oyun-obek.css`; `kur`+`asi` (eşleştirme ailesi) → `ortak/oyun-eslestir.css`. Fable 5 incelemesinden geçti (bkz. yaklaşım: paylaşılan dosya SIFIR renk tanımlar, her oyun kendi `:root`/`[data-tema="gece"]` bloğunu korur; JS'in ürettiği/sorguladığı sınıf adları — `.kus-havuz`/`.kthumb` gibi — asla ortak dosyaya taşınmaz, yerel kalır). Her ikisi de tarayıcıda gündüz+gece modunda görsel olarak doğrulandı.
  Kalan aday gruplar: `karine` (Avlu bulmaca — bu ailenin `:root` yapısına çok yakın ama farklı oyun türü, tek başına incelenmeli), `siir-defteri`/`nota`/`pedantle`/`cati` grubu (farklı bir `:root` şablonu paylaşıyor, ayrı bir konsolidasyon turu gerekir), `bulmaca`/`politika`/`sozluk` grubu (üçüncü bir şablon: `--bg`/`--card`/`--ink`/`--acc`), `karakapli`/`atlas` (dördüncü şablon). `karanlik-oda` kasıtlı olarak dışarıda bırakılmalı — kendine özgü noir tasarım dili var, paylaşılan "kağıt" estetiğine zorlanmamalı.
- **PWA — kısmen tamamlandı.** Lunapark'taki 9 araca (verandle, Atlas, Sancak, Karanlık Oda, Jenerik, Dört Sürü, Kur, Dört Demet, Aşı, Günün Yıldızları) `manifest.json` + SVG ikon eklendi. Kalan 14 oyun (sözlük, karşılık, siir-defteri, nota, karakapli, bulmaca, politika, bitki, kus, karanlik-oda hariç film aile üyeleri yok zaten dahil, vs.) hâlâ yok. PNG 192/512 fallback + service worker/offline hiçbirinde yok.
- **Dark mode standardizasyonu — kontrol edildi, gerçek durum netleşti.** `karsilik` ve `pedantle`'da gece modu zaten VARMIŞ (yanlış alarmdı — `body.classList.toggle('gece')` deseni kullanıyorlar). Lunapark'taki 9 araçta gerçek durum: `body.gece` class (wordle/cati/sicaksoguk/pedantle/Atlas — 5 oyun) vs `data-tema` attribute (Dört Sürü/Kur/Dört Demet/Aşı/Günün Yıldızları — 5 oyun); Karanlık Oda+Jenerik kasıtlı olarak her zaman koyu (toggle yok, doğru tasarım). **Sancak'ta hiç gece modu yoktu** — gerçek eksiklik buydu, düzeltildi (`body.gece` + 🌙/☀️ buton + `sancak:gece` localStorage, tarayıcıda doğrulandı). İki mekanizmayı (class vs attribute) tek yönteme indirmek hâlâ bekliyor ama bu daha büyük/riskli bir CSS taraması gerektiriyor — kullanıcıya görünür bir sorun değil, geliştirici tutarlılığı meselesi.
- **localStorage namespace göçü — tamamlandı.** `karakapli`'nin `kk-*` anahtarları önceki oturumda `karakapli:*`'ye taşınmıştı. Bu oturumda kalan 11 oyun da `oyun:anahtar` biçimine getirildi (her biri: yeni anahtar yoksa eskiyi bir kere oku → yeni anahtara yaz → eskiyi sil): `asi` (`esbitki-tema`→`asi:tema`), `dort-demet` (`herbaryum-tema`→`dort-demet:tema`), `dort-suru` (`obek-tema`→`dort-suru:tema`), `karine` (`karine-tema`→`karine:tema`), `kur` (`es-tema`→`kur:tema`), `sozluk` (`tema`/`defter`→`sozluk:tema`/`sozluk:defter`, kaynak `veri/template.html`'den `build.py` ile yeniden üretildi), `nota` (`nota-favoriler`/`nota-loops`→`nota:favoriler`/`nota:loops`), `bitki` (`bitki-*` 7 anahtar→`bitki:*`), `kus` (`kus-*` 7 anahtar→`kus:*`), `karsilik` (`karsilik-*`→`karsilik:*`), `atlas` (`atlas_mod_gun`→`atlas:mod:gun`, eski isim kalıntısı `vt_nick`/`vt_gece`→`atlas:nick`/`atlas:gece`), `siir-defteri` (`siir_defteri_v1`→`siir-defteri:v1`, `siir_drive_cid`/`siir_drive_on`→`siir-defteri:drive-cid`/`siir-defteri:drive-on`). Her sayfa tarayıcıda eski-anahtar→yeni-anahtar göçü test edilerek doğrulandı (konsol hatası yok). Bilinçli olarak dokunulmadı: `siir-defteri`'nin dahili teşhis/yedek anahtarları (`siir_defteri_goconcesi`, `siir_defteri_yedek_*`) — bunlar kurtarma amaçlı tek seferlik yan kanallar, birincil durum değil.

## Düzeltme (önceki taramanın hatası)

- `cati`, `sicaksoguk`, `wordle` (klavye tabanlı Wordle ailesi) `user-scalable=no` kullanıyor — kullanıcı kararı: **kalsın**, klavye-tap UX'i erişilebilirlikten öncelikli tutuldu. Değişiklik yapılmayacak, kapandı.
- Araştırma ajanı karakapli'de "sidebar mobilde collapse olmuyor" demişti — kod incelemesinde (`#uygulama` grid + `.yan{position:fixed;transform:translateX(-100%)}` + `.acik-yan`/`.perde` toggle, `@media(max-width:860px)`) bunun zaten doğru bir off-canvas menü olarak kurulu olduğu görüldü; mobil önizlemede kilit ekranı da tam genişlikte, ortalanmış render oluyor (DOM inceleme ile doğrulandı). Bu madde de yanlış alarmdı, kod değişikliği yapılmadı.

## Orta öncelik

- Font-weight 800 (Playfair Display) `cati` ve `yildiz`'de var, eski oyunlarda yok — ya hepsine ekle ya cati/yildiz'i 700'e indir.
- Footer yazar atıfı bazı oyunlarda eksik (`cati`, `yildiz` "veranda" yazıyor, "yusuf veranda" değil). Tek pattern'e getir.
- Paylaşım/emoji-kopyalama butonu bazı oyunlarda göze çarpıyor, bazılarında JS-lazy. Görünürlük tutarlılığı.
- `og:image` şu an sadece hub + 2 oyunda (sozluk, bulmaca) eklendi; kalan 20 oyuna da kendi `gorsel/*.jpg` görseliyle ekle.
- Google Fonts her oyunda ayrı ayrı yükleniyor (preconnect var ama `rel="preload"` yok); font-display:swap zaten var, preload eklenebilir.

## Düşük öncelik

- Favicon: her oyunun kendi SVG'si var (iyi), ama `.png` fallback yok — küçük performans etkisi.
- `og:image` boyutu/oranı standardize edilmemiş (sosyal paylaşım kırpması test edilmeli).

## Yapıldı (bu oturumda referans)

- `nota`/`karakapli` pinch-zoom düzeltmesi, `karakapli` mobil sidebar collapse — bkz. git geçmişi.
- 23 oyun + hub'a tek satır GA4 include (`ortak/analitik.js`) — ID henüz placeholder, hesap açılınca tek dosyadan aktif olacak. `karakapli` bilinçli olarak analitikten muaf tutuldu (özel not defteri).
- `robots.txt`, `sitemap.xml`, `manifest.json` (hub), `ads.txt` placeholder, `/gizlilik/`, `/kosullar/` eklendi.

## Doğrulama notu

Bu oturumda gerçek Lighthouse/PageSpeed/Core Web Vitals ölçümü yapılmadı (deploy sonrası, canlı sitede yapılmalı). AdSense başvurusundan önce en az bir kez çalıştır.
