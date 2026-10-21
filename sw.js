const C='gratitude-diary-v46-photos-replies';
const A=['./','./index.html','./style.css?v=46','./app.js?v=46','./bgm.wav','./magic.wav','./header.png','./h-avatar.png','./j-avatar.png','./apple-touch-icon.png','./manifest.webmanifest'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(A)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))])));
self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'||e.request.url.includes('app.js')||e.request.url.includes('style.css')){e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(C).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request)))}else{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))}});
