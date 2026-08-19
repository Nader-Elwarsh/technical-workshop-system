const CACHE="twms-v5-release";
const SHELL=[
"./","index.html","app-core.js","twms-ui.js","manifest.json",
"customers.html","devices.html","requests.html","record.html","invoices.html","payments.html",
"inventory.html","purchase-orders.html","loyalty.html","routes.html","contracts.html",
"customer-portal.html","notifications.html","reports.html","settings.html","audit-log.html",
"data-repair.html","core-test.html","technicians.html","visits.html","suppliers.html",
"warranties.html","technical-library.html","users.html"
];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
  const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r;
 }).catch(()=>caches.match("index.html"))));
});
