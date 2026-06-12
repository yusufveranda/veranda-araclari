# veranda araçları — kurulum ve otomatik yayın

Bu klasör çok araçlı sitenin tamamıdır:

```
site/
  index.html        vitrin (araç kartları)
  ortak/            ortak stil + kelime listeleri
  sozluk/           dilimin ucunda (eş-yakın-zıt anlamlılar)
  wordle/           kelimece (Türkçe Wordle)
  bulmaca/          bulmaca yardımcısı (desen arama)
```

## Hemen denemek

`index.html`'i tarayıcıda aç; her şey çalışır. Ya da `site.zip`'i Netlify'a sürükle.

## Otomatik yayın (bir kez kur, zip devri bitsin) — Claude Code ile

1. GitHub'da boş bir repo aç (örn. `veranda-araclari`).
2. Claude Code'u bu klasörde başlat ve şunu iste:
   "Bu klasörü git'e al, GitHub'daki veranda-araclari repoma push'la."
3. Netlify panelinde: **Add new project → Import an existing project → GitHub** →
   repoyu seç. Build command boş, publish directory `/` (kök). Deploy de.
4. Bitti: bundan sonra her `git push` siteyi kendiliğinden yayınlar.
   Claude Code'a "şunu değiştir, push'la" demen yeter.

## Alan adı

1. Porkbun ya da Cloudflare Registrar'dan al (yıllık ~10-12$).
2. Netlify: Site → Domain management → Add custom domain → alan adını yaz.
3. Netlify'ın verdiği DNS kayıtlarını (genelde tek CNAME + A) registrar'a gir.
   HTTPS sertifikasını Netlify kendisi kurar.

## Sözlüğü güncelleme

Sözlüğün üretim hattı `eş anlamlılar/veri/` klasöründedir (Cowork projesinde).
Yeni `index.html` üretildiğinde `site/sozluk/index.html` üzerine kopyala, push'la.

## Reklam (sonrası için)

Site birkaç sayfa içerikle oturunca Google AdSense'e başvur; onaydan sonra
verilen script `ortak/` üzerinden tüm sayfalara tek yerden eklenir.

## Sıradaki araçlar

- nota çevirici (piyano ↔ gitar): tamamen istemci tarafı, veri gerektirmez.
- bitki tanıma: görseller + soru bankası gerekir; Wikimedia Commons'tan
  telifsiz bitki fotoğraflarıyla kurulabilir.
