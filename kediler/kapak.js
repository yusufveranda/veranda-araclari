(function () {
  'use strict';
  var ANAHTAR = 'kediler:acildi';
  var kapak = document.getElementById('kapak');
  if (!kapak) return;
  if (localStorage.getItem(ANAHTAR)) {
    kapak.hidden = true;
    return;
  }
  var btn = document.getElementById('kapakAc');
  btn.onclick = function () {
    kapak.classList.add('kapaniyor');
    localStorage.setItem(ANAHTAR, '1');
    setTimeout(function () { kapak.hidden = true; }, 650);
  };
})();
