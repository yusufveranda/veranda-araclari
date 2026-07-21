/* Zincir: günlük film zinciri.
   Akış: günün oyuncusu > film > yan oyuncu (başrol hariç, çekilişle) > film >
   o filmin yönetmeni > film > kadrodan 3 aday, birini seç > yanına rastgele
   partner (çekilişle) > ortak film > tekrar seçim...
   Format: tur başına 3 deneme (biterse zincir kopar), 1 yeniden çek hakkı
   (kişiyi değiştirir), 10 halkada altın bitiş. Günde 1 resmi el + pratik. */
(function(){
"use strict";
const IMG = "https://image.tmdb.org/t/p/w342";
const AFIS_IMG = "https://image.tmdb.org/t/p/w185";
const ORDER_MAX = 15, DENEME_HAK = 3, PAS_HAK = 1, TAVAN = 10, ADAY = 3;
const EPOCH = 20654; // 2026-07-20 => Film Şeridi #1
const KAYIT = "zincir_v1";
const SES_ANAHTAR = "zincir_ses";
const AZ_HAREKET = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- ses ---------------------------------------------------------------
// Web Audio ile üretilen kısa efektler; dosya yok. Makara dönerken tık tık,
// doğru/yanlış cevapta ve zincir kopunca/altın bitişte kısa bir işaret.
const Ses = (() => {
  let ctx = null;
  let acik = localStorage.getItem(SES_ANAHTAR) !== "kapali";
  const al = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
  function ton(freq, sure, tip, ses, hedefFreq){
    if (!acik) return;
    try{
      const c = al(); if (c.state === "suspended") c.resume();
      const o = c.createOscillator(), g = c.createGain();
      o.type = tip || "sine"; o.frequency.setValueAtTime(freq, c.currentTime);
      if (hedefFreq) o.frequency.exponentialRampToValueAtTime(Math.max(30,hedefFreq), c.currentTime + sure);
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(ses || .16, c.currentTime + .008);
      g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + sure);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + sure + .02);
    }catch(e){}
  }
  return {
    acikMi: () => acik,
    ac(v){ acik = v; localStorage.setItem(SES_ANAHTAR, v ? "acik" : "kapali"); },
    tik(hiz){ ton(720 + Math.random()*260, .045, "square", .09, 500 + hiz*300); },
    dogru(){ ton(660, .09, "sine", .15); setTimeout(()=>ton(990, .16, "sine", .15), 70); },
    yanlis(){ ton(220, .17, "sawtooth", .13, 90); },
    koptu(){ ton(180, .22, "sawtooth", .16, 55); setTimeout(()=>ton(120,.28,"sawtooth",.14,40), 110); },
    altin(){ [660,880,1100].forEach((f,i)=>setTimeout(()=>ton(f, .22, "sine", .16), i*110)); },
    bonus(){ [880,660,880,1320].forEach((f,i)=>setTimeout(()=>ton(f, .1, "triangle", .12), i*55)); },
  };
})();

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
const HAVUZ_FILM_ID = [...F2A.keys()];   // bonus tur: kümelenecek film adayları

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
// bonus tur: oyunun bilgi boşluğu yüzünden zincir kopacaksa çıkmaz sokak
// yerine bunu çağır. Ortak bir filmden 5 kullanılmamış oyuncu çeker, bu
// beşliden hangi ikisi seçilirse seçilsin en az o kaynak filmi paylaşırlar.
// Yani oyuncunun hatası değil, oyunun veri boşluğu zinciri koparmaz.
function bonusHavuzBul(){
  const kk = kullanilanKisi(), kf = kullanilanFilm();
  for (let deneme = 0; deneme < 300; deneme++){
    const fid = HAVUZ_FILM_ID[Math.floor(Math.random()*HAVUZ_FILM_ID.length)];
    if (kf.has(fid)) continue;
    const uygun = (F2A.get(fid)||[]).filter(q => !kk.has(q));
    if (uygun.length >= 5) return uygun.sort(()=>Math.random()-.5).slice(0,5);
  }
  for (const [fid, list] of F2A){
    if (kf.has(fid)) continue;
    const uygun = list.filter(q => !kk.has(q));
    if (uygun.length >= 5) return uygun.sort(()=>Math.random()-.5).slice(0,5);
  }
  return null;
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
      pasEl=$("pas"), modEl=$("mod"), sesBtn=$("sesBtn");

sesBtn.textContent = Ses.acikMi() ? "🔊" : "🔇";
sesBtn.onclick = () => { Ses.ac(!Ses.acikMi()); sesBtn.textContent = Ses.acikMi() ? "🔊" : "🔇"; };

function kart(pid, tiklanir, tikHandler){
  const k = document.createElement("div");
  k.className = "kart" + (tiklanir ? " secilebilir" : "");
  if (tiklanir) k.tabIndex = 0;
  k.innerHTML = (P[pid].p
    ? `<img src="${IMG}${P[pid].p}" alt="">`
    : `<div class="bos">?</div>`)
    + `<div class="ad">${P[pid].n}</div>`;
  if (tiklanir){
    const h = tikHandler || (id => sec(id));
    k.onclick = () => h(pid, k);
    k.onkeydown = e => { if (e.key === "Enter" || e.key === " ") h(pid, k); };
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

// ---- çekiliş: slot makinesi -------------------------------------------------
// hedef baştan belli (adillik/resume için); makara sadece görsel açığa çıkarma.
// Otomatik dönmez: makine "hazır" görünür, oyuncu kolu çekince (ya da tuşa
// basınca) döner ve hedefte durur; bittiğinde devam() çağrılır. Kabin görseli
// üretilmiş (gorsel/zincir-makine-yatay.jpg + ayrı gorsel/zincir-kol.jpg); pencere konumu o görselin
// ölçülmüş oranlarına göre CSS'te (.pencere) yüzde ile sabit; kol artık ayrı
// bir görsel (gorsel/zincir-kol.jpg), .kolWrap tıklanabilir/klavyeyle erişilebilir sarmalayıcı.
let makaraZamanlayici = null;
let donuyor = false; // çekiliş sürerken zincir ucunda hedefi gösterme
function kareHTML(pid){
  return (P[pid].p ? `<img src="${IMG}${P[pid].p}" alt="">` : `<div class="bos">?</div>`)
    + `<div class="ad">${P[pid].n}</div>`;
}
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
  girisGoster(false);
  isimEl.textContent = "…";
  altEl.textContent = "";
  const k = document.createElement("div");
  k.className = "slotMakine";
  k.innerHTML =
    `<div class="makineSira">
      <div class="kabin">
        <div class="pencere">
          <div class="hedefCizgi"></div>
          <div class="makaraSerit">${sira.map(q => `<div class="kare">${kareHTML(q)}</div>`).join("")}</div>
        </div>
      </div>
      <div class="kolWrap" tabindex="0" role="button" aria-label="kolu çek, makarayı döndür">
        <div class="kolGorsel"></div>
      </div>
    </div>
    <div class="durumSlot hazir">hazır — kolu çek</div>`;
  kartEl.appendChild(k); // solo çekilişte çağıran kartları temizler; partner'da soldaki durur
  const pencereEl = k.querySelector(".pencere");
  const seritEl2 = k.querySelector(".makaraSerit");
  const kol = k.querySelector(".kolWrap");
  const durumEl = k.querySelector(".durumSlot");
  // pencere yüzde ile ölçülendiği için gerçek piksel yüksekliği ancak
  // yerleştikten sonra ölçülebilir; her kare o yüksekliğe eşitlenir.
  const kareH = pencereEl.getBoundingClientRect().height;
  seritEl2.querySelectorAll(".kare").forEach(el => el.style.height = kareH + "px");
  let cekildi = false;
  const tikZaman = [90,180,290,420,580,780,1040,1370,1790,2330];
  function cek(){
    if (cekildi) return;
    cekildi = true;
    kol.classList.add("cekildi");
    durumEl.textContent = etiket;
    durumEl.classList.remove("hazir");
    const toplam = (sira.length - 1) * kareH;
    requestAnimationFrame(() => {
      seritEl2.style.transition = "transform 2.33s cubic-bezier(.13,.85,.1,1)";
      seritEl2.style.transform = `translateY(-${toplam}px)`;
    });
    tikZaman.forEach((t, i) => makaraZamanlayici = setTimeout(() => Ses.tik(i / tikZaman.length), t));
    makaraZamanlayici = setTimeout(devam, 2380);
  }
  kol.onclick = cek;
  kol.onkeydown = e => { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); cek(); } };
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
  if (st.tip === "bonus") return st.secili.length ? st.secili : st.besli;
  return [];
}
const MAKAS_SVG =
  `<div class="makasIkon"><svg viewBox="0 0 36 22" xmlns="http://www.w3.org/2000/svg">
    <g class="bladeUst" fill="#c9c2b2"><rect x="16" y="9.3" width="18" height="2.8" rx="1.3"/><circle cx="5" cy="5" r="4.4" fill="none" stroke="#c9c2b2" stroke-width="2.2"/></g>
    <g class="bladeAlt" fill="#c9c2b2"><rect x="16" y="9.3" width="18" height="2.8" rx="1.3"/><circle cx="5" cy="17" r="4.4" fill="none" stroke="#c9c2b2" stroke-width="2.2"/></g>
  </svg></div>`;
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
    const [t, y, , , poster] = FILMS[b.fid];
    const yeni = i === yeniIdx;
    par.push(`<div class="kareFilm${yeni ? " yeniKare" : ""}" title="${t} (${y})">
      ${yeni ? MAKAS_SVG : ""}
      <div class="filmGovde ${emojiSinif(S.emoji[i]||"")}">
        <div class="rozetKume">${b.kisiler.slice(-2).map(q=>medalHTML(q)).join("")}</div>
        ${poster ? `<img class="poster" src="${AFIS_IMG}${poster}" alt="">` : `<div class="posterBos">🎬</div>`}
        <div class="slate">${t}<span>${y}</span></div>
      </div>
    </div>`);
  }
  // aktif uç: henüz filmi yazılmamış, sahnedeki kişi(ler)
  const aktif = sahneKisileri();
  let dolu = bolum.length;
  if (aktif.length){
    dolu++;
    par.push(`<div class="kareFilm">
      <div class="filmGovde bekleyen">
        <div class="rozetKume">${aktif.slice(0,2).map(q=>medalHTML(q, true)).join("")}</div>
        <div class="posterBos">?</div>
      </div>
    </div>`);
  }
  // kalan halkalar: pozlanmamış kareler
  for (let i = dolu; i < TAVAN; i++){
    par.push(`<div class="kareFilm"><div class="bosluKare">${String(i+1).padStart(2,"0")}</div></div>`);
  }
  seritEl.innerHTML = par.join("");
}
function durumCiz(yeniIdx){
  hakEl.innerHTML = `<span class="canEtiket">can</span>` +
    Array.from({length: DENEME_HAK}, (_, i) =>
      `<span class="can ${i < (DENEME_HAK - S.deneme) ? "dolu" : "bos"}">♥</span>`).join("");
  pasEl.style.display = (S.pas > 0 && !S.bitti && S.stage &&
    S.stage.tip !== "pick2" && S.stage.tip !== "bonus" && S.tur > 1) ? "" : "none";
  pasEl.textContent = `↻ yeniden çek (${S.pas})`;
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
    return bonusSahne(); // bu koldan devamı yok, oyunun eksiği; zincir kopmasın
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
    "biriyle devam edeceksin, karta tıkla.");
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
function partnerSahne(pid, haricPid, sessiz, zorlaEs){
  if (!S.kisi.includes(pid)) S.kisi.push(pid);
  const resumePair = sessiz && S.stage && S.stage.tip === "pair";
  let es, adaylar;
  if (resumePair){
    es = S.stage.b;
  } else if (zorlaEs){
    es = zorlaEs;
    S.stage = {tip:"pair", a:pid, b:es, bonus:true};
    if (!S.kisi.includes(es)) S.kisi.push(es);
    S.log.push({tip:"kisi", id:es});
  } else {
    adaylar = partnerler(pid, haricPid);
    if (!adaylar.length) return bonusSahne(); // oyunun eksiği, zincir kopmasın
    es = rnd(adaylar);
    S.stage = {tip:"pair", a:pid, b:es};
    if (!S.kisi.includes(es)) S.kisi.push(es);
    S.log.push({tip:"kisi", id:es});
  }
  kaydet();
  const son = () => {
    const bonus = !!S.stage.bonus;
    baslik(`tur ${S.tur} · ${bonus ? "bonus ortak film" : "ortak film"}`, `${P[pid].n} + ${P[es].n}`,
           "birlikte oynadıkları bir filmi söyle.");
    kaynakYaz(bonus
      ? `<span class="chip bonus">⚡ bonus, seçtiğin ikili</span>`
      : `<span class="chip">${P[pid].n}</span> <span class="zar">⚄</span> yanına, birlikte oynadığı biri çekildi`);
    const k2 = kart(es); if (!resumePair && !AZ_HAREKET) k2.classList.add("beliris");
    kartEl.replaceChildren(kart(pid), k2);
    girisGoster(true); girisEl.value = ""; girisEl.focus();
    durumCiz();
  };
  if (!resumePair && !zorlaEs){
    donuyor = true;
    durumCiz();
    kaynakYaz(`<span class="chip">${P[pid].n}</span> <span class="zar">⚄</span> yanına rastgele bir partner çekiliyor…`);
    girisGoster(false);
    kartEl.replaceChildren(kart(pid));
    makara(adaylar, es, "partner çekilişi dönüyor", son);
    isimEl.textContent = P[pid].n + " + …";
  } else son();
}

