/* karşılık — ingilizce ↔ türkçe sözlük
   Statik veri (sharded JSON) üzerinde istemci-taraflı arama.
   Hatayı (Levenshtein) ve Türkçe çekim eklerini affeder. */
'use strict';

/* ----------------------------------------------------------------- haritalar */
const POS = {
  verb:'f.', noun:'i.', adjective:'s.', adverb:'zf.', numeral:'say.',
  preposition:'e.', conjunction:'bağ.', pronoun:'zm.', interjection:'ünl.',
  determiner:'blr.', phrase:'öbek'
};
const posAbbr = p => POS[p] || p;

const DOMAIN = {
  computing:['bilişim','dm4'], tech:['teknik','dm4'], science:['bilim','dm4'],
  math:['matematik','dm4'], engineering:['mühendislik','dm4'], nautical:['denizcilik','dm4'],
  electronics:['elektronik','dm4'],
  finance:['finans','dm2'], business:['ticaret','dm2'], economics:['ekonomi','dm2'],
  accounting:['muhasebe','dm2'],
  medical:['tıp','dm3'], anatomy:['anatomi','dm3'], biology:['biyoloji','dm3'],
  botany:['botanik','dm3'], zoology:['zooloji','dm3'], nature:['doğa','dm3'],
  agriculture:['tarım','dm3'], chemistry:['kimya','dm3'],
  legal:['hukuk','dm5'], law:['hukuk','dm5'], military:['askerî','dm5'],
  politics:['siyaset','dm5'], government:['devlet','dm5'], grammar:['dilbilgisi','dm5'],
  linguistics:['dilbilim','dm5'], music:['müzik','dm5'], art:['sanat','dm5'],
  religion:['din','dm5'], architecture:['mimari','dm5'],
  sports:['spor','dm1'], games:['oyun','dm1'],
  geography:['coğrafya','dm6'], industry:['sanayi','dm6'], cooking:['mutfak','dm6'],
  food:['mutfak','dm6']
};
const domainInfo = d => (!d || d === 'general') ? null
  : (DOMAIN[d] || [d.charAt(0).toUpperCase() + d.slice(1), 'dm6']);

const TAG = {
  informal:'konuşma dili', formal:'resmî', slang:'argo', vulgar:'kaba',
  figurative:'mecaz', idiom:'deyim', archaic:'eski', dated:'eskimiş',
  literary:'edebî', poetic:'şiirsel', humorous:'şakacı', rare:'seyrek',
  'of colour':'renk', 'of number':'sayı'
};
const tagLabel = t => TAG[t] || t;

/* ----------------------------------------------------------------- türkçe metin */
function fold(s){
  s = String(s).toLocaleLowerCase('tr');
  const m = {'ç':'c','ğ':'g','ı':'i','ş':'s','ö':'o','ü':'u','â':'a','î':'i','û':'u','ä':'a','é':'e','è':'e','á':'a'};
  let o = '';
  for(const ch of s) o += (m[ch] || ch);
  return o.replace(/[^a-z0-9 -]/g, '');
}
const trLower = s => String(s).toLocaleLowerCase('tr');

// türkçe çekim eklerini soyup aday kökler üret (yalnız sözlükte varsa eşleşir)
const TR_SUF = ['larından','lerinden','larımız','lerimiz','larınız','leriniz','larını','lerini',
  'sından','sinden','larda','lerde','ların','lerin','ımız','imiz','umuz','ümüz','ınız','iniz',
  'unuz','ünüz','ları','leri','dan','den','tan','ten','nın','nin','nun','nün','mış','miş','muş',
  'müş','dır','dir','dur','dür','yor','acak','ecek','sın','sin','lar','ler','sız','siz','suz',
  'süz','ydı','ydi','ım','im','um','üm','ın','in','un','ün','da','de','ta','te','ya','ye','na',
  'ne','yı','yi','yu','yü','sı','si','su','sü','ki','ı','i','u','ü','a','e',
  // çekimli fiil ekleri (geçmiş / şimdiki / geniş zaman + kişi)
  'tular','tüler','dılar','diler','dular','düler','tılar','tiler',
  'dım','dim','dum','düm','tım','tim','tum','tüm','dın','din','dun','dün','tın','tin','tun','tün',
  'dık','dik','duk','dük','tık','tik','tuk','tük','dı','di','du','dü','tı','ti','tu','tü',
  'ıyor','iyor','uyor','üyor','makta','mekte','arak','erek','ınca','ince','mak','mek']
  .map(fold).sort((a,b)=>b.length-a.length);

