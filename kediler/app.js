(function () {
  'use strict';
  const API_URL = 'https://script.google.com/macros/s/AKfycby9czVTJT1UBxQq3MoYuVjb7qrW_1Zj_MOQ0mIHN-oyJze_JFbwrnKxAihp1-D4eTEDrQ/exec';

  const liste = document.getElementById('liste');
  const durum = document.getElementById('durum');

  function tarihYazi(iso) {
    const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const parcalar = iso.split('-').map(Number);
    const y = parcalar[0], a = parcalar[1], g = parcalar[2];
    return g + ' ' + aylar[a - 1] + ' ' + y;
  }

  function isimAlanCiz(isimAlan, id, isim) {
    isimAlan.innerHTML = '';
    if (isim) {
      const span = document.createElement('span');
      span.className = 'isim-metin';
      span.textContent = isim;
      span.title = 'değiştirmek için tıkla';
      span.onclick = function () { girisAc(isimAlan, id, isim); };
      isimAlan.appendChild(span);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'isim-btn';
      btn.textContent = 'isim ver';
      btn.onclick = function () { girisAc(isimAlan, id, ''); };
      isimAlan.appendChild(btn);
    }
  }

  function girisAc(isimAlan, id, mevcut) {
    isimAlan.innerHTML = '';
    const input = document.createElement('input');
    input.className = 'isim-input';
    input.value = mevcut;
    input.maxLength = 30;
    input.placeholder = 'isim yaz…';
    isimAlan.appendChild(input);
    input.focus();
    input.select();

    let kaydedildi = false;
    function kaydet() {
      if (kaydedildi) return;
      kaydedildi = true;
      const yeni = input.value.trim();
      if (!yeni || yeni === mevcut) { isimAlanCiz(isimAlan, id, mevcut); return; }
      isimAlan.textContent = 'kaydediliyor…';
      fetch(API_URL + '?fn=yaz&id=' + encodeURIComponent(id) + '&isim=' + encodeURIComponent(yeni))
        .then(function (r) { return r.json(); })
        .then(function (j) { isimAlanCiz(isimAlan, id, (j && j.ok) ? yeni : mevcut); })
        .catch(function () { isimAlanCiz(isimAlan, id, mevcut); });
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') kaydet();
      if (e.key === 'Escape') { kaydedildi = true; isimAlanCiz(isimAlan, id, mevcut); }
    });
    input.addEventListener('blur', kaydet);
  }

  function kartCiz(kedi, isim) {
    const el = document.createElement('article');
    el.className = 'kart';
    el.dataset.id = kedi.id;

    const img = document.createElement('img');
    img.src = kedi.gorsel;
    img.loading = 'lazy';
    img.alt = 'kedi, ' + kedi.tarih;
    el.appendChild(img);

    const alt = document.createElement('div');
    alt.className = 'kart-alt';

    const tarih = document.createElement('span');
    tarih.className = 'tarih';
    tarih.textContent = tarihYazi(kedi.tarih);
    alt.appendChild(tarih);

    const isimAlan = document.createElement('span');
    isimAlan.className = 'isim-alan';
    isimAlanCiz(isimAlan, kedi.id, isim);
    alt.appendChild(isimAlan);

    el.appendChild(alt);
    return el;
  }

  Promise.all([
    fetch('kediler.json').then(function (r) { return r.json(); }),
    fetch(API_URL + '?fn=al').then(function (r) { return r.json(); }).catch(function () { return { ok: false, isimler: {} }; })
  ]).then(function (sonuclar) {
    const kediler = sonuclar[0];
    const isimler = (sonuclar[1] && sonuclar[1].isimler) || {};
    kediler.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    kediler.forEach(function (kedi) {
      liste.appendChild(kartCiz(kedi, isimler[kedi.id] || ''));
    });
  }).catch(function () {
    durum.hidden = false;
    durum.textContent = 'yüklenemedi, sayfayı yenile.';
  });
})();
