/* Kervansaray · kabuk service worker (yalnız /kervansaray/ kapsamı)
   Oyun iframe'leri kapsam dışıdır; oyun deploy'ları cache'e takılmaz. */
var SURUM = 'kervansaray-v1';
var KABUK = ['./', 'stil.css?v=1', 'motor.js?v=1', 'rota.js?v=1', 'icon.svg', 'manifest.json'];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(SURUM).then(function(c){ return c.addAll(KABUK); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k!==SURUM; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  if(e.request.method!=='GET') return;
  var kapsam = self.registration.scope;
  if(e.request.url.indexOf(kapsam)!==0) return;   /* kabuk dışına karışma */
  if(e.request.mode==='navigate'){
    /* sayfanın kendisi ağ öncelikli: deploy'lar cache'e takılmasın */
    e.respondWith(fetch(e.request).then(function(r){
      if(r && r.ok){ var kopya=r.clone(); caches.open(SURUM).then(function(cc){ cc.put(e.request,kopya); }); }
      return r;
    }).catch(function(){ return caches.match(e.request); }));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(c){
      if(c) return c;
      return fetch(e.request).then(function(r){
        if(r && r.ok){ var kopya=r.clone(); caches.open(SURUM).then(function(cc){ cc.put(e.request,kopya); }); }
        return r;
      });
    })
  );
});
