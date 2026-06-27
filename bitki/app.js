/* ===================== bitki bilimi ===================== */
(function () {
  'use strict';

  const BUILD = '4';
  const KAT = {
    agac: 'Ağaç', cali: 'Çalı', cicek: 'Çiçek',
    igneyapaktili: 'İğne yapraklı', igneyaprakli: 'İğne yapraklı',
    tirmanici: 'Tırmanıcı', otsu: 'Otsu', sukulent: 'Sukulent', sarmasik: 'Sarmaşık'
  };
  const TIP = { butun: 'Genel görünüm', yaprak: 'Yaprak', cicek: 'Çiçek', kabuk: 'Kabuk', meyve: 'Meyve / Tohum' };
  const YAPRAK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 80'%3E%3Crect width='100' height='80' fill='%23ece4d2'/%3E%3Cpath d='M50 64 V34' stroke='%23a4673a' stroke-width='2' fill='none'/%3E%3Cpath d='M50 40 C30 40 22 24 26 12 C46 12 54 26 50 40 Z' fill='%2333614a' opacity='.5'/%3E%3C/svg%3E";

  let DATA = [];
  let byId = {};
  const ekran = document.getElementById('ekran');

  const esc = s => (s == null ? '' : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const karistir = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rast = a => a[Math.floor(Math.random() * a.length)];
  const adAnahtar = t => (t.ad.tr || t.ad.la || '').toLowerCase().trim();
  const katAd = k => KAT[k] || (k || '');
  const gorselli = t => Array.isArray(t.gorsel) && t.gorsel.length > 0;

  /* quiz için kullanılabilir fotoğraflar (genel/çiçek/yaprak önce) */
  function quizFotolari(t) {
    if (!gorselli(t)) return [];
    const oncelik = { butun: 0, cicek: 1, yaprak: 2, meyve: 3, kabuk: 4 };
    return t.gorsel.slice().sort((a, b) => (oncelik[a.tip] ?? 9) - (oncelik[b.tip] ?? 9));
  }

  /* ---------- tema ---------- */
  function temaKur(t) {
    document.documentElement.setAttribute('data-tema', t);
    document.getElementById('temaBtn').textContent = t === 'gece' ? 'gündüz' : 'gece';
    try { localStorage.setItem('bitki-tema', t); } catch (e) { }
  }
  document.getElementById('temaBtn').addEventListener('click', () =>
    temaKur(document.documentElement.getAttribute('data-tema') === 'gece' ? 'gunduz' : 'gece'));
  (function () {
    let t; try { t = localStorage.getItem('bitki-tema'); } catch (e) { }
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'gece' : 'gunduz';
    temaKur(t);
  })();

  document.getElementById('rastBtn').addEventListener('click', () => {
    if (!DATA.length) return;
    location.hash = 'tur=' + rast(DATA).id;
  });

  /* ---------- skor (oturum + kalıcı en iyi seri) ---------- */
  const skor = { dogru: 0, toplam: 0, seri: 0, enSeri: 0 };
  function skorYukle() { try { skor.enSeri = JSON.parse(localStorage.getItem('bitki-skor') || '{}').enSeri || 0; } catch (e) { } }
  function skorKaydet() { try { localStorage.setItem('bitki-skor', JSON.stringify({ enSeri: skor.enSeri })); } catch (e) { } }
  function zorlar() { try { return new Set(JSON.parse(localStorage.getItem('bitki-zor') || '[]')); } catch (e) { return new Set(); } }
  function zorEkle(id) { const s = zorlar(); s.add(id); try { localStorage.setItem('bitki-zor', JSON.stringify([...s].slice(-60))); } catch (e) { } }
  function zorCikar(id) { const s = zorlar(); if (s.delete(id)) try { localStorage.setItem('bitki-zor', JSON.stringify([...s])); } catch (e) { } }

  /* ---------- bölge (kapsam): Türkiye / Dünya geneli ---------- */
  let bolge;
  try { bolge = localStorage.getItem('bitki-bolge'); } catch (e) { }
  if (bolge !== 'dunya' && bolge !== 'tr') bolge = 'tr';
  function veri() { return bolge === 'dunya' ? DATA : DATA.filter(t => t.bolge === 'tr'); }
  function bolgeSayiGuncelle() {
    const n = veri().length;
    const el = document.getElementById('sayiTur'); if (el) el.textContent = '(' + n + ')';
    const bs = document.getElementById('bolgeSayi');
    if (bs) bs.textContent = bolge === 'dunya' ? n + ' tür · Türkiye dahil' : n + ' tür';
    document.querySelectorAll('.bsec').forEach(x => x.classList.toggle('aktif', x.dataset.bolge === bolge));
  }
  function bolgeKur(b) {
    bolge = b;
    try { localStorage.setItem('bitki-bolge', b); } catch (e) { }
    bolgeSayiGuncelle();
    ekran.dataset.cevaplandi = '0';
    router();
  }
  document.querySelectorAll('.bsec').forEach(b => b.addEventListener('click', () => bolgeKur(b.dataset.bolge)));

  /* ---------- görsel raporlama (🚩 bayrak) ---------- */
  // İleride Google Apps Script web-app URL'i konursa raporlar oraya da POST edilir.
  const RAPOR_URL = 'https://script.google.com/macros/s/AKfycbwuAfnAIHaUS5rH0TNOFN_dSNVT7nmhMfeO_UjOrIqCavANKxtla7DCasOUyKSwtK39/exec';
  const SEBEPLER = [
    ['yanlis', '🌿 Yanlış bitki'], ['bocek', '🐝 Böcek / hayvan var'],
    ['kalitesiz', '🌫️ Kalitesiz / bulanık'], ['alakasiz', '❓ Konu dışı / saçma'],
    ['kalabalik', '🖼️ Yanında başka şeyler var'], ['diger', '✏️ Başka sorun']
  ];
  const sebepAd = Object.fromEntries(SEBEPLER.map(s => s));
  function raporlariAl() { try { return JSON.parse(localStorage.getItem('bitki-raporlar') || '[]'); } catch (e) { return []; } }
  function raporKaydet(k) {
    const r = raporlariAl(); r.push(k);
    try { localStorage.setItem('bitki-raporlar', JSON.stringify(r)); } catch (e) { }
    if (RAPOR_URL) {
      try {
        fetch(RAPOR_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify(Object.assign({}, k, { ua: (navigator.userAgent || '').slice(0, 140) })) });
      } catch (e) { }
    }
  }
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.className = 'goster';
    clearTimeout(toast._t); toast._t = setTimeout(() => { el.className = ''; }, 2400);
  }
  function bayrakHTML(tur, g, mod) {
    return `<button class="bayrak" data-id="${esc(tur.id)}" data-url="${esc(g.url)}" data-tip="${esc(g.tip || '')}" data-mod="${mod}" title="bu fotoğrafı bildir" aria-label="fotoğrafı bildir">⚐</button>`;
  }
  function menuKapat() { const m = document.getElementById('rapor-menu'); if (m) m.remove(); }
  function raporMenuAc(btn) {
    menuKapat();
    const m = document.createElement('div'); m.id = 'rapor-menu';
    m.innerHTML = `<div class="rm-bas">Bu fotoğrafta sorun ne?</div>` +
      SEBEPLER.map(s => `<button data-s="${s[0]}">${esc(s[1])}</button>`).join('');
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    m.style.top = (window.scrollY + r.bottom + 6) + 'px';
    m.style.left = Math.max(8, Math.min(window.scrollX + r.left - 40, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 10)) + 'px';
    m.querySelectorAll('button').forEach(x => x.addEventListener('click', () => {
      const t = byId[btn.dataset.id] || {};
      raporKaydet({
        id: btn.dataset.id, ad: (t.ad || {}).tr || '', la: (t.ad || {}).la || '',
        url: btn.dataset.url, tip: btn.dataset.tip, sebep: x.dataset.s, mod: btn.dataset.mod,
        t: new Date().toISOString()
      });
      menuKapat(); btn.classList.add('bildirildi'); toast('Teşekkürler — rapor alındı 🌿');
    }));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.bayrak');
    if (b) { e.preventDefault(); e.stopPropagation(); raporMenuAc(b); return; }
    if (!e.target.closest('#rapor-menu')) menuKapat();
  });

  /* ===================== ROUTER ===================== */
  function router() {
    const h = location.hash.replace(/^#/, '');
    menuKapat();
    if (h === 'raporlar') { aktifSekme(''); return raporlarGoster(); }
    if (h.startsWith('tur=')) { aktifSekme('ansiklopedi'); return turDetay(decodeURIComponent(h.slice(4))); }
    const mod = ['tani', 'ansiklopedi', 'mitoloji'].includes(h) ? h : 'tani';
    aktifSekme(mod);
    if (mod === 'tani') quizGoster();
    else if (mod === 'ansiklopedi') ansiklopediGoster();
    else mitolojiGoster();
  }
  function aktifSekme(mod) {
    document.querySelectorAll('.sekme').forEach(b => b.classList.toggle('aktif', b.dataset.mod === mod));
  }
  document.querySelectorAll('.sekme').forEach(b =>
    b.addEventListener('click', () => { location.hash = b.dataset.mod; }));
  window.addEventListener('hashchange', router);

  /* ===================== TANI (QUIZ) ===================== */
  let quizHedef = null, sonId = null;

  function quizSec() {
    const havuz = veri().filter(t => quizFotolari(t).length);
    if (!havuz.length) return null;
    let aday;
    const zor = [...zorlar()].map(id => byId[id]).filter(t => t && quizFotolari(t).length);
    if (zor.length && Math.random() < 0.4) aday = rast(zor);
    else aday = rast(havuz);
    if (havuz.length > 1 && aday.id === sonId) return quizSec();
    return aday;
  }

  function celdiriciler(hedef, n) {
    const diger = veri().filter(t => t.id !== hedef.id);
    const gorulen = new Set([adAnahtar(hedef)]);
    const sec = [];
    const havuzlar = [
      diger.filter(t => (hedef.karistirilan || []).includes(t.ad.la)),
      diger.filter(t => t.taksonomi && hedef.taksonomi && t.taksonomi.familya && t.taksonomi.familya === hedef.taksonomi.familya),
      diger.filter(t => t.kategori === hedef.kategori),
      diger
    ];
    for (const hv of havuzlar) {
      for (const t of karistir(hv)) {
        if (sec.length >= n) break;
        const k = adAnahtar(t);
        if (gorulen.has(k)) continue;
        gorulen.add(k); sec.push(t);
      }
      if (sec.length >= n) break;
    }
    return sec.slice(0, n);
  }

  function sikMetni(t) {
    return `<span class="ad-tr">${esc(t.ad.tr)}</span>` +
      (t.ad.en ? ` · <span class="ad-en">${esc(t.ad.en)}</span>` : '') +
      ` · <i class="la">${esc(t.ad.la)}</i>`;
  }

  function quizGoster() {
    const havuz = veri().filter(t => quizFotolari(t).length);
    if (!havuz.length) { ekran.innerHTML = `<p class="bos-uyari">Henüz görselli tür yok.</p>`; return; }
    quizHedef = quizSec();
    sonId = quizHedef.id;
    const foto = rast(quizFotolari(quizHedef).slice(0, 3));
    const siklar = karistir([quizHedef, ...celdiriciler(quizHedef, 3)]);
    const harfler = ['A', 'B', 'C', 'D'];

    ekran.innerHTML = `
      ${gununBitkiSerit()}
      <div class="quiz-skor">
        <div class="skor-kutu"><b id="sDogru">${skor.dogru}</b><span>doğru</span></div>
        <div class="skor-kutu"><b id="sToplam">${skor.toplam}</b><span>soru</span></div>
        <div class="skor-kutu"><b class="seri-alev" id="sSeri">${skor.seri}🔥</b><span>seri</span></div>
        <div class="skor-kutu"><b id="sEn">${skor.enSeri}</b><span>en iyi seri</span></div>
      </div>
      <div class="cipler" id="quizKat"></div>
      <div class="quiz-duzen">
        <div class="levha">
          <div class="foto">
            <span class="tip-rozet">${TIP[foto.tip] || 'Fotoğraf'}</span>
            ${bayrakHTML(quizHedef, foto, 'tani')}
            <img id="quizFoto" src="${esc(foto.url)}" alt="tanınacak bitki">
          </div>
          <div class="atif-ust"><span>Bu hangi bitki?</span></div>
        </div>
        <div>
          <p class="soru-bas">Doğru adı seç — Türkçe · İngilizce · <i>Latince</i></p>
          <div class="siklar" id="siklar">
            ${siklar.map((t, i) => `<button class="sik" data-id="${esc(t.id)}">
                <span class="harf">${harfler[i]}</span><span>${sikMetni(t)}</span></button>`).join('')}
          </div>
          <div id="gb"></div>
        </div>
      </div>`;

    document.getElementById('quizFoto').onerror = function () { this.src = YAPRAK_SVG; };
    quizKategoriCipleri();
    const btnlar = [...document.querySelectorAll('#siklar .sik')];
    btnlar.forEach(b => b.addEventListener('click', () => quizCevapla(b.dataset.id, btnlar)));
  }

  function quizCevapla(secId, btnlar) {
    if (ekran.dataset.cevaplandi === '1') return;
    ekran.dataset.cevaplandi = '1';
    const dogruMu = secId === quizHedef.id;
    skor.toplam++;
    btnlar.forEach(b => {
      b.disabled = true;
      if (b.dataset.id === quizHedef.id) b.classList.add('dogru');
      else if (b.dataset.id === secId) b.classList.add('yanlis');
    });
    if (dogruMu) { skor.dogru++; skor.seri++; if (skor.seri > skor.enSeri) { skor.enSeri = skor.seri; skorKaydet(); } zorCikar(quizHedef.id); }
    else { skor.seri = 0; zorEkle(quizHedef.id); }
    document.getElementById('sDogru').textContent = skor.dogru;
    document.getElementById('sToplam').textContent = skor.toplam;
    document.getElementById('sSeri').textContent = skor.seri + '🔥';
    document.getElementById('sEn').textContent = skor.enSeri;

    const t = quizHedef;
    const ipucu = (t.tanima && t.tanima.ayirt_edici) ? t.tanima.ayirt_edici : (t.form || '');
    document.getElementById('gb').innerHTML = `
      <div class="geri-bildirim ${dogruMu ? 'iyi' : 'kotu'}">
        <div class="gb-bas">${dogruMu ? 'Doğru! 🌿' : 'Bu bir ' + esc(t.ad.tr)}</div>
        <div class="ipucu"><b>${esc(t.ad.tr)}</b> · <i>${esc(t.ad.la)}</i>${t.ad.en ? ' · ' + esc(t.ad.en) : ''}
          ${ipucu ? '<br>İpucu: ' + esc(ipucu) : ''}</div>
        <div class="gb-alt">
          <button class="btn-ana" id="sonraki">Sonraki →</button>
          <a class="btn-link" href="#tur=${esc(t.id)}">${esc(t.ad.tr)} hakkında her şey</a>
        </div>
      </div>`;
    document.getElementById('sonraki').addEventListener('click', () => { ekran.dataset.cevaplandi = '0'; quizGoster(); });
  }

  function quizKategoriCipleri() {
    const kutu = document.getElementById('quizKat');
    if (!kutu) return;
    const katlar = [...new Set(veri().filter(t => quizFotolari(t).length).map(t => t.kategori))];
    if (katlar.length < 2) return;
    kutu.innerHTML = `<button class="cip${!quizFiltre ? ' aktif' : ''}" data-k="">Hepsi</button>` +
      katlar.map(k => `<button class="cip${quizFiltre === k ? ' aktif' : ''}" data-k="${esc(k)}">${esc(katAd(k))}</button>`).join('');
    kutu.querySelectorAll('.cip').forEach(c => c.addEventListener('click', () => {
      quizFiltre = c.dataset.k || null; ekran.dataset.cevaplandi = '0'; quizGoster();
    }));
  }
  let quizFiltre = null;
  // filtreyi quizSec içine bağla
  const _quizSec = quizSec;
  quizSec = function () {
    const bolgede = t => bolge === 'dunya' || (t && t.bolge === 'tr');
    const havuz = veri().filter(t => quizFotolari(t).length && (!quizFiltre || t.kategori === quizFiltre));
    if (!havuz.length) return _quizSec();
    let aday;
    const zor = [...zorlar()].map(id => byId[id]).filter(t => t && bolgede(t) && quizFotolari(t).length && (!quizFiltre || t.kategori === quizFiltre));
    if (zor.length && Math.random() < 0.4) aday = rast(zor); else aday = rast(havuz);
    if (havuz.length > 1 && aday.id === sonId) return quizSec();
    return aday;
  };

  /* bugünün bitkisi — tarihe göre sabit */
  function gununBitki() {
    const g = veri().filter(gorselli);
    if (!g.length) return null;
    const d = new Date(); const s = '' + d.getFullYear() + d.getMonth() + d.getDate();
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return g[h % g.length];
  }
  function gununBitkiSerit() {
    const t = gununBitki(); if (!t) return '';
    const f = (t.gorsel[0] || {}).url;
    return `<div class="gunun-bitki">
      <img src="${esc(f)}" alt="${esc(t.ad.tr)}" onerror="this.style.display='none'">
      <div class="gb-yz"><div class="et">bugünün bitkisi</div>
        <b>${esc(t.ad.tr)}</b> <i class="la">${esc(t.ad.la)}</i></div>
      <a class="btn-link" href="#tur=${esc(t.id)}">tanı →</a>
    </div>`;
  }

  /* ===================== ANSİKLOPEDİ ===================== */
  let ansAra = '', ansKat = null;
  function ansiklopediGoster() {
    ekran.innerHTML = `
      <div class="ara-satir">
        <label class="ara-kutu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input id="ansArama" type="text" placeholder="tür, familya ya da Latince ad ara…" autocomplete="off" value="${esc(ansAra)}">
        </label>
      </div>
      <div class="cipler" id="ansKat"></div>
      <div id="ansListe"></div>`;
    const katlar = [...new Set(veri().map(t => t.kategori))];
    const kk = document.getElementById('ansKat');
    kk.innerHTML = `<button class="cip${!ansKat ? ' aktif' : ''}" data-k="">Hepsi</button>` +
      katlar.map(k => `<button class="cip${ansKat === k ? ' aktif' : ''}" data-k="${esc(k)}">${esc(katAd(k))}</button>`).join('');
    kk.querySelectorAll('.cip').forEach(c => c.addEventListener('click', () => { ansKat = c.dataset.k || null; ansiklopediListe(); kk.querySelectorAll('.cip').forEach(x => x.classList.toggle('aktif', x.dataset.k === (ansKat || ''))); }));
    const inp = document.getElementById('ansArama');
    inp.addEventListener('input', () => { ansAra = inp.value; ansiklopediListe(); });
    inp.focus();
    ansiklopediListe();
  }
  function ansiklopediListe() {
    const q = ansAra.toLowerCase().trim();
    const list = veri().filter(t => {
      if (ansKat && t.kategori !== ansKat) return false;
      if (!q) return true;
      const hay = [t.ad.tr, t.ad.en, t.ad.la, t.taksonomi && t.taksonomi.familya, ...(t.tr_alt || [])].join(' ').toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => a.ad.tr.localeCompare(b.ad.tr, 'tr'));
    const kutu = document.getElementById('ansListe');
    if (!list.length) { kutu.innerHTML = `<p class="bos-uyari">Eşleşen tür yok.</p>`; return; }
    kutu.innerHTML = `<div class="izgara">${list.map(turKartHTML).join('')}</div>`;
  }
  function turKartHTML(t) {
    const f = gorselli(t) ? t.gorsel[0].url : YAPRAK_SVG;
    return `<a class="tur-kart" href="#tur=${esc(t.id)}">
      <div class="tk-foto"><img src="${esc(f)}" alt="${esc(t.ad.tr)}" loading="lazy" onerror="this.src='${YAPRAK_SVG}'"></div>
      <div class="tk-yz">
        <div class="tk-tr">${esc(t.ad.tr)}</div>
        <div class="tk-la">${esc(t.ad.la)}</div>
        <div class="tk-fam">${esc((t.taksonomi && t.taksonomi.familya) || '')}</div>
        <span class="rozet-kat">${esc(katAd(t.kategori))}</span>
      </div></a>`;
  }

  /* ---------- detay ---------- */
  function turDetay(id) {
    const t = byId[id];
    if (!t) { ekran.innerHTML = `<p class="bos-uyari">Tür bulunamadı. <a href="#ansiklopedi">listeye dön</a></p>`; return; }
    const g = t.gorsel || [];
    const tk = t.taksonomi || {};
    const soy = [
      ['Âlem', tk.alem], ['Bölüm', tk.bolum], ['Sınıf', tk.sinif],
      ['Takım', tk.takim], ['Familya', tk.familya], ['Cins', tk.cins]
    ].filter(x => x[1]);
    const tn = t.tanima || {};
    const tanimaKalem = [['Yaprak', tn.yaprak], ['Çiçek', tn.cicek], ['Kabuk', tn.kabuk], ['Meyve', tn.meyve]].filter(x => x[1]);
    const hb = t.habitat || {}, ku = t.kullanim || {}, kl = t.kultur || {};
    const benzer = (t.karistirilan || []).map(la => DATA.find(x => x.ad.la === la)).filter(Boolean);

    ekran.innerHTML = `
      <div class="detay-ust"><button class="geri-btn" id="geri">← geri</button></div>
      <div class="detay">
        <div class="galeri">
          <div class="ana-foto">${g[0] ? bayrakHTML(t, g[0], 'ansiklopedi') : ''}<img id="anaFoto" src="${esc(g[0] ? g[0].url : YAPRAK_SVG)}" alt="${esc(t.ad.tr)}" onerror="this.src='${YAPRAK_SVG}'"></div>
          <div class="atif" id="anaAtif">${g[0] ? atifHTML(g[0]) : ''}</div>
          ${g.length > 1 ? `<div class="kucukler" id="kucukler">${g.map((x, i) =>
        `<button class="${i === 0 ? 'sec' : ''}" data-i="${i}"><img src="${esc(x.url)}" alt="" loading="lazy" onerror="this.src='${YAPRAK_SVG}'"></button>`).join('')}</div>` : ''}
        </div>
        <div class="detay-bilgi">
          <div class="detay-ad">
            <h2>${esc(t.ad.tr)} ${t.ad.en ? `<span class="en">· ${esc(t.ad.en)}</span>` : ''}</h2>
            <span class="la">${esc(t.ad.la)}</span>
            ${(t.tr_alt && t.tr_alt.length) ? `<div class="alt-adlar">diğer adları: ${t.tr_alt.map(esc).join(', ')}</div>` : ''}
            <span class="rozet-kat">${esc(katAd(t.kategori))}${t.form ? ' · ' + esc(t.form) : ''}</span>
          </div>

          <div class="blok"><h3>Tanıma — sokakta nasıl ayırt edilir</h3>
            ${tn.ayirt_edici ? `<div class="ayirt"><b>En kolay teşhis:</b> ${esc(tn.ayirt_edici)}</div>` : ''}
            ${tanimaKalem.length ? `<div class="tanima-grid">${tanimaKalem.map(x =>
        `<div class="tanima-kart"><div class="tk-bas">${x[0]}</div><p>${esc(x[1])}</p></div>`).join('')}</div>` : ''}
          </div>

          <div class="blok"><h3>Soyağacı (taksonomi)</h3>
            <ul class="soyagaci">${soy.map(x =>
          `<li><span class="rk">${x[0]}</span><b>${esc(x[1])}</b></li>`).join('')}
              <li class="tur-satir"><span class="rk">Tür</span><b>${esc(t.ad.la)}</b></li>
            </ul>
          </div>

          <div class="ikili">
            ${(hb.iklim || hb.yayilim || hb.ortam) ? `<div class="blok"><h3>Habitat</h3><ul class="tanim-liste">
              ${hb.iklim ? `<li><span class="et">İklim</span>${esc(hb.iklim)}</li>` : ''}
              ${hb.yayilim ? `<li><span class="et">Yayılım</span>${esc(hb.yayilim)}</li>` : ''}
              ${hb.ortam ? `<li><span class="et">Ortam</span>${esc(hb.ortam)}</li>` : ''}</ul></div>` : ''}
            ${(ku.besin || ku.tibbi || ku.endustri || ku.diger) ? `<div class="blok"><h3>Ne işe yarar</h3><ul class="tanim-liste">
              ${ku.besin ? `<li><span class="et">Besin</span>${esc(ku.besin)}</li>` : ''}
              ${ku.tibbi ? `<li><span class="et">Tıbbi</span>${esc(ku.tibbi)}</li>` : ''}
              ${ku.endustri ? `<li><span class="et">Endüstri</span>${esc(ku.endustri)}</li>` : ''}
              ${ku.diger ? `<li><span class="et">Diğer</span>${esc(ku.diger)}</li>` : ''}</ul></div>` : ''}
          </div>

          ${(kl.ozet || kl.mit || kl.tarih) ? `<div class="blok"><h3>Kültür &amp; mitoloji</h3>
            ${kl.ozet ? `<p>${esc(kl.ozet)}</p>` : ''}
            ${kl.mit ? `<p style="margin-top:8px"><b>Efsane:</b> ${esc(kl.mit)}</p>` : ''}
            ${kl.tarih ? `<p style="margin-top:8px;color:var(--soluk)">${esc(kl.tarih)}</p>` : ''}
          </div>` : ''}

          ${benzer.length ? `<div class="blok"><h3>Karıştırılabilir türler</h3>
            <div class="benzer-cipler">${benzer.map(b =>
              `<a class="benzer-cip" href="#tur=${esc(b.id)}">${esc(b.ad.tr)} · ${esc(b.ad.la)}</a>`).join('')}</div></div>` : ''}

          ${(t.ipuclari_quiz && t.ipuclari_quiz.length) ? `<div class="blok"><h3>Bunu biliyor muydun?</h3>
            <div id="detaySoru"></div></div>` : ''}

          <div class="kaynak-satir">
            ${t.kaynaklar && t.kaynaklar.wikipedia_tr ? `<a href="${esc(t.kaynaklar.wikipedia_tr)}" target="_blank" rel="noopener">Vikipedi ↗</a>` : ''}
            ${t.kaynaklar && t.kaynaklar.inat ? `<a href="https://www.inaturalist.org/taxa/${esc(t.kaynaklar.inat)}" target="_blank" rel="noopener">iNaturalist ↗</a>` : ''}
            <a href="#tani">bu türü quizde gör →</a>
          </div>
        </div>
      </div>`;

    document.getElementById('geri').addEventListener('click', () => history.length > 1 ? history.back() : (location.hash = 'ansiklopedi'));
    if (g.length > 1) {
      const ana = document.getElementById('anaFoto'), atif = document.getElementById('anaAtif');
      const anaBayrak = document.querySelector('.ana-foto .bayrak');
      document.querySelectorAll('#kucukler button').forEach(b => b.addEventListener('click', () => {
        const x = g[+b.dataset.i]; ana.src = x.url; atif.innerHTML = atifHTML(x);
        if (anaBayrak) { anaBayrak.dataset.url = x.url; anaBayrak.dataset.tip = x.tip || ''; anaBayrak.classList.remove('bildirildi'); }
        document.querySelectorAll('#kucukler button').forEach(z => z.classList.toggle('sec', z === b));
      }));
    }
    if (t.ipuclari_quiz && t.ipuclari_quiz.length) miniSoruCiz(document.getElementById('detaySoru'), rast(t.ipuclari_quiz));
    window.scrollTo(0, 0);
  }
  function atifHTML(g) {
    return `${esc(g.atif || '')} ${g.sayfa ? `· <a href="${esc(g.sayfa)}" target="_blank" rel="noopener">kaynak ↗</a>` : ''}`;
  }

  /* ===================== MİTOLOJİ & KÜLTÜR ===================== */
  function mitolojiGoster() {
    const hikayeli = veri().filter(t => t.kultur && (t.kultur.mit || t.kultur.tarih || t.kultur.ozet))
      .sort((a, b) => (b.kultur.mit ? 1 : 0) - (a.kultur.mit ? 1 : 0));
    const sorulu = veri().filter(t => t.ipuclari_quiz && t.ipuclari_quiz.length);
    ekran.innerHTML = `
      <div class="mit-ust">
        <p>Her bitkinin bir hikâyesi var — mitolojide, tarihte, deyimlerde. Önce oku, sonra kendini sına.</p>
        ${sorulu.length ? `<div class="gb-alt" style="margin-top:14px"><button class="btn-ana" id="testBtn">🌿 Kültür testi başlat (${sorulu.length} soru)</button></div>` : ''}
      </div>
      <div id="mitGovde"></div>`;
    if (sorulu.length) document.getElementById('testBtn').addEventListener('click', () => kulturTesti(sorulu));
    document.getElementById('mitGovde').innerHTML =
      `<div class="mit-izgara">${hikayeli.map(mitKartHTML).join('')}</div>`;
    hikayeli.forEach(t => {
      const yer = document.getElementById('ms-' + t.id);
      if (yer && t.ipuclari_quiz && t.ipuclari_quiz.length) miniSoruCiz(yer, t.ipuclari_quiz[0]);
    });
  }
  function mitKartHTML(t) {
    const f = gorselli(t) ? t.gorsel[0].url : '';
    const k = t.kultur;
    return `<div class="mit-kart">
      ${f ? `<div class="mk-foto"><img src="${esc(f)}" alt="${esc(t.ad.tr)}" loading="lazy" onerror="this.parentNode.style.display='none'"></div>` : ''}
      <div class="mk-govde">
        <h3><a href="#tur=${esc(t.id)}" style="text-decoration:none;color:inherit">${esc(t.ad.tr)}</a></h3>
        <div class="mk-la">${esc(t.ad.la)}</div>
        ${k.mit ? `<p class="mk-mit">${esc(k.mit)}</p>` : (k.ozet ? `<p class="mk-mit">${esc(k.ozet)}</p>` : '')}
        ${k.tarih ? `<div class="mk-tarih">${esc(k.tarih)}</div>` : ''}
        ${(t.ipuclari_quiz && t.ipuclari_quiz.length) ? `<div id="ms-${esc(t.id)}"></div>` : ''}
        <a class="btn-link mk-link" href="#tur=${esc(t.id)}">tüm bilgiler →</a>
      </div></div>`;
  }

  /* tek mini soru çiz (detay + mitoloji kartlarında) */
  function miniSoruCiz(yer, soru, sonra) {
    if (!yer || !soru) return;
    yer.innerHTML = `<div class="mini-soru">
      <div class="ms-q">${esc(soru.soru)}</div>
      ${soru.secenekler.map((s, i) => `<button class="ms-sik" data-i="${i}">${esc(s)}</button>`).join('')}
      <div class="ms-acik" style="display:none"></div></div>`;
    const btnlar = [...yer.querySelectorAll('.ms-sik')];
    btnlar.forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i, dogruMu = i === soru.dogru;
      btnlar.forEach(x => { x.disabled = true; if (+x.dataset.i === soru.dogru) x.classList.add('dogru'); else if (x === b) x.classList.add('yanlis'); });
      const a = yer.querySelector('.ms-acik'); a.style.display = 'block';
      a.textContent = (dogruMu ? '✓ ' : '✗ ') + (soru.aciklama || '');
      if (sonra) sonra(dogruMu);
    }));
  }

  /* kültür testi — sıralı sorular, puanlı */
  function kulturTesti(turler) {
    const sorular = karistir(turler.flatMap(t => t.ipuclari_quiz.map(q => ({ q, t })))).slice(0, 12);
    let i = 0, dogru = 0;
    function ciz() {
      if (i >= sorular.length) {
        ekran.innerHTML = `<div class="mit-ust"><p style="font-size:18px;color:var(--murekkep)">
          Test bitti — <b>${dogru}/${sorular.length}</b> doğru. ${dogru === sorular.length ? '🌳 Kusursuz!' : (dogru >= sorular.length * .6 ? '🌿 İyi!' : '🌱 Tekrar dene!')}</p>
          <div class="gb-alt" style="margin-top:14px">
            <button class="btn-ana" id="tekrar">Tekrar</button>
            <a class="btn-link" href="#mitoloji">hikâyelere dön</a></div></div>`;
        document.getElementById('tekrar').addEventListener('click', () => kulturTesti(turler));
        return;
      }
      const { q, t } = sorular[i];
      ekran.innerHTML = `<div class="mit-ust">
        <div class="et" style="color:var(--vurgu);font-size:12px;letter-spacing:.06em;text-transform:uppercase">Kültür testi · ${i + 1}/${sorular.length} · ${dogru} doğru</div>
        <h2 style="font-family:'Playfair Display',serif;color:var(--yesil-koyu);margin:6px 0 4px">${esc(t.ad.tr)}</h2>
        <div class="mk-la" style="font-style:italic;color:var(--toprak)">${esc(t.ad.la)}</div></div>
        <div id="ktSoru" style="max-width:680px"></div>`;
      miniSoruCiz(document.getElementById('ktSoru'), q, ok => {
        if (ok) dogru++;
        const d = document.querySelector('#ktSoru .mini-soru');
        const b = document.createElement('button'); b.className = 'btn-ana'; b.style.marginTop = '12px';
        b.textContent = (i + 1 < sorular.length) ? 'Sonraki →' : 'Sonucu gör';
        b.addEventListener('click', () => { i++; ciz(); }); d.appendChild(b);
      });
    }
    ciz();
  }

  /* ===================== RAPORLAR (yönetim) ===================== */
  function raporlarGoster() {
    const r = raporlariAl();
    ekran.innerHTML = `
      <div class="mit-ust">
        <h2 style="font-family:'Playfair Display',serif;color:var(--yesil-koyu);margin-bottom:4px">Bildirilen fotoğraflar (${r.length})</h2>
        <p>İşaretlediğin sorunlu görseller burada toplanır. <b>JSON indir</b>'e bas, dosyayı geliştiriciye ver; o düzeltsin/silsin. (Dosya bu tarayıcıda saklanır.)</p>
        <div class="gb-alt" style="margin-top:14px">
          <button class="btn-ana" id="rIndir">JSON indir</button>
          <button class="ikonbtn" id="rKopya">Panoya kopyala</button>
          <button class="ikonbtn" id="rTemiz">Tümünü temizle</button>
          <a class="btn-link" href="#ansiklopedi">← ansiklopediye dön</a>
        </div>
      </div>
      ${r.length ? `<div class="izgara">${r.map((x, i) => `
        <div class="tur-kart">
          <div class="tk-foto"><img src="${esc(x.url)}" alt="" loading="lazy" onerror="this.src='${YAPRAK_SVG}'"></div>
          <div class="tk-yz">
            <div class="tk-tr">${esc(x.ad || '?')}</div>
            <div class="tk-la">${esc(x.la || '')}</div>
            <div class="tk-fam">${esc(sebepAd[x.sebep] || x.sebep)} · ${esc(x.mod || '')}</div>
            <button class="cip" data-sil="${i}" style="margin-top:8px">kaldır</button>
          </div>
        </div>`).join('')}</div>` : `<p class="bos-uyari">Henüz rapor yok. Tanı ya da ansiklopedide bir fotoğrafın köşesindeki ⚐ işaretine bas.</p>`}`;

    document.getElementById('rIndir').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'bitki-raporlar.json'; document.body.appendChild(a); a.click(); a.remove();
    });
    document.getElementById('rKopya').addEventListener('click', () => {
      const s = JSON.stringify(r, null, 1);
      (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject())
        .then(() => toast('Panoya kopyalandı')).catch(() => toast('Kopyalanamadı — JSON indir kullan'));
    });
    document.getElementById('rTemiz').addEventListener('click', () => {
      if (confirm('Tüm raporlar silinsin mi?')) { localStorage.removeItem('bitki-raporlar'); raporlarGoster(); }
    });
    ekran.querySelectorAll('[data-sil]').forEach(b => b.addEventListener('click', () => {
      const arr = raporlariAl(); arr.splice(+b.dataset.sil, 1);
      try { localStorage.setItem('bitki-raporlar', JSON.stringify(arr)); } catch (e) { }
      raporlarGoster();
    }));
  }

  /* ===================== BAŞLAT ===================== */
  fetch('data/bitkiler.json?v=' + BUILD)
    .then(r => r.json())
    .then(j => {
      DATA = (Array.isArray(j) ? j : (j.turler || [])).filter(t => t && t.ad && t.ad.la && t.ad.tr);
      DATA.forEach(t => byId[t.id] = t);
      skorYukle();
      const trN = DATA.filter(t => t.bolge === 'tr').length;
      document.getElementById('stat').textContent = `${DATA.length} tür · ${trN} Türkiye · ${DATA.length - trN} dünya`;
      bolgeSayiGuncelle();
      router();
    })
    .catch(e => { ekran.innerHTML = `<p class="bos-uyari">Veri yüklenemedi. (${esc(e.message)})</p>`; });
})();