function trStems(qf){
  const out = new Set();
  let cur = qf;
  for(let i = 0; i < 6; i++){
    let hit = false;
    for(const suf of TR_SUF){
      if(cur.length - suf.length >= 2 && cur.endsWith(suf)){
        cur = cur.slice(0, cur.length - suf.length);
        out.add(cur); hit = true; break;
      }
    }
    if(!hit) break;
  }
  return out;
}

function lev(a, b, max){
  if(Math.abs(a.length - b.length) > max) return max + 1;
  const n = b.length;
  let prev = Array.from({length: n + 1}, (_, j) => j);
  for(let i = 1; i <= a.length; i++){
    const cur = [i]; let best = i;
    for(let j = 1; j <= n; j++){
      const c = a[i-1] === b[j-1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + c);
      if(cur[j] < best) best = cur[j];
    }
    if(best > max) return max + 1;
    prev = cur;
  }
  return prev[n];
}

/* ----------------------------------------------------------------- durum */
const records = {en: [], tr: []};
const bucketCache = {};
let meta = null;
let prefDir = 'en';

function toRec(w, dir){
  const keys = [fold(w.l)];
  if(dir === 'tr' && (w.p || []).includes('verb')){
    const low = trLower(w.l);
    if(low.endsWith('mak') || low.endsWith('mek')) keys.push(fold(w.l.slice(0, -3)));
  }
  return {l: w.l, id: w.id, b: w.b, ph: w.ph, p: w.p || [], f: w.f || 0, h: w.h || '', dir, keys};
}

/* ----------------------------------------------------------------- arama */
function scoreRec(rec, qf, stems){
  let best = null;
  const longEnough = qf.length >= 3;
  for(const key of rec.keys){
    let s = null;
    if(key === qf) s = 0;
    else if(key.startsWith(qf)) s = 1 + (key.length - qf.length) / 200;
    else if(rec.dir === 'tr' && stems.has(key)) s = 2;
    else if(longEnough && key.includes(qf)) s = 3 + (key.length - qf.length) / 200;
    else if(longEnough){
      const max = qf.length <= 4 ? 1 : 2;
      const d = lev(qf, key, max);
      if(d <= max) s = 4 + d;
    }
    if(s !== null && (best === null || s < best)) best = s;
  }
  return best;
}

function search(q, limit){
  const qf = fold(q);
  if(!qf) return [];
  const stems = trStems(qf);
  const out = [];
  for(const dir of ['en', 'tr']){
    for(const rec of records[dir]){
      let s = scoreRec(rec, qf, stems);
      if(s === null) continue;
      if(dir === prefDir) s -= 0.15;                 // tercih edilen yöne hafif öncelik
      out.push({rec, s});
    }
  }
  out.sort((a, b) => a.s - b.s || a.rec.f - b.rec.f || a.rec.l.length - b.rec.l.length);
  const seen = new Set(), res = [];
  for(const o of out){
    const k = o.rec.dir + '/' + o.rec.id + '/' + (o.rec.ph ?? '');
    if(seen.has(k)) continue;
    seen.add(k); res.push(o.rec);
    if(res.length >= (limit || 8)) break;
  }
  return res;
}

/* ----------------------------------------------------------------- veri yükleme */
async function loadIndexes(){
  meta = await fetch('data/meta.json').then(r => r.json());
  const [en, tr] = await Promise.all([
    fetch('data/index.en.json').then(r => r.json()),
    fetch('data/index.tr.json').then(r => r.json())
  ]);
  records.en = en.words.map(w => toRec(w, 'en'));
  records.tr = tr.words.map(w => toRec(w, 'tr'));
}
async function fetchEntry(dir, id, b){
  const k = dir + '/' + b;
  if(!bucketCache[k]) bucketCache[k] = fetch(`data/entries/${dir}/${b}.json`).then(r => r.json());
  return (await bucketCache[k])[id];
}

