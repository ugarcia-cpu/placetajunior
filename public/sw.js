/* ═══════════════════════════════════════════════════════════════════
   PLACETA JUNIOR — Service Worker (modo offline, como la app)
   Cachea únicamente recursos estáticos pesados (JS, CSS, fuentes, imágenes
   y sonidos). Las páginas HTML, la configuración y la API siempre se piden
   a red para que los despliegues se vean inmediatamente.
   ═══════════════════════════════════════════════════════════════════ */
// Versionar la caché fuerza la actualización del reproductor y estilos en
// dispositivos que ya visitaron la web.
const CACHE = 'placetajunior-assets-v5';

const ASSETS = [
  '/css/styles.css',
  '/css/home.css',
  '/css/leaflet.css',
  '/js/app.js',
  '/js/player.js',
  '/js/sonidos.js',
  '/js/avisos.js',
  '/js/accesibilidad.js',
  '/js/mapa-mundi.js',
  '/js/progreso.js',
  '/js/topojson-client.min.js',
  '/js/colecciones.js',
  '/js/modalidades.js',
  '/css/colecciones.css',
  '/js/leaflet.js',
  '/fonts/handly_casual.ttf',
  '/fonts/plus_jakarta_regular.woff2',
  '/fonts/plus_jakarta_bold.woff2',
  '/data/countries-110m.json',
  '/img/logo.png',
  '/img/PJ-BLANCO-LOGO.png',
  '/img/PJ-COLOR-LOGO.png',
  '/img/forma.svg',
  '/favijunior.png',
  '/sounds/clic.wav',
  '/sounds/pop.wav',
  '/sounds/abrir.wav',
  '/sounds/exito.wav',
  '/sounds/error.wav',
  '/sounds/victoria.wav',
  '/sounds/letra.wav',
  '/sounds/hoja.wav',
  '/css/images/layers.png',
  '/css/images/layers-2x.png',
  '/css/images/marker-icon.png',
  '/css/images/marker-icon-2x.png',
  '/css/images/marker-shadow.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Las APIs se dejan pasar directamente al navegador. En especial, las
  // peticiones cross-origin no deben quedar envueltas por el SW: un fallo de
  // red o CORS dentro de respondWith() se convierte en un error del worker.
  if (url.origin !== self.location.origin || url.pathname.indexOf('/api/') === 0) return;

  // HTML siempre desde red: los cambios de la web no esperan a una caché.
  if (url.origin === self.location.origin && req.mode === 'navigate') {
    e.respondWith(fetch(req));
    return;
  }

  const esAsset = url.origin === self.location.origin && url.pathname !== '/sw.js' &&
    /\.(css|js|woff2?|ttf|png|jpe?g|svg|webp|gif|wav|mp3|json)$/i.test(url.pathname);
  const esCDNAsset = /fonts\.googleapis|fonts\.gstatic|unpkg|jsdelivr/.test(url.hostname) ||
    /picsum\.photos|images\.unsplash\.com/.test(url.hostname);

  // Recursos estáticos: red primero para refrescar cambios rápidamente,
  // usando la versión guardada solo si no hay conexión.
  if (esAsset || esCDNAsset) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req);
      })
    );
  }
});
