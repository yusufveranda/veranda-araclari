(function () {
  'use strict';
  var ANAHTAR = 'kediler:acildi';
  var kapak = document.getElementById('kapak');
  if (!kapak) return;
  if (localStorage.getItem(ANAHTAR)) {
    kapak.hidden = true;
    return;
  }

  var SEMBOLLER = ['🐱', '🐈', '🐈‍⬛', '😺', '😸', '😻', '🙀', '❤️', '💕', '🐾'];
  var ADET = 22;
  for (var i = 0; i < ADET; i++) {
    var span = document.createElement('span');
    span.className = 'kapak-emoji';
    span.textContent = SEMBOLLER[Math.floor(Math.random() * SEMBOLLER.length)];
    span.style.left = Math.random() * 100 + '%';
    span.style.fontSize = (18 + Math.random() * 22) + 'px';
    span.style.setProperty('--surukle', (Math.random() * 90 - 45) + 'px');
    span.style.setProperty('--don', (Math.random() * 50 - 25) + 'deg');
    span.style.animationDuration = (7 + Math.random() * 6) + 's';
    span.style.animationDelay = (Math.random() * 8) + 's';
    kapak.appendChild(span);
  }

  var btn = document.getElementById('kapakAc');
  btn.onclick = function () {
    kapak.classList.add('kapaniyor');
    localStorage.setItem(ANAHTAR, '1');
    setTimeout(function () { kapak.hidden = true; }, 650);

    // Müziği tam bu tıklama anında başlat: tarayıcıların otomatik oynatma
    // engeli, kullanıcı etkileşimiyle aynı anda tetiklenen oynatmaya izin
    // veriyor. Autoplay parametresi src'ye SONRADAN eklenir (baştan
    // koyulsaydı sayfa yüklenir yüklenmez engellenip konsola uyarı basardı).
    var calar = document.getElementById('muzikCalar');
    if (calar && calar.src.indexOf('autoplay=1') === -1) {
      calar.src = calar.src + '&autoplay=1';
    }
  };
})();
