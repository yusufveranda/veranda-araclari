#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
muzayede_harvest.py - Wikipedia'nin "List of most expensive paintings" ve
"List of most expensive artworks by living artists" sayfalarindan
ressam/tablo/fiyat/kaynak adaylarini cikarir.

Kullanim:
  python3 veri/muzayede_harvest.py
  python3 veri/muzayede_harvest.py --limit 20   # deneme

Not: iki kaynak sayfanin tablo bicimi birbirinden farkli. Ilk sayfa
(List_of_most_expensive_paintings) her satirda gercek dolar tutarini bir
HTML yorumu icinde tasiyor (orn. <!-- $ 450,312,500 -->) - bu en guvenilir
fiyat kaynagi. Ikinci sayfa (List_of_most_expensive_artworks_by_living_artists)
boyle bir yorum tasimiyor, hucrelerde de "$" veya "million" kelimesi
gecmiyor (sadece cikti duz sayi, orn. "91.1") - bu yuzden bu script'in genel
amacli fiyat deseni o sayfada satir bulamayabilir. Bu beklenen bir durum:
gorevin kapsami "ham satir + fiyat ayiklama" ile sinirli, sayfa'ya ozel
sutun tahmini (hangi sutun ressam/tablo adi) kasitli olarak Faz 3'e
birakildi.
"""
import json, re, time, argparse, urllib.request
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
CIKTI = KOK / "veri" / "muzayede_aday.json"
UA = "VerandaMuzayede/1.0 (https://verandatools.com; sanat oyunu veri toplama)"

KAYNAK_SAYFALAR = [
    "https://en.wikipedia.org/wiki/List_of_most_expensive_paintings",
    "https://en.wikipedia.org/wiki/List_of_most_expensive_artworks_by_living_artists",
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
    print(f"    ! istek hatasi ({url}): {son}")
    return None

def wikipedia_api_html(sayfa_url):
    # Wikipedia REST API uzerinden parsed HTML cek (ham HTML scrape yerine).
    baslik = sayfa_url.rsplit("/", 1)[-1]
    api = f"https://en.wikipedia.org/api/rest_v1/page/html/{baslik}"
    return http_get(api)

# Iki farkli fiyat deseni deneniyor, once en guvenilir olan (HTML yorumdaki
# tam dolar tutari), sonra daha genel "$X million" metin deseni.
FIYAT_YORUM_RE = re.compile(r"<!--\s*\$\s*([\d,]+)\s*-->")
FIYAT_MILYON_RE = re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*million", re.I)

def fiyat_ayikla(ham_satir_html):
    # Once tam dolar tutarini tasiyan HTML yorumunu dene (en guvenilir).
    ym = FIYAT_YORUM_RE.search(ham_satir_html)
    if ym:
        try:
            return int(ym.group(1).replace(",", ""))
        except ValueError:
            pass
    # Yoksa "$X million" metin desenini dene.
    mm = FIYAT_MILYON_RE.search(ham_satir_html)
    if mm:
        try:
            return int(float(mm.group(1).replace(",", "")) * 1_000_000)
        except ValueError:
            pass
    return None

def tablo_satirlarini_ayikla(html, kaynak_url):
    if not html:
        return []
    adaylar = []
    # Basit satir bazli ayiklama: <tr> icindeki <td>/<th> hucrelerinden
    # ham metin ve fiyat cek. Wikipedia REST API ciktisinda <tr> her zaman
    # bir id ozniteligi tasiyor, bu yuzden ozniteliksiz <tr> varsayimi
    # (orijinal taslak) gercek tablo satirlarini kacirir.
    for satir in re.findall(r"<tr[^>]*>.*?</tr>", html, re.S):
        fiyat = fiyat_ayikla(satir)
        if fiyat is None:
            continue
        hucreler = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", satir, re.S)
        if len(hucreler) < 4:
            continue
        metin = [re.sub(r"<[^>]+>", "", h).strip() for h in hucreler]
        metin = [m for m in metin if m]
        if not metin:
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
        print(f"cekiliyor: {sayfa}")
        html = wikipedia_api_html(sayfa)
        adaylar = tablo_satirlarini_ayikla(html, sayfa)
        print(f"  {len(adaylar)} satir bulundu")
        tumu.extend(adaylar)
        time.sleep(0.5)

    if a.limit:
        tumu = tumu[:a.limit]

    CIKTI.write_text(json.dumps(tumu, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"yazildi: {len(tumu)} aday satir -> {CIKTI}")
    print("NOT: 'ham_satir' alani elle/ajanla islenip ressam/tablo adi cikarilmali - bu script sadece ham tablo satirlarini toplar.")

if __name__ == "__main__":
    main()
