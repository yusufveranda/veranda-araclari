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

# Uc fiyat deseni deneniyor, once en guvenilir olan (HTML yorumdaki tam
# dolar tutari), sonra "$X million" metin deseni, en son da (fiyat
# sutununda "million" kelimesi hic gecmeyen, birim basligindan anlasilan
# satirlar icin) ciplak "$X.X" deseni.
FIYAT_YORUM_RE = re.compile(r"<!--\s*\$\s*([\d,]+)\s*-->")
FIYAT_MILYON_RE = re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*million", re.I)
FIYAT_CIPLAK_RE = re.compile(r"\$\s*([\d]{1,3}(?:,\d{3})*(?:\.\d+)?)")
# Parsoid ciktisinda kaynakca/dipnot metni iki farkli yerde saklanabiliyor
# ve ikisi de gercek fiyatla alakasiz dolar rakamlari tasiyabiliyor:
#  1) ic ice bir <sup>'un data-mw='{"parts":[...]}' JSON ozniteliginde
#     (orn. bir alici hakkindaki "...privately resold for $65-$90
#     million..." notu).
#  2) Parsoid'in tablo hucresi icine birakabildigi ham HTML yorumlarinda
#     (orn. <!--<ref>{{Cite news |title=...Record $1.21 Million...}}</ref>-->
#     gibi, gercek "fiyat yorumu" desenimizle (<!-- $ N,NNN,NNN -->)
#     KARISTIRILMAMASI gereken, eski/artik wikitext kalintisi yorumlar).
# Bu iki blogu temizlemezsek, gorunmeyen bir dipnottaki alakasiz bir dolar
# rakami hucrenin gercek fiyatiymis gibi eslesebilir.
DATA_MW_RE = re.compile(r"""data-mw=(['"]).*?\1""", re.S)
YORUM_RE = re.compile(r"<!--.*?-->", re.S)

def _hucreyi_temizle(ham_hucre_html):
    # data-mw ozniteliklerini temizler ama HTML yorumlarina dokunmaz -
    # gercek "<!-- $ N,NNN,NNN -->" fiyat yorumunu (FIYAT_YORUM_RE) hala
    # bulabilmemiz gerekiyor.
    return DATA_MW_RE.sub("", ham_hucre_html)

def _hucreyi_agir_temizle(temizlenmis_hucre_html):
    # FIYAT_YORUM_RE hicbir seyle eslesmediyse (yani gecerli bir fiyat
    # yorumu yoksa), daha az guvenilir MILYON/ciplak desenlerini denemeden
    # once TUM HTML yorumlarini da temizle - aksi halde eski/artik bir
    # wikitext-kalintisi yorumun icindeki alakasiz bir "$X million" metni
    # yanlislikla eslesebilir.
    return YORUM_RE.sub("", temizlenmis_hucre_html)

def _satir_eskiden_bulunur_muydu(ham_satir_html):
    # Satirin "aday" sayilip sayilmayacagina eski (temizlenmemis, tum
    # satirin ham HTML'i uzerinde arama yapan) davranisla karar verir -
    # SADECE hangi satirlarin secildigini belirlemek icin kullanilir, asla
    # gercek fiyat degeri icin degil (bkz. tablo_satirlarini_ayikla).
    # Boylece bu fiks hangi satirlarin bulundugunu degistirmez, sadece
    # zaten bulunacak olan satirlarin kaydedilen fiyat degerini duzeltir.
    if FIYAT_YORUM_RE.search(ham_satir_html):
        return True
    if FIYAT_MILYON_RE.search(ham_satir_html):
        return True
    return False

