// Akrostis uretim algoritmasi: harfleri 4'lu bloklara ayirir, blok-ici 1&3 / 2&4
// pozisyonlarini akrostis-kafiye.js ile kafiyeli eslestirmeye calisir (ABAB).
// Havuzu bos olan harfler (orn. Turkcede hicbir kelimenin baslamadigi Ğ)
// eslestirmeden muaf tutulur, kalan dolu-havuzlu harfler kendi aralarinda eslesir.
(function(root){
  const K = (typeof module !== 'undefined' && module.exports) ? require('./akrostis-kafiye.js') : root.AkrostisKafiye;

  const TR_BUYUK_HARITA = {"i":"İ","ı":"I","ş":"Ş","ğ":"Ğ","ü":"Ü","ö":"Ö","ç":"Ç"};
  function trBuyukHarf(s){
    return s.split('').map(c => TR_BUYUK_HARITA[c] || c.toUpperCase()).join('');
  }

  function harfleriAyir(kelime){
    const buyuk = trBuyukHarf(kelime);
    return buyuk.split('').filter(c => /[A-ZÇĞİIÖŞÜ]/.test(c));
  }

  function harfleriGrupla(harfler){
    const gruplar = [];
    for(let i=0;i<harfler.length;i+=4) gruplar.push(harfler.slice(i,i+4));
    return gruplar;
  }

  // Grup uzunluguna gore kafiyeli cift ve tek indeksleri dondurur (grup-ici 0-tabanli).
  function grupEslesmeleri(uzunluk){
    if(uzunluk===4) return {ciftler:[[0,2],[1,3]], tekler:[]};
    if(uzunluk===3) return {ciftler:[[0,1]], tekler:[2]};
    if(uzunluk===2) return {ciftler:[[0,1]], tekler:[]};
    if(uzunluk===1) return {ciftler:[], tekler:[0]};
    return {ciftler:[], tekler:[]};
  }

  // Bos havuzlu (orn. Ğ) pozisyonlar hep tek kalir; digerlerinin eslesmesini bozmaz.
  // grup icindeki dolu-havuzlu pozisyonlari once kendi aralarinda (ayni grupEslesmeleri
  // mantigiyla) eslestirir, bos pozisyonlari her zaman teklere ekler.
  function grupEslesmeleriUyumlu(grup, veriHavuzu){
    const canli = [];
    const bos = [];
    grup.forEach((harf, i) => {
      if(havuzGetir(veriHavuzu, harf).length) canli.push(i);
      else bos.push(i);
    });
    const {ciftler: canliCiftler, tekler: canliTekler} = grupEslesmeleri(canli.length);
    const ciftler = canliCiftler.map(([a, b]) => [canli[a], canli[b]]);
    const tekler = [...canliTekler.map(t => canli[t]), ...bos];
    return {ciftler, tekler};
  }

  function havuzGetir(veriHavuzu, harf){
    return veriHavuzu[harf] || [];
  }

  function tekSec(havuz, disiTutulacak, rastgele){
    const aday = havuz.filter(d => !disiTutulacak.has(d));
    const liste = aday.length ? aday : havuz;
    if(!liste.length) return null;
    return liste[Math.floor(rastgele()*liste.length)];
  }

  // havuzA x havuzB arasinda kafiyeli bir cift arar. Once zengin/tam (>=2) esigini,
  // bulunamazsa yarim (>=1), o da yoksa herhangi bir eslesmeyi (>=0) dener. Her
  // esikte, o esigi karsilayan TUM adaylar arasindan rastgele secim yapar (cesitlilik
  // icin), sadece en yuksek puanli cifti tekrar tekrar secmek yerine.
  function ciftSec(havuzA, havuzB, disiTutulacak, rastgele){
    const adaylarA = havuzA.filter(d => !disiTutulacak.has(d));
    const listeA = (adaylarA.length ? adaylarA : havuzA).slice();
    if(!listeA.length || !havuzB.length) return null;
    for(let i=listeA.length-1;i>0;i--){
      const j = Math.floor(rastgele()*(i+1));
      [listeA[i], listeA[j]] = [listeA[j], listeA[i]];
    }
    const denenecek = listeA.slice(0, Math.min(15, listeA.length));
    for(const esik of [2, 1, 0]){
      for(const a of denenecek){
        const kelimeA = K.sonKelime(a);
        const adaylarB = havuzB.filter(d => !disiTutulacak.has(d) && d !== a);
        const listeB = adaylarB.length ? adaylarB : havuzB.filter(d => d !== a);
        if(!listeB.length) continue;
        const uygunB = listeB.filter(b => K.kafiyeGucu(kelimeA, K.sonKelime(b)) >= esik);
        if(uygunB.length){
          const b = uygunB[Math.floor(rastgele()*uygunB.length)];
          const puan = K.kafiyeGucu(kelimeA, K.sonKelime(b));
          return {a, b, puan};
        }
      }
    }
    return null;
  }

  function tekDizeUret(pos, harf, veriHavuzu, disiTutulacak, rastgele){
    const havuz = havuzGetir(veriHavuzu, harf);
    const metin = tekSec(havuz, disiTutulacak, rastgele);
    return {pos, harf, metin, esPos: null, kafiye: 0};
  }

  function uretSiir(girdi, veriHavuzu, opts){
    const rastgele = (opts && opts.rastgele) || Math.random;
    const harfler = harfleriAyir(girdi);
    const gruplar = harfleriGrupla(harfler);
    const dizeler = new Array(harfler.length).fill(null);
    const disiTutulacak = new Set();
    let ofset = 0;
    for(const grup of gruplar){
      const {ciftler, tekler} = grupEslesmeleriUyumlu(grup, veriHavuzu);
      for(const [i, j] of ciftler){
        const posA = ofset+i, posB = ofset+j;
        const harfA = grup[i], harfB = grup[j];
        const havuzA = havuzGetir(veriHavuzu, harfA);
        const havuzB = havuzGetir(veriHavuzu, harfB);
        const sonuc = ciftSec(havuzA, havuzB, disiTutulacak, rastgele);
        if(sonuc){
          disiTutulacak.add(sonuc.a); disiTutulacak.add(sonuc.b);
          dizeler[posA] = {pos:posA, harf:harfA, metin:sonuc.a, esPos:posB, kafiye:sonuc.puan};
          dizeler[posB] = {pos:posB, harf:harfB, metin:sonuc.b, esPos:posA, kafiye:sonuc.puan};
        } else {
          const dA = tekDizeUret(posA, harfA, veriHavuzu, disiTutulacak, rastgele);
          if(dA.metin) disiTutulacak.add(dA.metin);
          const dB = tekDizeUret(posB, harfB, veriHavuzu, disiTutulacak, rastgele);
          if(dB.metin) disiTutulacak.add(dB.metin);
          dizeler[posA] = dA; dizeler[posB] = dB;
        }
      }
      for(const i of tekler){
        const pos = ofset+i, harf = grup[i];
        const d = tekDizeUret(pos, harf, veriHavuzu, disiTutulacak, rastgele);
        if(d.metin) disiTutulacak.add(d.metin);
        dizeler[pos] = d;
      }
      ofset += grup.length;
    }
    return {girdi, harfler, dizeler};
  }

  // Tek bir dizeyi (varsa kafiye partneriyle birlikte) yeniden uretir; siir nesnesini
  // YERINDE gunceller ve dondurur.
  function dizeyiDegistir(siir, pos, veriHavuzu, opts){
    const rastgele = (opts && opts.rastgele) || Math.random;
    const hedef = siir.dizeler[pos];
    if(!hedef) return siir;
    const disiTutulacak = new Set(
      siir.dizeler.filter(d => d && d.pos !== pos && d.pos !== hedef.esPos).map(d => d.metin)
    );
    disiTutulacak.add(hedef.metin);
    if(hedef.esPos !== null){
      const es = siir.dizeler[hedef.esPos];
      disiTutulacak.add(es.metin);
      const havuzA = havuzGetir(veriHavuzu, hedef.harf);
      const havuzB = havuzGetir(veriHavuzu, es.harf);
      const sonuc = ciftSec(havuzA, havuzB, disiTutulacak, rastgele);
      if(sonuc){
        siir.dizeler[pos] = {pos, harf:hedef.harf, metin:sonuc.a, esPos:es.pos, kafiye:sonuc.puan};
        siir.dizeler[es.pos] = {pos:es.pos, harf:es.harf, metin:sonuc.b, esPos:pos, kafiye:sonuc.puan};
      }
    } else {
      const havuz = havuzGetir(veriHavuzu, hedef.harf);
      const yeni = tekSec(havuz, disiTutulacak, rastgele);
      if(yeni) siir.dizeler[pos] = {pos, harf:hedef.harf, metin:yeni, esPos:null, kafiye:0};
    }
    return siir;
  }

  const API = { trBuyukHarf, harfleriAyir, harfleriGrupla, grupEslesmeleri, grupEslesmeleriUyumlu, uretSiir, dizeyiDegistir };
  if(typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.AkrostisUret = API;
})(typeof window !== 'undefined' ? window : globalThis);
