/* Zincir — günlük film zinciri.
   Akış: günün oyuncusu → film → yan oyuncu (başrol hariç, ÇEKİLİŞLE) → film →
   o filmin yönetmeni → film → kadrodan 3 aday, birini seç → yanına rastgele
   partner (çekilişle) → ortak film → tekrar seçim...
   Format: tur başına 3 deneme (biterse zincir kopar), 1 pas (kişiyi yeniden
   çeker), 10 halkada altın bitiş. Günde 1 resmi el (localStorage) + pratik. */
(function(){
"use strict";
const IMG = "https://image.tmdb.org/t/p/w342";
const ORDER_MAX = 7, DENEME_HAK = 3, PAS_HAK = 1, TAVAN = 10, ADAY = 3;
const EPOCH = 20654; // 2026-07-20 => Zincir #1
const KAYIT = "zincir_v1";
const AZ_HAREKET = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- veri hazırlığı --------------------------------------------------------
const FILMS = ZD.films;                 // id -> [t, y, votes, dirId]
const P = {};                           // id -> {n,p,fame,cast:Map,dir:[]}
for (const id in ZD.people){
  const [n, foto, fame, castS, dirS] = ZD.people[id];
  const cast = new Map();
  if (castS) for (const c of castS.split(",")){
    const [f, o] = c.split(":"); cast.set(+f, +o);
  }
  P[id] = {id:+id, n, p:foto, fame, cast, dir: dirS ? dirS.split(",").map(Number) : []};
}
const OYUNCU = new Set();
for (const id in P) if (P[id].cast.size) OYUNCU.add(+id);

const F2A = new Map();                  // film -> ilk-8 usable oyuncular
for (const id of OYUNCU){
  for (const [f, o] of P[id].cast) if (o <= ORDER_MAX){
    if (!F2A.has(f)) F2A.set(f, []);
    F2A.get(f).push(id);
  }
}

const norm = s => s.toLowerCase()
  .replace(/ı/g,"i").normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[^a-z0-9]+/g," ").trim();
const AC = [];
for (const id in FILMS){
  const [t, y, v] = FILMS[id];
  AC.push({key: norm(t), id:+id, t, y, v});
}
AC.sort((a,b)=>b.v-a.v);

// ---- durum -----------------------------------------------------------------
const gun = Math.floor(Date.now()/864e5);
const gunNo = gun - EPOCH + 1;
let pratik = false;
let S = null;

function yeniDurum(baslangicPid){
  return {basla: baslangicPid, tur:0, halka:0, deneme:0, pas:PAS_HAK,
          pasBuTur:false, emoji:[], film:[], kisi:[], log:[],
          stage:null, bitti:null};
}
const rnd = a => a[Math.floor(Math.random()*a.length)];
const kullanilanFilm = () => new Set(S.film);
const kullanilanKisi = () => new Set(S.kisi);

const oynanabilirF = pid => { const kf = kullanilanFilm();
  return [...P[pid].cast.keys()].filter(f => !kf.has(f)); };
const yonetilebilirF = pid => { const kf = kullanilanFilm();
  return (P[pid].dir||[]).filter(f => !kf.has(f)); };
function yanOyuncular(fid, haricPid){
  const kk = kullanilanKisi();
  const hepsi = (F2A.get(fid) || []).filter(q =>
    q !== haricPid && !kk.has(q) && oynanabilirF(q).length);
  const yan = hepsi.filter(q => P[q].cast.get(fid) > 0);
  return yan.length ? yan : hepsi;
}
function partnerler(pid, haricPid){
  const kf = kullanilanFilm(), kk = kullanilanKisi(), out = [];
  for (const [f, o] of P[pid].cast){
    if (o > ORDER_MAX || kf.has(f)) continue;
    for (const q of F2A.get(f) || []){
      if (q !== pid && q !== haricPid && !kk.has(q)) out.push(q);
    }
  }
  return [...new Set(out)].filter(b => ortakFilmler(pid, b).length);
}
function ortakFilmler(a, b){
  const kf = kullanilanFilm(), out = [];
  for (const [f] of P[a].cast) if (P[b].cast.has(f) && !kf.has(f)) out.push(f);
  return out;
}

// ---- kayıt -----------------------------------------------------------------
function kaydet(){
  if (pratik) return;
  try{ localStorage.setItem(KAYIT, JSON.stringify({gun, S})); }catch(e){}
}
function oku(){
  try{
    const k = JSON.parse(localStorage.getItem(KAYIT));
    if (k && k.gun === gun) return k.S;
  }catch(e){}
  return null;
}

// ---- DOM -------------------------------------------------------------------
const $ = id => document.getElementById(id);
const adimEl=$("adim"), kaynakEl=$("kaynak"), isimEl=$("isim"), altEl=$("alt"),
      kartEl=$("kartlar"), mesajEl=$("mesaj"), girisEl=$("giris"),
      onerEl=$("oneriler"), seritEl=$("serit"), hakEl=$("haklar"),
      pasEl=$("pas"), modEl=$("mod");

function kart(pid, tiklanir){
  const k = document.createElement("div");
  k.className = "kart" + (tiklanir ? " secilebilir" : "");
  if (tiklanir) k.tabIndex = 0;
  k.innerHTML = (P[pid].p
    ? `<img src="${IMG}${P[pid].p}" alt="">`
    : `<div class="bos">?</div>`)
    + `<div class="ad">${P[pid].n}</div>`;
  if (tiklanir){
    k.onclick = () => sec(pid);
    k.onkeydown = e => { if (e.key === "Enter" || e.key === " ") sec(pid); };
  }
  return k;
}
function mesaj(s, iyi){ mesajEl.textContent = s||""; mesajEl.className = iyi ? "iyi" : ""; }
function baslik(a, i, alt){
  adimEl.textContent = a; isimEl.textContent = i; altEl.textContent = alt;
}
function filmChip(fid, sinif){
  const [t, y] = FILMS[fid];
  return `<span class="chip ${sinif||""}">${t} (${y})</span>`;
}
function kaynakYaz(html){ kaynakEl.innerHTML = html || ""; }

// ---- çekiliş makarası ------------------------------------------------------
// pool içindeki yüzler hızla değişir, hedefte durur; bittiğinde devam() çağrılır
let makaraZamanlayici = null;
let donuyor = false; // çekiliş sürerken zincir ucunda hedefi gösterme
function makara(pool, hedef, etiket, bitis){
  clearTimeout(makaraZamanlayici);
  const devam = () => { donuyor = false; bitis(); };
  if (AZ_HAREKET || pool.length < 3){ devam(); return; }
  donuyor = true;
  const adaylar = pool.filter(q => q !== hedef && P[q].p);
  const sira = [];
  for (let i = 0; i < 9 && adaylar.length; i++)
    sira.push(adaylar[Math.floor(Math.random()*adaylar.length)]);
  sira.push(hedef);
  const bekle = [90,90,110,130,160,200,260,330,420,540];
  girisGoster(false);
  isimEl.textContent = "…";
  altEl.textContent = etiket;
  const k = document.createElement("div");
  k.className = "kart makara";
  // tüm kareler baştan DOM'da (fotoğraflar paralel yüklensin), tek tek gösterilir
  k.innerHTML = `<div class="makaraKat">` + sira.map((q,ix) =>
    `<div class="kat" data-i="${ix}">` +
    (P[q].p ? `<img src="${IMG}${P[q].p}" alt="">` : `<div class="bos">?</div>`) +
    `<div class="ad">${P[q].n}</div></div>`).join("") + `</div>`;
  kartEl.appendChild(k); // solo çekilişte çağıran kartları temizler; partner'da soldaki durur
  const katlar = k.querySelectorAll(".kat");
  let i = 0;
  const adimAt = () => {
    katlar.forEach((el,ix)=>el.style.display = ix===i ? "" : "none");
    i++;
    if (i < sira.length) makaraZamanlayici = setTimeout(adimAt, bekle[i] || 400);
    else makaraZamanlayici = setTimeout(devam, 340);
  };
  adimAt();
}

// ---- zincir çizimi ---------------------------------------------------------
function medalHTML(pid, aktif){
  const c = "medal" + (aktif ? " aktifM" : "");
  return P[pid].p
    ? `<img class="${c}" src="${IMG}${P[pid].p}" alt="" title="${P[pid].n}">`
    : `<div class="${c}" title="${P[pid].n}">?</div>`;
}
function sahneKisileri(){
  const st = S.stage;
  if (!st || S.bitti || donuyor) return [];
  if (st.tip === "solo" || st.tip === "dir") return [st.pid];
  if (st.tip === "pick2") return st.adaylar;
  if (st.tip === "pair") return [st.a, st.b];
  return [];
}
function seritCiz(yeniIdx){
  // log'u [kişiler]→film bölümlerine ayır
  const bolum = [];
  let biriken = [];
  for (const k of S.log){
    if (k.tip === "kisi") biriken.push(k.id);
    else { bolum.push({fid:k.id, kisiler:biriken}); biriken = []; }
  }
  const emojiSinif = e => e === "🟩" ? "d0" : e === "⬜" ? "dp" : "d1";
  const par = [];
  for (let i = 0; i < bolum.length; i++){
    const b = bolum[i];
    if (b.kisiler.length){
      par.push(`<div class="medalGrup">${b.kisiler.slice(-2).map(q=>medalHTML(q)).join("")}</div>`);
      par.push(`<div class="bag"></div>`);
    }
    const [t, y] = FILMS[b.fid];
    par.push(`<div class="plaka ${emojiSinif(S.emoji[i]||"")}${i===yeniIdx?" yeni":""}" title="${t} (${y})">
      <div class="ft">${t}</div><div class="fy">${y}</div></div>`);
    if (i < bolum.length - 1) par.push(`<div class="bag"></div>`);
  }
  // aktif uç: sahnedeki kişiler nabız halkasıyla
  const aktif = sahneKisileri();
  if (aktif.length){
    if (bolum.length) par.push(`<div class="bag"></div>`);
    par.push(`<div class="medalGrup">${aktif.slice(0,3).map(q=>medalHTML(q, true)).join("")}</div>`);
  }
  // kalan halkalar: hayalet plakalar
  for (let i = bolum.length; i < TAVAN; i++){
    par.push(`<div class="bag soluk"></div>`);
    par.push(`<div class="plaka ghost">${String(i+1).padStart(2,"0")}</div>`);
  }
  seritEl.innerHTML = par.join("");
}
function durumCiz(yeniIdx){
  hakEl.textContent = "●".repeat(DENEME_HAK - S.deneme) + "○".repeat(S.deneme);
  pasEl.style.display = (S.pas > 0 && !S.bitti && S.stage && S.stage.tip !== "pick2" && S.tur > 1) ? "" : "none";
  pasEl.textContent = `pas (${S.pas})`;
  modEl.textContent = pratik ? "pratik" : `günün zinciri · #${gunNo}`;
  seritCiz(yeniIdx);
}

// ---- sahneler --------------------------------------------------------------
function turBasi(){ S.deneme = 0; S.pasBuTur = false; }
function girisGoster(v){ $("girisKutu").style.display = v ? "" : "none"; }

function soloSahne(pid, rolEtiket, kaynakFid, sessiz, cekilisPool){
  S.stage = {tip:"solo", pid, rol:rolEtiket, kaynak:kaynakFid||0};
  if (!S.kisi.includes(pid)) S.kisi.push(pid);
  if (!sessiz){ S.tur++; turBasi(); S.log.push({tip:"kisi", id:pid}); }
  kaydet();
  const son = () => {
    baslik(`tur ${S.tur} · ${rolEtiket}`, P[pid].n, "bir filmini söyle.");
    kaynakYaz(kaynakFid
      ? `${filmChip(kaynakFid)} <span class="zar">⚄</span> kadrosundan rastgele çekildi`
      : (S.tur === 1 ? "zincirin ilk halkasını o başlatıyor" : ""));
    const k = kart(pid); if (!sessiz && !AZ_HAREKET) k.classList.add("beliris");
    kartEl.replaceChildren(k);
    girisGoster(true); girisEl.value = ""; girisEl.focus();
    durumCiz();
  };
  if (!sessiz && cekilisPool && kaynakFid){
    donuyor = true;
    durumCiz();
    adimEl.textContent = `tur ${S.tur} · ${rolEtiket}`;
    kaynakYaz(`${filmChip(kaynakFid)} <span class="zar">⚄</span> kadrodan biri çekiliyor…`);
    kartEl.replaceChildren();
    makara(cekilisPool, pid, "çekiliş dönüyor", son);
  } else son();
}
function yonetmenSahne(pid, kaynakFid, sessiz){
  S.stage = {tip:"dir", pid, kaynak:kaynakFid||0};
  if (!S.kisi.includes(pid)) S.kisi.push(pid);
  if (!sessiz){ S.tur++; turBasi(); S.log.push({tip:"kisi", id:pid}); }
  kaydet();
  baslik(`tur ${S.tur} · yönetmen`, P[pid].n, "başka bir filmini söyle.");
  kaynakYaz(`${filmChip(kaynakFid, "yonetmen")} <span style="color:#b9c48a">🎬</span> bu filmin yönetmeni`);
  const k = kart(pid); if (!sessiz && !AZ_HAREKET) k.classList.add("beliris");
  kartEl.replaceChildren(k);
  girisGoster(true); girisEl.value = ""; girisEl.focus();
  durumCiz();
}
function pick2Sahne(fid, sessiz){
  const kk = kullanilanKisi();
  const adaylar = (F2A.get(fid) || []).filter(q => !kk.has(q) && partnerler(q).length);
  if (!adaylar.length){
    const yedek = yanOyuncular(fid);
    if (yedek.length) return soloSahne(rnd(yedek), "yan oyuncu", fid, false, yedek);
    return bitir("koptu", "Bu koldan devam edecek kimse kalmadı.");
  }
  let secilen;
  if (sessiz && S.stage && S.stage.tip === "pick2"){ secilen = S.stage.adaylar; }
  else {
    secilen = adaylar.sort(()=>Math.random()-.5).slice(0, ADAY);
    if (secilen.length === 1){
      S.tur++; turBasi();
      return partnerSahne(secilen[0]);
    }
    S.stage = {tip:"pick2", adaylar:secilen, kaynak:fid};
    S.tur++; turBasi();
  }
  kaydet();
  baslik(`tur ${S.tur} · seçim`,
    secilen.map(q=>P[q].n).join(" · "),
    "biriyle devam edeceksin — karta tıkla.");
  kaynakYaz(`${filmChip(fid)} kadrosundan ${secilen.length} aday`);
  kartEl.replaceChildren(...secilen.map(q => {
    const k = kart(q, true);
    if (!sessiz && !AZ_HAREKET) k.classList.add("beliris");
    return k;
  }));
  girisGoster(false);
  durumCiz();
}
function sec(pid){
  if (S.stage.tip !== "pick2" || S.bitti) return;
  S.log.push({tip:"kisi", id:pid});
  partnerSahne(pid);
}
function partnerSahne(pid, haricPid, sessiz){
  if (!S.kisi.includes(pid)) S.kisi.push(pid);
  const adaylar = partnerler(pid, haricPid);
  if (!adaylar.length) return bitir("koptu", `${P[pid].n} için partner kalmadı.`);
  let es;
  if (sessiz && S.stage && S.stage.tip === "pair"){ es = S.stage.b; }
  else {
    es = rnd(adaylar);
    S.stage = {tip:"pair", a:pid, b:es};
    if (!S.kisi.includes(es)) S.kisi.push(es);
    S.log.push({tip:"kisi", id:es});
  }
  kaydet();
  const son = () => {
    baslik(`tur ${S.tur} · ortak film`, `${P[pid].n} + ${P[es].n}`,
           "birlikte oynadıkları bir filmi söyle.");
    kaynakYaz(`<span class="chip">${P[pid].n}</span> <span class="zar">⚄</span> yanına, birlikte oynadığı biri çekildi`);
    const k2 = kart(es); if (!sessiz && !AZ_HAREKET) k2.classList.add("beliris");
    kartEl.replaceChildren(kart(pid), k2);
    girisGoster(true); girisEl.value = ""; girisEl.focus();
    durumCiz();
  };
  if (!sessiz){
    donuyor = true;
    durumCiz();
    kaynakYaz(`<span class="chip">${P[pid].n}</span> <span class="zar">⚄</span> yanına rastgele bir partner çekiliyor…`);
    girisGoster(false);
    kartEl.replaceChildren(kart(pid));
    makara(adaylar, es, "partner çekilişi dönüyor", son);
    isimEl.textContent = P[pid].n + " + …";
  } else son();
}

// ---- cevap / ilerleme ------------------------------------------------------
function halkaEmojisi(){
  if (S.pasBuTur) return "⬜";
  return ["🟩","🟨","🟧"][S.deneme] || "🟧";
}
function cevap(fid){
  if (S.bitti) return;
  const st = S.stage;
  if (st.tip === "pick2") return;
  const [t] = FILMS[fid];
  if (kullanilanFilm().has(fid)) return mesaj(`${t} zincirde kullanıldı, başka bir tane.`);
  let dogru;
  if (st.tip === "solo") dogru = P[st.pid].cast.has(fid);
  else if (st.tip === "dir") dogru = P[st.pid].dir.includes(fid);
  else dogru = P[st.a].cast.has(fid) && P[st.b].cast.has(fid);
  if (!dogru){
    S.deneme++;
    durumCiz(); kaydet();
    if (S.deneme >= DENEME_HAK) return bitir("koptu");
    const kim = st.tip === "pair" ? "İkisi birden bu filmde yok" :
      st.tip === "dir" ? `${P[st.pid].n} bu filmi çekmedi` : `${P[st.pid].n} bu filmde yok`;
    return mesaj(`${kim}. Kalan deneme: ${DENEME_HAK - S.deneme}`);
  }
  const yeniIdx = S.halka;
  S.film.push(fid);
  S.emoji.push(halkaEmojisi());
  S.halka++;
  S.log.push({tip:"film", id:fid});
  mesaj("");
  if (S.halka >= TAVAN) return bitir("altin");
  if (st.tip === "solo" && S.tur === 1){
    const adaylar = yanOyuncular(fid);
    if (!adaylar.length) return pick2Sahne(fid);
    soloSahne(rnd(adaylar), "yan oyuncu", fid, false, adaylar);
  } else if (st.tip === "solo" && S.tur === 2){
    const d = FILMS[fid][3];
    if (P[d] && yonetilebilirF(d).length && !kullanilanKisi().has(d)) yonetmenSahne(d, fid);
    else {
      const adaylar = yanOyuncular(fid);
      if (adaylar.length) soloSahne(rnd(adaylar), "yan oyuncu", fid, false, adaylar);
      else pick2Sahne(fid);
    }
  } else {
    pick2Sahne(fid);
  }
  seritCiz(yeniIdx);
}

// ---- pas -------------------------------------------------------------------
pasEl.onclick = () => {
  if (S.bitti || S.pas <= 0) return;
  const st = S.stage;
  let ok = false;
  if (st.tip === "solo" && st.kaynak){
    const adaylar = yanOyuncular(st.kaynak, st.pid);
    if (adaylar.length){
      const y = rnd(adaylar);
      S.pas--; S.pasBuTur = true;
      S.log.push({tip:"kisi", id:y});
      donuyor = true;
      soloSahne(y, st.rol || "yan oyuncu", st.kaynak, true, null);
      kartEl.replaceChildren();
      makara(adaylar, y, "pas — yeniden çekiliyor", () => soloSahne(y, st.rol || "yan oyuncu", st.kaynak, true));
      mesaj(`pas kullanıldı — ${P[st.pid].n} gitti, kadrodan yeni biri çekiliyor.`, true);
      ok = true;
    }
  } else if (st.tip === "dir"){
    const adaylar = yanOyuncular(st.kaynak);
    if (adaylar.length){
      const y = rnd(adaylar);
      S.pas--; S.pasBuTur = true;
      S.log.push({tip:"kisi", id:y});
      donuyor = true;
      soloSahne(y, "yan oyuncu", st.kaynak, true, null);
      kartEl.replaceChildren();
      makara(adaylar, y, "pas — kadrodan çekiliyor", () => soloSahne(y, "yan oyuncu", st.kaynak, true));
      mesaj(`pas kullanıldı — yönetmen ${P[st.pid].n} gitti, yerine kadrodan biri geliyor.`, true);
      ok = true;
    }
  } else if (st.tip === "pair"){
    const adaylar = partnerler(st.a, st.b);
    if (adaylar.length){
      const eski = st.b;
      const es = rnd(adaylar);
      S.pas--; S.pasBuTur = true;
      S.stage = {tip:"pair", a:st.a, b:es};
      if (!S.kisi.includes(es)) S.kisi.push(es);
      S.log.push({tip:"kisi", id:es});
      kaydet();
      kartEl.replaceChildren(kart(st.a));
      makara(adaylar, es, "pas — yeni partner çekiliyor", () => partnerSahne(st.a, null, true));
      mesaj(`pas kullanıldı — ${P[eski].n} gitti, yeni partner çekiliyor.`, true);
      ok = true;
    }
  }
  if (!ok) mesaj("Pas işlemedi — çekilecek başka kimse yok.");
};

// ---- bitiş / paylaşım ------------------------------------------------------
function bitir(neden, not){
  S.bitti = neden;
  kaydet();
  clearTimeout(makaraZamanlayici); donuyor = false;
  girisGoster(false); $("pes").style.display = "none"; pasEl.style.display = "none";
  onerEl.style.display = "none"; hakEl.style.display = "none";
  kartEl.replaceChildren(); baslik("", "", ""); kaynakYaz(""); mesaj("");
  const s = $("sonEkran");
  s.style.display = "block";
  $("sonBaslik").textContent = neden === "altin" ? "altın bitiş" :
    neden === "pes" ? "bıraktın" : "zincir koptu";
  $("sonSayi").textContent = `${S.halka} halka`;
  $("sonEmoji").textContent = paylasimSatiri();
  let ek = not || "";
  if (neden !== "altin" && S.stage && S.stage.tip !== "pick2" && !not){
    let cevaplar = [];
    const st = S.stage;
    if (st.tip === "solo") cevaplar = oynanabilirF(st.pid);
    else if (st.tip === "dir") cevaplar = yonetilebilirF(st.pid);
    else if (st.tip === "pair") cevaplar = ortakFilmler(st.a, st.b);
    cevaplar.sort((a,b)=>FILMS[b][2]-FILMS[a][2]);
    const kimdi = st.tip === "pair" ? `${P[st.a].n} + ${P[st.b].n}` :
      st.tip === "dir" ? `yönetmen ${P[st.pid].n}` : P[st.pid].n;
    ek = `${kimdi} — olabilirdi: ` +
      cevaplar.slice(0,4).map(f=>`${FILMS[f][0]} (${FILMS[f][1]})`).join(" · ");
  }
  $("cevaplar").textContent = ek;
  $("paylas").style.display = pratik ? "none" : "";
  seritCiz();
}
function paylasimSatiri(){
  const uc = S.bitti === "altin" ? "⭐" : S.bitti === "pes" ? "🏳️" : "🟥";
  return S.emoji.join("") + uc;
}
$("paylas").onclick = () => {
  const txt = `⛓️ Zincir #${gunNo} · ${S.halka} halka\n${paylasimSatiri()}\nverandatools.com/zincir`;
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
    .then(()=>{ $("paylas").textContent = "kopyalandı ✓"; })
    .catch(()=>{ prompt("kopyala:", txt); });
};
$("pes").onclick = () => bitir("pes");
$("pratikBtn").onclick = () => { pratik = true; basla(true); };

// ---- otomatik tamamlama ----------------------------------------------------
let aktifOneri = -1, oneriler = [];
girisEl.addEventListener("input", () => {
  const q = norm(girisEl.value);
  aktifOneri = -1;
  if (q.length < 2){ onerEl.style.display = "none"; return; }
  oneriler = [];
  for (const f of AC){
    if (f.key.startsWith(q) || f.key.includes(" "+q) || f.key.includes(q)){
      oneriler.push(f);
      if (oneriler.length >= 8) break;
    }
  }
  onerEl.replaceChildren(...oneriler.map((f,i) => {
    const d = document.createElement("div");
    d.innerHTML = `${f.t} <span class="yil">(${f.y})</span>`;
    d.onclick = () => { onerEl.style.display="none"; cevap(f.id); };
    return d;
  }));
  onerEl.style.display = oneriler.length ? "block" : "none";
});
girisEl.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp"){
    e.preventDefault();
    if (!oneriler.length) return;
    aktifOneri = (aktifOneri + (e.key==="ArrowDown"?1:-1) + oneriler.length) % oneriler.length;
    [...onerEl.children].forEach((c,i)=>c.classList.toggle("aktif", i===aktifOneri));
  } else if (e.key === "Enter"){
    if (oneriler.length){
      const f = oneriler[aktifOneri >= 0 ? aktifOneri : 0];
      onerEl.style.display = "none";
      cevap(f.id);
    }
  }
});
document.addEventListener("click", e => {
  if (!$("girisKutu").contains(e.target)) onerEl.style.display = "none";
});

// ---- başlangıç / devam -----------------------------------------------------
function sahneyiKur(){
  const st = S.stage;
  if (st.tip === "solo") soloSahne(st.pid, st.rol, st.kaynak, true);
  else if (st.tip === "dir") yonetmenSahne(st.pid, st.kaynak, true);
  else if (st.tip === "pick2") pick2Sahne(st.kaynak, true);
  else if (st.tip === "pair") partnerSahne(st.a, null, true);
}
function basla(zorla){
  girisEl.disabled = false; $("pes").style.display = ""; hakEl.style.display = "";
  $("sonEkran").style.display = "none"; $("paylas").textContent = "paylaş";
  mesaj("");
  const kayitli = pratik ? null : oku();
  if (kayitli && !zorla){
    S = kayitli;
    if (S.bitti){ durumCiz(); bitir(S.bitti); return; }
    sahneyiKur();
    return;
  }
  const baslangic = pratik ? rnd(ZD.start) : ZD.start[(gun * 37) % ZD.start.length];
  S = yeniDurum(baslangic);
  soloSahne(baslangic, pratik ? "başlangıç oyuncusu" : "günün oyuncusu");
}
basla();
})();