// ---- bonus tur: veri boşluğu yüzünden zincir kopacaksa devreye girer ------
function bonusSahne(sessiz){
  if (sessiz && S.stage && S.stage.tip === "bonus"){
    // devam (resume): aynı beşliyi ve seçili işaretlerini yeniden çiz
  } else {
    const besli = bonusHavuzBul();
    if (!besli) return bitir("koptu", "Zincir için havuzda uygun kimse kalmadı.");
    S.stage = {tip:"bonus", besli, secili:[]};
    S.tur++; turBasi();
    if (!sessiz) Ses.bonus();
  }
  kaydet();
  const st = S.stage;
  baslik(`tur ${S.tur} · bonus tur`, "5 rastgele oyuncu",
    `${2 - st.secili.length} kişi daha seç, ikisi de aynı filmden.`);
  kaynakYaz(`<span class="chip bonus">⚡ bonus</span> zincir bilgi boşluğuna denk geldi, yeni beşli çekildi`);
  girisGoster(false);
  kartEl.replaceChildren(...st.besli.map(q => {
    const k = kart(q, true, bonusTikla);
    if (st.secili.includes(q)) k.classList.add("secildi");
    if (!sessiz && !AZ_HAREKET) k.classList.add("beliris");
    return k;
  }));
  durumCiz();
}
function bonusTikla(pid, el){
  if (!S.stage || S.stage.tip !== "bonus" || S.bitti) return;
  const st = S.stage;
  const i = st.secili.indexOf(pid);
  if (i >= 0){
    st.secili.splice(i, 1);
    el.classList.remove("secildi");
    altEl.textContent = `${2 - st.secili.length} kişi daha seç, ikisi de aynı filmden.`;
    kaydet();
    return;
  }
  if (st.secili.length >= 2) return;
  st.secili.push(pid);
  el.classList.add("secildi");
  if (st.secili.length < 2){
    altEl.textContent = `${2 - st.secili.length} kişi daha seç, ikisi de aynı filmden.`;
    kaydet();
    return;
  }
  const [a, b] = st.secili;
  S.log.push({tip:"kisi", id:a});
  kaydet();
  partnerSahne(a, null, false, b);
}

