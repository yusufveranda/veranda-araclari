# -*- coding: utf-8 -*-
# Muzayede v1 örnek veri: 8 ressam, gerçek belgelenmiş müzayede satışı.
# Alan sırası: ressam_id, isim, dogum_olum, ulke, akim, risk_seviyesi,
#              tablo_adi, tablo_yili, gorsel_url, fiyat_usd, satis_yili,
#              muzayede_evi, kaynak_url
#
# risk_seviyesi notu: public_domain = ressam olumunun uzerinden 2026'da
# 70+ yil gecmis (ABD/AB kurali). dikkat = henuz kamu malı olmamis veya
# miras hakki sahipleri aktif olarak telif/imaj hakkini koruyor; bu
# durumda gorsel_url dusuk cozunurluklu bir Wikipedia kucuk resmine
# (thumbnail) isaret eder, yuksek cozunurluklu Commons dosyasina degil.

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
     # gecici görsel, Faz 3'te lisans dogrulamasiyla degisecek
     "https://upload.wikimedia.org/wikipedia/en/thumb/b/b5/Les_femmes_d%E2%80%99Alger%2C_Picasso%2C_version_O.jpg/330px-Les_femmes_d%E2%80%99Alger%2C_Picasso%2C_version_O.jpg",
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
     # gecici görsel, Faz 3'te lisans dogrulamasiyla degisecek
     "https://upload.wikimedia.org/wikipedia/en/thumb/f/f6/Untitled1982Basquiat.jpg/330px-Untitled1982Basquiat.jpg",
     110500000, 2017, "Sotheby's",
     "https://en.wikipedia.org/wiki/Untitled_(1982_Basquiat_skull_painting)"),

    ("andy-warhol", "Andy Warhol", "1928-1987", "ABD",
     "Pop Art", "dikkat",
     "Shot Sage Blue Marilyn", "1964",
     # gecici görsel, Faz 3'te lisans dogrulamasiyla degisecek
     "https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Andy_Warhol_Shot_Marilyns_1964.jpg/330px-Andy_Warhol_Shot_Marilyns_1964.jpg",
     195000000, 2022, "Christie's",
     "https://en.wikipedia.org/wiki/Shot_Marilyns"),

    ("frida-kahlo", "Frida Kahlo", "1907-1954", "Meksika",
     "Sürrealizm", "dikkat",
     "Diego y yo", "1949",
     # gecici görsel, Faz 3'te lisans dogrulamasiyla degisecek
     # not: Meksika telif suresi olum+100 yil (ABD/AB'deki olum+70
     # degil) ve Frida Kahlo Corporation imaj hakkini aktif koruyor,
     # bu yuzden olum+70 kuralina ragmen public_domain degil dikkat.
     "https://upload.wikimedia.org/wikipedia/en/thumb/f/fc/Diego_And_I.jpg/250px-Diego_And_I.jpg",
     34900000, 2021, "Sotheby's",
     "https://en.wikipedia.org/wiki/Diego_y_yo"),
]
