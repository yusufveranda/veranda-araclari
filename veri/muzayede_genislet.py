#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
muzayede_genislet.py: Wikidata SPARQL sorgusuyla, Commons'ta gorseli olan
taninmis eserleri bulunan ressamlarin aday havuzunu cikarir.

Kullanim:
  python3 veri/muzayede_genislet.py
  python3 veri/muzayede_genislet.py --limit 50   # deneme
"""
import json, time, argparse, urllib.request, urllib.parse, re
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
CIKTI = KOK / "veri" / "muzayede_aday_genis.json"
UA = "VerandaMuzayede/1.0 (https://verandatools.com; sanat oyunu veri toplama)"
SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"

SORGU = """
SELECT DISTINCT ?ressam ?ressamLabel ?olum ?ulkeLabel ?gorsel WHERE {
  ?ressam wdt:P106 wd:Q1028181.        # meslek: ressam
  ?ressam wdt:P800 ?eser.               # dikkate deger eser
  ?eser wdt:P18 ?gorsel.                # eserin Commons gorseli var
  OPTIONAL { ?ressam wdt:P570 ?olum. }
  OPTIONAL { ?ressam wdt:P27 ?ulke. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 2000
"""

# Regex to parse ISO 8601 dates (including optional leading - for BC years)
YIL_RE = re.compile(r'^(-?\d+)-\d{2}-\d{2}T')

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
    print(f"    ! sorgu hatasi: {son}")
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()

    print("Wikidata sorgulaniyor...")
    sonuc = sparql_sorgula(SORGU)
    if not sonuc:
        print("sorgu basarisiz, cikiliyor.")
        raise SystemExit(1)

    satirlar = sonuc["results"]["bindings"]
    print(f"{len(satirlar)} satir dondu")

    gorulen = set()
    adaylar = []
    for s in satirlar:
        wid = s["ressam"]["value"].rsplit("/", 1)[-1]
        if wid in gorulen:
            continue
        gorulen.add(wid)
        olum = s.get("olum", {}).get("value")
        olum_yili = None
        if olum:
            m = YIL_RE.match(olum)
            if m:
                olum_yili = int(m.group(1))
        adaylar.append({
            "isim": s.get("ressamLabel", {}).get("value", wid),
            "wikidata_id": wid,
            "olum_yili": olum_yili,
            "ulke": s.get("ulkeLabel", {}).get("value"),
            "commons_gorsel": s.get("gorsel", {}).get("value"),
        })

    if a.limit:
        adaylar = adaylar[:a.limit]

    CIKTI.write_text(json.dumps(adaylar, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"yazildi: {len(adaylar)} benzersiz ressam -> {CIKTI}")

if __name__ == "__main__":
    main()
