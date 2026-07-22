#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
muzayede_harvest.py - Wikipedia'nin muzayede-rekor listelerinden ressam/
tablo/fiyat/kaynak adaylarini cikarir.

Kullanim:
  python3 veri/muzayede_harvest.py
  python3 veri/muzayede_harvest.py --limit 20   # deneme

Kaynak sayfalarin tablo bicimleri birbirinden farkli:
- List_of_most_expensive_paintings: her satirda gercek dolar tutarini bir
  HTML yorumu icinde tasiyor (orn. <!-- $ 450,312,500 -->) - bu en guvenilir
  fiyat kaynagi. Genel amacli tablo_satirlarini_ayikla() bu sayfayi isler.
- List_of_most_expensive_artworks_by_living_artists: boyle bir yorum
  tasimiyor, hucrelerde de "$" veya "million" kelimesi gecmiyor (sutunlar
  sabit: [enflasyona-gore-guncel-milyon, nominal-satis-milyon, eser,
  sanatci, tarih, mekan, kaynakca]). Bu sayfaya ozel
  yasayan_sanatcilar_satirlarini_ayikla() fonksiyonu nominal (2. sutun)
  degeri kullanir.
"""
import json, re, time, argparse, urllib.request, urllib.parse, sys
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
CIKTI = KOK / "veri" / "muzayede_aday.json"
UA = "VerandaMuzayede/1.0 (https://verandatools.com; sanat oyunu veri toplama)"

# Genel amacli (tablo_satirlarini_ayikla ile islenecek) sayfalar.
KAYNAK_SAYFALAR = [
    "https://en.wikipedia.org/wiki/List_of_most_expensive_paintings",
]

# Sayfaya ozel ayrac fonksiyonu gerektiren sayfalar (baslik -> ayrac adi).
# Sadece REST API'de var oldugu ve tablo icerdigi dogrulanmis sayfalar
# eklendi. Denenip bulunamayanlar (404): List_of_most_expensive_paintings_
# by_female_artists, List_of_most_expensive_paintings_by_country ve
# ressam-ozel "List of most expensive X paintings" (Picasso, Van Gogh,
# Monet, Cezanne, Basquiat, Warhol, Klimt, Modigliani, Rembrandt, Rubens,
# Matisse icin denendi, hicbiri yok). List_of_most_expensive_sculptures
# kasitli disarida birakildi (heykel, kapsam disi).
YASAYAN_SANATCILAR_SAYFA = "https://en.wikipedia.org/wiki/List_of_most_expensive_artworks_by_living_artists"

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

# Yasayan sanatcilar sayfasinin sutun sirasi sabit: [enflasyona-gore-guncel
# fiyat (milyon USD), nominal/gercek satis fiyati (milyon USD), eser adi,
# sanatci, tarih, mekan, kaynakca]. Bu sayfada ne HTML-yorum fiyati ne de
# "$"/"million" kelimesi var - hucreler ciplak sayi. O yuzden genel amacli
# tablo_satirlarini_ayikla() burada calismiyor, sayfaya ozel bu fonksiyon
# gerekiyor. Nominal (2. sutun) degeri kullaniyoruz, cunku enflasyona-gore-
# guncellenmis tutar degil, o satista gercekten odenen miktar bizim
# "fiyat_usd" alanimizin anlami (diger kaynak sayfalarla tutarli olsun diye).
def yasayan_sanatcilar_satirlarini_ayikla(html, kaynak_url):
    if not html:
        return []
    adaylar = []
    for satir in re.findall(r"<tr[^>]*>.*?</tr>", html, re.S):
        hucreler = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", satir, re.S)
        # Bu sayfadaki gercek veri satirlari her zaman tam 7 hucreli
        # (baslik satiri dahil). Sayfa altindaki navbox'lar 1-3 hucreli
        # oldugundan bu filtre onlari zaten eler.
        if len(hucreler) != 7:
            continue
        metin = [re.sub(r"<[^>]+>", "", h).strip() for h in hucreler]
        # 2. hucre (indeks 1) nominal fiyat - sayisal degilse (orn. baslik
        # satirindaki "Original price\n(in millions of USD)") bu satir atlanir.
        # Bazi satirlarda esit fiyatli kayitlar "3.63 (tied)" gibi bir ek
        # aciklamayla isaretleniyor - basdaki sayiyi cekip geri kalanini yok
        # sayiyoruz.
        fiyat_eslesme = re.match(r"^\s*([\d,]+(?:\.\d+)?)", metin[1])
        if not fiyat_eslesme:
            continue
        try:
            fiyat_milyon = float(fiyat_eslesme.group(1).replace(",", ""))
        except ValueError:
            continue
        fiyat = int(round(fiyat_milyon * 1_000_000))
        metin = [m for m in metin if m]
        if not metin:
            continue
        adaylar.append({
            "ham_satir": metin,
            "fiyat_usd": fiyat,
            "kaynak_url": kaynak_url,
        })
    return adaylar

def _normalize_metin(s):
    # Dedup karsilastirmasi icin kabaca normallestirme: kucuk harf, sadece
    # harf/rakam/bosluk, tek bosluklu.
    s = s.lower()
    s = re.sub(r"[^a-z0-9şğüöçı ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def bilinen_tablo_adlarini_yukle():
    # Mevcut 129 kayitli ressamin (muzayede_ornek.py DATA + muzayede_faz3_data.py
    # FAZ3_DATA) tablo_adi alanlarini (her tuple'in 7. elemani, indeks 6) okur.
    # Basit/kaba dedup icin - kesin dogrulama sonraki (ajan) asamada yapilacak.
    veri_dizini = str(KOK / "veri")
    if veri_dizini not in sys.path:
        sys.path.insert(0, veri_dizini)
    import muzayede_ornek
    import muzayede_faz3_data
    isimler = set()
    for kayit in muzayede_ornek.DATA:
        isimler.add(kayit[6])
    for kayit in muzayede_faz3_data.FAZ3_DATA:
        isimler.add(kayit[6])
    return {_normalize_metin(isim) for isim in isimler if isim}

def muhtemelen_zaten_var_mi(aday, bilinen_normali):
    # aday'in ham_satir hucrelerinden herhangi biri, bilinen bir tablo_adi ile
    # (normallestirilmis) bir yonde alt-dize eslesirse "muhtemelen zaten var"
    # sayilir. Cok kisa metinlerde (orn. tarih/fiyat hucreleri) yanlis pozitif
    # riskini azaltmak icin 4 karakterden kisa dizeler karsilastirmaya girmez.
    for hucre in aday.get("ham_satir", []):
        h = _normalize_metin(hucre)
        if len(h) < 4:
            continue
        for bn in bilinen_normali:
            if len(bn) < 4:
                continue
            if bn in h or h in bn:
                return True
    return False

def wikipedia_sayfa_var_mi(baslik):
    # Sadece varlik/tablo kontrolu icin hafif bir HEAD-benzeri deneme: REST
    # API'den HTML cekmeyi dener, 404/hata durumunda None doner.
    api = f"https://en.wikipedia.org/api/rest_v1/page/html/{urllib.parse.quote(baslik)}"
    try:
        req = urllib.request.Request(api, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode("utf-8")
    except Exception:
        return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    a = ap.parse_args()

    tumu = []

    # 1) Genel amacli sayfalar (HTML-yorum/million deseni ile ayiklanabilenler).
    for sayfa in KAYNAK_SAYFALAR:
        print(f"cekiliyor: {sayfa}")
        html = wikipedia_api_html(sayfa)
        adaylar = tablo_satirlarini_ayikla(html, sayfa)
        print(f"  {len(adaylar)} satir bulundu")
        tumu.extend(adaylar)
        time.sleep(0.5)

    # 2) Yasayan sanatcilar sayfasi - sayfaya ozel ayrac.
    print(f"cekiliyor: {YASAYAN_SANATCILAR_SAYFA}")
    html = wikipedia_api_html(YASAYAN_SANATCILAR_SAYFA)
    adaylar = yasayan_sanatcilar_satirlarini_ayikla(html, YASAYAN_SANATCILAR_SAYFA)
    print(f"  {len(adaylar)} satir bulundu")
    tumu.extend(adaylar)

    if a.limit:
        tumu = tumu[:a.limit]

    # 3) Kaba dedup: mevcut 129 kayitli ressamin tablo_adi'lariyla karsilastir,
    # eslesenleri isaretle (cikarma, sadece not dus).
    bilinen_normali = bilinen_tablo_adlarini_yukle()
    zaten_var_sayisi = 0
    for aday in tumu:
        eslesti = muhtemelen_zaten_var_mi(aday, bilinen_normali)
        aday["muhtemelen_zaten_var"] = eslesti
        if eslesti:
            zaten_var_sayisi += 1

    CIKTI.write_text(json.dumps(tumu, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"yazildi: {len(tumu)} aday satir -> {CIKTI}")
    print(f"  bunlardan {zaten_var_sayisi} tanesi mevcut 129 kayitla (kaba, alt-dize bazli) eslesiyor -> 'muhtemelen_zaten_var': true")
    print("NOT: 'ham_satir' alani elle/ajanla islenip ressam/tablo adi cikarilmali - bu script sadece ham tablo satirlarini toplar.")

if __name__ == "__main__":
    main()
