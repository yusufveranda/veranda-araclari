/* Zincir — günlük film zinciri.
   Akış: günün oyuncusu → film → yan oyuncu (başrol hariç) → film → yönetmen →
   film → 2 aday, birini seç → rastgele partner → ortak film → tekrar seçim...
   Format: tur başına 3 deneme (biterse zincir kopar), 1 pas (kişiyi yeniden
   çeker), 10 halkada altın bitiş. Günde 1 resmi el (localStorage) + pratik. */
(function(){
"use strict";
const IMG = "https://image.tmdb.org/t/p/w342";
const ORDER_MAX = 7, DENEME_HAK = 3, PAS_HAK = 1, TAVAN = 10;
const EPOCH = 20654; // 2026-07-20 => Zincir #1
const KAYIT = "zincir_v1";

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
let S = null; // oyun durumu (serileşebilir)

function yeniDurum(baslangicPid){
  return {basla: baslangicPid, tur:0, halka:0, deneme:0, pas:PAS_HAK,
          pasBuTur:false, emoji:[], film:[], kisi:[], log:[],
          stage:null, bitti:null}; // bitti: "koptu"|"altin"|"pes"
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
const adimEl=$("adim"), soruEl=$("soru"), kartEl=$("kartlar"), mesajEl=$("mesaj"),
      girisEl=$("giris"), onerEl=$("oneriler"), zincirEl=$("zincir"),
      hakEl=$("haklar"), pasEl=$("pas"), modEl=$("mod");

function kart(pid, tiklanir){
  const k = document.createElement("div");
  k.className = "kart" + (tiklanir ? " secilebilir" : "");
  k.innerHTML = (P[pid].p
    ? `<img src="${IMG}${P[pid].p}" alt="">`
    : `<div class="bos">?</div>`)
    + `<div class="ad">${P[pid].n}</div>`;
  if (tiklanir) k.onclick = () => sec(pid);
  return k;
}
function logEkle(kayit){ S.log.push(kayit); logCiz(kayit); }
function logCiz(k){
  const d = document.createElement("div");
  if (k.tip === "kisi"){
    d.className = "halka";
    d.innerHTML = `${P[k.id].p?`<img src="${IMG}${P[k.id].p}">`:'<div class="mini">?</div>'}
      <span><span class="etiket">${k.etiket}</span><span class="kim">${P[k.id].n}</span></span>`;
  } else {
    d.className = "halka film";
    d.textContent = `↳ ${FILMS[k.id][0]} (${FILMS[k.id][1]})`;
  }
  zincirEl.appendChild(d);
}
function mesaj(s, iyi){ mesajEl.textContent = s||""; mesajEl.className = iyi ? "iyi" : ""; }
function durumCiz(){
  hakEl.textContent = "●".repeat(DENEME_HAK - S.deneme) + "○".repeat(S.deneme);
  pasEl.style.display = (S.pas > 0 && S.stage && S.stage.tip !== "pick2" && S.tur > 1) ? "" : "none";
  pasEl.textContent = `pas (${S.pas})`;
  modEl.textContent = pratik ? "pratik" : `günün zinciri #${gunNo}`;
}

// ---- sahneler --------------------------------------------------------------
function turBasi(){ S.deneme = 0; S.pasBuTur = false; }
function soloSahne(pid, rolEtiket, kaynakFid, sessiz){
  S.stage = {tip:"solo", pid, rol:rolEtiket, kaynak:kaynakFid||0};
  if (!S.kisi.includes(pid)) S.kisi.push(pid);
  if (!sessiz){ S.tur++; turBasi(); logEkle({tip:"kisi", id:pid, etiket:rolEtiket}); }
  adimEl.textContent = `tur ${S.tur} · ${rolEtiket}`;
  const bas = rolEtiket.charAt(0).toUpperCase() + rolEtiket.slice(1);
  soruEl.textContent = `${bas} ${P[pid].n} — bir filmini söyle.`;
  kartEl.replaceChildren(kart(pid));
  girisEl.value = ""; girisEl.focus();
  durumCiz(); kaydet();
}
function yonetmenSahne(pid, kaynakFid, sessiz){
  S.stage = {tip:"dir", pid, kaynak:kaynakFid||0};
  if (!S.kisi.includes(pid)) S.kisi.push(pid);
  if (!sessiz){ S.tur++; turBasi(); logEkle({tip:"kisi", id:pid, etiket:"yönetmen"}); }
  adimEl.textContent = `tur ${S.tur} · yönetmen`;
  soruEl.textContent = `Yönetmen ${P[pid].n} — başka bir filmini söyle.`;
  kartEl.replaceChildren(kart(pid));
  girisEl.value = ""; girisEl.focus();
  durumCiz(); kaydet();
}
function pick2Sahne(fid, sessiz){
  const kk = kullanilanKisi();
  const adaylar = (F2A.get(fid) || []).filter(q => !kk.has(q) && partnerler(q).length);
  if (!adaylar.length){
    const yedek = yanOyuncular(fid);
    if (yedek.length) return soloSahne(rnd(yedek), "yan oyuncu", fid);
    return bitir("koptu", "Bu koldan devam edecek kimse kalmadı.");
  }
  if (adaylar.length === 1){
    if (!sessiz){ S.tur++; turBasi(); }
    return partnerSahne(adaylar[0]);
  }
  let a, b;
  if (sessiz && S.stage && S.stage.tip === "pick2"){ [a, b] = S.stage.adaylar; }
  else {
    [a, b] = adaylar.sort(()=>Math.random()-.5).slice(0,2);
    S.stage = {tip:"pick2", adaylar:[a,b], kaynak:fid};
    S.tur++; turBasi();
  }
  adimEl.textContent = `tur ${S.tur} · seçim`;
  soruEl.textContent = `Bu filmden iki kişi çıktı: ${P[a].n} ya da ${P[b].n}. Hangisiyle devam?`;
  kartEl.replaceChildren(kart(a, true), kart(b, true));
  girisEl.value = "";
  durumCiz(); kaydet();
}
function sec(pid){
  if (S.stage.tip !== "pick2" || S.bitti) return;
  logEkle({tip:"kisi", id:pid, etiket:"senin seçimin"});
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
    logEkle({tip:"kisi", id:es, etiket:"partner"});
  }
  adimEl.textContent = `tur ${S.tur} · ortak film`;
  soruEl.textContent = `Ortak film: ${P[pid].n} + ${P[es].n} — birlikte oynadıkları bir filmi söyle.`;
  kartEl.replaceChildren(kart(pid), kart(es));
  girisEl.value = ""; girisEl.focus();
  durumCiz(); kaydet();
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
  S.film.push(fid);
  S.emoji.push(halkaEmojisi());
  S.halka++;
  logEkle({tip:"film", id:fid});
  mesaj("doğru!", true);
  if (S.halka >= TAVAN) return bitir("altin");
  if (st.tip === "solo" && S.tur === 1){
    const adaylar = yanOyuncular(fid);
    if (!adaylar.length) return pick2Sahne(fid);
    soloSahne(rnd(adaylar), "yan oyuncu", fid);
  } else if (st.tip === "solo" && S.tur === 2){
    const d = FILMS[fid][3];
    if (P[d] && yonetilebilirF(d).length && !kullanilanKisi().has(d)) yonetmenSahne(d, fid);
    else {
      const adaylar = yanOyuncular(fid);
      if (adaylar.length) soloSahne(rnd(adaylar), "yan oyuncu", fid);
      else pick2Sahne(fid);
    }
  } else {
    pick2Sahne(fid);
  }
}

// ---- pas -------------------------------------------------------------------
pasEl && (pasEl.onclick = () => {
  if (S.bitti || S.pas <= 0) return;
  const st = S.stage;
  let ok = false;
  if (st.tip === "solo" && st.kaynak){
    const adaylar = yanOyuncular(st.kaynak, st.pid);
    if (adaylar.length){
      const y = rnd(adaylar);
      S.pas--; S.pasBuTur = true;
      logEkle({tip:"kisi", id:y, etiket:"pas → yeni çekiliş"});
      soloSahne(y, st.rol || "yan oyuncu", st.kaynak, true); ok = true;
    }
  } else if (st.tip === "dir"){
    const adaylar = yanOyuncular(st.kaynak);
    if (adaylar.length){
      const y = rnd(adaylar);
      S.pas--; S.pasBuTur = true;
      logEkle({tip:"kisi", id:y, etiket:"pas → yan oyuncu"});
      soloSahne(y, "yan oyuncu", st.kaynak, true); ok = true;
    }
  } else if (st.tip === "pair"){
    const adaylar = partnerler(st.a, st.b);
    if (adaylar.length){
      const es = rnd(adaylar);
      S.pas--; S.pasBuTur = true;
      S.stage = {tip:"pair", a:st.a, b:es};
      if (!S.kisi.includes(es)) S.kisi.push(es);
      logEkle({tip:"kisi", id:es, etiket:"pas → yeni partner"});
      partnerSahne(st.a, null, true); ok = true;
    }
  }
  if (!ok) mesaj("Pas işlemedi — çekilecek başka kimse yok.");
  else mesaj("");
});

// ---- bitiş / paylaşım ------------------------------------------------------
function bitir(neden, not){
  S.bitti = neden;
  kaydet();
  girisEl.disabled = true; $("pes").style.display = "none"; pasEl.style.display = "none";
  onerEl.style.display = "none"; hakEl.style.display = "none";
  kartEl.replaceChildren(); soruEl.textContent = ""; adimEl.textContent = "";
  const s = $("sonEkran");
  s.style.display = "block";
  $("sonBaslik").textContent = neden === "altin" ? "⭐ altın bitiş!" :
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
    ek = "olabilirdi: " + cevaplar.slice(0,4).map(f=>`${FILMS[f][0]} (${FILMS[f][1]})`).join(" · ");
  }
  $("cevaplar").textContent = ek;
  $("paylas").style.display = pratik ? "none" : "";
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
function sahneyiKur(){ // S.stage'den ekranı yeniden kur (resume)
  const st = S.stage;
  if (st.tip === "solo") soloSahne(st.pid, st.rol, st.kaynak, true);
  else if (st.tip === "dir") yonetmenSahne(st.pid, st.kaynak, true);
  else if (st.tip === "pick2") pick2Sahne(st.kaynak, true);
  else if (st.tip === "pair") partnerSahne(st.a, null, true);
}
function basla(zorla){
  zincirEl.replaceChildren();
  girisEl.disabled = false; $("pes").style.display = ""; hakEl.style.display = "";
  $("sonEkran").style.display = "none"; mesaj("");
  const kayitli = pratik ? null : oku();
  if (kayitli && !zorla){
    S = kayitli;
    S.log.forEach(logCiz);
    durumCiz();
    if (S.bitti){ bitir(S.bitti); return; }
    sahneyiKur();
    return;
  }
  const baslangic = pratik
    ? rnd(ZD.start)
    : ZD.start[(gun * 37) % ZD.start.length];
  S = yeniDurum(baslangic);
  soloSahne(baslangic, pratik ? "başlangıç oyuncusu" : "günün oyuncusu");
}
basla();
})();
