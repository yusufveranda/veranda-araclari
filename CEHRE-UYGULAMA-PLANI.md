# Çehre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ünlü tanıma oyunu "Çehre" — Burun/Gözler/Ağız sekmeli, üç bağımsız günlük bulmaca; her bulmaca bağlamsal yüz kesitiyle başlar, yanlış tahminlerde diğer organlar sırayla açılır.

**Architecture:** Mutfak (proje kökü, git dışı) Wikidata'dan ticari-güvenli lisanslı ünlü fotoğrafları toplar, YuNet yüz-nirengi modeliyle burun/göz/ağız kesitlerini otomatik çıkarır ve kalite filtresinden geçirir. Üretim betiği havuzu üç sekmeye böler ve günlük sırayı `site/cehre/puzzles.js`'e yazar. Ön yüz tek dosyalık `site/cehre/index.html` (diğer oyunlarla aynı desen: inline CSS+JS, `../ortak/nav-panel.js`, jenerik.html'deki autocomplete/fold/EPOCH kalıpları).

**Tech Stack:** Python 3 (urllib, opencv-python 4.13 FaceDetectorYN/YuNet, Pillow), vanilla JS/HTML/CSS (framework yok), GitHub Pages statik barındırma.

## Global Constraints

- Görsel lisansı: yalnız CC0/CC-BY/CC-BY-SA/kamu malı (Wikimedia Commons `extmetadata.License`) — CC-BY-NC ve "fair use" KESİN yasak (spec: Ünlü havuzu ve görsel kaynağı).
- ~~Kesitler bağlamsal olacak (sadece organ değil, çevresi de dahil) — dar/soyut kesit YASAK~~ **REVİZE (2026-07-21, kullanıcı geri bildirimi — bkz. Task 10-13):** ilk gösterilen kesit gerçekten SIKI/organ-odaklı olacak (neredeyse tüm yüzü göstermeyecek kadar dar); "bağlamsallık" artık kademeli zoom-out'un SONUNDA ortaya çıkıyor, başta değil.
- Üç sekmede günün kişileri birbirinden farklı olacak, asla çakışmayacak (spec: Kişi paylaşımı kararı).
- Tahmin girişi otomatik tamamlamalı metin kutusu olacak, çoktan seçmeli DEĞİL (spec: Tahmin girişi kararı).
- Puan ölçeği tam olarak `[100, 80, 60, 40, 25, 15]`, 6 deneme (spec: Puan ölçeği kararı).
- ~~Organ açılış eşiği: 3 yanlıştan sonra 2. organ, 5 yanlıştan sonra 3. organ~~ **REVİZE:** 3 yanlıştan sonra 2. zoom seviyesi (aynı organ, daha geniş kesit), 5 yanlıştan sonra (2 yanlış daha) 3. zoom seviyesi, toplam 6 hak — eşik SAYILARI aynı kaldı, açılan şey "farklı organ" değil "aynı organın daha geniş kesiti".
- Ünlü havuzu ünlülük filtresinden geçmeli (Wikidata sitelinks eşiği) — hem "son ~20 yılda hâlâ tanınan" hem "çok eski ama Mozart/Marx düzeyinde ünlü" olanları geçirir, obscure/niş figürleri eler (spec: kullanıcı geri bildirimi 2026-07-21).
- Tam ekran genişliği kuralı: sayfada belirgin yatay/dikey boş alan KALMAYACAK — [[tam-ekran-genisligi]] hafıza kaydı, "SON UYARI" + 2026-07-21 tekrar ihlali notu.
- Paylaşım Wordle-tarzı emoji ızgarası + puan olacak (spec: Paylaşım kararı).
- v1'de leaderboard YOK (spec: Leaderboard kararı).
- Em dash hiçbir metinde kullanılmayacak (proje-geneli kural).
- Mutfak dosyaları (`cehre-mutfak/`) proje kökünde, git dışı — yalnız `site/cehre/*` ve `site/oyunlar/index.html` değişiklikleri git'e girer (site/ git deposu, proje kökü değil).

---

### Task 1: Wikidata ünlü havuzu hasadı (lisans filtreli)

**Files:**
- Create: `cehre-mutfak/wikidata_harvest.py`

**Interfaces:**
- Consumes: yok (ilk adım).
- Produces: `cehre-mutfak/havuz-ham.json` — liste of `{"qid": str, "isim": str, "resim_url": str, "lisans": str, "kaynak_sayfa": str}`. Task 2 bu dosyayı okuyacak.

- [ ] **Step 1: Betiği yaz**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
wikidata_harvest.py — Çehre oyunu için Wikidata'dan ünlü + fotoğraf hasadı.

Wikidata SPARQL'dan meslek listesindeki (oyuncu/müzisyen/sporcu/politikacı/
yönetmen/sunucu) ve P18 (fotoğraf) alanı dolu kişileri çeker, her fotoğrafın
Wikimedia Commons lisansını TİCARİ-GÜVENLİ (CC0/CC-BY/CC-BY-SA/kamu malı)
olup olmadığına göre süzer. bitki_harvest.py'deki lisans-regex deseniyle
aynı mantık (CC-BY-NC ASLA kabul edilmez).

Kullanım:
  python3 wikidata_harvest.py                 # tam hasat (varsayılan 2000 kişi)
  python3 wikidata_harvest.py --limit 200      # deneme
  python3 wikidata_harvest.py --self-test      # tek bilinen kişiyle (Q76) doğrulama
"""

import json, re, sys, time, argparse, urllib.parse, urllib.request
from pathlib import Path

KOK = Path(__file__).resolve().parent
CIKTI = KOK / "havuz-ham.json"
UA = "VerandaCehre/1.0 (https://verandatools.com; yuz-tanima oyunu)"

SPARQL_URL = "https://query.wikidata.org/sparql"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"

# meslek qid'leri: oyuncu, müzisyen, şarkıcı, sporcu, politikacı, yönetmen, TV sunucusu
MESLEKLER = ["wd:Q33999", "wd:Q639669", "wd:Q177220", "wd:Q2066131",
             "wd:Q82955", "wd:Q2526255", "wd:Q10800557"]

GUVENLI_KOD = re.compile(r"^(cc0|cc-pd|pd|pdm|cc-by(-sa)?(-\d(\.\d)?)?(-[a-z]{2})?|no restrictions)", re.I)
YASAK = re.compile(r"(nc|fair use|all rights|non-?free|gfdl)", re.I)


def http_json(url, headers=None, deneme=3):
    son = None
    for i in range(deneme):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            son = e
            time.sleep(1.5 * (i + 1))
    print(f"  ! istek hatası: {son}")
    return None


def temiz(s):
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"&#?\w+;", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def sparql_sorgula(limit):
    meslek_values = " ".join(MESLEKLER)
    sorgu = f"""
    SELECT DISTINCT ?person ?personLabel ?image WHERE {{
      ?person wdt:P31 wd:Q5;
              wdt:P106 ?meslek;
              wdt:P18 ?image.
      VALUES ?meslek {{ {meslek_values} }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "tr,en". }}
    }}
    LIMIT {limit}
    """
    url = SPARQL_URL + "?query=" + urllib.parse.quote(sorgu) + "&format=json"
    d = http_json(url, headers={"Accept": "application/sparql-results+json"})
    if not d:
        return []
    out = []
    for b in d.get("results", {}).get("bindings", []):
        qid = b["person"]["value"].rsplit("/", 1)[-1]
        isim = temiz(b.get("personLabel", {}).get("value", ""))
        img_url = b["image"]["value"]
        if not isim or isim.startswith("Q"):   # etiket yoksa qid döner, atla
            continue
        out.append({"qid": qid, "isim": isim, "commons_url": img_url})
    return out


def commons_lisans(commons_url):
    """Special:FilePath URL'inden dosya adını çıkar, Commons API ile lisansı doğrula."""
    dosya = urllib.parse.unquote(commons_url.rsplit("/", 1)[-1])
    url = (COMMONS_API + "?action=query&format=json&prop=imageinfo"
           "&iiprop=url|extmetadata&iiurlwidth=1200&titles="
           + urllib.parse.quote("File:" + dosya))
    d = http_json(url)
    if not d:
        return None
    pages = d.get("query", {}).get("pages", {}) or {}
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii:
            continue
        em = ii.get("extmetadata", {}) or {}
        kod = (em.get("License", {}) or {}).get("value", "")
        kisa = temiz((em.get("LicenseShortName", {}) or {}).get("value", ""))
        if YASAK.search(kod) or YASAK.search(kisa):
            continue
        if not (GUVENLI_KOD.search(kod) or GUVENLI_KOD.search(kisa.replace(" ", "-"))
                or "public domain" in kisa.lower() or kisa.lower().startswith("cc")):
            continue
        thumb = ii.get("thumburl") or ii.get("url")
        w = ii.get("thumbwidth") or ii.get("width") or 0
        if not thumb or w < 300:      # yüz kesiti için asgari çözünürlük
            continue
        sayfa = "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(dosya.replace(" ", "_"))
        return {"resim_url": thumb, "lisans": kisa or kod or "CC", "kaynak_sayfa": sayfa}
    return None


def hasat(limit):
    adaylar = sparql_sorgula(limit)
    print(f"{len(adaylar)} aday Wikidata'dan geldi, lisans doğrulanıyor...")
    sonuc, gorulen = [], set()
    for i, a in enumerate(adaylar):
        if a["qid"] in gorulen:
            continue
        lisans = commons_lisans(a["commons_url"])
        time.sleep(0.3)
        if not lisans:
            continue
        gorulen.add(a["qid"])
        sonuc.append({"qid": a["qid"], "isim": a["isim"], **lisans})
        if (i + 1) % 50 == 0:
            print(f"  ... {i+1}/{len(adaylar)} tarandı, {len(sonuc)} geçerli")
    return sonuc


