# Cila listesi (Phase 1 backlog)

2026-07-08 üç ajanlı taramadan (site altyapısı, 8 oyun karşılaştırması, dış AdSense/SEO/PWA/erişilebilirlik araştırması) çıkan, bu oturumda YAPILMAYAN maddeler. Sırayla, her oyunda önizleme kontrolüyle ilerlensin — hepsini aynı anda değiştirmek görsel kırılma riski taşıyor.

## Yüksek öncelik

- **CSS token konsolidasyonu**: 13/19+ oyun `../ortak/stil.css` yerine kendi `<style>` bloğunu embed ediyor (aynı `--kirmizi`/`--kagit` değerlerini elle kopyalayarak). Hedef: ortak bir `ortak/tokens.css` + her oyunun kendine özgü override'ları. Fable 5 ile tasarım-tutarlılık incelemesi yapıp uygulamadan önce onay al (bkz. plan dosyası).
- **PWA**: Her oyuna `manifest.json` + gerçek 192/512 PNG ikon seti (şu an sadece hub'da SVG "any" ikon var — MVP). Service worker + offline fallback sonrası.
- **Dark mode standardizasyonu**: 3 farklı toggle yöntemi var (`data-tema` attr / `.gece` class / `body.gece`). Tek yönteme (`.gece` class) geçir; `karsilik` ve `pedantle`'da dark mode eksik/eksik olabilir, tekrar kontrol et.
- **localStorage namespace göçü**: `karakapli`'nin `kk-*` anahtarları bu oturumda `karakapli:*`'ye taşındı (bkz. Phase 2). Diğer oyunlarda da `nota-*` gibi tire-tabanlı anahtarlar var; hepsini `oyun:anahtar` biçimine getir, eski anahtarı bir kere okuyup göç ettir.

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
