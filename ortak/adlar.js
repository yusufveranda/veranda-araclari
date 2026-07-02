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
  "karine": "Avlu",
  "karine_rozet": "beş harf · üç deneme",
  "karine_aciklama": "İpuculu \nKısa",
  "pedantle": "Parsel",
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