// ---- cevap / ilerleme ------------------------------------------------------
function halkaEmojisi(){
  if (S.pasBuTur) return "⬜";
  return ["🟩","🟨","🟧"][S.deneme] || "🟧";
}
function cevap(fid){
  if (S.bitti) return;
  const st = S.stage;
  if (st.tip === "pick2" || st.tip === "bonus") return;
  const [t] = FILMS[fid];
  if (kullanilanFilm().has(fid)) return mesaj(`${t} zincirde kullanıldı, başka bir tane.`);
  let dogru;
  if (st.tip === "solo") dogru = P[st.pid].cast.has(fid);
  else if (st.tip === "dir") dogru = P[st.pid].dir.includes(fid);
  else dogru = P[st.a].cast.has(fid) && P[st.b].cast.has(fid);
  if (!dogru){
    Ses.yanlis();
    S.deneme++;
    durumCiz(); kaydet();
    if (S.deneme >= DENEME_HAK) return bitir("koptu");
    const kim = st.tip === "pair" ? "İkisi birden bu filmde yok" :
      st.tip === "dir" ? `${P[st.pid].n} bu filmi çekmedi` : `${P[st.pid].n} bu filmde yok`;
    return mesaj(`${kim}. Kalan deneme: ${DENEME_HAK - S.deneme}`);
  }
  Ses.dogru();
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
      makara(adaylar, y, "yeniden çekiliyor", () => soloSahne(y, st.rol || "yan oyuncu", st.kaynak, true));
      mesaj(`yeniden çekildi, ${P[st.pid].n} gitti, kadrodan yeni biri geliyor.`, true);
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
      makara(adaylar, y, "yeniden çekiliyor", () => soloSahne(y, "yan oyuncu", st.kaynak, true));
      mesaj(`yeniden çekildi, yönetmen ${P[st.pid].n} gitti, yerine kadrodan biri geliyor.`, true);
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
      makara(adaylar, es, "yeniden çekiliyor", () => partnerSahne(st.a, null, true));
      mesaj(`yeniden çekildi, ${P[eski].n} gitti, yeni partner geliyor.`, true);
      ok = true;
    }
  }
  if (!ok) mesaj("Yeniden çekilemedi, çekilecek başka kimse yok.");
};

