(function () {
  'use strict';
  const API_URL = 'https://script.google.com/macros/s/AKfycby9czVTJT1UBxQq3MoYuVjb7qrW_1Zj_MOQ0mIHN-oyJze_JFbwrnKxAihp1-D4eTEDrQ/exec';

  const liste = document.getElementById('liste');
  const durum = document.getElementById('durum');
  const sayacEl = document.getElementById('sayac');
  const slaytBtn = document.getElementById('slaytBaslat');

  const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  function tarihYazi(iso) {
    const parcalar = iso.split('-').map(Number);
    const y = parcalar[0], a = parcalar[1], g = parcalar[2];
    return g + ' ' + AYLAR[a - 1] + ' ' + y;
  }

  function ayYazi(iso) {
    const parcalar = iso.split('-').map(Number);
    return AYLAR[parcalar[1] - 1] + ' ' + parcalar[0];
  }

  function idHash(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) { h = (h * 31 + id.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  function donusAcisi(id) {
    return ((idHash(id) % 300) / 100 - 1.5).toFixed(2);
  }

  function isimAlanCiz(isimAlan, id, isim) {
    isimAlan.innerHTML = '';
    if (isim) {
      const span = document.createElement('span');
      span.className = 'isim-metin';
      span.textContent = isim;
      span.title = 'değiştirmek için tıkla';
      span.onclick = function () { girisAc(isimAlan, id, isim, 'isim'); };
      isimAlan.appendChild(span);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'isim-btn';
      btn.textContent = 'isim ver';
      btn.onclick = function () { girisAc(isimAlan, id, '', 'isim'); };
      isimAlan.appendChild(btn);
    }
  }

  function notAlanCiz(notAlan, id, not) {
    notAlan.innerHTML = '';
    if (not) {
      const span = document.createElement('span');
      span.className = 'not-metin';
      span.textContent = not;
      span.title = 'değiştirmek için tıkla';
      span.onclick = function () { girisAc(notAlan, id, not, 'not'); };
      notAlan.appendChild(span);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'isim-btn';
      btn.textContent = 'not ekle';
      btn.onclick = function () { girisAc(notAlan, id, '', 'not'); };
      notAlan.appendChild(btn);
    }
  }

  function girisAc(alan, id, mevcut, tur) {
    alan.innerHTML = '';
    const input = document.createElement('input');
    input.className = 'isim-input';
    input.value = mevcut;
    input.maxLength = tur === 'not' ? 140 : 30;
    input.placeholder = tur === 'not' ? 'not yaz…' : 'isim yaz…';
    alan.appendChild(input);
    input.focus();
    input.select();

    const fn = tur === 'not' ? 'notyaz' : 'yaz';
    const param = tur === 'not' ? 'not' : 'isim';
    const ciz = tur === 'not' ? notAlanCiz : isimAlanCiz;

    let kaydedildi = false;
    function kaydet() {
      if (kaydedildi) return;
      kaydedildi = true;
      const yeni = input.value.trim();
      if (!yeni || yeni === mevcut) { ciz(alan, id, mevcut); return; }
      alan.textContent = 'kaydediliyor…';
      fetch(API_URL + '?fn=' + fn + '&id=' + encodeURIComponent(id) + '&' + param + '=' + encodeURIComponent(yeni))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          const basarili = j && j.ok;
          if (basarili) {
            if (tur === 'not') { NOTLAR[id] = yeni; } else { ISIMLER[id] = yeni; }
          }
          ciz(alan, id, basarili ? yeni : mevcut);
        })
        .catch(function () { ciz(alan, id, mevcut); });
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') kaydet();
      if (e.key === 'Escape') { kaydedildi = true; ciz(alan, id, mevcut); }
    });
    input.addEventListener('blur', kaydet);
  }

  let TUM_FOTOLAR = [];
  let ID_INDEKS = {};
  let ISIMLER = {};
  let NOTLAR = {};
  let lbIndex = -1;

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.hidden = true;
  lb.innerHTML =
    '<div class="lb-slayt">' +
      '<button type="button" class="lb-sirali">sıralı</button>' +
      '<button type="button" class="lb-rastgele">rastgele</button>' +
    '</div>' +
    '<button type="button" class="lb-kapat" aria-label="kapat">×</button>' +
    '<button type="button" class="lb-onceki" aria-label="önceki">‹</button>' +
    '<img class="lb-img" alt="">' +
    '<div class="lb-bilgi"></div>' +
    '<button type="button" class="lb-sonraki" aria-label="sonraki">›</button>';
  document.body.appendChild(lb);
  const lbImg = lb.querySelector('.lb-img');
  const lbBilgi = lb.querySelector('.lb-bilgi');
  let slaytZamanlayici = null;

  function slaytDurdur() {
    if (slaytZamanlayici) { clearInterval(slaytZamanlayici); slaytZamanlayici = null; }
    lb.querySelectorAll('.lb-slayt button').forEach(function (b) { b.classList.remove('aktif'); });
  }

  function slaytBaslat(mod, btn) {
    slaytDurdur();
    btn.classList.add('aktif');
    slaytZamanlayici = setInterval(function () {
      if (!TUM_FOTOLAR.length) return;
      if (mod === 'rastgele') {
        lbGoster(Math.floor(Math.random() * TUM_FOTOLAR.length));
      } else {
        lbGoster((lbIndex + 1) % TUM_FOTOLAR.length);
      }
    }, 4500);
  }

  function lbGoster(i) {
    if (i < 0 || i >= TUM_FOTOLAR.length) return;
    lbIndex = i;
    const foto = TUM_FOTOLAR[i];
    lbImg.src = foto.gorsel;
    lbImg.alt = 'kedi, ' + foto.tarih;
    const isim = ISIMLER[foto.id];
    lbBilgi.textContent = tarihYazi(foto.tarih) + (isim ? ' · ' + isim : '');
  }

  function lbAc(i) {
    lbGoster(i);
    lb.hidden = false;
  }

  function lbKapat() {
    lb.hidden = true;
    slaytDurdur();
  }

  lb.querySelector('.lb-kapat').onclick = lbKapat;
  lb.querySelector('.lb-onceki').onclick = function () { slaytDurdur(); lbGoster((lbIndex - 1 + TUM_FOTOLAR.length) % TUM_FOTOLAR.length); };
  lb.querySelector('.lb-sonraki').onclick = function () { slaytDurdur(); lbGoster((lbIndex + 1) % TUM_FOTOLAR.length); };
  lb.onclick = function (e) { if (e.target === lb) lbKapat(); };
  lb.querySelector('.lb-sirali').onclick = function (e) {
    if (e.target.classList.contains('aktif')) { slaytDurdur(); } else { slaytBaslat('sirali', e.target); }
  };
  lb.querySelector('.lb-rastgele').onclick = function (e) {
    if (e.target.classList.contains('aktif')) { slaytDurdur(); } else { slaytBaslat('rastgele', e.target); }
  };

  if (slaytBtn) {
    slaytBtn.onclick = function () {
      if (!TUM_FOTOLAR.length) return;
      lbAc(0);
      slaytBaslat('sirali', lb.querySelector('.lb-sirali'));
    };
  }
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') lbKapat();
    if (e.key === 'ArrowLeft') lb.querySelector('.lb-onceki').click();
    if (e.key === 'ArrowRight') lb.querySelector('.lb-sonraki').click();
  });

  const azaltilmisHareket = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gozlemci = ('IntersectionObserver' in window && !azaltilmisHareket)
    ? new IntersectionObserver(function (girisler) {
        girisler.forEach(function (giris) {
          if (giris.isIntersecting) {
            giris.target.classList.add('gorunur');
            gozlemci.unobserve(giris.target);
          }
        });
      }, { threshold: 0.1 })
    : null;

  function kartCiz(gun) {
    const el = document.createElement('article');
    el.className = 'kart';
    if (!gozlemci) el.classList.add('gorunur');

    const tarihEl = document.createElement('h2');
    tarihEl.className = 'gun-tarih';
    tarihEl.textContent = tarihYazi(gun.tarih);
    el.appendChild(tarihEl);

    const galeri = document.createElement('div');
    galeri.className = 'galeri';
    gun.fotograflar.forEach(function (foto) {
      const blok = document.createElement('div');
      blok.className = 'foto-blok';
      blok.dataset.id = foto.id;

      const pol = document.createElement('div');
      pol.className = 'polaroid';
      pol.style.transform = 'rotate(' + donusAcisi(foto.id) + 'deg)';

      const img = document.createElement('img');
      img.src = foto.gorsel;
      img.loading = 'lazy';
      img.alt = 'kedi, ' + gun.tarih;
      img.onclick = function () { lbAc(ID_INDEKS[foto.id]); };
      pol.appendChild(img);
      blok.appendChild(pol);

      const alt = document.createElement('div');
      alt.className = 'kart-alt';

      const isimAlan = document.createElement('span');
      isimAlan.className = 'isim-alan';
      isimAlanCiz(isimAlan, foto.id, ISIMLER[foto.id] || '');
      alt.appendChild(isimAlan);

      const notAlan = document.createElement('span');
      notAlan.className = 'not-alan';
      notAlanCiz(notAlan, foto.id, NOTLAR[foto.id] || '');
      alt.appendChild(notAlan);

      blok.appendChild(alt);
      galeri.appendChild(blok);
    });
    el.appendChild(galeri);

    return el;
  }

  Promise.all([
    fetch('kediler.json').then(function (r) { return r.json(); }),
    fetch(API_URL + '?fn=al').then(function (r) { return r.json(); }).catch(function () { return { ok: false, isimler: {} }; }),
    fetch(API_URL + '?fn=notal').then(function (r) { return r.json(); }).catch(function () { return { ok: false, notlar: {} }; })
  ]).then(function (sonuclar) {
    const gunler = sonuclar[0];
    ISIMLER = (sonuclar[1] && sonuclar[1].isimler) || {};
    NOTLAR = (sonuclar[2] && sonuclar[2].notlar) || {};
    gunler.sort(function (a, b) { return a.tarih > b.tarih ? -1 : 1; });

    let toplamFoto = 0;
    TUM_FOTOLAR = [];
    ID_INDEKS = {};
    gunler.forEach(function (gun) {
      gun.fotograflar.forEach(function (foto) {
        toplamFoto++;
        ID_INDEKS[foto.id] = TUM_FOTOLAR.length;
        TUM_FOTOLAR.push({ id: foto.id, gorsel: foto.gorsel, tarih: gun.tarih });
      });
    });

    let sonAy = '';
    gunler.forEach(function (gun) {
      const ay = ayYazi(gun.tarih);
      if (ay !== sonAy) {
        sonAy = ay;
        const ayrac = document.createElement('div');
        ayrac.className = 'ay-ayrac';
        ayrac.innerHTML = '<span>' + ay + '</span>';
        liste.appendChild(ayrac);
      }
      const kart = kartCiz(gun);
      liste.appendChild(kart);
      if (gozlemci) gozlemci.observe(kart);
    });

    // Güvenlik ağı: IntersectionObserver bir sebepten tetiklenmezse
    // (bazı tarayıcı/önizleme ortamlarında olabiliyor) içerik kalıcı
    // olarak görünmez kalmasın diye kısa bir süre sonra zorla göster.
    setTimeout(function () {
      document.querySelectorAll('.kart:not(.gorunur)').forEach(function (k) {
        k.classList.add('gorunur');
      });
    }, 1200);

    if (sayacEl) {
      const gecerliIdler = TUM_FOTOLAR.map(function (f) { return f.id; });
      const isimliSayisi = Object.keys(ISIMLER).filter(function (id) {
        return ISIMLER[id] && gecerliIdler.indexOf(id) !== -1;
      }).length;
      sayacEl.textContent = gunler.length + ' sabah · ' + toplamFoto + ' kedi · ' + isimliSayisi + ' kediye isim verdik';
    }
  }).catch(function () {
    durum.hidden = false;
    durum.textContent = 'yüklenemedi, sayfayı yenile.';
  });
})();
