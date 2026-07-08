// GA4 ölçüm kimliği henüz yok — tüm sayfalar bu tek dosyayı yüklüyor,
// hesap açılıp kimlik buraya yapıştırılınca site genelinde tek yerden aktif olur.
(function(){
  var ID = "G-XXXXXXXXXX";
  if (!ID || ID.indexOf("XXXX") !== -1) return;
  var s = document.createElement('script');
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', ID, { anonymize_ip: true });
})();
