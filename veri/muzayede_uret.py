# -*- coding: utf-8 -*-
# Muzayede veri üretici: veri/muzayede_ornek.py -> muzayede/{data/*.json, gunler.js}
# Doğrulama başarısızsa hiçbir dosya yazılmaz (exit 1).
import json, sys
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from muzayede_ornek import DATA

SITE = KOK / "muzayede"
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
    js = "// Muzayede gün sırası. Üretim: veri/muzayede_uret.py. Elle düzenleme: doğrulamayı çalıştır.\n"
    js += "window.MUZAYEDE_GUNLER=" + json.dumps(gunler, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (SITE / "gunler.js").write_text(js, encoding="utf-8")

    print(f"yazıldı: {len(ressamlar)} ressam, {len(tablolar)} tablo -> muzayede/")

if __name__ == "__main__":
    main()
