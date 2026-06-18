window.ADLAR = {
  "verandle": "verandle",
  "slogan": "bir veranda, dört kelime oyunu",
  "harfiyat": "harfiyat",
  "harfiyat_rozet": "beş harf · altı deneme",
  "harfiyat_aciklama": "klasik olan. beş harfli kelimeyi altı denemede çıkarıyorsun.",
  "taraca": "taraça",
  "taraca_rozet": "3–8 harf · altı kelime",
  "taraca_aciklama": "üçten sekize altı kelime, tek tahtada. sekmeler arası gez, hepsini topla.",
  "karine": "karine",
  "karine_rozet": "beş harf · üç deneme",
  "karine_aciklama": "az deneme, çok düşünme. yakın anlam ipucu verir; ikincisi ikinci tahminden sonra düşer.",
  "mod_gun": "günün kelimesi",
  "mod_sonsuz": "sonsuz",
  "sicak": "sıcak soğuk",
  "sicak_slogan": "gizli kelimeyi anlam yakınlığıyla yakala",
  "sicak_rozet": "anlam oyunu · sınırsız tahmin",
  "sicak_aciklama": "harfini değil anlamını bul. her tahmin gizli kelimeye ne kadar yakın? yaklaştıkça ısınırsın.",
  "sicak_tahmin": "tahmin",
  "sozluk": "dilimin ucunda",
  "bulmaca": "bulmaca yardımcısı",
  "siir": "şiir defteri",
  "politika": "politics revision"
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
