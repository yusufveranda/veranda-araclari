# -*- coding: utf-8 -*-
# Muzayede v1 örnek veri: 8 ressam, gerçek belgelenmiş müzayede satışı.
# Alan sırası: ressam_id, isim, dogum_olum, ulke, akim, risk_seviyesi,
#              tablo_adi, tablo_yili, gorsel_url, fiyat_usd, satis_yili,
#              muzayede_evi, kaynak_url
#
# risk_seviyesi notu: public_domain = ressam olumunun uzerinden 2026'da
# 70+ yil gecmis (ABD/AB kurali). dikkat = henuz kamu malı olmamis veya
# miras hakki sahipleri aktif olarak telif/imaj hakkini koruyor; bu
# durumda gorsel_url Wikipedia'nin kendi adil kullanim (fair use)
# yuklemesine isaret eder (Commons'taki serbest dosyalara degil).
# Wikipedia bu dosyalari zaten dusuk cozunurlukte barindirir (kendi
# adil kullanim politikasi geregi), o yuzden mumkun olan en genis
# thumb genisligi istenir; sonuc yine de kaynaktan daha buyuk olmaz.

DATA = [
    ("leonardo-da-vinci", "Leonardo da Vinci", "1452-1519", "İtalya",
     "Rönesans", "public_domain",
     "Salvator Mundi", "yak. 1500",
     "https://upload.wikimedia.org/wikipedia/commons/f/ff/Salvator_Mundi_Ganay.jpg",
     450300000, 2017, "Christie's",
     "https://en.wikipedia.org/wiki/Salvator_Mundi_(Leonardo)"),

    ("pablo-picasso", "Pablo Picasso", "1881-1973", "İspanya",
     "Kübizm", "dikkat",
     "Les Femmes d'Alger (Version O)", "1955",
     # Christie's basin gorseli (HENI arsivi uzerinden), Wikipedia'nin kendi
     # adil kullanim kopyasindan (400x249) cok daha buyuk ve net
     "https://resources.heni.com/e28e372d-efb3-4ce6-9f91-f4400b966ab1.jpg?width=1024",
     179400000, 2015, "Christie's",
     "https://en.wikipedia.org/wiki/Les_Femmes_d%27Alger"),

    ("vincent-van-gogh", "Vincent van Gogh", "1853-1890", "Hollanda",
     "Post-Empresyonizm", "public_domain",
     "Portrait de Dr. Gachet", "1890",
     "https://upload.wikimedia.org/wikipedia/commons/1/1e/Portrait_of_Dr._Gachet.jpg",
     82500000, 1990, "Christie's",
     "https://en.wikipedia.org/wiki/Portrait_of_Dr._Gachet"),

    ("claude-monet", "Claude Monet", "1840-1926", "Fransa",
     "Empresyonizm", "public_domain",
     "Meules", "1890",
     "https://upload.wikimedia.org/wikipedia/commons/4/4e/Claude_Monet_-_Meules_%28W_1273%29.jpg",
     110700000, 2019, "Sotheby's",
     "https://en.wikipedia.org/wiki/List_of_most_expensive_paintings"),

    ("gustav-klimt", "Gustav Klimt", "1862-1918", "Avusturya",
     "Sembolizm", "public_domain",
     "Lady with a Fan", "1917-1918",
     "https://upload.wikimedia.org/wikipedia/commons/a/a4/Gustav_Klimt_-_Dame_mit_F%C3%A4cher.jpeg",
     108400000, 2023, "Sotheby's",
     "https://en.wikipedia.org/wiki/Lady_with_a_Fan_(Klimt)"),

    ("jean-michel-basquiat", "Jean-Michel Basquiat", "1960-1988", "ABD",
     "Neo-Ekspresyonizm", "dikkat",
     "Untitled", "1982",
     # Hyperallergic'in basin gorseli, Wikipedia'nin kendi adil kullanim
     # kopyasindan cok daha buyuk ve net
     "https://storage.ghost.io/c/51/f8/51f871d8-b6be-4a73-b958-0ca4fff0110a/content/images/hyperallergic-newspack-s3-amazonaws-com/uploads/2017/05/9761-lot-24.jpg",
     110500000, 2017, "Sotheby's",
     "https://en.wikipedia.org/wiki/Untitled_(1982_Basquiat_skull_painting)"),

    ("andy-warhol", "Andy Warhol", "1928-1987", "ABD",
     "Pop Art", "dikkat",
     "Shot Sage Blue Marilyn", "1964",
     # Hyperallergic'in basin gorseli (Christie's kaynakli), Wikipedia'nin
     # kendi adil kullanim kopyasindan cok daha buyuk ve net
     "https://storage.ghost.io/c/51/f8/51f871d8-b6be-4a73-b958-0ca4fff0110a/content/images/hyperallergic-newspack-s3-amazonaws-com/uploads/2022/05/warhol-marilyn-1.jpg",
     195000000, 2022, "Christie's",
     "https://en.wikipedia.org/wiki/Shot_Marilyns"),

    ("frida-kahlo", "Frida Kahlo", "1907-1954", "Meksika",
     "Sürrealizm", "dikkat",
     "El sueño (La cama)", "1940",
     # 2025'te yeni rekor sattigi icin Diego y yo yerine bu tablo
     # kullaniliyor (34.9M -> 54.7M, kadin ressamlar arasinda rekor).
     # Hyperallergic'in basin gorseli (Sotheby's kaynakli).
     # not: Meksika telif suresi olum+100 yil (ABD/AB'deki olum+70
     # degil) ve Frida Kahlo Corporation imaj hakkini aktif koruyor,
     # bu yuzden olum+70 kuralina ragmen public_domain degil dikkat.
     "https://storage.ghost.io/c/51/f8/51f871d8-b6be-4a73-b958-0ca4fff0110a/content/images/size/w1200/hyperallergic-newspack-s3-amazonaws-com/uploads/2025/11/frida-kahlo-el-sueno-la-cama-est--40000000-60000000-1.jpg",
     54700000, 2025, "Sotheby's",
     "https://hyperallergic.com/frida-kahlo-becomes-most-expensive-woman-artist-at-auction/"),
]

# CAKMA: gercek=False isaretlenen, degersiz/taninmayan tablolar. "gercek mi
# cakma mi" sorusunun cakma tarafini besler. Ayni alan sirasini kullanir,
# ama fiyat_usd burada gercekten dusuk (yuzlerce/binlerce dolar). Ressam
# gercek ve isimli olsa da (Wikimedia Commons uzerinden), tur bu asamada
# ressam tahminine gecmiyor, o yuzden risk_seviyesi/dogum_olum gibi alanlar
# sadece kayit tutarliligi icin dolduruluyor, oyunda kullanilmiyor.
CAKMA_DATA = [
    ("stil-abraham-pether", "Bilinmiyor (Abraham Pether tarzında)", "1752-1812", "İngiltere",
     "Taklit/atfedilen", "public_domain",
     "Moonlit Landscape with Lake and Ruined Abbey", "19. yüzyıl",
     # York Art Gallery koleksiyonundaki "style of" (Abraham Pether'in
     # kendisi degil, taklit) eser, Wikimedia Commons'tan kamu malı.
     "https://upload.wikimedia.org/wikipedia/commons/1/10/Abraham_Pether_%281756-1812%29_%28style_of%29_-_Moonlit_Landscape_with_Lake_and_Ruined_Abbey_-_YORAG_%2C_599_-_York_Art_Gallery.jpg",
     425, 2023, "Bonhams",
     "https://en.wikipedia.org/wiki/Abraham_Pether"),
]