def self_test():
    """Bilinen tek kişiyle (Q76, Barack Obama) uçtan uca doğrulama."""
    lisans = commons_lisans("http://commons.wikimedia.org/wiki/Special:FilePath/President%20Barack%20Obama.jpg")
    assert lisans is not None, "Q76 fotoğrafı için lisans bulunamadı (Commons API değişmiş olabilir)"
    assert lisans["resim_url"].startswith("http"), "resim_url geçerli bir URL değil"
    print("self-test OK:", lisans)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=2000)
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()

    if a.self_test:
        self_test()
        return

    sonuc = hasat(a.limit)
    CIKTI.write_text(json.dumps(sonuc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nBitti. {len(sonuc)} kişi yazıldı: {CIKTI}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Self-test çalıştır**

Run: `cd cehre-mutfak && python3 wikidata_harvest.py --self-test`
Expected: `self-test OK: {'resim_url': 'https://...', 'lisans': '...', 'kaynak_sayfa': 'https://commons.wikimedia.org/...'}` yazdırır, `AssertionError` fırlatmaz.

- [ ] **Step 3: Küçük ölçekte gerçek hasat dene**

Run: `python3 wikidata_harvest.py --limit 100`
Expected: konsolda `N aday Wikidata'dan geldi...` ve sonunda `Bitti. M kişi yazıldı: .../havuz-ham.json` (M genelde N'in yarısından fazlası — lisans/çözünürlük filtresinden geçen). `havuz-ham.json` dosyasını aç, en az 20 girdi olduğunu ve her girdide `qid/isim/resim_url/lisans/kaynak_sayfa` alanlarının dolu olduğunu gözle doğrula.

- [ ] **Step 4: Not — commit yok**

`cehre-mutfak/` proje kökünde ve git dışı (bkz. Global Constraints). Bu dosya için git işlemi yapılmaz.

---

### Task 2: Yüz nirengi tespiti ile burun/göz/ağız kesiti çıkarma + kalite filtresi

**Files:**
- Create: `cehre-mutfak/yuz_kesit.py`
- Reuse (kopyalanmayacak, doğrudan yol referansı): `karanlik-oda-mutfak/yunet.onnx`

**Interfaces:**
- Consumes: `cehre-mutfak/havuz-ham.json` (Task 1 çıktısı).
- Produces: `cehre-mutfak/kesitler/{qid}/{burun,gozler,agiz}.webp` dosyaları + `cehre-mutfak/havuz.json` — yalnız üç kesiti de geçerli olan kişilerin listesi: `{"qid": str, "isim": str, "kesit": {"burun": "kesitler/{qid}/burun.webp", "gozler": "...", "agiz": "..."}}`. Task 3 bu dosyayı okuyacak.

- [ ] **Step 1: Betiği yaz**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
yuz_kesit.py — havuz-ham.json'daki fotoğraflardan YuNet ile yüz nirengi
noktaları bulur, burun/gözler/ağız için BAĞLAMSAL (yalnız organ değil,
çevresi de dahil) kesitler üretir. Düşük kalite/profil/küçük yüzleri eler.

Kullanım:
  python3 yuz_kesit.py                # havuz-ham.json'daki herkesi işle
  python3 yuz_kesit.py --limit 50     # deneme
  python3 yuz_kesit.py --self-test    # yerel örnek görselle doğrulama
"""

import json, sys, time, argparse, urllib.request
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

KOK = Path(__file__).resolve().parent
GIRDI = KOK / "havuz-ham.json"
CIKTI = KOK / "havuz.json"
KESIT_DIZIN = KOK / "kesitler"
MODEL = KOK.parent / "karanlik-oda-mutfak" / "yunet.onnx"
UA = "VerandaCehre/1.0 (https://verandatools.com; yuz-tanima oyunu)"

SKOR_ESIK = 0.85
MIN_GOZ_MESAFESI = 40   # piksel — bu kadar küçükse çözünürlük yetersiz
MIN_YAW_ORAN = 0.28     # göz-mesafesi / yüz-genişliği bu orandan küçükse profil kabul edilir


def indir(url, hedef):
    if hedef.exists():
        return True
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            hedef.write_bytes(r.read())
        return True
    except Exception as e:
        print(f"    ! indirme hatası: {e}")
        return False


def dedektor_yukle():
    if not MODEL.exists():
        sys.exit(f"HATA: {MODEL} yok (karanlik-oda-mutfak/yunet.onnx bulunamadı)")
    return cv2.FaceDetectorYN.create(str(MODEL), "", (0, 0), score_threshold=SKOR_ESIK)


def en_iyi_yuz(det, img):
    """img üzerinde yüz tespiti yapar, en yüksek skorlu tek yüzü döner ya da None."""
    h, w = img.shape[:2]
    det.setInputSize((w, h))
    _, faces = det.detect(img)
    if faces is None or len(faces) == 0:
        return None
    faces = sorted(faces, key=lambda f: -f[-1])
    return faces[0]   # [x,y,w,h, x_re,y_re, x_le,y_le, x_nt,y_nt, x_rcm,y_rcm, x_lcm,y_lcm, skor]


def kirp(img, cx, cy, genislik, yukseklik):
    h, w = img.shape[:2]
    x0 = int(max(0, cx - genislik / 2))
    y0 = int(max(0, cy - yukseklik / 2))
    x1 = int(min(w, cx + genislik / 2))
    y1 = int(min(h, cy + yukseklik / 2))
    if x1 - x0 < 20 or y1 - y0 < 20:
        return None
    return img[y0:y1, x0:x1]


def kesitleri_uret(img, yuz):
    box_w = yuz[2]
    x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm = yuz[4:14]
    d = float(np.hypot(x_le - x_re, y_le - y_re))   # göz-arası mesafe, ölçek birimi

    if d < MIN_GOZ_MESAFESI or d / box_w < MIN_YAW_ORAN:
        return None   # çözünürlük yetersiz ya da aşırı profil

    ex, ey = (x_re + x_le) / 2, (y_re + y_le) / 2
    mx, my = (x_rcm + x_lcm) / 2, (y_rcm + y_lcm) / 2

    kesitler = {
        "burun": kirp(img, x_nt, y_nt, d * 1.9, d * 1.7),
        "gozler": kirp(img, ex, ey, d * 2.3, d * 1.2),
        "agiz": kirp(img, mx, my, d * 2.0, d * 1.5),
    }
    if any(v is None for v in kesitler.values()):
        return None
    return kesitler


def isle_kisi(det, kisi, dizin):
    dizin.mkdir(parents=True, exist_ok=True)
    ham = dizin / "ham.jpg"
    if not indir(kisi["resim_url"], ham):
        return False
    img = cv2.imread(str(ham))
    if img is None:
        return False
    yuz = en_iyi_yuz(det, img)
    if yuz is None:
        return False
    kesitler = kesitleri_uret(img, yuz)
    if kesitler is None:
        return False
    for ad, kesit in kesitler.items():
        rgb = cv2.cvtColor(kesit, cv2.COLOR_BGR2RGB)
        Image.fromarray(rgb).save(dizin / f"{ad}.webp", "WEBP", quality=85)
    ham.unlink(missing_ok=True)
    return True


def self_test():
    """Yerel test görseli olmadan modelin yüklenip çalıştığını doğrular (boş kare)."""
    det = dedektor_yukle()
    bos = np.zeros((300, 300, 3), dtype=np.uint8)
    yuz = en_iyi_yuz(det, bos)
    assert yuz is None, "boş karede yüz bulunmamalıydı"
    print("self-test OK: model yüklendi, boş karede yüz tespit edilmedi (beklenen davranış)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()

    if a.self_test:
        self_test()
        return

    if not GIRDI.exists():
        sys.exit(f"HATA: {GIRDI} yok. Önce wikidata_harvest.py çalıştırılmalı.")

    havuz_ham = json.loads(GIRDI.read_text(encoding="utf-8"))
    hedef = havuz_ham[:a.limit] if a.limit else havuz_ham
    det = dedektor_yukle()

    gecerli = []
    for i, kisi in enumerate(hedef):
        dizin = KESIT_DIZIN / kisi["qid"]
        ok = isle_kisi(det, kisi, dizin)
        if ok:
            gecerli.append({
                "qid": kisi["qid"], "isim": kisi["isim"],
                "kesit": {ad: f"kesitler/{kisi['qid']}/{ad}.webp" for ad in ("burun", "gozler", "agiz")},
            })
        if (i + 1) % 25 == 0:
            print(f"  ... {i+1}/{len(hedef)} işlendi, {len(gecerli)} geçerli")

    CIKTI.write_text(json.dumps(gecerli, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nBitti. {len(gecerli)}/{len(hedef)} kişi geçerli kesitle yazıldı: {CIKTI}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Self-test çalıştır**

Run: `cd cehre-mutfak && python3 yuz_kesit.py --self-test`
Expected: `self-test OK: model yüklendi, boş karede yüz tespit edilmedi (beklenen davranış)`. Hata varsa (`HATA: .../yunet.onnx yok`) `karanlik-oda-mutfak/yunet.onnx` dosyasının yerinde olduğunu doğrula.

- [ ] **Step 3: Küçük ölçekte gerçek hasat üzerinde dene**

Run: `python3 yuz_kesit.py --limit 20`
Expected: `Bitti. N/20 kişi geçerli kesitle yazıldı: .../havuz.json` (N tipik olarak 10-18 arası — bazı fotoğraflar profilden/düşük çözünürlükte elenir). `kesitler/{qid}/` altında `burun.webp`, `gozler.webp`, `agiz.webp` dosyalarının var olduğunu ve görsel olarak açılabildiğini (Finder'da önizleme) gözle doğrula.

- [ ] **Step 4: Not — commit yok**

`cehre-mutfak/` git dışı, bu dosya için git işlemi yapılmaz.

---

### Task 3: Günlük bulmaca üretimi (üç sekmeye bölme + puzzles.js yazımı)

**Files:**
- Create: `cehre-mutfak/cehre_uret.py`
- Produces (site tarafı, git'e girecek): `site/cehre/puzzles.js`, `site/cehre/gorseller/{qid}/{burun,gozler,agiz}.webp`

**Interfaces:**
- Consumes: `cehre-mutfak/havuz.json` (Task 2 çıktısı) — her girdi `{"qid","isim","kesit":{"burun","gozler","agiz"}}`.
- Produces: `site/cehre/puzzles.js` global değişkenleri:
  - `window.CEHRE_KISILER = {"<qid>": {"isim": str, "g": {"burun": "gorseller/<qid>/burun.webp", "gozler": "...", "agiz": "..."}}}`
  - `window.CEHRE_SEKME = {"burun": ["<qid>", ...], "gozler": [...], "agiz": [...]}` — dizin sırası = gün sırası.
  Task 5-7 (index.html) bu iki değişkeni okuyacak.

- [ ] **Step 1: Betiği yaz**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cehre_uret.py — havuz.json'daki kişileri üç sekmeye (burun/gozler/agiz)
KALICI ve ÇAKIŞMASIZ şekilde böler (her kişi tam olarak bir sekmeye ait),
her sekme içinde sabit seed'le karıştırır (gün sırası = dizin sırası,
sonradan yeniden çalıştırıldığında sıra DEĞİŞMEZ çünkü seed sabit) ve
site/cehre/puzzles.js'i yazar. Kesit webp dosyalarını site/cehre/gorseller/
altına kopyalar.

Kullanım:
  python3 cehre_uret.py
"""

import json, random, shutil
from pathlib import Path

KOK = Path(__file__).resolve().parent
GIRDI = KOK / "havuz.json"
SITE = KOK.parent / "site" / "cehre"
PUZZLES = SITE / "puzzles.js"
GORSEL_HEDEF = SITE / "gorseller"

SEKMELER = ("burun", "gozler", "agiz")
SEED = 20260721   # EPOCH tarihiyle eşleşir, DEĞİŞTİRME (gün sırası kayar)


def sekme_ata(qid):
    """qid'yi kalıcı olarak bir sekmeye atar (kişi bazlı, deterministik)."""
    return SEKMELER[_stabil_hash(qid) % 3]


def _stabil_hash(s):
    # Python'un yerleşik hash()'i çalıştırmalar arası tuzlanır (PYTHONHASHSEED);
    # gün sırasının kararlı kalması için basit sabit bir string-hash kullan.
    h = 0
    for ch in s:
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return h


def main():
    if not GIRDI.exists():
        raise SystemExit(f"HATA: {GIRDI} yok. Önce yuz_kesit.py çalıştırılmalı.")

    havuz = json.loads(GIRDI.read_text(encoding="utf-8"))
    gruplar = {s: [] for s in SEKMELER}
    for kisi in havuz:
        gruplar[sekme_ata(kisi["qid"])].append(kisi)

    kisiler, sekme_listeleri = {}, {}
    rnd = random.Random(SEED)
    for s in SEKMELER:
        grup = gruplar[s][:]
        rnd.shuffle(grup)
        sekme_listeleri[s] = [k["qid"] for k in grup]
        for k in grup:
            kisiler[k["qid"]] = {"isim": k["isim"], "g": k["kesit"]}

    GORSEL_HEDEF.mkdir(parents=True, exist_ok=True)
    for kisi in havuz:
        kaynak_dizin = KOK / "kesitler" / kisi["qid"]
        hedef_dizin = GORSEL_HEDEF / kisi["qid"]
        hedef_dizin.mkdir(parents=True, exist_ok=True)
        for organ in SEKMELER:
            src = kaynak_dizin / f"{organ}.webp"
            if src.exists():
                shutil.copyfile(src, hedef_dizin / f"{organ}.webp")

    icerik = (
        "window.CEHRE_KISILER=" + json.dumps(kisiler, ensure_ascii=False) + ";\n"
        "window.CEHRE_SEKME=" + json.dumps(sekme_listeleri, ensure_ascii=False) + ";\n"
    )
    PUZZLES.write_text(icerik, encoding="utf-8")

    for s in SEKMELER:
        print(f"{s}: {len(sekme_listeleri[s])} kişi")
    print(f"\nYazıldı: {PUZZLES}")
    print(f"Görseller kopyalandı: {GORSEL_HEDEF}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Bir önceki task'ın küçük-ölçek çıktısıyla dene**

Run: `cd cehre-mutfak && python3 cehre_uret.py`
Expected: `burun: N kişi`, `gozler: M kişi`, `agiz: K kişi` (N+M+K = Task 2'deki toplam geçerli kişi sayısı), ardından `Yazıldı: .../site/cehre/puzzles.js` ve `Görseller kopyalandı: .../site/cehre/gorseller`.

- [ ] **Step 3: Çıktıyı doğrula**

Run: `python3 -c "exec(open('../site/cehre/puzzles.js').read().replace('window.','').rstrip(';\n')); print(len(CEHRE_KISILER), len(CEHRE_SEKME['burun']))"`
Expected: iki sayı yazdırır, ikisi de 0'dan büyük ve `CEHRE_SEKME` içindeki üç listenin toplamı `CEHRE_KISILER` uzunluğuna eşit.

- [ ] **Step 4: site/ dosyalarını commit'le**

```bash
cd "../site" && git add cehre/puzzles.js cehre/gorseller && git commit -m "Çehre: ilk veri hasadı (puzzles.js + görseller)" && git push
```

---

### Task 4: Oyun kabuğu — HTML/CSS iskeleti, sekmeler, günün kesitini gösterme

**Files:**
- Create: `site/cehre/index.html`
- Create: `site/cehre/manifest.json`
- Create: `site/cehre/icon.svg`

**Interfaces:**
- Consumes: `site/cehre/puzzles.js` (Task 3) — `window.CEHRE_KISILER`, `window.CEHRE_SEKME`.
- Produces: sayfa yüklendiğinde 3 sekme arasında geçiş yapılabilir, aktif sekmenin günün kişisine ait BAŞLANGIÇ organı (sekme adına karşılık gelen) gösterilir. Task 5, bu dosyaya tahmin/skor mantığını ekleyecek (aynı dosya, sonraki task'ta genişletilir).

- [ ] **Step 1: manifest.json ve icon.svg oluştur**

`site/cehre/manifest.json`:
```json
{
  "name": "Çehre — Ünlü Tanıma Oyunu",
  "short_name": "Çehre",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#0c0a09",
  "theme_color": "#0c0a09",
  "icons": [{"src": "icon.svg", "sizes": "any", "type": "image/svg+xml"}]
}
```

`site/cehre/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0c0a09"/><circle cx="32" cy="30" r="14" fill="none" stroke="#e2a13f" stroke-width="3"/><circle cx="27" cy="27" r="2" fill="#e2a13f"/><circle cx="37" cy="27" r="2" fill="#e2a13f"/><path d="M27 36 Q32 40 37 36" stroke="#e2a13f" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>
```

- [ ] **Step 2: index.html iskeletini yaz**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<script src="../ortak/analitik.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Çehre — Ünlüyü yüzünden tanı</title>
<meta name="description" content="Burun, göz ya da ağız kesitinden günün ünlüsünü çıkar. Yanlış tahminde yeni bir organ açılır.">
<meta name="theme-color" content="#0c0a09">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Special+Elite&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box; margin:0; padding:0;}
  html{color-scheme:dark;}
  :root{
    --bg:#0c0a09; --card:#1a1614; --border:#2e2724;
    --paper:#efe9dc; --text:#ece7de; --muted:#94897c;
    --accent:#e2a13f; --ok:#7cb46b; --bad:#e5382e;
  }
  body{background:var(--bg); color:var(--text); font-family:"Inter",-apple-system,sans-serif;
    min-height:100dvh; padding:22px clamp(12px,3vw,44px) 90px;}
  .wrap{max-width:760px; margin:0 auto;}
  h1{font-family:"Special Elite",cursive; font-size:28px; color:var(--accent); margin-bottom:4px;}
  .tagline{font-size:13px; color:var(--muted); margin-bottom:18px;}

  .sekmeler{display:flex; gap:8px; margin-bottom:18px;}
  .sekme-btn{flex:1; background:var(--card); border:1px solid var(--border); color:var(--muted);
    border-radius:6px; padding:10px; font-size:14px; cursor:pointer; font-weight:600;}
  .sekme-btn.aktif{color:var(--accent); border-color:var(--accent);}

  .portre-alan{display:flex; gap:10px; justify-content:center; margin-bottom:20px; min-height:160px;}
  .kesit{width:150px; height:150px; border:3px solid var(--paper); border-radius:4px;
    overflow:hidden; background:#000;}
  .kesit img{width:100%; height:100%; object-fit:cover; display:block;}
  .kesit.kilitli{display:flex; align-items:center; justify-content:center; color:var(--border); font-size:32px;}

  .guess-row{display:flex; gap:8px; margin-bottom:10px; position:relative;}
  .guess-row input{flex:1; background:var(--card); border:1px solid var(--border); color:var(--text);
    border-radius:6px; padding:14px 16px; font-size:16px; outline:none;}
  .guess-row button{background:var(--accent); color:#1a1614; border:none; border-radius:6px;
    padding:0 22px; font-weight:600; cursor:pointer;}
  .guess-row button:disabled{opacity:.35; cursor:default;}
  .ac-list{position:absolute; top:56px; left:0; right:70px; background:var(--card);
    border:1px solid var(--border); border-radius:6px; max-height:220px; overflow-y:auto; z-index:5; display:none;}
  .ac-item{padding:10px 14px; cursor:pointer; font-size:14px;}
  .ac-item:hover, .ac-item.sel{background:var(--border);}

  .durum{font-size:13px; color:var(--muted); min-height:20px; margin-bottom:8px;}
  .durum.iyi{color:var(--ok);} .durum.kotu{color:var(--bad);}
  .puan{font-size:13px; color:var(--muted);}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Çehre</h1>
    <p class="tagline">Yüz kesitinden günün ünlüsünü çıkar.</p>
  </header>

  <div class="sekmeler">
    <button class="sekme-btn" data-sekme="burun">Burun</button>
    <button class="sekme-btn" data-sekme="gozler">Gözler</button>
    <button class="sekme-btn" data-sekme="agiz">Ağız</button>
  </div>

  <div class="portre-alan" id="portreAlan"></div>

  <div class="guess-row">
    <input type="text" id="guessInput" placeholder="İsim yaz…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button id="guessBtn" disabled>Tahmin</button>
    <div class="ac-list" id="acList"></div>
  </div>
  <div class="durum" id="durum"></div>
  <div class="puan" id="puanAlan"></div>
</div>
<script src="puzzles.js"></script>
<script>
const $ = id => document.getElementById(id);
const esc = s => (s||"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const EPOCH = new Date("2026-07-21T00:00:00");
const KISILER = window.CEHRE_KISILER || {};
const SEKME = window.CEHRE_SEKME || {burun:[], gozler:[], agiz:[]};
const SIRA = {burun:["burun","gozler","agiz"], gozler:["gozler","burun","agiz"], agiz:["agiz","burun","gozler"]};

function gunIndex(sekmeAdi){
  const gun = Math.floor((Date.now() - EPOCH.getTime()) / 86400000);
  const n = SEKME[sekmeAdi].length;
  return n ? ((gun % n) + n) % n : 0;
}

function gununKisisi(sekmeAdi){
  const qid = SEKME[sekmeAdi][gunIndex(sekmeAdi)];
  return {qid, ...KISILER[qid]};
}

let aktifSekme = "burun";

function renderPortre(){
  const kisi = gununKisisi(aktifSekme);
  const sira = SIRA[aktifSekme];
  const acikSayisi = 1;   // Task 5'te wrongCount'a göre güncellenecek
  $("portreAlan").innerHTML = sira.map((organ, i) =>
    i < acikSayisi
      ? `<div class="kesit"><img src="${kisi.g[organ]}" alt="yüz kesiti"></div>`
      : `<div class="kesit kilitli">?</div>`
  ).join("");
}

document.querySelectorAll(".sekme-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sekme-btn").forEach(b => b.classList.remove("aktif"));
    btn.classList.add("aktif");
    aktifSekme = btn.dataset.sekme;
    renderPortre();
  });
});
document.querySelector('.sekme-btn[data-sekme="burun"]').classList.add("aktif");
renderPortre();
</script>
<script src="../ortak/nav-panel.js"></script>
</body>
</html>
```

- [ ] **Step 3: Tarayıcıda doğrula**

`preview_start` ile bir statik sunucu aç (`.claude/launch.json`'da yoksa `{"name":"site","runtimeExecutable":"python3","runtimeArgs":["-m","http.server","8123"],"port":8123}` ekle, `site/` dizininden çalıştır), `http://localhost:8123/cehre/` adresine git.

Expected: "Çehre" başlığı, 3 sekme butonu, Burun sekmesi aktif ve tek bir kesit görseli (kilitli olmayan) + iki kilitli "?" kutusu görünür. Gözler/Ağız sekmelerine tıklayınca görsel değişir (`read_page` veya `computer screenshot` ile doğrula). Konsol hatası olmamalı (`read_console_messages`).

- [ ] **Step 4: Commit'le**

```bash
cd "site" && git add cehre/index.html cehre/manifest.json cehre/icon.svg && git commit -m "Çehre: oyun kabuğu ve sekme iskeleti" && git push
```

---

### Task 5: Otomatik tamamlamalı tahmin girişi + organ açılış kademesi + puanlama

**Files:**
- Modify: `site/cehre/index.html` (Task 4'teki `<script>` bloğu genişletilir)

**Interfaces:**
- Consumes: Task 4'teki `gununKisisi()`, `renderPortre()`, `SIRA`, `aktifSekme`, `$`, `esc`.
- Produces: `state[sekme]` nesnesi `{wrong:int, solved:bool, score:int|null}`; `submit()`, `showAc()`, `choose()` fonksiyonları — Task 6 bu state'i localStorage'a yazacak, Task 7 paylaşım metninde okuyacak.

- [ ] **Step 1: `renderPortre` içindeki sabit `acikSayisi=1` satırını kaldır, state'e bağlı hale getir; tahmin mantığını ekle**

`</script>` etiketinden önceki JS bloğunu şu şekilde genişlet (Task 4'teki `renderPortre`, sekme-tık dinleyicisi ve son iki satırı SİL, yerine koy):

```javascript
const PUAN = [100, 80, 60, 40, 25, 15];
const TUM_ISIMLER = Object.entries(KISILER).map(([qid, k]) => ({qid, isim: k.isim}));

let state = {burun: bosDurum(), gozler: bosDurum(), agiz: bosDurum()};
function bosDurum(){ return {wrong: 0, solved: false, score: null, over: false}; }

function acikOrganSayisi(wrong){
  if (wrong >= 5) return 3;
  if (wrong >= 3) return 2;
  return 1;
}

function renderPortre(){
  const kisi = gununKisisi(aktifSekme);
  const sira = SIRA[aktifSekme];
  const s = state[aktifSekme];
  const acikSayisi = s.over ? 3 : acikOrganSayisi(s.wrong);
  $("portreAlan").innerHTML = sira.map((organ, i) =>
    i < acikSayisi
      ? `<div class="kesit"><img src="${kisi.g[organ]}" alt="yüz kesiti"></div>`
      : `<div class="kesit kilitli">?</div>`
  ).join("");
  $("guessInput").disabled = s.over;
  $("guessBtn").disabled = true;
  $("puanAlan").textContent = s.solved ? `Bu sekmede puanın: ${s.score}` : "";
  $("durum").textContent = "";
  $("durum").className = "durum";
  if (s.over && !s.solved) {
    $("durum").textContent = `Hakların bitti. Cevap: ${kisi.isim}`;
    $("durum").className = "durum kotu";
  }
}

const fold = s => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
let acResults = [], acIdx = -1;

function showAc(){
  const q = fold($("guessInput").value.trim());
  $("guessBtn").disabled = true;
  if (q.length < 2){ hideAc(); return; }
  const starts = [], contains = [];
  for (const p of TUM_ISIMLER){
    const t = fold(p.isim);
    if (t.startsWith(q)) starts.push(p);
    else if (t.includes(q)) contains.push(p);
    if (starts.length >= 8) break;
  }
  acResults = [...starts, ...contains].slice(0, 8);
  acIdx = -1;
  if (!acResults.length){ hideAc(); return; }
  $("acList").innerHTML = acResults.map((r,i) => `<div class="ac-item" data-i="${i}">${esc(r.isim)}</div>`).join("");
  $("acList").style.display = "block";
  $("acList").querySelectorAll(".ac-item").forEach(el =>
    el.addEventListener("click", () => choose(acResults[+el.dataset.i])));
}
function hideAc(){ $("acList").style.display = "none"; acResults = []; acIdx = -1; }
let secilen = null;
function choose(p){
  secilen = p;
  $("guessInput").value = p.isim;
  $("guessBtn").disabled = false;
  hideAc();
}

function submit(){
  const s = state[aktifSekme];
  if (s.over || !secilen) return;
  const kisi = gununKisisi(aktifSekme);
  if (secilen.qid === kisi.qid){
    s.solved = true; s.over = true; s.score = PUAN[s.wrong];
    $("durum").textContent = `Doğru! ${kisi.isim} — ${s.score} puan.`;
    $("durum").className = "durum iyi";
  } else {
    s.wrong++;
    if (s.wrong >= PUAN.length){
      s.over = true;
    } else {
      $("durum").textContent = `${secilen.isim} değil.`;
      $("durum").className = "durum kotu";
    }
  }
  secilen = null;
  $("guessInput").value = "";
  $("guessBtn").disabled = true;
  renderPortre();
}

$("guessInput").addEventListener("input", showAc);
$("guessBtn").addEventListener("click", submit);
$("guessInput").addEventListener("keydown", e => {
  if (e.key === "Enter" && !$("guessBtn").disabled) submit();
});

document.querySelectorAll(".sekme-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sekme-btn").forEach(b => b.classList.remove("aktif"));
    btn.classList.add("aktif");
    aktifSekme = btn.dataset.sekme;
    hideAc();
    renderPortre();
  });
});
document.querySelector('.sekme-btn[data-sekme="burun"]').classList.add("aktif");
renderPortre();
```

- [ ] **Step 2: Tarayıcıda doğrula**

Sayfayı yeniden yükle (`navigate` aynı URL'ye ya da `javascript_tool: window.location.reload()`). `computer type` ile arama kutusuna 2+ harf yaz, `read_page` ile öneri listesinin göründüğünü doğrula, bir öneriye tıkla, "Tahmin" butonuna bas.

- Yanlış bir isim seçip 3 kez art arda gönderirsen ikinci bir kesitin (Gözler) açıldığını gözle doğrula.
- 2 yanlış daha (toplam 5) ile üçüncü kesitin (Ağız) açıldığını doğrula.
- 1 yanlış daha (toplam 6) ile "Hakların bitti. Cevap: ..." mesajının çıktığını ve girişin kilitlendiğini doğrula.
- Ayrı bir denemede, doğru kişiyi ilk tahminde bulup "100 puan" mesajı aldığını doğrula (günün kişisini `console.log(gununKisisi('burun'))` ile `javascript_tool` üzerinden öğrenebilirsin).

Expected: yukarıdaki dört davranışın hepsi gözlemlenir, konsolda hata yok.

- [ ] **Step 3: Commit'le**

```bash
cd "site" && git add cehre/index.html && git commit -m "Çehre: tahmin girişi, organ açılış kademesi, puanlama" && git push
```

---

### Task 6: localStorage kalıcılığı (sayfa yeniden yüklendiğinde günün durumu korunsun)

**Files:**
- Modify: `site/cehre/index.html`

**Interfaces:**
- Consumes: Task 5'teki `state`, `bosDurum()`, `renderPortre()`, `gunIndex()`.
- Produces: `persist()`, `yukle()` fonksiyonları; sayfa açılışında `state` localStorage'dan doldurulur.

- [ ] **Step 1: Kalıcılık fonksiyonlarını ekle**

`let state = {...}` satırını şununla değiştir:

```javascript
const LS = "cehre_v1";
function loadSave(){ try{ return JSON.parse(localStorage.getItem(LS)) || {}; }catch(e){ return {}; } }
function persist(){
  const save = loadSave();
  for (const s of ["burun", "gozler", "agiz"]) {
    save[s] = save[s] || {};
    save[s][gunIndex(s)] = state[s];
  }
  try{ localStorage.setItem(LS, JSON.stringify(save)); }catch(e){}
}
function state_yukle(){
  const save = loadSave();
  const out = {};
  for (const s of ["burun", "gozler", "agiz"]) {
    out[s] = (save[s] && save[s][gunIndex(s)]) || bosDurum();
  }
  return out;
}
let state = state_yukle();
```

`submit()` fonksiyonunun sonunda, `renderPortre();` satırından hemen önce `persist();` ekle.

- [ ] **Step 2: Tarayıcıda doğrula**

Bir sekmede 2 yanlış tahmin yap (henüz bitirme), sayfayı yeniden yükle (`navigate` aynı URL). `read_page` ile o sekmenin hâlâ 2 yanlıştan sonraki durumda (tek kesit açık, henüz 3'e ulaşmadıysa) olduğunu doğrula — `javascript_tool` ile `JSON.parse(localStorage.getItem('cehre_v1'))` çalıştırıp state'in doğru kaydedildiğini kontrol et.

Expected: state kaybolmaz, sekme kilitlenmemişse tahmin kutusu hâlâ aktiftir ve önceki yanlış-sayısı korunur.

- [ ] **Step 3: Commit'le**

```bash
cd "site" && git add cehre/index.html && git commit -m "Çehre: localStorage kalıcılığı" && git push
```

---

### Task 7: Wordle-tarzı paylaşım metni

**Files:**
- Modify: `site/cehre/index.html`

**Interfaces:**
- Consumes: Task 6'daki `state`, `gunIndex()`.
- Produces: `shareText()`, bir "Paylaş" butonu ile panoya kopyalama.

- [ ] **Step 1: Paylaş butonunu ve fonksiyonu ekle**

`<div class="puan" id="puanAlan"></div>` satırının altına ekle:
```html
  <button id="shareBtn" style="margin-top:10px; background:var(--card); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:10px 16px; cursor:pointer; display:none;">Paylaş</button>
```

Script bloğunun sonuna ekle:
```javascript
const SEKME_EMOJI = {burun:"👃", gozler:"👀", agiz:"👄"};
function organSayisiEmoji(n){
  return ["🟥","🟨","🟩"].slice(0, n).join("") + "⬛".repeat(3 - n);
}
function shareText(){
  let satirlar = [`Çehre — Gün #${gunIndex("burun") + 1}`];
  let toplamPuan = 0;
  for (const s of ["burun", "gozler", "agiz"]) {
    const st = state[s];
    const acik = st.solved ? acikOrganSayisi(st.wrong) : 3;
    const puan = st.solved ? st.score : 0;
    toplamPuan += puan;
    satirlar.push(`${SEKME_EMOJI[s]} ${organSayisiEmoji(acik)} ${st.solved ? puan : "✗"}`);
  }
  satirlar.push(`Toplam: ${toplamPuan} puan`);
  return satirlar.join("\n");
}
function tumuBitti(){
  return ["burun","gozler","agiz"].every(s => state[s].over);
}
function shareGoster(){
  $("shareBtn").style.display = tumuBitti() ? "inline-block" : "none";
}
$("shareBtn").addEventListener("click", async () => {
  try{ await navigator.clipboard.writeText(shareText()); $("shareBtn").textContent = "Kopyalandı ✓"; }
  catch(e){}
});
```

`submit()` içindeki `persist();` satırından hemen sonra `shareGoster();` çağrısı ekle. `renderPortre()` fonksiyonunun sonuna da `shareGoster();` ekle (sayfa yeniden yüklendiğinde, üç sekme de zaten bitmişse buton görünsün).

- [ ] **Step 2: Tarayıcıda doğrula**

Üç sekmenin de birini bitir (doğru bul ya da hakları tüket). `read_page` ile "Paylaş" butonunun göründüğünü doğrula, tıkla, `javascript_tool` ile `navigator.clipboard.readText()` çalıştırıp panodaki metnin `Çehre — Gün #` ile başladığını ve 3 organ satırı + `Toplam:` satırı içerdiğini doğrula.

Expected: metin formatı yukarıdaki gibi, emoji sırası `SEKME_EMOJI` ile eşleşiyor.

- [ ] **Step 3: Commit'le**

```bash
cd "site" && git add cehre/index.html && git commit -m "Çehre: Wordle-tarzı paylaşım metni" && git push
```

---

### Task 8: Lunapark hub entegrasyonu

**Files:**
- Modify: `site/oyunlar/index.html`
- Create: `site/gorsel/cehre.jpg` (yer tutucu — gerçek kapak görseli kullanıcının konusu, bkz. [veranda-redesign-ilerleme]; SVG yer tutucu da kabul)

**Interfaces:**
- Consumes: mevcut `.kart.oyun` HTML deseni (Task bağlamında `site/oyunlar/index.html:162-170`'teki Sancak kartı örnek alınacak).
- Produces: Lunapark'ta yeni bir oyun kartı, `../cehre/`'ye bağlı.

- [ ] **Step 1: Yer tutucu kapak görseli oluştur**

Gerçek görsel kullanıcının konusu (sorma) — bu adımda basit bir SVG yer tutucu yeterli:

```bash
cat > "site/gorsel/cehre-placeholder.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1a1614"/><circle cx="200" cy="140" r="60" fill="none" stroke="#e2a13f" stroke-width="4"/><text x="200" y="260" text-anchor="middle" fill="#94897c" font-family="sans-serif" font-size="16">Çehre</text></svg>
EOF
```

- [ ] **Step 2: Hub kartını ekle**

`site/oyunlar/index.html` içinde Jenerik kartından (`../karanlik-oda/jenerik.html`) hemen sonra, `<!-- SİNEMA -->` grubunun dışında uygun bir yere (yeni bir `<!-- YÜZ TANIMA -->` grubu ya da mevcut bir gruba, kullanıcının tercihine göre) şunu ekle:

```html
          <a class="kart oyun" href="../cehre/" style="--td:#8B6F47">
            <div class="kapak"><img src="../gorsel/cehre-placeholder.svg" alt="yüz kesitlerinden oluşan bir portre" loading="lazy"></div>
            <div class="govde">
              <span class="tur">Yüz Tanıma</span>
              <h2>Çehre</h2>
              <p>Burun, göz ya da ağız kesitinden günün ünlüsünü çıkar.</p>
              <span class="oyna">Oyna <span class="ok">→</span></span>
            </div>
          </a>
```

- [ ] **Step 3: Tarayıcıda doğrula**

`http://localhost:8123/oyunlar/` adresine git, `find` ile "Çehre" kartını bul, tıkla (`computer left_click`), `../cehre/` adresine yönlendiğini `read_page` ile doğrula.

Expected: kart görünür, tıklanınca Çehre oyun sayfası açılır, konsol hatası yok.

- [ ] **Step 4: Commit'le**

```bash
cd "site" && git add oyunlar/index.html gorsel/cehre-placeholder.svg && git commit -m "Çehre: Lunapark hub kartı ekle" && git push
```

---

### Task 9: Uçtan uca doğrulama (üç sekme, tam hasat)

**Files:** yok (yalnız doğrulama — mutfak betiklerini tam ölçekte çalıştırma).

**Interfaces:**
- Consumes: Task 1-3'teki tüm betikler.
- Produces: yok (bu task kod üretmez, mevcut boru hattını tam ölçekte doğrular).

- [ ] **Step 1: Tam hasadı çalıştır**

```bash
cd cehre-mutfak
python3 wikidata_harvest.py --limit 2000
python3 yuz_kesit.py
python3 cehre_uret.py
```

Expected: her adım kendi "Bitti..." mesajını verir. `cehre_uret.py` çıktısında üç sekmenin de en az birkaç yüz kişilik olduğunu gözle doğrula (havuz büyüklüğü, hasat başarı oranına bağlı — 2000 adaydan tipik olarak %20-40'ı üç filtreden (lisans + çözünürlük + yüz kalitesi) geçer).

- [ ] **Step 2: Üç sekmeyi tarayıcıda tek tek test et**

`http://localhost:8123/cehre/` adresinde her üç sekmeye geçip her birinde en az bir tam oyun turu oyna (yanlış tahminlerle organ açılışını, doğru tahminle puanlamayı, paylaşım metnini) — Task 5-7'deki doğrulama adımlarının aynısını gerçek (self-test değil, tam hasat) veriyle tekrar et.

Expected: üç sekmenin üçü de bağımsız çalışır, aynı gün aynı kişi iki sekmede birden çıkmaz (`javascript_tool` ile `[gununKisisi('burun').qid, gununKisisi('gozler').qid, gununKisisi('agiz').qid]` çalıştırıp üç qid'in birbirinden farklı olduğunu doğrula).

- [ ] **Step 3: site/ dosyalarını commit'le**

```bash
cd "../site" && git add cehre/puzzles.js cehre/gorseller && git commit -m "Çehre: tam ölçekli veri hasadı" && git push
```

---

## Ek görevler (2026-07-21, kullanıcı geri bildirimi sonrası)

Yayına girdikten sonra kullanıcı üç sorun bildirdi: (1) kesitler o kadar geniş çıkıyordu ki pratikte tüm yüzü gösteriyordu, (2) ünlü havuzunda obscure/niş figürler çok, (3) "farklı organ açılıyor" yerine "aynı organ kademeli büyüyerek açılsın" istendi (zoom-out). Ayrıca [[tam-ekran-genisligi]] kuralı yine ihlal edildi (sayfanın büyük kısmı boş). Aşağıdaki 4 görev, Task 1-9'un ÜZERİNE inşa edilir (aynı dosyaları değiştirir/yeniden çalıştırır), Task 1-9 iptal olmuyor.

**Yeni mimari özet:** Her ünlü artık TEK organ (kendi sekmesine karşılık gelen) için 3 farklı ZOOM SEVİYESİNDE kesit taşıyor (1=sıkı/organ-odaklı, 2=orta, 3=geniş/bağlamsal — eski tek-seviye kesit boyutuyla aynı). Ön yüzde 3 ayrı kutu yerine TEK büyük görsel var; yanlış tahminde aynı görsel yerini daha geniş zoom seviyesine bırakıyor (3 yanlış → seviye 2, 5 yanlış → seviye 3). `SIRA` (hangi organ önce) kavramı tamamen kalkıyor — artık her kişi zaten kendi sekmesinin organına atanmış durumda geliyor.

### Task 10: Wikidata ünlülük filtresi + yeniden hasat

**Files:**
- Modify: `cehre-mutfak/wikidata_harvest.py`

**Interfaces:**
- Consumes/Produces: değişmedi (Task 1 ile aynı — `havuz-ham.json`), yalnız içerik daha ünlü kişilerle sınırlanıyor.

- [ ] **Step 1: `sparql_sorgula` fonksiyonunu ünlülük filtresiyle güncelle**

Şu anki dosyada (`cehre-mutfak/wikidata_harvest.py`) `MESLEKLER` sabitinin hemen altına yeni bir sabit ekle:

```python
MIN_SITELINKS = 40   # kaç farklı dil Wikipedia'sında makalesi var — ünlülük vekili (Mozart/Obama düzeyi ~100+, obscure figürler genelde <20)
```

`sparql_sorgula` fonksiyonundaki SPARQL sorgu metnini şu şekilde değiştir (WHERE bloğuna `wikibase:sitelinks` satırı ve `FILTER` ekleniyor, geri kalan fonksiyon AYNEN kalıyor):

```python
def sparql_sorgula(limit):
    """Meslek başına ayrı sorgular çalıştır, sonuçları birleştir (zaman aşımı önlemek için).
    Her meslek için limit // len(MESLEKLER) kişi iste, sonra qid'ye göre tekrarları kaldır.
    Yalnız MIN_SITELINKS eşiğini geçen (yeterince ünlü) kişiler alınır.
    """
    per_meslek_limit = max(1, limit // len(MESLEKLER) + 1)  # Her meslek başına limit
    out_dict = {}  # qid → {"qid", "isim", "commons_url"}

    for meslek in MESLEKLER:
        sorgu = f"""
        SELECT DISTINCT ?person ?personLabel ?image WHERE {{
          ?person wdt:P31 wd:Q5;
                  wdt:P106 {meslek};
                  wdt:P18 ?image;
                  wikibase:sitelinks ?sitelinks.
          FILTER(?sitelinks >= {MIN_SITELINKS})
          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "tr,en". }}
        }}
        ORDER BY DESC(?sitelinks)
        LIMIT {per_meslek_limit}
        """
        url = SPARQL_URL + "?query=" + urllib.parse.quote(sorgu) + "&format=json"
        d = http_json(url, headers={"Accept": "application/sparql-results+json"})
        if not d:
            continue
        for b in d.get("results", {}).get("bindings", []):
            qid = b["person"]["value"].rsplit("/", 1)[-1]
            isim = temiz(b.get("personLabel", {}).get("value", ""))
            img_url = b["image"]["value"]
            if not isim or isim.startswith("Q"):   # etiket yoksa qid döner, atla
                continue
            if qid not in out_dict:  # İlk sefer görülen kişiyi kaydet
                out_dict[qid] = {"qid": qid, "isim": isim, "commons_url": img_url}
        time.sleep(0.1)  # Wikidata'ya saygılı (meslek başına sorgu arası bekleme)

    # Sıra yaklaşık olarak limit'e ulaşıncaya kadar al
    out = list(out_dict.values())[:limit]
    return out
```

(`ORDER BY DESC(?sitelinks)` eklendi ki `per_meslek_limit` dolarken en ünlüler önce gelsin — filtre zaten 40+ ile sınırlı ama meslek başına migel limit'e takılırsa en ünlüler kaybolmasın.)

- [ ] **Step 2: Self-test'in hâlâ geçtiğini doğrula**

Run: `cd cehre-mutfak && python3 wikidata_harvest.py --self-test`
Expected: değişmedi, `self-test OK: {...}` (self-test `commons_lisans`'ı test ediyor, `sparql_sorgula`'ya dokunmuyor).

- [ ] **Step 3: Küçük ölçekte dene, filtrenin gerçekten daraltığını doğrula**

Run: `python3 wikidata_harvest.py --limit 300`
Expected: `havuz-ham.json`'a yazılan isimlerin gözle bariz daha tanınır olduğunu doğrula (ör. çıktıyı `python3 -c "import json; [print(x['isim']) for x in json.load(open('havuz-ham.json'))[:40]]"` ile yazdır, listeye bak — Jean-Baptiste Lully tarzı niş isimlerin yerini Paul Newman/Bob Dylan/Mozart tarzı isimlerin aldığını gözle onayla).

- [ ] **Step 4: Not — commit yok, tam ölçekli yeniden hasat Task 13 sonrası (Task 9'un yerini alan) bir doğrulama adımında yapılacak**

`cehre-mutfak/` git dışı. Tam ölçekli (`--limit`, filtre seçici olduğu için eskisinden YÜKSEK, ör. `5000`) yeniden hasat bu görevde DEĞİL, tüm zincir (Task 10+11+12) bitince tek seferde çalıştırılacak — aşağıdaki Task 13'ün doğrulama adımına bkz.

---

### Task 11: Sıkı + kademeli (3 zoom seviyeli) kesit çıkarma

**Files:**
- Modify: `cehre-mutfak/yuz_kesit.py`

**Interfaces:**
- Consumes: `havuz-ham.json` (değişmedi).
- Produces: `havuz.json` — YENİ ŞEMA: `{"qid","isim","kesit": {"burun": {"1":"kesitler/{qid}/burun_1.webp","2":"...","3":"..."}, "gozler": {...}, "agiz": {...}}}` (üç organ × üç seviye = kişi başına 9 dosya). Task 12 bu yeni şemayı okuyacak.

- [ ] **Step 1: `kesitleri_uret` ve `isle_kisi`'yi kademeli zoom üretecek şekilde değiştir**

`cehre-mutfak/yuz_kesit.py`'de `MIN_YAW_ORAN` satırının altına yeni bir sabit ekle:

```python
# organ→[(seviye1 genişlik-katsayısı, yükseklik-katsayısı), seviye2, seviye3] — d=göz-arası mesafe birimi
# seviye 1 SIKI (yalnız organ), seviye 3 eski tek-seviye kesitle aynı (bağlamsal)
ZOOM = {
    "burun":  [(0.9, 0.8), (1.3, 1.15), (1.9, 1.7)],
    "gozler": [(1.3, 0.55), (1.8, 0.85), (2.3, 1.2)],
    "agiz":   [(1.0, 0.75), (1.5, 1.1), (2.0, 1.5)],
}
```

`kesitleri_uret` fonksiyonunu şununla DEĞİŞTİR:

```python
def kesitleri_uret(img, yuz):
    box_w = yuz[2]
    x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm = yuz[4:14]
    d = float(np.hypot(x_le - x_re, y_le - y_re))   # göz-arası mesafe, ölçek birimi

    if d < MIN_GOZ_MESAFESI or d / box_w < MIN_YAW_ORAN:
        return None   # çözünürlük yetersiz ya da aşırı profil

    ex, ey = (x_re + x_le) / 2, (y_re + y_le) / 2
    mx, my = (x_rcm + x_lcm) / 2, (y_rcm + y_lcm) / 2
    merkezler = {"burun": (x_nt, y_nt), "gozler": (ex, ey), "agiz": (mx, my)}

    sonuc = {}
    for organ, (cx, cy) in merkezler.items():
        seviyeler = {}
        for i, (kw, kh) in enumerate(ZOOM[organ], start=1):
            kesit = kirp(img, cx, cy, d * kw, d * kh)
            if kesit is None:
                return None
            seviyeler[i] = kesit
        sonuc[organ] = seviyeler
    return sonuc
```

`isle_kisi` fonksiyonunu şununla DEĞİŞTİR (kayıt döngüsü artık iç içe: organ → seviye):

```python
def isle_kisi(det, kisi, dizin):
    dizin.mkdir(parents=True, exist_ok=True)
    ham = dizin / "ham.jpg"
    try:
        if not indir(kisi["resim_url"], ham):
            return False
        img = cv2.imread(str(ham))
        if img is None:
            return False
        yuz = en_iyi_yuz(det, img)
        if yuz is None:
            return False
        kesitler = kesitleri_uret(img, yuz)
        if kesitler is None:
            return False
        for organ, seviyeler in kesitler.items():
            for seviye, kesit in seviyeler.items():
                rgb = cv2.cvtColor(kesit, cv2.COLOR_BGR2RGB)
                Image.fromarray(rgb).save(dizin / f"{organ}_{seviye}.webp", "WEBP", quality=85)
        return True
    finally:
        ham.unlink(missing_ok=True)
```

`main()` içindeki `gecerli.append(...)` bloğunu şununla DEĞİŞTİR:

```python
        if ok:
            gecerli.append({
                "qid": kisi["qid"], "isim": kisi["isim"],
                "kesit": {
                    organ: {str(i): f"kesitler/{kisi['qid']}/{organ}_{i}.webp" for i in (1, 2, 3)}
                    for organ in ("burun", "gozler", "agiz")
                },
            })
```

Dosyanın en üstündeki docstring'i de güncelle: "BAĞLAMSAL... kesitler üretir" cümlesini "her organ için 3 kademeli (sıkı→bağlamsal) zoom seviyesinde kesit üretir" olarak değiştir — kozmetik, isteğe bağlı ama tutarlılık için önerilir.

- [ ] **Step 2: Self-test'i çalıştır**

Run: `cd cehre-mutfak && python3 yuz_kesit.py --self-test`
Expected: değişmedi, `self-test OK: model yüklendi, boş karede yüz tespit edilmedi (beklenen davranış)`.

- [ ] **Step 3: Eski kesit/havuz çıktısını temizleyip küçük ölçekte yeniden dene**

Eski tek-seviyeli kesitler yeni şemayla uyumsuz, temizle:
```bash
rm -rf kesitler havuz.json
python3 yuz_kesit.py --limit 20
```
Expected: `Bitti. N/20 kişi geçerli kesitle yazıldı: .../havuz.json` (N önceki tek-seviye denemeyle benzer aralıkta, 10-18 civarı — kalite filtresi organ/seviye sayısından bağımsız, hâlâ `d`/yaw eşiklerine bağlı). `kesitler/{qid}/` altında ARTIK 9 dosya olmalı: `burun_1.webp, burun_2.webp, burun_3.webp, gozler_1.webp, ..., agiz_3.webp`.

- [ ] **Step 4: Görsel doğrulama — seviye 1 gerçekten sıkı mı?**

En az 1 kişinin `burun_1.webp`, `burun_2.webp`, `burun_3.webp` dosyalarını Read tool ile aç, görsel olarak karşılaştır: seviye 1'de SADECE burun bölgesi görünmeli (göz/ağız/çene büyük ölçüde ÇERÇEVE DIŞI), seviye 3'te eski (tek-seviye) kesitteki gibi geniş bağlam olmalı. Eğer seviye 1 hâlâ neredeyse tüm yüzü gösteriyorsa (kullanıcının orijinal şikayeti), `ZOOM` katsayılarını daha da küçült (ör. burun seviye-1'i `(0.7, 0.6)`'ya indir) ve yeniden dene — bu görsel doğrulama BAŞARISIZ olursa görevi DONE_WITH_CONCERNS olarak işaretleyip bulduğun gerçek katsayıları raporla.

- [ ] **Step 5: Not — commit yok**

`cehre-mutfak/` git dışı.

---

### Task 12: `cehre_uret.py`'yi yeni zoom-seviyeli şemaya uyarla

**Files:**
- Modify: `cehre-mutfak/cehre_uret.py`

**Interfaces:**
- Consumes: `havuz.json` (Task 11'in YENİ şeması — `kesit: {organ: {seviye: yol}}`).
- Produces: `site/cehre/puzzles.js` — `window.CEHRE_KISILER[qid] = {"isim": str, "g": {"1": "gorseller/{qid}/1.webp", "2": "...", "3": "..."}}` (kişi artık yalnız KENDİ SEKMESİNİN organına ait 3 dosyayı taşıyor — diğer 6 dosya kopyalanmıyor). `window.CEHRE_SEKME` şeması değişmedi. Task 13 (index.html) bu yeni `g` şeklini okuyacak, `SIRA` kavramına artık ihtiyaç yok.

- [ ] **Step 1: `main()`'i güncelle**

`cehre-mutfak/cehre_uret.py`'de kişi-sözlüğü oluşturma ve görsel kopyalama bloklarını şununla DEĞİŞTİR (partition/shuffle mantığı — `gruplar`, `sekme_ata`, `_stabil_hash`, `SEED` — AYNEN kalıyor, değişen yalnızca `kisiler` sözlüğünün içeriği ve kopyalama döngüsü):

```python
    kisiler, sekme_listeleri = {}, {}
    rnd = random.Random(SEED)
    for s in SEKMELER:
        grup = gruplar[s][:]
        rnd.shuffle(grup)
        sekme_listeleri[s] = [k["qid"] for k in grup]
        for k in grup:
            kisiler[k["qid"]] = {
                "isim": k["isim"],
                "g": {str(i): f"gorseller/{k['qid']}/{i}.webp" for i in (1, 2, 3)},
            }

    GORSEL_HEDEF.mkdir(parents=True, exist_ok=True)
    for s in SEKMELER:
        for kisi in gruplar[s]:
            kaynak_dizin = KOK / "kesitler" / kisi["qid"]
            hedef_dizin = GORSEL_HEDEF / kisi["qid"]
            hedef_dizin.mkdir(parents=True, exist_ok=True)
            for i in (1, 2, 3):
                src = kaynak_dizin / f"{s}_{i}.webp"
                if src.exists():
                    shutil.copyfile(src, hedef_dizin / f"{i}.webp")
```

(Not: `s` burada döngü değişkeni olarak sekme adı = o kişiye atanan organ adı; `kaynak_dizin`'deki `{s}_{i}.webp` dosyaları tam olarak Task 11'in ürettiği `{organ}_{seviye}.webp` adlandırmasıyla eşleşiyor. Diğer 2 organın 6 dosyası kasıtlı olarak kopyalanmıyor — site'a yalnız oynanacak organ gidiyor, disk/bant genişliği tasarrufu.)

- [ ] **Step 2: Eski çıktıyı temizleyip yeniden dene**

```bash
rm -f ../site/cehre/puzzles.js
rm -rf ../site/cehre/gorseller
python3 cehre_uret.py
```
Expected: üç sekme için kişi sayıları basılır (Task 11'in ürettiği `havuz.json` büyüklüğüne bağlı), `Yazıldı:`/`Görseller kopyalandı:` mesajları.

- [ ] **Step 3: Çıktıyı doğrula**

```bash
python3 -c "
import json
d = json.loads(open('../site/cehre/puzzles.js').read().split('window.CEHRE_KISILER=')[1].split(';\n')[0])
qid, kayit = next(iter(d.items()))
print(qid, kayit)
"
```
Expected: `kayit['g']` tam olarak `{"1": "gorseller/{qid}/1.webp", "2": "...", "3": "..."}` şeklinde 3 anahtarlı bir sözlük olmalı. Ardından o qid için `../site/cehre/gorseller/{qid}/1.webp`, `2.webp`, `3.webp` dosyalarının gerçekten var olduğunu `ls` ile doğrula (4. dosya vs. olmamalı — yalnız 3).

- [ ] **Step 4: Not — commit yok (bu adımın site/ çıktısı Task 13'ün sonundaki toplu doğrulamada commit'lenecek)**

---

### Task 13: Ön yüzde zoom-out açılış mekaniği + tam-genişlik yerleşim

**Files:**
- Modify: `site/cehre/index.html`

**Interfaces:**
- Consumes: Task 12'nin ürettiği YENİ `puzzles.js` şeması (`g: {"1","2","3"}`).
- Produces: tek büyük görsel + iki sütunlu (görsel + bilgi paneli) tam genişlik yerleşim; `SIRA` kaldırılıyor; `acikOrganSayisi` yerine `zoomSeviyesi` geliyor. `state[sekme]` şekli (`{wrong,solved,score,over}`), `PUAN`, `LS` anahtarı, `persist`/`state_yukle`'nin qid-doğrulama mantığı DEĞİŞMİYOR — yalnız hangi görselin gösterildiği ve genel sayfa yerleşimi değişiyor.

**ÖNEMLİ — [[tam-ekran-genisligi]] kuralı bu görevde bağlayıcı:** sayfanın hiçbir yerinde belirgin boş yatay/dikey alan KALMAYACAK. Aşağıdaki kod bunu iki-sütunlu yerleşimle çözüyor (görsel solda büyük, bilgi paneli sağda) — bunu KÜÇÜLTME veya tek-sütun dar bir kutuya geri döndürme, 1680px genişlikte önizleyip iki yanda boşluk kalmadığını doğrula.

- [ ] **Step 1: `site/cehre/index.html`'i tamamen şu içerikle DEĞİŞTİR**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<script src="../ortak/analitik.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Çehre: Ünlüyü yüzünden tanı</title>
<meta name="description" content="Yüz kesitinden günün ünlüsünü çıkar. Yanlış tahminde kesit genişler.">
<meta name="theme-color" content="#0c0a09">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Special+Elite&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box; margin:0; padding:0;}
  html{color-scheme:dark;}
  :root{
    --bg:#0c0a09; --card:#1a1614; --border:#2e2724;
    --paper:#efe9dc; --text:#ece7de; --muted:#94897c;
    --accent:#e2a13f; --ok:#7cb46b; --bad:#e5382e;
  }
  body{background:var(--bg); color:var(--text); font-family:"Inter",-apple-system,sans-serif;
    min-height:100dvh; padding:22px clamp(12px,3vw,44px) 90px;}
  .wrap{max-width:min(96vw, 1400px); margin:0 auto;}
  h1{font-family:"Special Elite",cursive; font-size:30px; color:var(--accent); margin-bottom:4px;}
  .tagline{font-size:13px; color:var(--muted); margin-bottom:22px;}

  .sekmeler{display:flex; gap:8px; margin-bottom:22px; max-width:600px;}
  .sekme-btn{flex:1; background:var(--card); border:1px solid var(--border); color:var(--muted);
    border-radius:6px; padding:10px; font-size:14px; cursor:pointer; font-weight:600;}
  .sekme-btn.aktif{color:var(--accent); border-color:var(--accent);}

  .oyun-alan{display:grid; grid-template-columns:minmax(320px,520px) 1fr; gap:40px; align-items:start;}
  @media(max-width:760px){ .oyun-alan{grid-template-columns:1fr;} }

  .kesit-buyuk{width:100%; aspect-ratio:1/1; border:5px solid var(--paper); border-radius:6px;
    overflow:hidden; background:#000; box-shadow:0 10px 34px rgba(0,0,0,.5);}
  .kesit-buyuk img{width:100%; height:100%; object-fit:cover; display:block;}

  .bilgi-panel{display:flex; flex-direction:column; gap:16px; padding-top:6px;}
  .zoom-label{font-size:12px; color:var(--muted); letter-spacing:1px; text-transform:uppercase;}
  .zoom-dots{display:flex; gap:6px;}
  .zoom-dots i{width:26px; height:6px; border-radius:3px; background:var(--border); display:block;}
  .zoom-dots i.acik{background:var(--accent);}
  .can-dots{display:flex; gap:5px; font-size:18px; letter-spacing:2px;}

  .guess-row{display:flex; gap:8px; position:relative;}
  .guess-row input{flex:1; background:var(--card); border:1px solid var(--border); color:var(--text);
    border-radius:6px; padding:14px 16px; font-size:16px; outline:none;}
  .guess-row button{background:var(--accent); color:#1a1614; border:none; border-radius:6px;
    padding:0 22px; font-weight:600; cursor:pointer;}
  .guess-row button:disabled{opacity:.35; cursor:default;}
  .ac-list{position:absolute; top:56px; left:0; right:70px; background:var(--card);
    border:1px solid var(--border); border-radius:6px; max-height:260px; overflow-y:auto; z-index:5; display:none;}
  .ac-item{padding:10px 14px; cursor:pointer; font-size:14px;}
  .ac-item:hover, .ac-item.sel{background:var(--border);}

  .durum{font-size:14px; color:var(--muted); min-height:20px;}
  .durum.iyi{color:var(--ok);} .durum.kotu{color:var(--bad);}
  .puan{font-size:14px; color:var(--muted);}
  #shareBtn{align-self:flex-start; background:var(--card); color:var(--text); border:1px solid var(--border);
    border-radius:6px; padding:10px 18px; cursor:pointer; display:none;}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Çehre</h1>
    <p class="tagline">Yüz kesitinden günün ünlüsünü çıkar.</p>
  </header>

  <div class="sekmeler">
    <button class="sekme-btn" data-sekme="burun">Burun</button>
    <button class="sekme-btn" data-sekme="gozler">Gözler</button>
    <button class="sekme-btn" data-sekme="agiz">Ağız</button>
  </div>

  <div class="oyun-alan">
    <div class="kesit-buyuk" id="kesitBuyuk"></div>
    <div class="bilgi-panel">
      <div>
        <div class="zoom-label" id="zoomEtiket">Kesit 1/3</div>
        <div class="zoom-dots" id="zoomDots"></div>
      </div>
      <div class="can-dots" id="canDots"></div>
      <div class="guess-row">
        <input type="text" id="guessInput" placeholder="İsim yaz…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
        <button id="guessBtn" disabled>Tahmin</button>
        <div class="ac-list" id="acList"></div>
      </div>
      <div class="durum" id="durum"></div>
      <div class="puan" id="puanAlan"></div>
      <button id="shareBtn">Paylaş</button>
    </div>
  </div>
</div>
<script src="puzzles.js"></script>
<script>
const $ = id => document.getElementById(id);
const esc = s => (s||"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const EPOCH = new Date("2026-07-21T00:00:00");
const KISILER = window.CEHRE_KISILER || {};
const SEKME = window.CEHRE_SEKME || {burun:[], gozler:[], agiz:[]};

function gunIndex(sekmeAdi){
  const gun = Math.floor((Date.now() - EPOCH.getTime()) / 86400000);
  const n = SEKME[sekmeAdi].length;
  return n ? ((gun % n) + n) % n : 0;
}

function gununKisisi(sekmeAdi){
  const qid = SEKME[sekmeAdi][gunIndex(sekmeAdi)];
  return {qid, ...KISILER[qid]};
}

let aktifSekme = "burun";

const PUAN = [100, 80, 60, 40, 25, 15];
const TUM_ISIMLER = Object.entries(KISILER).map(([qid, k]) => ({qid, isim: k.isim}));

const LS = "cehre_v1";
function loadSave(){ try{ return JSON.parse(localStorage.getItem(LS)) || {}; }catch(e){ return {}; } }
function persist(){
  const save = loadSave();
  for (const s of ["burun", "gozler", "agiz"]) {
    save[s] = save[s] || {};
    save[s][gunIndex(s)] = {...state[s], qid: gununKisisi(s).qid};
  }
  try{ localStorage.setItem(LS, JSON.stringify(save)); }catch(e){}
}
function state_yukle(){
  const save = loadSave();
  const out = {};
  for (const s of ["burun", "gozler", "agiz"]) {
    const kayit = save[s] && save[s][gunIndex(s)];
    if (kayit && kayit.qid === gununKisisi(s).qid){
      const {qid, ...durum} = kayit;
      out[s] = durum;
    } else {
      out[s] = bosDurum();
    }
  }
  return out;
}
let state = state_yukle();
function bosDurum(){ return {wrong: 0, solved: false, score: null, over: false}; }

function zoomSeviyesi(wrong){
  if (wrong >= 5) return 3;
  if (wrong >= 3) return 2;
  return 1;
}

function renderPortre(){
  const kisi = gununKisisi(aktifSekme);
  const s = state[aktifSekme];
  const seviye = s.over ? 3 : zoomSeviyesi(s.wrong);
  $("kesitBuyuk").innerHTML = `<img src="${kisi.g[String(seviye)]}" alt="yüz kesiti">`;
  $("zoomEtiket").textContent = `Kesit ${seviye}/3`;
  $("zoomDots").innerHTML = [1,2,3].map(i => `<i class="${i <= seviye ? "acik" : ""}"></i>`).join("");
  const kalanHak = PUAN.length - s.wrong;
  $("canDots").innerHTML = Array.from({length: PUAN.length}, (_,i) =>
    i < kalanHak ? "🤎" : "🖤").join("");
  $("guessInput").disabled = s.over;
  $("guessBtn").disabled = true;
  $("puanAlan").textContent = s.solved ? `Bu sekmede puanın: ${s.score}` : "";
  $("durum").textContent = "";
  $("durum").className = "durum";
  if (s.over && !s.solved) {
    $("durum").textContent = `Hakların bitti. Cevap: ${kisi.isim}`;
    $("durum").className = "durum kotu";
  }
  shareGoster();
}

const fold = s => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
let acResults = [], acIdx = -1;

function showAc(){
  const q = fold($("guessInput").value.trim());
  $("guessBtn").disabled = true;
  if (q.length < 2){ hideAc(); return; }
  const starts = [], contains = [];
  for (const p of TUM_ISIMLER){
    const t = fold(p.isim);
    if (t.startsWith(q)) starts.push(p);
    else if (t.includes(q)) contains.push(p);
    if (starts.length >= 8) break;
  }
  acResults = [...starts, ...contains].slice(0, 8);
  acIdx = -1;
  if (!acResults.length){ hideAc(); return; }
  $("acList").innerHTML = acResults.map((r,i) => `<div class="ac-item" data-i="${i}">${esc(r.isim)}</div>`).join("");
  $("acList").style.display = "block";
  $("acList").querySelectorAll(".ac-item").forEach(el =>
    el.addEventListener("click", () => choose(acResults[+el.dataset.i])));
}
function hideAc(){ $("acList").style.display = "none"; acResults = []; acIdx = -1; }
let secilen = null;
function choose(p){
  secilen = p;
  $("guessInput").value = p.isim;
  $("guessBtn").disabled = false;
  hideAc();
}

const SEKME_EMOJI = {burun:"👃", gozler:"👀", agiz:"👄"};
function zoomEmoji(n){
  return ["🟥","🟨","🟩"].slice(0, n).join("") + "⬛".repeat(3 - n);
}
function shareText(){
  let satirlar = [`Çehre: Gün #${gunIndex("burun") + 1}`];
  let toplamPuan = 0;
  for (const s of ["burun", "gozler", "agiz"]) {
    const st = state[s];
    const seviye = st.solved ? zoomSeviyesi(st.wrong) : 3;
    const puan = st.solved ? st.score : 0;
    toplamPuan += puan;
    satirlar.push(`${SEKME_EMOJI[s]} ${zoomEmoji(seviye)} ${st.solved ? puan : "✗"}`);
  }
  satirlar.push(`Toplam: ${toplamPuan} puan`);
  return satirlar.join("\n");
}
function tumuBitti(){
  return ["burun","gozler","agiz"].every(s => state[s].over);
}
function shareGoster(){
  $("shareBtn").style.display = tumuBitti() ? "inline-block" : "none";
}
$("shareBtn").addEventListener("click", async () => {
  try{ await navigator.clipboard.writeText(shareText()); $("shareBtn").textContent = "Kopyalandı ✓"; }
  catch(e){}
});

function submit(){
  const s = state[aktifSekme];
  if (s.over || !secilen) return;
  const kisi = gununKisisi(aktifSekme);
  const secIsim = secilen.isim;
  let yanlisMesaj = null;
  if (secilen.qid === kisi.qid){
    s.solved = true; s.over = true; s.score = PUAN[s.wrong];
  } else {
    s.wrong++;
    if (s.wrong >= PUAN.length){
      s.over = true;
    } else {
      yanlisMesaj = `${secIsim} değil.`;
    }
  }
  secilen = null;
  $("guessInput").value = "";
  $("guessBtn").disabled = true;
  persist();
  shareGoster();
  renderPortre();
  if (s.solved){
    $("durum").textContent = `Doğru! ${kisi.isim}. ${s.score} puan.`;
    $("durum").className = "durum iyi";
  } else if (yanlisMesaj){
    $("durum").textContent = yanlisMesaj;
    $("durum").className = "durum kotu";
  }
}

$("guessInput").addEventListener("input", showAc);
$("guessBtn").addEventListener("click", submit);
$("guessInput").addEventListener("keydown", e => {
  if (e.key === "Enter" && !$("guessBtn").disabled) submit();
});

document.querySelectorAll(".sekme-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sekme-btn").forEach(b => b.classList.remove("aktif"));
    btn.classList.add("aktif");
    aktifSekme = btn.dataset.sekme;
    hideAc();
    renderPortre();
  });
});
document.querySelector('.sekme-btn[data-sekme="burun"]').classList.add("aktif");
renderPortre();
</script>
<script src="../ortak/nav-panel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Tam ölçekli zinciri baştan sona çalıştır (Task 10+11+12'nin gerçek/büyük veriyle son hali)**

```bash
cd cehre-mutfak
rm -rf havuz-ham.json havuz.json kesitler
python3 wikidata_harvest.py --limit 5000
python3 yuz_kesit.py
python3 cehre_uret.py
```

Expected: ünlülük filtresi (Task 10) yüzünden aday sayısı öncekinden az ama ORTALAMA KALİTE yüksek olacak; `yuz_kesit.py` önceki turda görülen Wikimedia 429 hız-sınırı riskini hâlâ taşıyor — eğer aşırı miktarda `HTTP Error 429` hatası görülürse (art arda çoğu indirme başarısız oluyorsa), `indir()` fonksiyonuna indirmeler arası küçük bir `time.sleep(0.3)` eklemeyi düşün (bu görevin asıl kapsamı değil ama gerçek çalıştırmada havuz çok küçülüyorsa DONE_WITH_CONCERNS olarak işaretleyip bunu bulguların arasında raporla — kullanıcı ayrı bir turda bunu isteyebilir).

- [ ] **Step 3: Tarayıcıda doğrula (üç sekme + zoom-out mekaniği + tam genişlik)**

Preview server "site" (port 8642) ile `http://localhost:8642/cehre/` adresine git.

- **Sıkı ilk kesit:** Burun sekmesinde AÇILAN İLK görselin gerçekten dar/organ-odaklı olduğunu, tüm yüzü göstermediğini gözle doğrula (kullanıcının orijinal şikayeti tam burada çözülüyor mu?).
- **Zoom-out kademesi:** 3 yanlış tahminden sonra AYNI fotoğrafın daha geniş bir kesitinin göründüğünü (farklı bir organ DEĞİL) doğrula; 5 yanlıştan sonra en geniş (3. seviye) kesitin göründüğünü doğrula.
- **Tam genişlik:** pencereyi 1680px+ genişliğe getir (`resize_window` ile), sayfanın solda görsel + sağda bilgi paneliyle genişliği kullandığını, belirgin boş alan kalmadığını `computer screenshot` ile gözle doğrula.
- **Konsol hatası yok.**
- **Em dash yok** (`grep -rn "—" site/cehre/`).

- [ ] **Step 4: Tüm site/ çıktısını (Task 12 + bu görev) commit'le**

```bash
cd "../site" && git add cehre/index.html cehre/puzzles.js cehre/gorseller && git commit -m "Çehre: zoom-out açılış mekaniği, sıkı kesitler, ünlülük filtresi, tam genişlik yerleşim" && git push
```
