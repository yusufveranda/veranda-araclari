# Muzayede Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable v1 of Muzayede (site/muzayede/) — a daily game where the
player guesses a painter from a painting, chooses which hint categories to reveal,
then guesses the painting's real auction sale price — seeded with a small curated
sample dataset, plus the first two (cheap) phases of the large-scale data pipeline
that will eventually grow the roster to 300-500 painters.

**Architecture:** Follows the existing static-site game pattern used by `site/cati`
and `site/atlas` (vanilla JS, no build step, no fetch of local data in those games)
crossed with `site/bitki`'s pattern (large JSON dataset fetched at runtime, since
Muzayede's corpus is data/image-heavy like plants, not a small fixed word list).
Concretely: full painter/painting detail lives in `site/muzayede/data/*.json`
(fetched via `fetch()`), while the *daily ordering* of which painting shows on
which day is a small baked file `site/muzayede/gunler.js`
(`window.MUZAYEDE_GUNLER = {epoch, sira: [tabloId, ...]}`), matching how
`karanlik-oda` orders its film list. Admin-only unlimited access reuses the
existing Firebase `VF.adminMi` gate (`site/ortak/firebase.js`) already used by
`karanlik-oda` and `cati`. Data generation follows `veri/cati_uret.py` (validate
then bake to JS/JSON) for the build step, and `bitki_harvest.py` (urllib + linear
backoff retry) for anything that hits an external source (Faz 1/Faz 2 scripts).