// ---- bitiş / paylaşım ------------------------------------------------------
function afisHTML(fid){
  const [t, y, , , poster] = FILMS[fid];
  return `<div class="afis">${poster
    ? `<img src="${AFIS_IMG}${poster}" alt="" loading="lazy">`
    : `<div class="bos">🎬</div>`}<div class="ft">${t}<br>${y}</div></div>`;
}
function bitir(neden, not){
  S.bitti = neden;
  kaydet();
  clearTimeout(makaraZamanlayici); donuyor = false;
  if (neden === "koptu") Ses.koptu(); else if (neden === "altin") Ses.altin();
  girisGoster(false); $("pes").style.display = "none"; pasEl.style.display = "none";
  onerEl.style.display = "none"; hakEl.style.display = "none";
  kartEl.replaceChildren(); baslik("", "", ""); kaynakYaz(""); mesaj("");
  const s = $("sonEkran");
  s.style.display = "block";
  $("sonBaslik").textContent = neden === "altin" ? "altın bitiş" :
    neden === "pes" ? "bıraktın" : "zincir koptu";
  $("sonSayi").textContent = `${S.halka} halka`;
  $("sonEmoji").textContent = paylasimSatiri();
  let baslikYazi = not || "";
  let afisler = [];
  const gosterilebilir = st => st && (st.tip === "solo" || st.tip === "dir" || st.tip === "pair");
  if (neden !== "altin" && gosterilebilir(S.stage) && !not){
    let cevaplar = [];
    const st = S.stage;
    if (st.tip === "solo") cevaplar = oynanabilirF(st.pid);
    else if (st.tip === "dir") cevaplar = yonetilebilirF(st.pid);
    else if (st.tip === "pair") cevaplar = ortakFilmler(st.a, st.b);
    cevaplar.sort((a,b)=>FILMS[b][2]-FILMS[a][2]);
    const kimdi = st.tip === "pair" ? `${P[st.a].n} + ${P[st.b].n}` :
      st.tip === "dir" ? `yönetmen ${P[st.pid].n}` : P[st.pid].n;
    baslikYazi = `${kimdi} için olabilirdi:`;
    afisler = cevaplar.slice(0,4);
  }
  $("cevapBaslik").textContent = baslikYazi;
  $("cevapAfisler").innerHTML = afisler.map(afisHTML).join("");
  $("paylas").style.display = pratik ? "none" : "";
  seritCiz();
}
function paylasimSatiri(){
  const uc = S.bitti === "altin" ? "⭐" : S.bitti === "pes" ? "🏳️" : "🟥";
  return S.emoji.join("") + uc;
}
$("paylas").onclick = () => {
  const txt = `🎞️ Film Şeridi #${gunNo} · ${S.halka} halka\n${paylasimSatiri()}\nverandatools.com/zincir`;
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
  else if (st.tip === "bonus") bonusSahne(true);
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
