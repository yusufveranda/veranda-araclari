window.ADLAR = {
  "verandle": "verandle",
  "slogan": "Kelime Oyunları",
  "mod_gun": "günün kelimesi",
  "mod_sonsuz": "sonsuz",
  "harfiyat": "Harfiyat",
  "harfiyat_rozet": "beş harf · altı deneme",
  "harfiyat_aciklama": "Klasik Wordle ",
  "taraca": "Taraça",
  "taraca_rozet": "3–8 harf · altı kelime",
  "taraca_aciklama": "Farklı sayılı kelimelerle Wordle",
  "cati": "Çatı",
  "cati_rozet": "beş kelime · gizli tema",
  "cati_aciklama": "Beş kelime çöz, ortak temayı bul.",
  "karine": "Avlu",
  "karine_rozet": "beş harf · üç deneme",
  "karine_aciklama": "İpuculu \nKısa",
  "aralik": "Aralık",
  "aralik_rozet": "4-6 harf · zamana karşı",
  "aralik_aciklama": "Süre bitmeden ne kadar çok kelime çözebilirsin?",
  "pedantle": "Parsel",
  "pedantle_rozet": "gizli madde · sınırsız tahmin",
  "pedantle_aciklama": "Günün Vikipedi maddesini tahminlerle aç.",
  "sicak": "Şömine",
  "sicak_rozet": "anlam oyunu · sınırsız tahmin",
  "sicak_aciklama": "Saklı kelimeyi bulmaya çalış.",
  "sicak_slogan": "gizli kelimeyi anlam yakınlığıyla yakala",
  "karanlikoda": "Karanlık Oda",
  "sozluk": "Dilimin Ucunda",
  "bulmaca": "Bulmaca Yardımcısı",
  "siir": "Bitmeyen Şiir",
  "politika": "Siyaset Bilimi",
  "nota": "Veranda Band",
  "akrostis": "Akrostiş",
  "sicak_tahmin": "tahmin"
};
/* [data-ad] taşıyan ögelere config'ten metni yazar. Bu blok düzenleme sayfasınca aynen korunur. */
(function(){
  function uygula(){
    if(!window.ADLAR) return;
    document.querySelectorAll('[data-ad]').forEach(function(el){
      var k=el.getAttribute('data-ad');
      if(ADLAR[k]!=null) el.textContent=ADLAR[k];
    });
  }
  window.adlariUygula=uygula;
  if(document.readyState!=='loading') uygula();
  else document.addEventListener('DOMContentLoaded',uygula);
})();