**Tech Stack:** Vanilla HTML/CSS/JS (no framework, no build step), Python 3
stdlib only (`urllib`, `json`, `argparse` — no `requests`, no `pytest`; neither is
installed in this environment and the codebase doesn't use them), Firebase
compat SDK (already wired site-wide via `site/ortak/firebase.js`).

## Global Constraints

- No em dash anywhere in any Turkish copy or code comments (write like a plain
  human, not like AI-generated text).
- Do not `git add -A` — stage only the files this plan touches.
- After committing files you created/modified, push without asking (per existing
  project convention).
- Follow existing file/data conventions exactly as found in `site/cati`,
  `site/atlas`, `site/bitki`, `site/karanlik-oda`, `site/ortak/nav-panel.js`,
  `site/ortak/firebase.js` — do not introduce a JS test framework, a Node
  toolchain, `requests`, or `pytest`; none exist in this repo and none are
  needed for this plan.
- Price-guess scoring: `diff = |log10(guess) - log10(actual)|`,
  `score = max(0, round(100 * (1 - diff)))` (0 diff = 100 pts, 10x off = 0 pts).
- Painter-guess scoring: `max(0, 100 - 25 * ipuçuSayısı)` if guessed correctly,
  `0` if given up. Four hint categories exist, so this ranges 100/75/50/25/0.
- `risk_seviyesi` field on every painter is one of exactly:
  `"public_domain"`, `"dogrulanmis_serbest"`, `"dikkat"`. No other values.
- This plan stops after Faz 1 + Faz 2 of the data pipeline (per the design spec's
  staged-execution decision). Faz 3 (large-scale agent-verified expansion to
  300-500 painters) is explicitly out of scope here and will be its own plan
  once Faz 1/2 output is reviewed.

---

## File Structure

```
site/muzayede/
  index.html          # game shell: markup, inline <style>, inline game JS
  manifest.json        # PWA manifest, same shape as site/cati/manifest.json
  icon.svg              # game icon
  gorsel/               # favicons (favicon-32.png, favicon-180.png)
  data/
    ressamlar.json      # painter list, fetched at runtime
    tablolar.json        # painting list, fetched at runtime
  gunler.js               # window.MUZAYEDE_GUNLER = {epoch, sira:[tabloId,...]}

veri/
  muzayede_ornek.py        # Task 1: hand-curated v1 sample content (Python DATA list)
  muzayede_uret.py          # Task 2: validates + bakes DATA into site/muzayede/{data/*.json, gunler.js}
  muzayede_harvest.py        # Task 10 (Faz 1): Wikipedia curated-list scraper -> veri/muzayede_aday.json
  muzayede_genislet.py        # Task 11 (Faz 2): Wikidata SPARQL expansion -> veri/muzayede_aday_genis.json

site/ortak/nav-panel.js       # Task 9: add Muzayede entry to OYUNLAR
site/oyunlar/index.html        # Task 9: add Muzayede card
site/sitemap.xml                 # Task 9: add /muzayede/ entry
```

---

### Task 1: Curate v1 sample content (8 painters, real documented auction sales)

**Files:**
- Create: `veri/muzayede_ornek.py`

**Interfaces:**
- Produces: a Python module-level `DATA` list of 8-tuples, consumed by Task 2's
  `muzayede_uret.py` via
  `from muzayede_ornek import DATA`. Each tuple is:
  `(ressam_id, ressam_isim, dogum_olum, ulke, akim, risk_seviyesi, tablo_adi, tablo_yili, gorsel_url, satis_fiyati_usd, satis_yili, muzayede_evi, kaynak_url)`

This is a research step, not a coding step: pick 8 widely-documented,
extremely famous auction-record paintings (each has its own well-sourced
Wikipedia article and/or is listed on Wikipedia's "List of most expensive
paintings" — so the research is low-risk to get wrong). Use WebSearch/WebFetch
to confirm the exact sale price, sale year, auction house, and source URL for
each of these 8 painters before writing the file — do not invent numbers:

1. Leonardo da Vinci (attributed) — "Salvator Mundi"
2. Pablo Picasso — "Les Femmes d'Alger (Version O)"
3. Vincent van Gogh — a documented record sale of his
4. Claude Monet — "Meules" (or another documented record sale)
5. Gustav Klimt — "Lady with a Fan" (or another documented record sale)
6. Jean-Michel Basquiat — "Untitled" (1982, skull painting)
7. Andy Warhol — "Shot Sage Blue Marilyn"
8. Frida Kahlo — "Diego y yo" (or another documented record sale)

For `risk_seviyesi`: da Vinci, van Gogh, Monet, Klimt are `public_domain`
(died 70+ years ago). Picasso (d. 1973), Basquiat (d. 1988), Warhol (d. 1987),
Kahlo (d. 1954) are all past 70 years post-death by 2026 **except** Picasso
(1973 + 70 = 2043) — mark Picasso `dikkat` since his estate is well known for
active copyright enforcement. Basquiat/Warhol/Kahlo: verify each artist's
death year against 2026 - 70 = 1956 cutoff; anyone who died after 1956 is not
yet public domain by the "life+70" rule and should be marked `dikkat` unless
you find their specific work is CC-licensed by the rights holder, in which
case use `dogrulanmis_serbest`. Do this check per painter, don't assume.

For `gorsel_url`: use a Wikimedia Commons file URL for painters marked
`public_domain`; for `dikkat`-tier painters use a Wikipedia page thumbnail URL
(lower resolution, used here only as a placeholder since Faz 3 will replace it
with a properly-licensed asset — flag this inline with a Turkish comment, no
em dash: `# gecici görsel, Faz 3'te lisans dogrulamasiyla degisecek`).

- [ ] **Step 1: Research and write the file**

```python
# -*- coding: utf-8 -*-
# Muzayede v1 örnek veri: 8 ressam, gerçek belgelenmiş müzayede satışı.
# Alan sırası: ressam_id, isim, dogum_olum, ulke, akim, risk_seviyesi,
#              tablo_adi, tablo_yili, gorsel_url, fiyat_usd, satis_yili,
#              muzayede_evi, kaynak_url

DATA = [
    ("leonardo-da-vinci", "Leonardo da Vinci", "1452-1519", "İtalya",
     "Rönesans", "public_domain",
     "Salvator Mundi", "yak. 1500",
     "https://upload.wikimedia.org/wikipedia/commons/...",
     450300000, 2017, "Christie's", "https://..."),
    # ... 7 more tuples researched the same way
]
```

- [ ] **Step 2: Sanity-check the file loads and has 8 entries**

Run: `python3 -c "import sys; sys.path.insert(0,'veri'); from muzayede_ornek import DATA; print(len(DATA)); [print(d[0], d[9]) for d in DATA]"`
Expected: prints `8` then 8 lines of `ressam_id fiyat_usd` with no exceptions.

- [ ] **Step 3: Commit**

```bash
git add veri/muzayede_ornek.py
git commit -m "Muzayede: 8 ressamlık örnek veri seti"
git push
```

---

### Task 2: `veri/muzayede_uret.py` — validate and bake to site files

**Files:**
- Create: `veri/muzayede_uret.py`
- Depends on: `veri/muzayede_ornek.py` (Task 1)
- Produces: `site/muzayede/data/ressamlar.json`, `site/muzayede/data/tablolar.json`,
  `site/muzayede/gunler.js`

**Interfaces:**
- Consumes: `DATA` list from `veri/muzayede_ornek.py` (see Task 1 tuple shape).
- Produces: three files. Exact JSON shapes:
  - `ressamlar.json`: `[{"id":str, "isim":str, "dogum_olum":str, "ulke":str, "akim":str, "risk_seviyesi":str}, ...]`
  - `tablolar.json`: `[{"id":str (== ressam_id, one painting per painter in v1), "ressam_id":str, "tablo_adi":str, "tablo_yili":str, "gorsel":str, "fiyat_usd":int, "satis_yili":int, "muzayede_evi":str, "kaynak_url":str}, ...]`
  - `gunler.js`: `window.MUZAYEDE_GUNLER={"epoch":"2026-07-21","sira":["leonardo-da-vinci", ...]}` (id order = play order, same list as `DATA`, do not shuffle — matches the project rule that `filmler.txt` order is day order and must not be reordered casually)

- [ ] **Step 1: Write the script**

```python
# -*- coding: utf-8 -*-
# Muzayede veri üretici: veri/muzayede_ornek.py -> site/muzayede/{data/*.json, gunler.js}
# Doğrulama başarısızsa hiçbir dosya yazılmaz (exit 1).
import json, sys
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from muzayede_ornek import DATA

SITE = KOK / "site" / "muzayede"
RISK_GECERLI = {"public_domain", "dogrulanmis_serbest", "dikkat"}

def dogrula():
    hata = []
    idler = [d[0] for d in DATA]
    if len(idler) != len(set(idler)):
        hata.append("tekrar eden ressam_id var")
    for d in DATA:
        (rid, isim, dogum_olum, ulke, akim, risk, tablo_adi, tablo_yili,
         gorsel, fiyat, satis_yili, ev, kaynak) = d
        if risk not in RISK_GECERLI:
            hata.append(f"{rid}: gecersiz risk_seviyesi '{risk}'")
        if not isinstance(fiyat, int) or fiyat <= 0:
            hata.append(f"{rid}: gecersiz fiyat_usd {fiyat!r}")
        if not kaynak.startswith("http"):
            hata.append(f"{rid}: kaynak_url http ile baslamiyor")
        if not gorsel.startswith("http"):
            hata.append(f"{rid}: gorsel_url http ile baslamiyor")
    return hata

def uret():
    ressamlar = []
    tablolar = []
    for d in DATA:
        (rid, isim, dogum_olum, ulke, akim, risk, tablo_adi, tablo_yili,
         gorsel, fiyat, satis_yili, ev, kaynak) = d
        ressamlar.append({"id": rid, "isim": isim, "dogum_olum": dogum_olum,
                           "ulke": ulke, "akim": akim, "risk_seviyesi": risk})
        tablolar.append({"id": rid, "ressam_id": rid, "tablo_adi": tablo_adi,
                          "tablo_yili": tablo_yili, "gorsel": gorsel,
                          "fiyat_usd": fiyat, "satis_yili": satis_yili,
                          "muzayede_evi": ev, "kaynak_url": kaynak})
    return ressamlar, tablolar

def main():
    hata = dogrula()
    if hata:
        print("DOGRULAMA HATASI:")
        for h in hata:
            print(" -", h)
        sys.exit(1)

    ressamlar, tablolar = uret()
    veri_dir = SITE / "data"
    veri_dir.mkdir(parents=True, exist_ok=True)
    (veri_dir / "ressamlar.json").write_text(
        json.dumps(ressamlar, ensure_ascii=False, indent=1), encoding="utf-8")
    (veri_dir / "tablolar.json").write_text(
        json.dumps(tablolar, ensure_ascii=False, indent=1), encoding="utf-8")

    sira = [d[0] for d in DATA]
    gunler = {"epoch": "2026-07-21", "sira": sira}
    js = "// Muzayede gün sırası — üretim: veri/muzayede_uret.py. Elle düzenleme: doğrulamayı çalıştır.\n"
    js += "window.MUZAYEDE_GUNLER=" + json.dumps(gunler, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (SITE / "gunler.js").write_text(js, encoding="utf-8")

    print(f"yazıldı: {len(ressamlar)} ressam, {len(tablolar)} tablo -> site/muzayede/")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it and verify output**

Run: `python3 veri/muzayede_uret.py`
Expected: `yazıldı: 8 ressam, 8 tablo -> site/muzayede/` and exit code 0.
Then: `python3 -c "import json; d=json.load(open('site/muzayede/data/tablolar.json')); print(len(d), d[0]['id'])"`
Expected: `8 leonardo-da-vinci` (or whichever id you listed first).

- [ ] **Step 3: Verify validation actually catches errors**

Temporarily edit `veri/muzayede_ornek.py`, change one `risk_seviyesi` value to
`"bozuk"`, run `python3 veri/muzayede_uret.py` again.
Expected: prints `DOGRULAMA HATASI:` with the offending id, exit code 1, and
the three output files are **not** overwritten (check their mtimes/content are
unchanged from Step 2). Then revert the temporary edit and re-run to confirm
it's back to `yazıldı: ...` / exit 0.

- [ ] **Step 4: Commit**

```bash
git add veri/muzayede_uret.py site/muzayede/data/ressamlar.json site/muzayede/data/tablolar.json site/muzayede/gunler.js
git commit -m "Muzayede: veri üretici script + ilk üretilen dosyalar"
git push
```

---

### Task 3: Game shell — `index.html`, `manifest.json`, `icon.svg`

**Files:**
- Create: `site/muzayede/index.html`
- Create: `site/muzayede/manifest.json`
- Create: `site/muzayede/icon.svg`

**Interfaces:**
- Consumes: `site/ortak/stil.css`, `site/ortak/nav-panel.js`, `site/ortak/firebase.js`
  (all pre-existing, included via relative `<script>`/`<link>` tags, no changes
  needed to those files in this task).
- Produces: page skeleton that Tasks 4-8 fill in with a `<script>` block. Element
  ids other tasks depend on (create these empty containers now):
  `#tabloGorsel` (img), `#ressamGiris` (text input), `#ipucuAlanlari` (div, one
  child button per hint category), `#fiyatGiris` (number input), `#sonucKutu`
  (div, hidden until round ends), `#adminSecici` (select, hidden unless admin).

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Muzayede — ressamı ve fiyatı bil</title>
<meta name="description" content="Bir tablo gör, ressamını ve gerçek müzayede satış fiyatını tahmin et.">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🖼️</text></svg>">
<link rel="apple-touch-icon" href="gorsel/favicon-180.png">
<link rel="stylesheet" href="../ortak/stil.css">
<style>
  .tablo-kutu{max-width:640px;margin:0 auto}
  .tablo-kutu img{width:100%;height:auto;border-radius:8px;display:block}
  #ipucuAlanlari{display:flex;flex-wrap:wrap;gap:.5rem;margin:.75rem 0}
  .ipucu-btn[data-acik="1"]{opacity:.55;pointer-events:none}
  #sonucKutu{display:none;margin-top:1rem}
</style>
</head>
<body>
<div id="navYer"></div>
<main class="tablo-kutu">
  <h1>Muzayede</h1>
  <img id="tabloGorsel" alt="günün tablosu" src="">
  <select id="adminSecici" style="display:none"></select>

  <div id="ressamAsama">
    <input id="ressamGiris" type="text" placeholder="ressam adı" autocomplete="off">
    <button id="ressamGonderBtn">tahmin et</button>
    <div id="ipucuAlanlari"></div>
    <p id="ressamMesaj"></p>
  </div>

  <div id="fiyatAsama" style="display:none">
    <input id="fiyatGiris" type="number" placeholder="tahmini satış fiyatı (USD)">
    <button id="fiyatGonderBtn">tahmin et</button>
    <p id="fiyatMesaj"></p>
  </div>

  <div id="sonucKutu"></div>
</main>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"></script>
<script src="../ortak/firebase.js"></script>
<script src="../ortak/nav-panel.js"></script>
<script src="./gunler.js"></script>
<script>
// Task 4-8 doldurur
</script>
</body>
</html>
```

- [ ] **Step 2: Write `manifest.json`**

```json
{
  "name": "Muzayede — ressamı ve fiyatı bil",
  "short_name": "Muzayede",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#1C1510",
  "theme_color": "#1C1510",
  "lang": "tr",
  "icons": [{ "src": "icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }]
}
```

- [ ] **Step 3: Write `icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="16" fill="#1C1510"/>
  <text x="50" y="68" font-size="56" text-anchor="middle">🖼️</text>
</svg>
```

- [ ] **Step 4: Verify the page loads with no console errors**

Use `preview_start` to open `site/muzayede/index.html` directly (or via the
site's local server if one exists for the `site/` root), then check
`read_console_messages` for errors. Expected: no 404s for `../ortak/stil.css`,
`../ortak/firebase.js`, `../ortak/nav-panel.js`, `./gunler.js` — all should
resolve given this task runs after Task 2 has already written `gunler.js`.

- [ ] **Step 5: Commit**

```bash
git add site/muzayede/index.html site/muzayede/manifest.json site/muzayede/icon.svg
git commit -m "Muzayede: oyun kabuğu (html/manifest/icon)"
git push
```

---

### Task 4: Day-index selection + data loading

**Files:**
- Modify: `site/muzayede/index.html` (the empty `<script>` block from Task 3)

**Interfaces:**
- Consumes: `window.MUZAYEDE_GUNLER` (from `gunler.js`, Task 2), `fetch('./data/ressamlar.json')`, `fetch('./data/tablolar.json')`.
- Produces (globals other tasks read): `GUN` (int, today's day index),
  `_METAB` (int or null, override index from `?bulmaca=N&meta=1`),
  `bulmacaSec()` (function, returns the active `tablo` object for today),
  `RESSAMLAR` (array, loaded from `ressamlar.json`), `TABLOLAR` (array).

- [ ] **Step 1: Add the loading + day-index script**

```html
<script>
(function(){
  const q = new URLSearchParams(location.search);
  const GOMULU = q.has('gomulu');
  const _METAB = q.has('meta') && q.has('bulmaca') ? parseInt(q.get('bulmaca'), 10) : null;

  function gunNo(){
    const ep = Date.parse(MUZAYEDE_GUNLER.epoch + 'T00:00:00');
    const now = new Date();
    const bugun = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((bugun - ep) / 86400000);
  }
  const GUN = gunNo();

  function bugunTabloId(){
    const sira = MUZAYEDE_GUNLER.sira;
    const key = (_METAB !== null) ? _METAB : GUN;
    return sira[((key % sira.length) + sira.length) % sira.length];
  }

  let RESSAMLAR = [], TABLOLAR = [];

  function veriYukle(){
    return Promise.all([
      fetch('./data/ressamlar.json').then(r => r.json()),
      fetch('./data/tablolar.json').then(r => r.json())
    ]).then(([ressamlar, tablolar]) => {
      RESSAMLAR = ressamlar;
      TABLOLAR = tablolar;
      window.MUZ = { GUN, _METAB, RESSAMLAR, TABLOLAR, bugunTabloId };
      baslat();
    });
  }

  function baslat(){
    const tabloId = bugunTabloId();
    const tablo = TABLOLAR.find(t => t.id === tabloId);
    document.getElementById('tabloGorsel').src = tablo.gorsel;
    document.getElementById('tabloGorsel').alt = 'günün tablosu';
    window.MUZ.tablo = tablo;
    window.MUZ.ressam = RESSAMLAR.find(r => r.id === tablo.ressam_id);
  }

  veriYukle();
})();
</script>
```

- [ ] **Step 2: Manual browser verification**

Open the page (`preview_start` + `navigate`). Then in `javascript_tool`, run:
`window.MUZ.tablo.id` and `window.MUZ.GUN`.
Expected: `tablo.id` matches whatever `MUZAYEDE_GUNLER.sira[GUN % 8]` resolves
to (compute this by hand from the `gunler.js` content and compare — since v1
only has 8 entries, `GUN % 8` should match). Also verify `#tabloGorsel` has a
non-empty `src` and the image actually renders (take a screenshot).

- [ ] **Step 3: Verify the `?bulmaca=N&meta=1` override works**

Navigate to `index.html?bulmaca=3&meta=1`, then check
`window.MUZ.tablo.id === MUZAYEDE_GUNLER.sira[3]` in `javascript_tool`.
Expected: `true`.

- [ ] **Step 4: Commit**

```bash
git add site/muzayede/index.html
git commit -m "Muzayede: gün seçimi ve veri yükleme"
git push
```

---

### Task 5: Painter guess — autocomplete input + submit

**Files:**
- Modify: `site/muzayede/index.html`

**Interfaces:**
- Consumes: `window.MUZ.RESSAMLAR`, `window.MUZ.ressam` (from Task 4).
- Produces (globals Task 6/7 read): `window.MUZ.state.ressamBulundu` (bool),
  `window.MUZ.state.hintCount` (int, 0-4), `ressamGonder()` (function, wired
  to `#ressamGonderBtn` click and Enter-key on `#ressamGiris`).

- [ ] **Step 1: Add guess-checking script (append inside the same script block, after `baslat()`)**

```javascript
window.MUZ.state = { ressamBulundu: false, hintCount: 0, hintsAcik: {} };

function isimNormallestir(s){
  return s.toLocaleLowerCase('tr').trim()
    .replace(/[̇]/g, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function ressamGonder(){
  if(window.MUZ.state.ressamBulundu) return;
  const giris = document.getElementById('ressamGiris').value;
  const dogru = window.MUZ.ressam.isim;
  const msg = document.getElementById('ressamMesaj');
  if(isimNormallestir(giris) === isimNormallestir(dogru)){
    window.MUZ.state.ressamBulundu = true;
    msg.textContent = 'doğru: ' + dogru;
    document.getElementById('ressamAsama').querySelectorAll('input,button').forEach(el => el.disabled = true);
    fiyatAsamasiniAc();
  } else {
    msg.textContent = 'yanlış, bir ipucu seç';
  }
}

document.getElementById('ressamGonderBtn').addEventListener('click', ressamGonder);
document.getElementById('ressamGiris').addEventListener('keydown', e => {
  if(e.key === 'Enter') ressamGonder();
});
```

Note: `fiyatAsamasiniAc()` is defined in Task 7; leave it as a forward
reference here (functions declared with `function` are hoisted, so this is
safe as long as Task 7's code lands in the same script block before the page
runs — which it will, since all tasks append to one `<script>` block in
document order).

- [ ] **Step 2: Manual verification — wrong guess**

Navigate to the page, in `javascript_tool` check
`window.MUZ.ressam.isim` (e.g. `"Pablo Picasso"`). Use `computer` to type a
wrong name (e.g. `"yanlış isim"`) into `#ressamGiris` and click
`#ressamGonderBtn`. Expected: `#ressamMesaj` shows `"yanlış, bir ipucu seç"`,
`window.MUZ.state.ressamBulundu === false`.

- [ ] **Step 3: Manual verification — correct guess**

Clear the input, type the exact correct name from Step 2, submit again.
Expected: `#ressamMesaj` shows `"doğru: <isim>"`, inputs/buttons in
`#ressamAsama` become disabled, `window.MUZ.state.ressamBulundu === true`.

- [ ] **Step 4: Manual verification — accent/case insensitivity**

Type the correct name in all-lowercase with Turkish `İ`/`ı` swapped (e.g. if
correct name is "İtalya" try "italya"), submit. Expected: still recognized as
correct, since `isimNormallestir` folds case and diacritics.

- [ ] **Step 5: Commit**

```bash
git add site/muzayede/index.html
git commit -m "Muzayede: ressam tahmin girişi ve doğrulama"
git push
```

---

### Task 6: Hint mechanic — player picks which category to reveal

**Files:**
- Modify: `site/muzayede/index.html`

**Interfaces:**
- Consumes: `window.MUZ.ressam` (fields: `dogum_olum`, `ulke`, `akim`),
  `window.MUZ.tablo` (fields: `tablo_adi`, `tablo_yili`).
- Produces: renders 4 buttons in `#ipucuAlanlari`; clicking one increments
  `window.MUZ.state.hintCount` and reveals that category's text; each hint
  button becomes disabled/marked `data-acik="1"` once opened (can't be closed
  or re-cost).

- [ ] **Step 1: Add hint rendering + reveal logic**

```javascript
const IPUCU_KATEGORILERI = [
  { id: 'donem', etiket: 'dönem', metin: r => r.dogum_olum.split('-')[0].slice(0, 2) + '. yüzyıl civarı' },
  { id: 'ulke', etiket: 'ülke', metin: r => r.ulke },
  { id: 'akim', etiket: 'sanat akımı', metin: r => r.akim },
  { id: 'tablo', etiket: 'tablo adı + baş harf', metin: (r, t) => t.tablo_adi + ' (' + t.tablo_yili + ') — ' + r.isim[0] + '.' }
];

function ipucularinCiz(){
  const alan = document.getElementById('ipucuAlanlari');
  alan.innerHTML = '';
  IPUCU_KATEGORILERI.forEach(k => {
    const b = document.createElement('button');
    b.className = 'ipucu-btn';
    b.textContent = 'ipucu: ' + k.etiket;
    b.dataset.kategori = k.id;
    b.addEventListener('click', () => ipucuAc(k.id));
    alan.appendChild(b);
  });
}

function ipucuAc(kategoriId){
  if(window.MUZ.state.ressamBulundu) return;
  if(window.MUZ.state.hintsAcik[kategoriId]) return;
  const k = IPUCU_KATEGORILERI.find(x => x.id === kategoriId);
  window.MUZ.state.hintsAcik[kategoriId] = true;
  window.MUZ.state.hintCount++;
  const btn = document.querySelector('.ipucu-btn[data-kategori="' + kategoriId + '"]');
  btn.dataset.acik = '1';
  btn.textContent = k.etiket + ': ' + k.metin(window.MUZ.ressam, window.MUZ.tablo);
}

ipucularinCiz();
```

Call `ipucularinCiz()` once, right after it's defined (module runs top to
bottom in the same script block, and `window.MUZ.ressam`/`tablo` are already
set by `baslat()` from Task 4 which runs inside the `fetch().then()` chain —
so this line must actually go **inside `baslat()`**, not at top level, since
`RESSAMLAR`/`TABLOLAR` aren't populated yet at parse time. Move the
`ipucularinCiz();` call to the end of `baslat()` in Task 4's code instead of
leaving it as a bare top-level call.

- [ ] **Step 2: Manual verification — reveal one hint**

Navigate to the page, use `computer` to click the "ipucu: ülke" button.
Expected: button text becomes `"ülke: <gerçek ülke>"`, becomes visually
dimmed (`opacity:.55` from the `data-acik="1"` CSS rule), and
`window.MUZ.state.hintCount === 1`.

- [ ] **Step 3: Manual verification — can't open the same hint twice**

Click the same button again. Expected: nothing changes,
`window.MUZ.state.hintCount` stays `1`.

- [ ] **Step 4: Manual verification — open all 4, then guess correctly**

Open the remaining 3 hints, verify `hintCount === 4`, then submit the correct
painter name (Task 5's flow). Expected: guess still succeeds normally.

- [ ] **Step 5: Commit**

```bash
git add site/muzayede/index.html
git commit -m "Muzayede: kademeli ipucu seçim mekaniği"
git push
```

---

### Task 7: Price guess + scoring + result screen

**Files:**
- Modify: `site/muzayede/index.html`

**Interfaces:**
- Consumes: `window.MUZ.tablo.fiyat_usd`, `window.MUZ.state.hintCount`.
- Produces: `fiyatAsamasiniAc()` (called from Task 5 on correct guess),
  `fiyatGonder()` (wired to `#fiyatGonderBtn`), `ressamPuanHesapla()`,
  `fiyatPuanHesapla(tahmin, gercek)` — both pure functions, testable
  standalone in devtools console.

- [ ] **Step 1: Add scoring functions + price-guess flow**

```javascript
function ressamPuanHesapla(){
  if(!window.MUZ.state.ressamBulundu) return 0;
  return Math.max(0, 100 - 25 * window.MUZ.state.hintCount);
}

function fiyatPuanHesapla(tahmin, gercek){
  if(tahmin <= 0 || gercek <= 0) return 0;
  const fark = Math.abs(Math.log10(tahmin) - Math.log10(gercek));
  return Math.max(0, Math.round(100 * (1 - fark)));
}

function fiyatAsamasiniAc(){
  document.getElementById('fiyatAsama').style.display = '';
  document.getElementById('fiyatGiris').focus();
}

function fiyatGonder(){
  const tahmin = parseFloat(document.getElementById('fiyatGiris').value);
  if(!(tahmin > 0)){
    document.getElementById('fiyatMesaj').textContent = 'geçerli bir sayı gir';
    return;
  }
  const gercek = window.MUZ.tablo.fiyat_usd;
  const fiyatPuan = fiyatPuanHesapla(tahmin, gercek);
  const ressamPuan = ressamPuanHesapla();
  const toplam = fiyatPuan + ressamPuan;

  document.getElementById('fiyatAsama').querySelectorAll('input,button').forEach(el => el.disabled = true);

  const sonuc = document.getElementById('sonucKutu');
  sonuc.style.display = '';
  sonuc.innerHTML =
    '<p>gerçek fiyat: $' + gercek.toLocaleString('en-US') + ' — ' +
    window.MUZ.tablo.muzayede_evi + ', ' + window.MUZ.tablo.satis_yili + '</p>' +
    '<p><a href="' + window.MUZ.tablo.kaynak_url + '" target="_blank" rel="noopener">kaynak</a></p>' +
    '<p>ressam puanı: ' + ressamPuan + ' / fiyat puanı: ' + fiyatPuan + ' / toplam: ' + toplam + '</p>';

  window.MUZ.state.toplamPuan = toplam;
}

document.getElementById('fiyatGonderBtn').addEventListener('click', fiyatGonder);
document.getElementById('fiyatGiris').addEventListener('keydown', e => {
  if(e.key === 'Enter') fiyatGonder();
});
```

- [ ] **Step 2: Manual verification — exact price guess**

Play through: get the painter right with 0 hints, check
`window.MUZ.tablo.fiyat_usd` via `javascript_tool`, type that exact number
into `#fiyatGiris`, submit. Expected: `#sonucKutu` shows the real price,
`"ressam puanı: 100 / fiyat puanı: 100 / toplam: 200"`.

- [ ] **Step 3: Manual verification — 10x-off price guess**

Repeat on a fresh page load (or a different `?bulmaca=N&meta=1` index), this
time guess `10 *` the real price. Expected: `fiyatPuanHesapla` returns `0`
(check via `javascript_tool`: `fiyatPuanHesapla(realPrice*10, realPrice)`
should equal `0`), and the result screen shows `fiyat puanı: 0`.

- [ ] **Step 4: Manual verification — hint penalty**

On a fresh load, open 2 hints before guessing the painter correctly, verify
via `javascript_tool` that `ressamPuanHesapla()` returns `50` (100 - 25*2).

- [ ] **Step 5: Commit**

```bash
git add site/muzayede/index.html
git commit -m "Muzayede: fiyat tahmini, puanlama, sonuç ekranı"
git push
```

---

### Task 8: localStorage persistence (daily save + stats)

**Files:**
- Modify: `site/muzayede/index.html`

**Interfaces:**
- Consumes: `window.MUZ.state`, `GUN`, `window.MUZ.tablo.id` (as the content
  fingerprint, mirroring `cati`'s `v.gun!==oyunGun||v.tema!==gunVeri.t` guard).
- Produces: `kaydet()` (called after `fiyatGonder()` completes),
  `yukle()` (called from `baslat()`, restores a finished/in-progress round on
  page reload so refreshing doesn't reset the day's puzzle).

- [ ] **Step 1: Add save/load functions**

```javascript
function kaydet(){
  if(GOMULU) return;
  if(_METAB !== null) return;
  try{
    localStorage.setItem('muzayede:gun', JSON.stringify({
      gun: GUN, tabloId: window.MUZ.tablo.id, state: window.MUZ.state
    }));
  }catch(e){}
}

function yukle(){
  if(GOMULU) return false;
  if(_METAB !== null) return false;
  try{
    const v = JSON.parse(localStorage.getItem('muzayede:gun'));
    if(!v || v.gun !== GUN || v.tabloId !== window.MUZ.tablo.id) return false;
    window.MUZ.state = v.state;
    return true;
  }catch(e){ return false; }
}
```

Wire `kaydet()` to be called at the end of `fiyatGonder()` (append the call
as the last line of that function from Task 7), and call `yukle()` at the
start of `baslat()` (Task 4) — if it returns `true`, re-render the UI to match
the restored state (disable the painter input if `ressamBulundu`, re-open any
hint buttons listed in `state.hintsAcik`, show `#fiyatAsama`/`#sonucKutu` if
`state.toplamPuan` is already set). Add this restore-rendering as a small
`durumuUygula()` helper called right after a successful `yukle()`.

- [ ] **Step 2: Manual verification — save survives reload**

Play through a full round (painter + price), then reload the page (`navigate`
to the same URL again). Expected: `#sonucKutu` shows the same result
immediately on load, without needing to re-answer.

- [ ] **Step 3: Manual verification — stale save is discarded**

With today's round saved (from Step 2), manually edit localStorage via
`javascript_tool`: `const v=JSON.parse(localStorage.getItem('muzayede:gun')); v.tabloId='baska-bir-id'; localStorage.setItem('muzayede:gun', JSON.stringify(v));` then reload.
Expected: `yukle()` returns `false` (id mismatch), the round starts fresh
(painter input enabled, `#sonucKutu` hidden).

- [ ] **Step 4: Manual verification — `?meta=1&bulmaca=N` never persists**

Navigate to `index.html?bulmaca=2&meta=1`, play through, reload the same URL.
Expected: round starts fresh every time (no save/load happens in meta mode),
and `localStorage.getItem('muzayede:gun')` is unaffected by this session.

- [ ] **Step 5: Commit**

```bash
git add site/muzayede/index.html
git commit -m "Muzayede: günlük ilerleme localStorage kaydı"
git push
```

---

### Task 9: Site registration (nav panel, hub card, sitemap)

**Files:**
- Modify: `site/ortak/nav-panel.js`
- Modify: `site/oyunlar/index.html`
- Modify: `site/sitemap.xml`

**Interfaces:**
- None (pure registration, no new functions other files depend on).

- [ ] **Step 1: Add to `OYUNLAR` in `site/ortak/nav-panel.js`**

Find the `OYUNLAR` array (near line 18) and add, matching the existing
entries' style:

```javascript
{ad:'Muzayede', href:B+'muzayede/', oyun:'muzayede', gun:function(){
  const n=new Date();
  return Math.floor((Date.UTC(n.getFullYear(),n.getMonth(),n.getDate())-Date.UTC(2026,6,21))/86400000);
}},
```

(epoch `2026,6,21` = July 21 2026 in JS's 0-indexed month, matching this
plan's `gunler.js` epoch of `"2026-07-21"` from Task 2 — if Task 2's epoch
changes, update this line to match, they must stay in sync.)

- [ ] **Step 2: Add a hub card to `site/oyunlar/index.html`**

Inside `<section class="grup grup-oyunlar">`, add (matching the Atlas card
structure exactly, pick an unused `--td` accent color, e.g. `#8B2E3C`):

```html
<a class="kart oyun" href="../muzayede/" style="--td:#8B2E3C">
  <div class="kapak"><img src="../gorsel/muzayede.jpg" alt="müzayede salonu, tablo" loading="lazy"></div>
  <div class="govde">
    <span class="tur">Sanat</span>
    <h2>Muzayede</h2>
    <p>Tabloya bak, ressamını ve gerçek satış fiyatını tahmin et.</p>
    <span class="oyna">Oyna <span class="ok">→</span></span>
  </div>
</a>
```

Note: `../gorsel/muzayede.jpg` does not exist yet — this is a real missing
asset, not a placeholder pattern to leave broken. Add a TODO comment above
this task's commit reminding that a cover image needs to be dropped into
`site/gorsel/muzayede.jpg` before this card looks right; do not block this
task on producing that image (image sourcing is the user's own domain per
existing project convention — see memory note "kart görselleri kullanıcının
konusu, sorma").

- [ ] **Step 3: Add sitemap entry**

Open `site/sitemap.xml`, find an existing `<url>` entry for another game
(e.g. search for `/atlas/`) to copy its exact structure, then add a matching
entry for `https://verandatools.com/muzayede/` with today's date as
`<lastmod>`.

- [ ] **Step 4: Verify nav panel shows the new entry**

Open any existing game page (e.g. `site/cati/index.html`) in the browser,
open the nav panel UI, confirm "Muzayede" appears in the list and links to
`../muzayede/`.

- [ ] **Step 5: Verify hub card renders**

Open `site/oyunlar/index.html` in the browser, confirm the Muzayede card
renders (broken cover image is expected/acceptable per Step 2's note), and
clicking it navigates to `site/muzayede/index.html`.

- [ ] **Step 6: Commit**

```bash
git add site/ortak/nav-panel.js site/oyunlar/index.html site/sitemap.xml
git commit -m "Muzayede: site navigasyonuna ve hub'a kaydet"
git push
```

---

### Task 10: Faz 1 — `veri/muzayede_harvest.py` (Wikipedia curated-list scraper)

**Files:**
- Create: `veri/muzayede_harvest.py`

**Interfaces:**
- Produces: `veri/muzayede_aday.json`, a list of
  `{"isim":str, "tablo_adi":str, "fiyat_usd":int, "satis_yili":int, "muzayede_evi":str, "kaynak_url":str, "wikipedia_url":str}`
  dicts, one per row successfully parsed. This file is intermediate/working
  data, not committed to `site/` directly — it feeds a future Task 12
  (Faz 3, out of scope for this plan) that will cross-check licensing and
  produce the final `veri/muzayede_ornek.py`-style curated set.

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
muzayede_harvest.py — Wikipedia'nın "List of most expensive paintings" ve
"List of most expensive paintings by living artists" sayfalarından
ressam/tablo/fiyat/kaynak adaylarını çıkarır.

Kullanım:
  python3 veri/muzayede_harvest.py
  python3 veri/muzayede_harvest.py --limit 20   # deneme
"""
import json, re, time, argparse, urllib.request
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
CIKTI = KOK / "veri" / "muzayede_aday.json"
UA = "VerandaMuzayede/1.0 (https://verandatools.com; sanat oyunu veri toplama)"

KAYNAK_SAYFALAR = [
    "https://en.wikipedia.org/wiki/List_of_most_expensive_paintings",
    "https://en.wikipedia.org/wiki/List_of_most_expensive_paintings_by_living_artists",
]

def http_get(url, deneme=3):
    son = None
    for i in range(deneme):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except Exception as e:
            son = e
            time.sleep(1.2 * (i + 1))
    print(f"    ! istek hatası ({url}): {son}")
    return None

def wikipedia_api_html(sayfa_url):
    # Wikipedia REST API üzerinden parsed HTML çek (ham HTML scrape yerine).
    baslik = sayfa_url.rsplit("/", 1)[-1]
    api = f"https://en.wikipedia.org/api/rest_v1/page/html/{baslik}"
    return http_get(api)

FIYAT_RE = re.compile(r"\$([\d,]+)\s*million", re.I)

def tablo_satirlarini_ayikla(html, kaynak_url):
    if not html:
        return []
    adaylar = []
    # Basit satır bazlı ayıklama: <tr> hücrelerinden ressam/tablo/fiyat/yıl çek.
    for satir in re.findall(r"<tr>.*?</tr>", html, re.S):
        hucreler = re.findall(r"<td[^>]*>(.*?)</td>", satir, re.S)
        if len(hucreler) < 4:
            continue
        metin = [re.sub(r"<[^>]+>", "", h).strip() for h in hucreler]
        fiyat_m = None
        for h in metin:
            fm = FIYAT_RE.search(h)
            if fm:
                fiyat_m = fm
                break
        if not fiyat_m:
            continue
        try:
            fiyat = int(float(fiyat_m.group(1).replace(",", "")) * 1_000_000)
        except ValueError:
            continue
        adaylar.append({
            "ham_satir": metin,
            "fiyat_usd": fiyat,
            "kaynak_url": kaynak_url,
        })
    return adaylar

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()

    tumu = []
    for sayfa in KAYNAK_SAYFALAR:
        print(f"çekiliyor: {sayfa}")
        html = wikipedia_api_html(sayfa)
        adaylar = tablo_satirlarini_ayikla(html, sayfa)
        print(f"  {len(adaylar)} satır bulundu")
        tumu.extend(adaylar)
        time.sleep(0.5)

    if a.limit:
        tumu = tumu[:a.limit]

    CIKTI.write_text(json.dumps(tumu, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"yazıldı: {len(tumu)} aday satır -> {CIKTI}")
    print("NOT: 'ham_satir' alanı elle/ajanla işlenip ressam/tablo adı çıkarılmalı — bu script sadece ham tablo satırlarını toplar.")

if __name__ == "__main__":
    main()
```

Note on scope: Wikipedia table markup varies enough between pages that fully
automated ressam-name/tablo-name field extraction is unreliable without a
per-page-specific parser (column order differs between the two source pages).
This script deliberately stops at "raw row text + parsed price", matching the
design spec's Faz 3 step ("ajanlı doğrulama" reads these raw rows and does the
final structured extraction + license check) — do not over-build this script
to guess column meanings, that's explicitly deferred.

- [ ] **Step 2: Run it**

Run: `python3 veri/muzayede_harvest.py --limit 20`
Expected: prints `çekiliyor: ...` twice, then `X satır bulundu` for each page
(X > 0 for at least one page — if the REST API endpoint 404s or the table
regex finds 0 rows on both pages, that's a real failure to debug, not
something to silently accept), then `yazıldı: ... -> veri/muzayede_aday.json`.

- [ ] **Step 3: Inspect actual output quality**

Run: `python3 -c "import json; d=json.load(open('veri/muzayede_aday.json')); [print(x['fiyat_usd'], x['ham_satir'][:2]) for x in d[:5]]"`
Expected: 5 printed rows where `ham_satir` visibly contains a painter name
and/or painting title as plain text (confirms the HTML-to-text stripping
worked, even though structured field extraction is intentionally left for
Faz 3).

- [ ] **Step 4: Commit**

```bash
git add veri/muzayede_harvest.py veri/muzayede_aday.json
git commit -m "Muzayede Faz 1: Wikipedia liste tarayıcı"
git push
```

---

### Task 11: Faz 2 — `veri/muzayede_genislet.py` (Wikidata SPARQL expansion)

**Files:**
- Create: `veri/muzayede_genislet.py`

**Interfaces:**
- Produces: `veri/muzayede_aday_genis.json`, a list of
  `{"isim":str, "wikidata_id":str, "olum_yili":int|None, "ulke":str|None, "commons_gorsel":str|None}`
  dicts — one per painter found via SPARQL who has at least one notable work
  with a Commons image. Also intermediate/working data, feeds the deferred
  Faz 3 step.

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
muzayede_genislet.py — Wikidata SPARQL sorgusuyla, Commons'ta görseli olan
tanınmış eserleri bulunan ressamların aday havuzunu çıkarır.

Kullanım:
  python3 veri/muzayede_genislet.py
  python3 veri/muzayede_genislet.py --limit 50   # deneme
"""
import json, time, argparse, urllib.request, urllib.parse
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
CIKTI = KOK / "veri" / "muzayede_aday_genis.json"
UA = "VerandaMuzayede/1.0 (https://verandatools.com; sanat oyunu veri toplama)"
SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"

SORGU = """
SELECT DISTINCT ?ressam ?ressamLabel ?olum ?ulkeLabel ?gorsel WHERE {
  ?ressam wdt:P106 wd:Q1028181.        # meslek: ressam
  ?ressam wdt:P800 ?eser.               # dikkate değer eser
  ?eser wdt:P18 ?gorsel.                # eserin Commons görseli var
  OPTIONAL { ?ressam wdt:P570 ?olum. }
  OPTIONAL { ?ressam wdt:P27 ?ulke. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 2000
"""

def sparql_sorgula(sorgu, deneme=3):
    url = SPARQL_ENDPOINT + "?" + urllib.parse.urlencode({"query": sorgu, "format": "json"})
    son = None
    for i in range(deneme):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            son = e
            time.sleep(2 * (i + 1))
    print(f"    ! sorgu hatası: {son}")
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()

    print("Wikidata sorgulanıyor...")
    sonuc = sparql_sorgula(SORGU)
    if not sonuc:
        print("sorgu başarısız, çıkılıyor.")
        raise SystemExit(1)

    satirlar = sonuc["results"]["bindings"]
    print(f"{len(satirlar)} satır döndü")

    gorulen = set()
    adaylar = []
    for s in satirlar:
        wid = s["ressam"]["value"].rsplit("/", 1)[-1]
        if wid in gorulen:
            continue
        gorulen.add(wid)
        olum = s.get("olum", {}).get("value")
        adaylar.append({
            "isim": s.get("ressamLabel", {}).get("value", wid),
            "wikidata_id": wid,
            "olum_yili": int(olum[:4]) if olum else None,
            "ulke": s.get("ulkeLabel", {}).get("value"),
            "commons_gorsel": s.get("gorsel", {}).get("value"),
        })

    if a.limit:
        adaylar = adaylar[:a.limit]

    CIKTI.write_text(json.dumps(adaylar, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"yazıldı: {len(adaylar)} benzersiz ressam -> {CIKTI}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python3 veri/muzayede_genislet.py`
Expected: `Wikidata sorgulanıyor...`, then `X satır döndü` (X should be in the
hundreds to low thousands given `LIMIT 2000`), then
`yazıldı: Y benzersiz ressam -> veri/muzayede_aday_genis.json` with `Y <= X`.
If the request fails (network/SPARQL timeout), the script exits 1 — retry
once; if it fails twice, treat that as a real result to report, not something
to work around by removing the `SERVICE wikibase:label` clause silently.

- [ ] **Step 3: Inspect output quality**

Run: `python3 -c "import json; d=json.load(open('veri/muzayede_aday_genis.json')); print(len(d)); [print(x['isim'], x['olum_yili'], x['ulke']) for x in d[:10]]"`
Expected: 10 printed rows with plausible painter names, most with a
4-digit `olum_yili` or `None`, `ulke` populated for most entries.

- [ ] **Step 4: Commit**

```bash
git add veri/muzayede_genislet.py veri/muzayede_aday_genis.json
git commit -m "Muzayede Faz 2: Wikidata genişletme sorgusu"
git push
```

---

### Task 12: Review checkpoint — decide on Faz 3 (no code)

**Files:** none (this task produces a decision, not code)

- [ ] **Step 1: Report Faz 1 + Faz 2 output counts and a content sample**

Print: total candidate rows from `veri/muzayede_aday.json` (Task 10) and
total unique painters from `veri/muzayede_aday_genis.json` (Task 11), plus
5-10 example entries from each, to the user.

- [ ] **Step 2: Ask the user how to proceed**

Faz 3 (per-candidate agent-verified price + license lookup, scaling toward
300-500 painters) was deliberately left out of this plan — the design spec
calls for reviewing Faz 1/2 output first. Do not write a Faz 3 script or run
a Workflow for it as part of this plan. Once the user reviews the counts from
Step 1, a new brainstorming/plan cycle should scope Faz 3 based on what the
actual candidate pool looks like.

---

## Self-Review Notes

- **Spec coverage:** game flow (ressam guess -> chosen hints -> price guess ->
  result) is Tasks 3-8; data model + risk tiering is Tasks 1-2; site
  registration is Task 9; Faz 1/2 of the data pipeline are Tasks 10-11; the
  staged decision point before Faz 3 is Task 12. Leaderboard and practice mode
  are explicitly out of scope per the spec and not included here.
- **No placeholders:** Task 1's painter research step is a concrete, bounded
  research action (8 named painters, exact field schema) rather than invented
  numbers or a "TBD" — this is intentional, since asserting specific dollar
  figures without verification would risk shipping wrong facts.
- **Type/name consistency checked:** `window.MUZ.state` shape
  (`ressamBulundu`, `hintCount`, `hintsAcik`, `toplamPuan`) is defined once in
  Task 5 and reused identically in Tasks 6-8; `bugunTabloId()`/`GUN`/`_METAB`
  from Task 4 are the only names Tasks 5-9 reference for day/puzzle state;
  `fiyatPuanHesapla`/`ressamPuanHesapla` signatures match between their Task 7
  definition and their Task 7 verification steps.
