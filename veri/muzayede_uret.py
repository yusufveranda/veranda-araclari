# -*- coding: utf-8 -*-
# Muzayede veri üretici: veri/muzayede_ornek.py -> muzayede/{data/*.json, gunler.js}
# Doğrulama başarısızsa hiçbir dosya yazılmaz (exit 1).
import json, sys
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from muzayede_ornek import DATA, CAKMA_DATA
from muzayede_faz3_data import FAZ3_DATA
from muzayede_faz4_data import FAZ4_DATA
from muzayede_faz5_data import FAZ5_DATA
from muzayede_faz6_data import FAZ6_DATA
from muzayede_faz7_data import FAZ7_DATA
from muzayede_faz9_data import FAZ9_DATA
from muzayede_faz10_data import FAZ10_DATA

SITE = KOK / "muzayede"
RISK_GECERLI = {"public_domain", "dogrulanmis_serbest", "dikkat"}

# KANONIK sabit sira: yeni fazlar eklendikce SONUNA eklenir, araya sokulmaz.
# ressam_id ile tablo_id (bulmaca/gün kimliği) ayrı kavramlar: bir ressamın
# birden fazla tablosu olabilir. tablo_id, bu kanonik sirada bir (ressam_id,
# tablo_adi) ciftinin kacinci karsilasma oldugundan turetilir: ilk gorulen
# hep ressam_id kalir (mevcut gunler asla degismesin diye), sonrakiler -2,
# -3... soneki alir. Toplam sayima gore DEGIL, ilk-gorulme sirasina gore
# hesaplanir; boylece bir ressama sonradan tablo eklemek, o ressamin daha
# once yayinlanmis tablosunun id'sini asla degistirmez.
TUMU = DATA + FAZ3_DATA + FAZ4_DATA + FAZ5_DATA + FAZ6_DATA + FAZ7_DATA + FAZ9_DATA + FAZ10_DATA + CAKMA_DATA

def _tablo_id_haritasi():
    gorulen = {}
    harita = {}
    for d in TUMU:
        rid, tablo_adi = d[0], d[6]
        n = gorulen.get(rid, 0) + 1
        gorulen[rid] = n
        harita[(rid, tablo_adi)] = rid if n == 1 else f"{rid}-{n}"
    return harita

_TABLO_ID_HARITASI = _tablo_id_haritasi()

def tablo_id(d):
    return _TABLO_ID_HARITASI[(d[0], d[6])]

def dogrula():
    hata = []
    ciftler = [(d[0], d[6]) for d in TUMU]
    if len(ciftler) != len(set(ciftler)):
        hata.append("ayni ressamin iki tablosu tam ayni tablo_adi ile tekrar ediyor")
    idler = [tablo_id(d) for d in TUMU]
    if len(idler) != len(set(idler)):
        hata.append("tekrar eden tablo_id var")
    for d in TUMU:
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
    ressam_seen = set()
    tablolar = []
    for gercek, veri in ((True, DATA), (True, FAZ3_DATA), (True, FAZ4_DATA), (True, FAZ5_DATA), (True, FAZ6_DATA), (True, FAZ7_DATA), (True, FAZ9_DATA), (True, FAZ10_DATA), (False, CAKMA_DATA)):
        for d in veri:
            (rid, isim, dogum_olum, ulke, akim, risk, tablo_adi, tablo_yili,
             gorsel, fiyat, satis_yili, ev, kaynak) = d
            if rid not in ressam_seen:
                ressam_seen.add(rid)
                ressamlar.append({"id": rid, "isim": isim, "dogum_olum": dogum_olum,
                                   "ulke": ulke, "akim": akim})
            tablolar.append({"id": tablo_id(d), "ressam_id": rid, "tablo_adi": tablo_adi,
                              "tablo_yili": tablo_yili, "gorsel": gorsel,
                              "fiyat_usd": fiyat, "satis_yili": satis_yili,
                              "muzayede_evi": ev, "kaynak_url": kaynak, "gercek": gercek,
                              "risk_seviyesi": risk})
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

    # DATA+CAKMA_DATA sirasi korunuyor (mevcut gunlerin bulmacasi degismesin diye),
    # FAZ3/FAZ4/FAZ5/FAZ6/FAZ7_DATA yeni gunler olarak sirayla sona ekleniyor.
    sira = [tablo_id(d) for d in DATA + CAKMA_DATA + FAZ3_DATA + FAZ4_DATA + FAZ5_DATA + FAZ6_DATA + FAZ7_DATA + FAZ9_DATA + FAZ10_DATA]
    gunler = {"epoch": "2026-07-21", "sira": sira}
    js = "// Muzayede gün sırası. Üretim: veri/muzayede_uret.py. Elle düzenleme: doğrulamayı çalıştır.\n"
    js += "window.MUZAYEDE_GUNLER=" + json.dumps(gunler, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (SITE / "gunler.js").write_text(js, encoding="utf-8")

    print(f"yazıldı: {len(ressamlar)} ressam, {len(tablolar)} tablo -> muzayede/")

if __name__ == "__main__":
    main()