def satir_fiyatini_ayikla(hucreler_ham):
    # Fiyati SADECE tek tek hucrelerin ham HTML'inde ara, tum satirin
    # birlestirilmis HTML'inde degil. Aksi halde bir hucredeki kaynakca/
    # dipnot ilgisiz bir rakamla eslesebilir (orn. "[note 9]" iceren
    # Parsoid blobu). Once tum hucrelerde HTML-yorum desenini dene (en
    # guvenilir), sonra yine tum hucrelerde "$X million" desenini dene -
    # boylece bir hucrede yorum deseni gecerken baska bir hucrede daha az
    # guvenilir "million" deseninin yanlislikla oncelik kazanmasi
    # engellenir.
    temiz = [_hucreyi_temizle(h) for h in hucreler_ham]
    for h in temiz:
        ym = FIYAT_YORUM_RE.search(h)
        if ym:
            try:
                return int(ym.group(1).replace(",", ""))
            except ValueError:
                pass
    for h in temiz:
        mm = FIYAT_MILYON_RE.search(_hucreyi_agir_temizle(h))
        if mm:
            try:
                return int(float(mm.group(1).replace(",", "")) * 1_000_000)
            except ValueError:
                pass
    return None

def _ciplak_fiyat_dene(hucreler_ham):
    # Son care yedegi - SADECE zaten "eski (hatali) davranisla da bu satir
    # zaten bulunuyordu" diye onceden dogrulanmis satirlar icin cagirilir
    # (bkz. tablo_satirlarini_ayikla). Boylece bu yedek yeni satirlar
    # eklemez / tabloya kapsam genisletmez, sadece zaten secilmis olan bir
    # satirin degerini kaynakca kirliligi yuzunden None donerse kurtarir.
    # Fiyat sutunlari (bu tur "most expensive X" tablolarinda her zaman en
    # bastaki 1-2 sutun; tablo basligi birimi "million USD" olarak
    # belirtiyor) genelde "$203.3" gibi "million" kelimesi gecmeyen ciplak
    # bir ondalik tasir. Sadece ilk iki hucreye bakariz (baska sutunlarda -
    # alici/satici adi vb. - rastlantisal "$" gecmesi riskini azaltmak
    # icin). Birden fazla aday varsa en kucugunu aliriz: bu tablolarda ilk
    # sutun enflasyona-gore-guncellenmis (her zaman buyuk/esit) tutar,
    # sonraki sutun ise satisin gerceklestigi yildaki nominal/gercek
    # tutardir - kaydetmek istedigimiz gercek satis fiyati budur.
    temiz = [_hucreyi_agir_temizle(_hucreyi_temizle(h)) for h in hucreler_ham]
    adaylar = []
    for h in temiz[:2]:
        cm = FIYAT_CIPLAK_RE.search(h)
        if cm:
            try:
                deger = float(cm.group(1).replace(",", ""))
            except ValueError:
                continue
            # Virgullu (binlik ayiracli) tam sayi zaten dolar cinsinden
            # yazilmis (orn. "$450,312,500"); virgulsuz kucuk ondalik ise
            # "million" biriminde (orn. "$82.5" -> 82.5 milyon dolar).
            if "," in cm.group(1):
                adaylar.append(int(deger))
            else:
                adaylar.append(int(deger * 1_000_000))
    if adaylar:
        return min(adaylar)
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
        hucreler = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", satir, re.S)
        if len(hucreler) < 4:
            continue
        # Once bu satirin FIYAT bulunabilir bir satir olup olmadigini eski
        # (temizlenmemis, tum satir HTML'i uzerinde arama yapan) davranisla
        # belirle - bu, hangi satirlarin "aday" sayildigini eskisiyle ayni
        # tutar (kapsam genislemez/daralmaz). Sonra GERCEK fiyat degerini
        # guvenli (hucre-bazli + kaynakca temizlenmis) yontemle hesapla;
        # kirlilik yuzunden guvenli yontem None donerse, sadece bu onceden
        # nitelikli satir icin ciplak-fiyat yedegine basvur.
        if not _satir_eskiden_bulunur_muydu(satir):
            continue
        fiyat = satir_fiyatini_ayikla(hucreler)
        if fiyat is None:
            fiyat = _ciplak_fiyat_dene(hucreler)
        if fiyat is None:
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
