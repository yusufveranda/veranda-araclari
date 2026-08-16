/* ============================================================
   Kervansaray · rota verisi
   Uzun Yol: Akşehir'den Kayseri'ye, gerçek Selçuklu menzilleri.
   tur: 'han' (ayakta/bilinen), 'kayip' (yazılı kaynaklarda kalan
   menzil), 'sehir' (yol düğümü). Notlar gerçek tarih bilgisidir;
   emin olunamayan hanlar rotaya alınmadı.
   Beyşehir kolu (Kızılören, Kuruçeşme, Altınapa) doğrusallığı
   bozduğu için bu rotada yok; ileride "güney seferi" için rezerv.
   ============================================================ */
window.KERVAN_ROTA = [
  { tur:'sehir', ad:'Akşehir', yer:'Akşehir, Konya', tarih:'',
    not:'Selçuklu ülkesinin batı kapılarından sayılan kasaba Nasreddin Hoca\'nın türbesiyle tanınır; kervanlar Konya yoluna buradan koyulurdu.' },
  { tur:'han', ad:'İshaklı Kervansarayı', yer:'Sultandağı, Afyonkarahisar', tarih:'1249',
    not:'Vezir Sahip Ata Fahreddin Ali\'nin yaptırdığı, mimarları Kölük bin Abdullah ile Kaluyan el-Konevi olan bu han Afyonkarahisar\'ın en büyük kervansarayıdır.' },
  { tur:'kayip', ad:'Argıt Hanı', yer:'Argıthanı, Ilgın, Konya', tarih:'12. yüzyıl sonu',
    not:'Şemseddin Altun-aba\'nın vakıf olarak yaptırdığı handan bugün iz kalmadı; 1721\'de Damat İbrahim Paşa taşlarını yeni bir handa kullandı.' },
  { tur:'han', ad:'Ilgın Hanı', yer:'Ilgın, Konya', tarih:'1267',
    not:'Sahip Ata\'nın Ilgın kaplıcasının yanına yaptırdığı han ile zaviyede dönemin ünlü mimarı Kaluyan el-Konevi çalışmıştır.' },
  { tur:'han', ad:'Kadın Hanı', yer:'Kadınhanı, Konya', tarih:'1223',
    not:'Raziye Hatun\'un yaptırdığı kışlık han, çevresinde büyüyen ilçeye bugünkü adını verdi: Kadınhanı.' },
  { tur:'han', ad:'Dokuzun Hanı', yer:'Selçuklu, Konya', tarih:'1210',
    not:'Eski kaynaklarda tehlikeli geçit anlamına gelen Derbent Han diye geçer; halk söylencesi bugünkü adını selde sürüklenen dokuz kişiye bağlar.' },
  { tur:'sehir', ad:'Konya', yer:'Konya', tarih:'',
    not:'Anadolu Selçuklu Devleti\'nin başkenti; Alaeddin Tepesi çevresinde toplanan çarşılarıyla Uzun Yol\'un en büyük düğümüydü.' },
  { tur:'han', ad:'Horozlu Han', yer:'Selçuklu, Konya', tarih:'1246-1249',
    not:'Konya\'dan Aksaray ve Ankara yönüne çıkan kervanların ilk menziliydi; kitabesi kayıp olsa da banisi atabeg Esedüddin Ruzbe bilinir.' },
  { tur:'han', ad:'Zazadin Hanı', yer:'Tömek, Selçuklu, Konya', tarih:'1235-1236',
    not:'Sarayın ünlü entrikacı emiri Sadeddin Köpek\'in yaptırdığı bu dev yapı, oturum alanı bakımından Anadolu Selçuklu hanları arasında dokuzuncu sıradadır.' },
  { tur:'kayip', ad:'Zincirli Han', yer:'Karatay, Konya', tarih:'Selçuklu menzili',
    not:'Zazadin ile Akbaş arasındaki bu ıssız menzilin bugün ayakta duran yapısı en erken 18. yüzyıldandır; Selçuklu konağının yalnız yerini işaretler.' },
  { tur:'kayip', ad:'Akbaş Hanı', yer:'Akbaş, Karatay, Konya', tarih:'13. yüzyıl',
    not:'Tamamen yıkılan ve yeri bile güç saptanan yapının, İbn Bibi\'nin andığı Kaymaz Kervansarayı menzili olduğu öne sürülür.' },
  { tur:'han', ad:'Obruk Hanı', yer:'Obruk, Karatay, Konya', tarih:'13. yüzyıl ilk çeyreği',
    not:'Adını yanı başındaki dev Kızören Obruğu\'ndan alır; kervanların dokuz saatte aldığı 30-40 kilometrelik günlük menzil düzeninin ders kitabı örneğidir.' },
  { tur:'han', ad:'Okla Hanı', yer:'Obruk ile Sultanhanı arası', tarih:'II. Kılıç Arslan dönemi',
    not:'Kitabesi olmayan yapı II. Kılıç Arslan devrine tarihlenir; Konya yönünden gelen kervanın Obruk\'tan sonraki ara menziliydi.' },
  { tur:'han', ad:'Sultan Hanı', yer:'Sultanhanı, Aksaray', tarih:'1229',
    not:'I. Alaeddin Keykubad\'ın yaptırdığı yapı 4.800 metrekaresiyle Anadolu\'nun en büyük kervansarayıdır ve ilçeye adını vermiştir.' },
  { tur:'han', ad:'Akhan', yer:'Yenikent, Aksaray', tarih:'1253-1254',
    not:'Sultanhanı ile Aksaray arasındaki bu az bilinen han, UNESCO geçici listesindeki Selçuklu kervansarayları güzergahına dahildir.' },
  { tur:'sehir', ad:'Aksaray', yer:'Aksaray', tarih:'',
    not:'Selçuklu sultanlarının ordugah şehri; 13. yüzyılda çevresine örülen sultan hanları zinciriyle kervan yollarının kavşağıydı.' },
  { tur:'han', ad:'Ağzıkarahan', yer:'Ağzıkara, Aksaray', tarih:'1231-1239',
    not:'Zengin tüccar Hoca Mesud\'un yaptırdığı han, hamamı ve gözetleme kulesiyle tam donanımlı bir menzildi; avlusu 1239\'da bitti.' },
  { tur:'han', ad:'Öresin Han', yer:'Aksaray', tarih:'13. yüzyıl',
    not:'Avlusuz, tamamen kapalı kurgusuyla Anadolu\'da çok az örneği bulunan han, örtüsündeki aydınlık açıklığı yüzünden Tepesi Delik Han diye bilinir.' },
  { tur:'han', ad:'Alay Han', yer:'Alayhan, Aksaray', tarih:'12. yüzyıl son çeyreği',
    not:'Taçkapısındaki çift gövdeli tek başlı aslan kabartmasıyla tanınır; Anadolu\'nun bilinen en eski sultan hanı sayılır.' },
  { tur:'kayip', ad:'Latif Hanı', yer:'Aksaray-Ürgüp arası', tarih:'13. yüzyıl',
    not:'Ortaçağ yol kayıtlarında adı geçen ama yeri bugün bilinmeyen menzillerdendir; kervan burada yalnız yazılı satırlarda konaklar.' },
  { tur:'han', ad:'Dolay Han', yer:'Til, Derinkuyu, Nevşehir', tarih:'13. yüzyıl',
    not:'Avlusu tamamen yıkılmış olan ve köyünden ötürü Til Hanı da denen yapı, Kapadokya\'nın unutulmuş duraklarındandır.' },
  { tur:'han', ad:'Sarıhan', yer:'Avanos, Nevşehir', tarih:'1249',
    not:'II. İzzeddin Keykavus\'un Kapadokya tüfünden yaptırdığı han, Selçuklu sultanlarının inşa ettirdiği son sultan hanı kabul edilir.' },
  { tur:'sehir', ad:'Avanos', yer:'Avanos, Nevşehir', tarih:'',
    not:'Kızılırmak kıyısındaki kasaba Hititlerden beri çömlekçilik merkezidir; kervanlar ırmağı burada geçerdi.' },
  { tur:'sehir', ad:'Kayseri', yer:'Kayseri', tarih:'',
    not:'Selçuklu\'nun ikinci başkenti sayılan büyük pazar şehri; Uzun Yol burada Sivas ve Malatya kollarına ayrılırdı.' },
  { tur:'han', ad:'Sultan Hanı (Tuzhisar)', yer:'Bünyan, Kayseri', tarih:'1232-1236',
    not:'I. Alaeddin Keykubad\'ın yaptırdığı han, Kayseri\'den Sivas üzerinden İran\'a uzanan kolun başlıca sultan hanıydı.' },
  { tur:'han', ad:'Karatay Hanı', yer:'Karadayı, Bünyan, Kayseri', tarih:'1240-1241',
    not:'Vezir Celaleddin Karatay\'ın tamamlattığı hanın 1247 tarihli vakfiyesi, personelinden giderlerine kadar tutulmuş kayıtlarıyla günümüze ulaşmıştır.' }
];