/* ----------------------------------------------------------------- görünüm */
const $ = sel => document.querySelector(sel);
const main = $('#main'), sugg = $('#sugg'), qEl = $('#q');
const esc = s => (s == null ? '' : String(s)).replace(/[&<>"]/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function metaLine(pos, domain, tags){
  let h = '';
  if(pos) h += `<span class="pos">${esc(posAbbr(pos))}</span>`;
  const di = domainInfo(domain);
  if(di) h += `<span class="badge ${di[1]}">${esc(di[0])}</span>`;
  for(const t of (tags || [])) h += `<span class="tag">${esc(tagLabel(t))}</span>`;
  return h;
}
function exBlock(ex){
  if(!ex || !ex.length) return '';
  let pairs = '';
  for(const e of ex) pairs += `<div class="pair"><div class="s">${esc(e.s)}</div><div class="t">${esc(e.t)}</div></div>`;
  return `<button class="ex-toggle" type="button"><span class="chev">›</span> örnek</button><div class="ex">${pairs}</div>`;
}

function renderEntry(entry, dir, hlPhrase){
  const dirtag = dir === 'en' ? 'EN → TR' : 'TR → EN';
  const posLine = (entry.pos || []).map(posAbbr).join(' · ');
  const s0 = entry.senses[0] || {};
  const heroTr = (s0.tr || []).join(', ');

  let h = `<div class="entry-head">
      <span class="word">${esc(entry.lemma)}</span>
      ${entry.ipa ? `<span class="ipa">${esc(entry.ipa)}</span>` : ''}
      <span class="dirtag">${dirtag}</span>
    </div>`;

  // hero — baskın karşılık
  h += `<div class="hero">
      <div class="trs">${esc(heroTr)}<button class="copy" type="button" data-copy="${esc(heroTr)}">kopyala</button></div>
      ${s0.gloss ? `<div class="gloss">${esc(s0.gloss)}</div>` : ''}
      <div class="pos">${metaLine(s0.pos, s0.domain, s0.tags)}</div>
      ${exBlock(s0.ex)}
    </div>`;

  // öteki anlamlar
  const rest = entry.senses.slice(1);
  if(rest.length){
    h += `<section class="section"><div class="lbl">öteki anlamlar</div>`;
    for(const sn of rest){
      h += `<div class="sense">
        <div class="meta">${metaLine(sn.pos, sn.domain, sn.tags)}</div>
        <div class="trs">${esc((sn.tr || []).join(', '))}</div>
        ${sn.gloss ? `<div class="gloss">${esc(sn.gloss)}</div>` : ''}
        ${exBlock(sn.ex)}
      </div>`;
    }
    h += `</section>`;
  }

  // öbekler ve deyimler
  if((entry.phrases || []).length){
    h += `<section class="section"><div class="lbl">öbekler ve deyimler</div>`;
    entry.phrases.forEach((ph, i) => {
      const tags = (ph.tags || []).map(t => `<span class="tag">${esc(tagLabel(t))}</span>`).join('');
      h += `<div class="phrase${i === hlPhrase ? ' hl' : ''}" data-ph="${i}">
        <div><span class="ph-lm">${esc(ph.lemma)}</span><span class="ph-tr">${esc((ph.tr || []).join(', '))}</span> ${tags}</div>
        ${ph.gloss ? `<div class="gloss">${esc(ph.gloss)}</div>` : ''}
        ${exBlock(ph.ex)}
      </div>`;
    });
    h += `</section>`;
  }

  // ilişkili
  const rel = entry.rel || {};
  const chips = (arr) => arr.map(w => `<span class="chip" data-word="${esc(w)}">${esc(w)}</span>`).join('');
  if((rel.syn || []).length || (rel.see || []).length){
    h += `<section class="section"><div class="lbl">ilişkili sözcükler</div>`;
    if((rel.syn || []).length) h += `<div class="chips" style="margin-bottom:10px">${chips(rel.syn)}</div>`;
    if((rel.see || []).length) h += `<div class="chips">${chips(rel.see)}</div>`;
    h += `</section>`;
  }

  main.innerHTML = h;
  if(hlPhrase != null){
    const el = main.querySelector(`.phrase[data-ph="${hlPhrase}"]`);
    if(el) el.scrollIntoView({block: 'center', behavior: 'smooth'});
  }
}

function renderLanding(){
  const seeds = ['run', 'charge', 'bank', 'light', 'yüz', 'göz', 'açmak', 'ocak'];
  main.innerHTML = `<div class="landing">
    <div class="lead">iki dilin eşiğinde bir sözlük — her kelimenin, bağlamına göre karşılığı.</div>
    <div class="note">yanlış da yazsan, Türkçe ekleriyle de yazsan bulur.<br>“koştular”, “gözlerini”, “adress” → hepsi yerini bulur.</div>
    <div class="examples">
      <div class="lbl">deneyebilirsin</div>
      <div class="chips">${seeds.map(w => `<span class="chip" data-word="${esc(w)}">${esc(w)}</span>`).join('')}</div>
    </div>
  </div>`;
}

function renderNoResult(q){
  const best = search(q, 1)[0];
  main.innerHTML = `<div class="noresult">
    <div class="big">“${esc(q)}” bulunamadı</div>
    ${best ? `<div class="didyou">bunu mu demek istedin: <b data-word="${esc(best.l)}">${esc(best.l)}</b>?</div>` : ''}
  </div>`;
}

/* ----------------------------------------------------------------- gezinme */
async function openRec(rec, push){
  const entry = await fetchEntry(rec.dir, rec.id, rec.b);
  if(!entry){ renderNoResult(rec.l); return; }
  setDir(rec.dir);
  renderEntry(entry, rec.dir, rec.ph);
  hideSugg();
  if(push !== false){
    const url = `?q=${encodeURIComponent(rec.l)}&d=${rec.dir}`;
    history.pushState({id: rec.id, b: rec.b, dir: rec.dir, ph: rec.ph ?? null, l: rec.l}, '', url);
  }
}
function openWord(q, push){
  const r = search(q, 1)[0];
  if(r) openRec(r, push);
  else { renderNoResult(q); if(push !== false) history.pushState({nf: q}, '', `?q=${encodeURIComponent(q)}`); }
}

/* ----------------------------------------------------------------- öneriler */
let selIdx = -1, curSugg = [];
function showSugg(list){
  curSugg = list; selIdx = -1;
  if(!list.length){ hideSugg(); return; }
  sugg.innerHTML = list.map((r, i) => {
    const isPh = r.ph != null;
    return `<div class="row" data-i="${i}" role="option">
      <span class="dir ${r.dir}">${r.dir.toUpperCase()}</span>
      <span class="lm${isPh ? ' ph' : ''}">${esc(r.l)}</span>
      <span class="hint">${esc(r.h)}</span>
    </div>`;
  }).join('');
  sugg.style.display = 'block';
}
function hideSugg(){ sugg.style.display = 'none'; curSugg = []; selIdx = -1; }
function moveSel(d){
  const rows = sugg.querySelectorAll('.row');
  if(!rows.length) return;
  selIdx = (selIdx + d + rows.length) % rows.length;
  rows.forEach((r, i) => r.classList.toggle('sel', i === selIdx));
  rows[selIdx].scrollIntoView({block: 'nearest'});
}

/* ----------------------------------------------------------------- yön / tema */
function setDir(d){
  prefDir = d;
  $('#dirFrom').textContent = d === 'en' ? 'EN' : 'TR';
  $('#dirTo').textContent = d === 'en' ? 'TR' : 'EN';
  qEl.placeholder = d === 'en'
    ? 'bir kelime yaz… run, charge, set'
    : 'bir kelime yaz… yüz, göz, açmak';
}
function applyTheme(gece){
  document.body.classList.toggle('gece', gece);
  $('#themebtn').textContent = gece ? 'gündüz' : 'gece';
  try{ localStorage.setItem('karsilik-gece', gece ? '1' : '0'); }catch(e){}
}

/* ----------------------------------------------------------------- olaylar */
let t = null;
qEl.addEventListener('input', () => {
  $('#clearbtn').style.display = qEl.value ? 'block' : 'none';
  clearTimeout(t);
  t = setTimeout(() => {
    const q = qEl.value.trim();
    if(!q){ hideSugg(); return; }
    showSugg(search(q, 8));
  }, 150);
});
qEl.addEventListener('keydown', e => {
  if(e.key === 'ArrowDown'){ e.preventDefault(); moveSel(1); }
  else if(e.key === 'ArrowUp'){ e.preventDefault(); moveSel(-1); }
  else if(e.key === 'Enter'){
    e.preventDefault();
    if(selIdx >= 0 && curSugg[selIdx]) openRec(curSugg[selIdx]);
    else if(curSugg.length) openRec(curSugg[0]);
    else if(qEl.value.trim()) openWord(qEl.value.trim());
  } else if(e.key === 'Escape'){ hideSugg(); }
});
sugg.addEventListener('mousedown', e => {              // mousedown: blur'dan önce
  const row = e.target.closest('.row');
  if(row){ e.preventDefault(); openRec(curSugg[+row.dataset.i]); }
});
qEl.addEventListener('blur', () => setTimeout(hideSugg, 120));
qEl.addEventListener('focus', () => { if(qEl.value.trim()) showSugg(search(qEl.value.trim(), 8)); });

$('#clearbtn').addEventListener('click', () => {
  qEl.value = ''; $('#clearbtn').style.display = 'none'; hideSugg(); qEl.focus();
  renderLanding(); history.pushState({}, '', location.pathname);
});
$('#dirbtn').addEventListener('click', () => {
  setDir(prefDir === 'en' ? 'tr' : 'en');
  const q = qEl.value.trim();
  if(q) showSugg(search(q, 8));
});
$('#themebtn').addEventListener('click', () =>
  applyTheme(!document.body.classList.contains('gece')));

// içerik tıklamaları (delege)
main.addEventListener('click', e => {
  const tog = e.target.closest('.ex-toggle');
  if(tog){ tog.classList.toggle('open'); tog.nextElementSibling.classList.toggle('show'); return; }
  const word = e.target.closest('[data-word]');
  if(word){ qEl.value = word.dataset.word; openWord(word.dataset.word); return; }
  const copy = e.target.closest('.copy');
  if(copy && navigator.clipboard){
    navigator.clipboard.writeText(copy.dataset.copy).then(() => {
      copy.textContent = 'kopyalandı'; copy.classList.add('ok');
      setTimeout(() => { copy.textContent = 'kopyala'; copy.classList.remove('ok'); }, 1300);
    });
  }
});

window.addEventListener('popstate', e => {
  const s = e.state;
  if(s && s.id){ qEl.value = s.l || ''; openRec(s, false); }
  else if(s && s.nf){ qEl.value = s.nf; renderNoResult(s.nf); }
  else { qEl.value = ''; renderLanding(); }
});

/* ----------------------------------------------------------------- başlat */
(function init(){
  let gece = false;
  try{
    const saved = localStorage.getItem('karsilik-gece');
    gece = saved != null ? saved === '1'
      : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }catch(e){}
  applyTheme(gece);

  loadIndexes().then(() => {
    $('#stat').textContent = `${meta.dirs.en.count} ingilizce · ${meta.dirs.tr.count} türkçe başlık`;
    const p = new URLSearchParams(location.search);
    const q = p.get('q'), d = p.get('d');
    if(d) setDir(d);
    if(q){ qEl.value = q; $('#clearbtn').style.display = 'block'; openWord(q, false); }
    else renderLanding();
  }).catch(err => {
    main.innerHTML = `<div class="noresult"><div class="big">veri yüklenemedi</div>
      <div class="didyou">${esc(String(err))}</div></div>`;
  });
})();
