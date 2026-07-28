const CACHE_NAME = 'reja-cache-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './icon/icon-192.png',
  './icon/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // admin.html va uning JS fayli hech qachon keshlanmaydi (har doim tarmoqdan olinadi)
  if (event.request.url.includes('admin.html') || event.request.url.includes('js/admin.js')) return;

  // js/common.js va js/app.js uchun: TARMOQ-BIRINCHI strategiya.
  // ESLATMA: avvalgi versiyada bu fayllar "kesh-birinchi" edi — bu esa
  // GitHub/Vercel'da fayl yangilansa ham, foydalanuvchi brauzerida ESKI
  // nusxa ko'rsatilib turishiga sabab bo'lardi (ikkinchi marta yangilashda
  // ham ba'zan eski holicha qolib ketardi). Endi bu ikki fayl har doim
  // avval tarmoqdan (internetdan) so'raladi — faqat internet yo'q bo'lsa,
  // keshdagi (oxirgi muvaffaqiyatli yuklangan) nusxa ishlatiladi.
  if (event.request.url.includes('js/common.js') || event.request.url.includes('js/app.js')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Qolgan fayllar (CSS, ikonlar va h.k.) uchun avvalgidek: kesh-birinchi,
  // orqa fonda yangilanadi (o'zgarishlar kamdan-kam, tezlik muhimroq).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
