/* karşılık — ingilizce ↔ türkçe sözlük
   Statik veri (sharded JSON) üzerinde istemci-taraflı arama.
   Hatayı (Levenshtein) ve Türkçe çekim eklerini affeder. */
'use strict';

/* ----------------------------------------------------------------- haritalar */
const POS = {
  verb:'F.', noun:'İ.', adjective:'S.', adverb:'ZF.', numeral:'SAY.',
  preposition:'E.', conjunction:'BAĞ.', pronoun:'ZM.', interjection:'ÜNL.',
  determiner:'BLR.', phrase:'ÖBEK'
};
const posAbbr = p => POS[p] || (p || '').toLocaleUpperCase('tr');

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
  philosophy:['felsefe','dm5'], academic:['akademik','dm5'],
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

// İngilizce çekim biçimlerini köke indir: went→go, children→child, running→run
const EN_IRREGULAR = {
  went:'go', gone:'go', goes:'go', going:'go', took:'take', taken:'take', taking:'take',
  takes:'take', came:'come', coming:'come', comes:'come', got:'get', gotten:'get',
  getting:'get', gets:'get', made:'make', making:'make', makes:'make', said:'say',
  saying:'say', says:'say', had:'have', has:'have', having:'have', was:'be', were:'be',
  been:'be', being:'be', are:'be', did:'do', done:'do', doing:'do', does:'do', told:'tell',
  telling:'tell', tells:'tell', knew:'know', known:'know', knowing:'know', knows:'know',
  saw:'see', seen:'see', seeing:'see', sees:'see', gave:'give', given:'give', giving:'give',
  gives:'give', found:'find', finding:'find', finds:'find', thought:'think', thinking:'think',
  thinks:'think', brought:'bring', bought:'buy', caught:'catch', taught:'teach', ran:'run',
  running:'run', runs:'run', began:'begin', begun:'begin', wrote:'write', written:'write',
  writing:'write', spoke:'speak', spoken:'speak', broke:'break', broken:'break',
  chose:'choose', chosen:'choose', drove:'drive', driven:'drive', ate:'eat', eaten:'eat',
  fell:'fall', fallen:'fall', felt:'feel', kept:'keep', left:'leave', lost:'lose', met:'meet',
  paid:'pay', sat:'sit', sold:'sell', sent:'send', stood:'stand', won:'win', held:'hold',
  heard:'hear', led:'lead', meant:'mean', built:'build', spent:'spend', lent:'lend',
  understood:'understand', became:'become', flew:'fly', grew:'grow', drew:'draw', threw:'throw',
  wore:'wear', tore:'tear', swam:'swim', sang:'sing', drank:'drink', rang:'ring',
  children:'child', men:'man', women:'woman', feet:'foot', teeth:'tooth', mice:'mouse',
  geese:'goose', people:'person', lives:'life', wives:'wife', knives:'knife', leaves:'leaf',
  better:'good', best:'good', worse:'bad', worst:'bad', further:'far',
};
function enStems(qf){
  const out = new Set();
  if(EN_IRREGULAR[qf]) out.add(EN_IRREGULAR[qf]);
  const add = w => { if(w.length >= 2) out.add(w); };
  const n = qf.length;
  if(qf.endsWith('ies') && n > 4) add(qf.slice(0, -3) + 'y');
  if(qf.endsWith('ied') && n > 4) add(qf.slice(0, -3) + 'y');
  if(qf.endsWith('ier') && n > 4) add(qf.slice(0, -3) + 'y');   // happier→happy
  if(qf.endsWith('iest') && n > 5) add(qf.slice(0, -4) + 'y');  // happiest→happy
  if(qf.endsWith('es') && n > 3){ add(qf.slice(0, -2)); add(qf.slice(0, -1)); }
  if(qf.endsWith('s') && !qf.endsWith('ss') && n > 2) add(qf.slice(0, -1));
  if(qf.endsWith('ed') && n > 3){ add(qf.slice(0, -2)); add(qf.slice(0, -1)); if(/(.)\1ed$/.test(qf)) add(qf.slice(0, -3)); }
  if(qf.endsWith('ing') && n > 4){ add(qf.slice(0, -3)); add(qf.slice(0, -3) + 'e'); if(/(.)\1ing$/.test(qf)) add(qf.slice(0, -4)); }
  if(qf.endsWith('er') && n > 3){ add(qf.slice(0, -2)); add(qf.slice(0, -1)); }
  if(qf.endsWith('est') && n > 4){ add(qf.slice(0, -3)); add(qf.slice(0, -2)); }
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
const foldToRec = {en: new Map(), tr: new Map()};   // çapraz bağ için başlık arama
const bucketCache = {};
let meta = null;
let prefDir = 'en';
let curCtx = null;

/* yerel hafıza: geçmiş + yıldızlar */
const LS = {
  get(k, d){ try{ const v = localStorage.getItem('karsilik-' + k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('karsilik-' + k, JSON.stringify(v)); }catch(e){} }
};
let recent = LS.get('recent', []);
let favs = LS.get('favs', []);
const sameEntry = (a, b) => a.id === b.id && a.dir === b.dir;
function pushRecent(ctx){
  const it = {l: ctx.l, id: ctx.id, b: ctx.b, dir: ctx.dir};
  recent = [it, ...recent.filter(x => !sameEntry(x, it))].slice(0, 12);
  LS.set('recent', recent);
}
function pruneSaved(rec){               // artık var olmayan kaydı geçmiş + yıldızlardan sil
  recent = recent.filter(x => !(x.l === rec.l && x.dir === rec.dir));
  favs = favs.filter(x => !(x.l === rec.l && x.dir === rec.dir));
  LS.set('recent', recent); LS.set('favs', favs);
}
const isFav = ctx => favs.some(x => sameEntry(x, ctx));
function toggleFav(ctx){
  const it = {l: ctx.l, id: ctx.id, b: ctx.b, dir: ctx.dir};
  favs = isFav(ctx) ? favs.filter(x => !sameEntry(x, it)) : [it, ...favs].slice(0, 50);
  LS.set('favs', favs);
}
function speak(text, dir){
  if(!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = dir === 'en' ? 'en-US' : 'tr-TR'; u.rate = 0.95;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

function toRec(w, dir){
  const keys = [fold(w.l)];
  if(dir === 'tr' && (w.p || []).includes('verb')){
    const low = trLower(w.l);
    if(low.endsWith('mak') || low.endsWith('mek')) keys.push(fold(w.l.slice(0, -3)));
  }
  return {l: w.l, id: w.id, b: w.b, ph: w.ph, p: w.p || [], f: w.f || 0, h: w.h || '', ac: w.ac || 0, dir, keys};
}

/* ----------------------------------------------------------------- arama */
function scoreRec(rec, qf, stems, enstems){
  let best = null;
  const longEnough = qf.length >= 3;
  for(const key of rec.keys){
    let s = null;
    if(key === qf) s = 0;
    else if(key.startsWith(qf)) s = 1 + (key.length - qf.length) / 200;
    else if(rec.dir === 'tr' && stems.has(key)) s = 2;
    else if(rec.dir === 'en' && enstems.has(key)) s = 2;   // çekim biçimi → kök
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
  const enstems = enStems(qf);
  const out = [];
  for(const dir of ['en', 'tr']){
    for(const rec of records[dir]){
      let s = scoreRec(rec, qf, stems, enstems);
      if(s === null) continue;
      if(dir === prefDir) s -= 0.15;                 // tercih edilen yöne hafif öncelik
      out.push({rec, s});
    }
  }
  // skor → akademik öncelik (eşitlikte akademik/hukuk terimi öne) → sıklık → kısalık
  out.sort((a, b) => a.s - b.s || (b.rec.ac - a.rec.ac) || a.rec.f - b.rec.f || a.rec.l.length - b.rec.l.length);
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
  for(const dir of ['en', 'tr'])
    for(const r of records[dir])
      if(r.ph == null && !foldToRec[dir].has(fold(r.l))) foldToRec[dir].set(fold(r.l), r);
}
async function fetchEntry(dir, id, b){
  const k = dir + '/' + b;
  if(!bucketCache[k])                       // 404/ağ hatasında patlamasın → {} (openRec yeniden çözer)
    bucketCache[k] = fetch(`data/entries/${dir}/${b}.json`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  return (await bucketCache[k])[id];
}

/* ----------------------------------------------------------------- görünüm */
const $ = sel => document.querySelector(sel);
const main = $('#main'), sugg = $('#sugg'), qEl = $('#q'), side = $('#side');
let curRel = {};
const esc = s => (s == null ? '' : String(s)).replace(/[&<>"]/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// arama için karşılığı sadeleştir ("to run"→run, "-e rastlamak"→rastlamak)
function cleanLookup(word){
  const w = trLower(word).trim();
  return w.replace(/^to\s+/, '').replace(/^-\S+\s+/, '').replace(/^bir\s+/, '').trim() || w;
}
// HER karşılık ters-sözlüğe köprü: tıklanınca o yönde aranır.
// Ayraç: ince gri orta-nokta (·) — her sözcük ayrı, izole tıklanır bağlantı.
function linkTrs(list, oppDir){
  return (list || []).map(w =>
    `<a class="tlink" data-q="${esc(cleanLookup(w))}" data-d="${oppDir}">${esc(w)}</a>`
  ).join('<span class="sep">·</span>​');   // ​: ayraçtan sonra kırılma fırsatı → uzun listeler sarsın
}
// EŞ/YAN ANLAMLILAR — aynı dilde alternatifler, ait oldukları anlamın altında.
// Aynı yönde (kendi dilinde) aranır, çünkü eş anlamlı çeviri değil komşu sözcüktür.
function linkSyns(list, dir){
  if(!list || !list.length) return '';
  const links = list.map(w =>
    `<a class="tlink syn" data-q="${esc(cleanLookup(w))}" data-d="${dir}">${esc(w)}</a>`
  ).join('<span class="sep">·</span>​');   // ​: ayraçtan sonra kırılma fırsatı → uzun listeler sarsın
  return `<div class="syn-line"><span class="syn-k">eş · yan anlam</span>${links}</div>`;
}
// İLGİLİ — çapraz dildeki ilişkili sözcükler. Çeviri DEĞİL: 'vergi' isim ama 'levy'
// fiil ('vergi toplamak') olduğundan doğrudan karşılık değil, ilişkili olarak geçer.
function linkRel(list, dir){
  if(!list || !list.length) return '';
  const links = list.map(w =>
    `<a class="tlink rel" data-q="${esc(cleanLookup(w))}" data-d="${dir}">${esc(w)}</a>`
  ).join('<span class="sep">·</span>​');   // ​: ayraçtan sonra kırılma fırsatı → uzun listeler sarsın
  return `<div class="syn-line rel-line"><span class="syn-k">ilgili</span>${links}</div>`;
}

const POSWORD = {
  verb:'fiil', noun:'isim', adjective:'sıfat', adverb:'zarf', numeral:'sayı',
  preposition:'edat', conjunction:'bağlaç', pronoun:'zamir', interjection:'ünlem',
  determiner:'belirteç', phrase:'öbek'
};
const posWord = p => POSWORD[p] || (p || '');

// kenar boşluğu (gutter): domain (renkli, BÜYÜK) + POS (italik). general'da yalnız POS.
function gutterMeta(pos, domain){
  let h = '';
  const di = domainInfo(domain);
  if(di) h += `<span class="dom ${di[1]}">${esc(di[0].toLocaleUpperCase('tr'))}</span>`;
  if(pos) h += `<span class="pos">${esc(posWord(pos))}</span>`;
  return h;
}
// kayıt etiketi (argo, mecaz…) karşılığın yanında küçük italik
function tagInline(tags){
  const t = (tags || []).map(tagLabel);
  return t.length ? ` <span class="reg">· ${esc(t.join(', '))}</span>` : '';
}
function exBlock(ex){
  if(!ex || !ex.length) return '';
  let pairs = '';
  for(const e of ex) pairs += `<div class="pair"><span class="s">“${esc(e.s)}”</span><span class="t">${esc(e.t)}</span></div>`;
  return `<button class="ex-toggle" type="button">${CHEV} örnek</button><div class="ex">${pairs}</div>`;
}

const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 h3 l4.5-3.5 v13 L7 15 H4 Z"/><path d="M15.5 9.5 a3.5 3.5 0 0 1 0 5"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.5 l2.6 5.7 6.2 .6 -4.7 4.1 1.4 6.1 -5.5 -3.2 -5.5 3.2 1.4 -6.1 -4.7 -4.1 6.2 -.6 Z"/></svg>';
const COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15 H5 a2 2 0 0 1-2-2 V5 a2 2 0 0 1 2-2 h8 a2 2 0 0 1 2 2 v1"/></svg>';
const CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 l6 6 -6 6"/></svg>';

// kenar boşluğu (domain/POS) + gövde (karşılık → tanım → eş anlam → örnek). Çerçeve yok.
function renderSense(sn, opp, withCopy){
  const dir = opp === 'en' ? 'tr' : 'en';          // girişin kendi yönü (eş anlamlılar için)
  const copy = withCopy
    ? `<button class="copy" type="button" data-copy="${esc((sn.tr || []).join(', '))}" aria-label="kopyala">${COPY}</button>`
    : '';
  return `<div class="sense">
      <div class="gut">${gutterMeta(sn.pos, sn.domain)}</div>
      <div class="bod">
        <div class="tr">${linkTrs(sn.tr, opp)}${tagInline(sn.tags)}${copy}</div>
        ${sn.gloss ? `<div class="gloss">${esc(sn.gloss)}</div>` : ''}
        ${linkSyns(sn.syn, dir)}
        ${linkRel(sn.rel, opp)}
        ${exBlock(sn.ex)}
      </div>
    </div>`;
}
function renderPhrase(ph, i, opp, hl){
  const tg = (ph.tags && ph.tags.length)
    ? `<span class="dom dm1">${esc(tagLabel(ph.tags[0]).toLocaleUpperCase('tr'))}</span>` : '';
  return `<div class="phrase${hl ? ' hl' : ''}" data-ph="${i}">
      <div class="gut">${tg}</div>
      <div class="bod">
        <span class="ph-lm">${esc(ph.lemma)}</span> — <span class="tr">${linkTrs(ph.tr, opp)}</span>
        ${ph.gloss ? `<div class="gloss">${esc(ph.gloss)}</div>` : ''}
        ${exBlock(ph.ex)}
      </div>
    </div>`;
}

// AKADEMİK KART — disiplinlerarası bölümler + bağlam (köken/kullanım/eşdizim) toggle
function renderAcademic(entry, ctx){
  const dir = ctx.dir, opp = dir === 'en' ? 'tr' : 'en';
  curCtx = ctx; curRel = entry.rel || {};
  const fav = isFav(ctx), dirtag = dir === 'en' ? 'EN→TR' : 'TR→EN';

  let h = `<div class="entry-head">
      <span class="word">${esc(entry.lemma)}</span>
      <span class="phon"><button class="ico say" type="button" data-say="${esc(entry.lemma)}" data-sd="${dir}" aria-label="seslendir">${SPK}</button>${entry.ipa ? `<span class="ipa">${esc(entry.ipa)}</span>` : ''}</span>
      <button class="ico fav${fav ? ' on' : ''}" type="button" data-star="1" aria-label="kaydet">${STAR}</button>
      <span class="acdot">akademik</span>
      <span class="dirtag">${dirtag}</span>
    </div>`;

  // bağlam: köken + akademik kullanım + eşdizimler (varsayılan KAPALI → giriş temiz)
  const coll = entry.collocations || [];
  if(entry.etymology || entry.usage || coll.length){
    let c = '';
    if(entry.etymology) c += `<div class="ctx-row"><span class="ctx-k">kökeni</span><span class="ctx-v">${esc(entry.etymology)}</span></div>`;
    if(entry.usage) c += `<div class="ctx-row"><span class="ctx-k">akademik kullanım</span><span class="ctx-v">${esc(entry.usage)}</span></div>`;
    if(coll.length) c += `<div class="ctx-row"><span class="ctx-k">eşdizimler</span><span class="ctx-v coll-list">${coll.map(x => `<span class="coll">${esc(x)}</span>`).join('')}</span></div>`;
    h += `<button class="ex-toggle ctx-toggle" type="button">${CHEV} bağlam<span class="ctx-hint"> · köken · kullanım · eşdizim</span></button><div class="ctx">${c}</div>`;
  }

  // anlamlar domain'e göre bölümlenir (disiplinlerarası anlam kayması)
  const groups = [], gi = {};
  for(const s of entry.senses){
    const di = domainInfo(s.domain);
    const label = s.domlabel || (di ? di[0] : 'Genel'), fam = di ? di[1] : 'dm6';
    if(!(label in gi)){ gi[label] = groups.length; groups.push({label, fam, senses: []}); }
    groups[gi[label]].senses.push(s);
  }
  h += `<div class="acbody">`;
  for(const g of groups){
    h += `<div class="acdom ${g.fam}">${esc(g.label.toLocaleUpperCase('tr'))}</div>`;
    for(const s of g.senses){
      const tags = [...(s.tags || []), ...(s.register ? [s.register] : [])];
      h += `<div class="acsense">
        <div class="tr">${linkTrs(s.tr, opp)}${tagInline(tags)}</div>
        ${s.gloss ? `<div class="gloss">${esc(s.gloss)}</div>` : ''}
        ${linkSyns(s.syn, dir)}
        ${linkRel(s.rel, opp)}
        ${s.note ? `<div class="acnote">${esc(s.note)}</div>` : ''}
        ${exBlock(s.ex)}
      </div>`;
    }
  }
  h += `</div>`;

  if((entry.phrases || []).length){
    h += `<section class="section"><div class="sec-h">öbekler ve deyimler</div>`;
    entry.phrases.forEach((ph, i) => { h += renderPhrase(ph, i, opp, false); });
    h += `</section>`;
  }

  main.innerHTML = h;
  renderSide(curRel);
  window.scrollTo({top: 0});
}

function renderEntry(entry, ctx){
  if(entry.academic){ renderAcademic(entry, ctx); return; }
  const dir = ctx.dir, hlPhrase = ctx.ph, opp = dir === 'en' ? 'tr' : 'en';
  curCtx = ctx; curRel = entry.rel || {};
  const dirtag = dir === 'en' ? 'EN→TR' : 'TR→EN';
  const fav = isFav(ctx);

  let h = `<div class="entry-head">
      <span class="word">${esc(entry.lemma)}</span>
      <button class="ico fav${fav ? ' on' : ''}" type="button" data-star="1" title="kaydet" aria-label="kaydet">${STAR}</button>
      <span class="phon"><button class="ico say" type="button" data-say="${esc(entry.lemma)}" data-sd="${dir}" title="seslendir" aria-label="seslendir">${SPK}</button>${entry.ipa ? `<span class="ipa">${esc(entry.ipa)}</span>` : ''}</span>
      <span class="dirtag">${dirtag}</span>
    </div>`;

  h += `<div class="senses">`;
  entry.senses.forEach((sn, i) => { h += renderSense(sn, opp, i === 0); });
  h += `</div>`;

  if((entry.phrases || []).length){
    h += `<section class="section"><div class="sec-h">öbekler ve deyimler</div>`;
    entry.phrases.forEach((ph, i) => { h += renderPhrase(ph, i, opp, i === hlPhrase); });
    h += `</section>`;
  }

  main.innerHTML = h;
  renderSide(curRel);
  if(hlPhrase != null){
    const el = main.querySelector(`.phrase[data-ph="${hlPhrase}"]`);
    if(el) el.scrollIntoView({block: 'center', behavior: 'smooth'});
  } else {
    window.scrollTo({top: 0});
  }
}

// yan panel: yalnız arşiv — yıldızlar + son bakılanlar. (Eş/yan anlamlılar artık
// ait oldukları anlamın altında, ana kartta; sağ panel okuma yolundan uzak kalır.)
function renderSide(){
  const jitem = (it, list, i) => `<div class="sb-row">` +
    `<a class="sb-item" data-li="${esc(it.id)}" data-ld="${it.dir}" data-lb="${it.b}" data-ll="${esc(it.l)}">${esc(it.l)}<span class="cd">${it.dir}</span></a>` +
    `<button class="sb-del" type="button" data-del="${list}" data-i="${i}" title="kaldır" aria-label="${esc(it.l)} kaldır">×</button></div>`;
  const head = (label, clear) => `<div class="sb-h">${label}` +
    (clear ? `<button class="sb-clear" type="button" data-clear="${clear}">temizle</button>` : '') + `</div>`;
  let h = '';
  if(favs.length) h += `<section class="sb sb-archive">${head('yıldızlar', 'favs')}<div class="sb-list">${favs.map((it, i) => jitem(it, 'favs', i)).join('')}</div></section>`;
  if(recent.length) h += `<section class="sb sb-archive">${head('son bakılanlar', 'recent')}<div class="sb-list">${recent.map((it, i) => jitem(it, 'recent', i)).join('')}</div></section>`;
  if(!h) h = `<div class="sb-empty">aradıkların ve yıldızladıkların burada birikecek.</div>`;
  side.innerHTML = h;
}

function renderLanding(){
  curCtx = null; curRel = {};
  const seeds = ['run', 'charge', 'bank', 'light', 'yüz', 'göz', 'açmak', 'gül'];
  main.innerHTML = `<div class="landing">
    <div class="lead">iki dilin eşiğinde bir sözlük — her kelimenin, bağlamına göre karşılığı.</div>
    <div class="note">yanlış da yazsan, Türkçe ekleriyle de yazsan bulur.<br>“koştular”, “gözlerini”, “adress” → hepsi yerini bulur.</div>
    <div class="examples">
      <div class="sec-h">deneyebilirsin</div>
      <div class="chips">${seeds.map(w => `<span class="chip" data-word="${esc(w)}">${esc(w)}</span>`).join('')}</div>
    </div>
  </div>`;
  renderSide(curRel);
}

function renderNoResult(q){
  curCtx = null; curRel = {};
  const best = search(q, 1)[0];
  main.innerHTML = `<div class="noresult">
    <div class="big">“${esc(q)}” bulunamadı</div>
    ${best ? `<div class="didyou">bunu mu demek istedin: <b data-word="${esc(best.l)}">${esc(best.l)}</b>?</div>` : ''}
  </div>`;
  renderSide(curRel);
}

/* ----------------------------------------------------------------- gezinme */
async function openRec(rec, push){
  let dir = rec.dir, id = rec.id, b = +rec.b, ph = rec.ph;
  let entry = await fetchEntry(dir, id, b);
  if(!entry && rec.l){                      // veri güncellendiyse bucket değişmiş olabilir → indeksten çöz
    const cur = foldToRec[dir] && foldToRec[dir].get(fold(rec.l));
    if(cur){ id = cur.id; b = cur.b; entry = await fetchEntry(dir, id, b); }
  }
  if(!entry){                               // hâlâ yok → ölü kaydı düş, aramaya düş
    if(rec.l){ pruneSaved(rec); openWord(rec.l, push); }
    else renderNoResult(rec.l || rec.id);
    return;
  }
  const ctx = {dir, id, b, ph, l: entry.lemma};
  setDir(dir);
  renderEntry(entry, ctx);
  pushRecent(ctx);
  hideSugg();
  if(push !== false)
    history.pushState({id: ctx.id, b: ctx.b, dir: ctx.dir, ph: ctx.ph ?? null, l: ctx.l}, '',
      `?q=${encodeURIComponent(ctx.l)}&d=${ctx.dir}`);
}
function openWord(q, push){
  const r = search(q, 1)[0];
  if(r) openRec(r, push);
  else { renderNoResult(q); if(push !== false) history.pushState({nf: q}, '', `?q=${encodeURIComponent(q)}`); }
}

/* ----------------------------------------------------------------- öneriler */
let selIdx = -1, curSugg = [];
function hlMatch(lemma, qf){
  if(!qf) return esc(lemma);
  const lf = fold(lemma);
  if(lf.length !== lemma.length) return esc(lemma);
  const i = lf.indexOf(qf);
  if(i < 0) return esc(lemma);
  return esc(lemma.slice(0, i)) + '<b>' + esc(lemma.slice(i, i + qf.length)) + '</b>' + esc(lemma.slice(i + qf.length));
}
function showSugg(list){
  curSugg = list; selIdx = -1;
  if(!list.length){ hideSugg(); return; }
  const qf = fold(qEl.value.trim());
  sugg.innerHTML = list.map((r, i) => {
    const isPh = r.ph != null;
    return `<div class="row" data-i="${i}" role="option">
      <span class="dir ${r.dir}">${r.dir.toUpperCase()}</span>
      <span class="lm${isPh ? ' ph' : ''}">${hlMatch(r.l, qf)}</span>
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
  qEl.placeholder = d === 'en' ? 'ingilizce bir kelime yaz…' : 'türkçe bir kelime yaz…';
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
    clearTimeout(t);                                   // bekleyen (bayat) öneri güncellemesini iptal et
    // Enter TAM girdiyi arar. Açılır öneri YALNIZCA ArrowDown ile açıkça seçildiyse kullanılır;
    // hızlı yazıp Enter'a basınca bayat ilk öneri (ör. 'vermek') asla otomatik seçilmez.
    if(selIdx >= 0 && curSugg[selIdx]) openRec(curSugg[selIdx]);
    else if(qEl.value.trim()) openWord(qEl.value.trim());
  } else if(e.key === 'Escape'){ hideSugg(); }
});
sugg.addEventListener('mousedown', e => {              // mousedown: blur'dan önce
  const row = e.target.closest('.row');
  if(row){ e.preventDefault(); openRec(curSugg[+row.dataset.i]); }
});
qEl.addEventListener('blur', () => setTimeout(hideSugg, 120));
qEl.addEventListener('focus', () => { if(qEl.value.trim()) showSugg(search(qEl.value.trim(), 8)); });

// tıkla-tümünü-seç: dolu arama kutusuna İLK tık tüm metni seçer (yeni kelime yazmaya
// hazır); İKİNCİ tık seçimi bırakıp imleci tıklanan yere koyar (yazım düzeltmek için).
let selectAllNext = false;
qEl.addEventListener('mousedown', () => { selectAllNext = (document.activeElement !== qEl); });
qEl.addEventListener('mouseup', e => {
  if(selectAllNext && qEl.value){ e.preventDefault(); qEl.select(); }
  selectAllNext = false;
});

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

// içerik tıklamaları (hem ana sütun hem yan panel)
function onContentClick(e){
  const del = e.target.closest('[data-del]');            // tek tek geçmiş/yıldız sil
  if(del){
    e.preventDefault(); e.stopPropagation();
    const arr = del.dataset.del === 'favs' ? favs : recent;
    arr.splice(+del.dataset.i, 1);
    LS.set(del.dataset.del === 'favs' ? 'favs' : 'recent', arr);
    renderSide(curRel); return;
  }
  const clr = e.target.closest('[data-clear]');          // hepsini temizle
  if(clr){
    e.preventDefault();
    if(clr.dataset.clear === 'favs'){ favs = []; LS.set('favs', favs); }
    else { recent = []; LS.set('recent', recent); }
    renderSide(curRel); return;
  }
  const tog = e.target.closest('.ex-toggle');
  if(tog){ tog.classList.toggle('open'); tog.nextElementSibling.classList.toggle('show'); return; }
  const say = e.target.closest('[data-say]');
  if(say){ speak(say.dataset.say, say.dataset.sd); return; }
  const star = e.target.closest('[data-star]');
  if(star){
    if(curCtx){ toggleFav(curCtx); star.classList.toggle('on', isFav(curCtx)); renderSide(curRel); }
    return;
  }
  // çapraz bağ: her karşılık ters yönde aranır
  const tl = e.target.closest('.tlink');
  if(tl){
    const q = tl.dataset.q, d = tl.dataset.d;
    qEl.value = q; $('#clearbtn').style.display = 'block';
    const rec = foldToRec[d] && foldToRec[d].get(fold(q));
    if(rec) openRec(rec); else { setDir(d); openWord(q); }
    return;
  }
  const jump = e.target.closest('[data-li]');
  if(jump){ qEl.value = jump.dataset.ll || ''; $('#clearbtn').style.display = qEl.value ? 'block' : 'none';
    openRec({dir: jump.dataset.ld, id: jump.dataset.li, b: +jump.dataset.lb, l: jump.dataset.ll}); return; }
  const word = e.target.closest('[data-word]');
  if(word){ qEl.value = word.dataset.word; $('#clearbtn').style.display = 'block'; openWord(word.dataset.word); return; }
  const copy = e.target.closest('.copy');
  if(copy && navigator.clipboard){
    navigator.clipboard.writeText(copy.dataset.copy).then(() => {
      copy.classList.add('ok'); setTimeout(() => copy.classList.remove('ok'), 1100);
    });
  }
}
main.addEventListener('click', onContentClick);
side.addEventListener('click', onContentClick);

document.addEventListener('keydown', e => {
  if(document.activeElement === qEl) return;
  if(e.key === '/' || ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K'))){
    e.preventDefault(); qEl.focus(); qEl.select();
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
