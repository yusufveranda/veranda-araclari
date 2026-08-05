// Akrostiş kafiye motoru — site/sozluk'teki uyak sekmesinin (veri/template.html:566-616)
// kucuk bir portu: ek-dusurme + ortak-ses-uzunlugu ile iki kelime arasindaki kafiye gucunu hesaplar.
(function(root){
  const TRMAP = {"İ":"i","I":"ı","Ş":"ş","Ğ":"ğ","Ü":"ü","Ö":"ö","Ç":"ç"};
  function trKucukHarf(s){ return s.replace(/[İIŞĞÜÖÇ]/g, c => TRMAP[c]).toLowerCase(); }

  const EKLER = ["iyorum","ıyorum","uyorum","üyorum","iyoruz","ıyoruz","mekte","makta",
    "iyor","ıyor","uyor","üyor","ecek","acak","erek","arak","ince","ınca","unca","ünce",
    "miş","mış","muş","müş","mek","mak","lık","lik","luk","lük","sız","siz","suz","süz",
    "ler","lar","den","dan","ten","tan","nin","nın","nun","nün","izm","ist",
    "di","dı","du","dü","ti","tı","tu","tü","im","ım","um","üm","in","ın","un","ün",
    "me","ma","iş","ış","uş","üş","ci","cı","cu","cü","çi","çı","çu","çü","de","da","te","ta","e","a","i","ı","u","ü"];

  function ekleriDus(kelime){
    let govde = kelime, zincir = '';
    for(let tur=0; tur<3; tur++){
      let bulunan = '';
      for(const ek of EKLER){
        const asgari = (ek==='mak'||ek==='mek') ? 2 : (ek.length<=2 ? 4 : 3);
        if(govde.endsWith(ek) && govde.length - ek.length >= asgari){ bulunan = ek; break; }
      }
      if(!bulunan) break;
      govde = govde.slice(0, govde.length - bulunan.length);
      zincir = bulunan + zincir;
    }
    return [govde, zincir];
  }

  function ortakSesUzunlugu(a, b){
    let L = 0;
    while(L < a.length && L < b.length && a[a.length-1-L] === b[b.length-1-L]) L++;
    return L;
  }

  // Iki kelime arasindaki kafiye gucu: 0=kafiyesiz, 1=yarim, 2=tam, 3+=zengin.
  // Redif zinciri (son ek) esit ise govdeler kiyaslanir; degilse tam kelimeler kiyaslanir.
  function kafiyeGucu(kelime1, kelime2){
    const k1 = trKucukHarf(kelime1), k2 = trKucukHarf(kelime2);
    if(!k1 || !k2 || k1 === k2) return 0;
    const [govde1, zincir1] = ekleriDus(k1);
    const [govde2, zincir2] = ekleriDus(k2);
    if(zincir1 && zincir2 && zincir1 === zincir2) return ortakSesUzunlugu(govde1, govde2);
    return ortakSesUzunlugu(k1, k2);
  }

  function sonKelime(dize){
    const parcalar = dize.trim().split(/\s+/);
    const son = parcalar[parcalar.length-1] || '';
    return son.replace(/[^A-Za-zçğıöşüÇĞİIÖŞÜ]+$/g, '');
  }

  const API = { trKucukHarf, ekleriDus, ortakSesUzunlugu, kafiyeGucu, sonKelime };
  if(typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.AkrostisKafiye = API;
})(typeof window !== 'undefined' ? window : globalThis);
