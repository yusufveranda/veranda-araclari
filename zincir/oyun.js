/* Zincir — oynanabilir iskelet. Akış:
   1 başlangıç oyuncusu → film
   2 o filmden rastgele yan oyuncu → film
   3 o filmin yönetmeni → film  (yönetmen uygun değilse yan oyuncuya düşer)
   4+ filmden 2 aday → birini seç → yanına rastgele partner → ortak film → tekrar 4
   Puan/can yok; "pes" olası cevapları gösterip bitirir. */
(function(){
"use strict";
const IMG = "https://image.tmdb.org/t/p/w342";
const ORDER_MAX = 7;

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
const OYUNCU = new Set();               // "usable" oyuncular (cast'i olanlar)
for (const id in P) if (P[id].cast.size) OYUNCU.add(+id);

// film -> ilk-8'inde görünen usable oyuncular
const F2A = new Map();
for (const id of OYUNCU){
  for (const [f, o] of P[id].cast) if (o <= ORDER_MAX){
    if (!F2A.has(f)) F2A.set(f, []);
    F2A.get(f).push(id);
  }
}

// otomatik tamamlama dizini
const norm = s => s.toLowerCase()
  .replace(/ı/g,"i").normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[^a-z0-9]+/g," ").trim();
const AC = [];
for (const id in FILMS){
  const [t, y, v] = FILMS[id];
  AC.push({key: norm(t), id:+id, t, y, v});
}
AC.sort((a,b)=>b.v-a.v);

// ---- oyun durumu -----------------------------------------------------------
const kullanilanFilm = new Set(), kullanilanKisi = new Set();
let stage = null, tur = 0;

const gun = Math.floor(Date.now()/864e5);
const rnd = a => a[Math.floor(Math.random()*a.length)];

// kişinin söylenebilir (kullanılmamış) filmi var mı
const oynanabilirF = pid => [...P[pid].cast.keys()].filter(f => !kullanilanFilm.has(f));
// filmden yan oyuncu adayları: başrol (sıra 0) HARİÇ; hiç kalmazsa başrol da olur
function yanOyuncular(fid){
  const hepsi = (F2A.get(fid) || []).filter(q => !kullanilanKisi.has(q) && oynanabilirF(q).length);
  const yan = hepsi.filter(q => P[q].cast.get(fid) > 0);
  return yan.length ? yan : hepsi;
}
const yonetilebilirF = pid => (P[pid].dir||[]).filter(f => !kullanilanFilm.has(f));

// partnerler: ikisi de ilk-8'de olduğu kullanılmamış ortak film olan usable kişiler
function partnerler(pid){
  const out = [];
  for (const [f, o] of P[pid].cast){
    if (o > ORDER_MAX || kullanilanFilm.has(f)) continue;
    for (const q of F2A.get(f) || []){
      if (q !== pid && !kullanilanKisi.has(q)) out.push(q);
    }
  }
  return [...new Set(out)];
}
function ortakFilmler(a, b){
  const out = [];
  for (const [f] of P[a].cast) if (P[b].cast.has(f) && !kullanilanFilm.has(f)) out.push(f);
  return out;
}

// ---- DOM -------------------------------------------------------------------
const $ = id => document.getElementById(id);
const adimEl=$("adim"), soruEl=$("soru"), kartEl=$("kartlar"), mesajEl=$("mesaj"),
      girisEl=$("giris"), onerEl=$("oneriler"), zincirEl=$("zincir");

function kart(pid, rol, tiklanir){
  const k = document.createElement("div");
  k.className = "kart" + (tiklanir ? " secilebilir" : "");
  k.innerHTML = (P[pid].p
    ? `<img src="${IMG}${P[pid].p}" alt="">`
    : `<div class="bos">?</div>`)
    + `<div class="ad">${P[pid].n}</div><div class="rol">${rol||""}</div>`;
  if (tiklanir) k.onclick = () => sec(pid);
  return k;
}
function halka(html){ const d=document.createElement("div"); zincirEl.appendChild(d); d.outerHTML=html; }
function kisiHalka(pid, etiket){
  halka(`<div class="halka">${P[pid].p?`<img src="${IMG}${P[pid].p}">`:'<div class="mini">?</div>'}
    <span><span class="etiket">${etiket}</span><span class="kim">${P[pid].n}</span></span></div>`);
}
function filmHalka(fid){
  const [t,y] = FILMS[fid];
  halka(`<div class="halka film">↳ ${t} (${y})</div>`);
}
function mesaj(s, iyi){ mesajEl.textContent = s||""; mesajEl.className = iyi ? "iyi" : ""; }

// ---- sahneler --------------------------------------------------------------
function soloSahne(pid, rolEtiket){
  stage = {tip:"solo", pid};
  kullanilanKisi.add(pid);
  tur++;
  adimEl.textContent = `tur ${tur} · ${rolEtiket}`;
  soruEl.textContent = `${P[pid].n} — bir filmini söyle.`;
  kartEl.replaceChildren(kart(pid, rolEtiket));
  kisiHalka(pid, rolEtiket);
  girisEl.value = ""; girisEl.focus();
}
function yonetmenSahne(pid){
  stage = {tip:"dir", pid};
  kullanilanKisi.add(pid);
  tur++;
  adimEl.textContent = `tur ${tur} · yönetmen`;
  soruEl.textContent = `Yönetmen ${P[pid].n} — başka bir filmini söyle.`;
  kartEl.replaceChildren(kart(pid, "yönetmen"));
  kisiHalka(pid, "yönetmen");
  girisEl.value = ""; girisEl.focus();
}
function pick2Sahne(fid){
  const adaylar = (F2A.get(fid) || []).filter(q =>
    !kullanilanKisi.has(q) && partnerler(q).some(b => ortakFilmler(q,b).length));
  if (!adaylar.length){ // çıkmaz kaçınma: filmden yan oyuncu çek
    const yedek = yanOyuncular(fid);
    if (yedek.length) return soloSahne(rnd(yedek), "yan oyuncu");
    return bitir("Bu koldan devam edecek kimse kalmadı — iskelet sınırı.");
  }
  if (adaylar.length === 1) return partnerSahne(adaylar[0]);
  const [a, b] = adaylar.sort(()=>Math.random()-.5).slice(0,2);
  stage = {tip:"pick2"};
  tur++;
  adimEl.textContent = `tur ${tur} · seçim`;
  soruEl.textContent = "Bu filmden iki kişi çıktı. Hangisiyle devam?";
  kartEl.replaceChildren(kart(a, "seç", true), kart(b, "seç", true));
  girisEl.value = "";
  mesaj("");
}
function sec(pid){
  if (stage.tip !== "pick2") return;
  kullanilanKisi.add(pid);
  kisiHalka(pid, "senin seçimin");
  partnerSahne(pid);
}
function partnerSahne(pid){
  const adaylar = partnerler(pid).filter(b => ortakFilmler(pid, b).length);
  if (!adaylar.length) return bitir(`${P[pid].n} için partner kalmadı — iskelet sınırı.`);
  const es = rnd(adaylar);
  kullanilanKisi.add(pid); kullanilanKisi.add(es);
  stage = {tip:"pair", a:pid, b:es};
  adimEl.textContent = `tur ${tur} · ortak film`;
  soruEl.textContent = `${P[pid].n} + ${P[es].n} — birlikte oynadıkları bir film söyle.`;
  kartEl.replaceChildren(kart(pid, ""), kart(es, "partner"));
  kisiHalka(es, "partner");
  girisEl.value = ""; girisEl.focus();
}

// ---- cevap işleme ----------------------------------------------------------
function cevap(fid){
  const [t] = FILMS[fid];
  if (kullanilanFilm.has(fid)) return mesaj(`${t} zincirde kullanıldı, başka bir tane.`);
  if (stage.tip === "solo" || stage.tip === "dir"){
    const p = P[stage.pid];
    const dogru = stage.tip === "solo" ? p.cast.has(fid) : p.dir.includes(fid);
    if (!dogru) return mesaj(`${p.n} ${stage.tip==="dir"?"bu filmi çekmedi":"bu filmde yok"}.`);
    kullanilanFilm.add(fid); filmHalka(fid); mesaj("doğru!", true);
    ilerle(fid);
  } else if (stage.tip === "pair"){
    if (!(P[stage.a].cast.has(fid) && P[stage.b].cast.has(fid)))
      return mesaj("İkisi birden bu filmde yok.");
    kullanilanFilm.add(fid); filmHalka(fid); mesaj("doğru!", true);
    pick2Sahne(fid);
  }
}
function ilerle(fid){
  const seq = tur; // az önce biten tur
  if (seq === 1){
    const adaylar = yanOyuncular(fid);
    if (!adaylar.length) return pick2Sahne(fid);
    soloSahne(rnd(adaylar), "yan oyuncu");
  } else if (seq === 2){
    const d = FILMS[fid][3];
    if (P[d] && yonetilebilirF(d).length && !kullanilanKisi.has(d)) yonetmenSahne(d);
    else {
      const adaylar = yanOyuncular(fid);
      if (adaylar.length) soloSahne(rnd(adaylar), "yan oyuncu");
      else pick2Sahne(fid);
    }
  } else {
    pick2Sahne(fid);
  }
}

function bitir(not){
  girisEl.disabled = true; $("pes").style.display = "none";
  onerEl.style.display = "none";
  const s = $("sonEkran");
  s.style.display = "block";
  $("sonSayi").textContent = `${tur} tur`;
  if (not) $("cevaplar").textContent = not;
}
$("pes").onclick = () => {
  let cevaplar = [];
  if (stage.tip === "solo") cevaplar = oynanabilirF(stage.pid);
  else if (stage.tip === "dir") cevaplar = yonetilebilirF(stage.pid);
  else if (stage.tip === "pair") cevaplar = ortakFilmler(stage.a, stage.b);
  cevaplar.sort((a,b)=>FILMS[b][2]-FILMS[a][2]);
  const ornek = cevaplar.slice(0,5).map(f=>`${FILMS[f][0]} (${FILMS[f][1]})`).join(" · ");
  bitir(ornek ? "olabilecekler: " + ornek : "");
};

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

// ---- başla -----------------------------------------------------------------
const basla = ZD.start[(gun * 37) % ZD.start.length];
soloSahne(basla, "günün oyuncusu");
})();
