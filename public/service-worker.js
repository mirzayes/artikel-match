/* eslint-disable no-undef */
/**
 * PWA: yerli bildirişlər + gələcək Web Push üçün şablon.
 * Workbox `sw.js` bu faylı `importScripts('service-worker.js')` ilə yükləyir.
 *
 * Aktiv: `postMessage({ type: 'SHOW_LOCAL_NOTIF', title, body, tag?, icon?, url? })`
 * Tez aktivləşdirmə (push server əlavə edəndə): aşağıdakı `push` blokunun şərhlərini açın
 * və `self.registration.pushManager.subscribe(...)` üçün UI düyməsi əlavə edin.
 */

// ---------------------------------------------------------------------------
// Gələcək: Web Push (bir düymə ilə aktivləşdirmə üçün hazır şablon)
// ---------------------------------------------------------------------------
// self.addEventListener('push', function (event) {
//   if (!event.data) return;
//   var payload;
//   try {
//     payload = event.data.json();
//   } catch (e) {
//     payload = { title: 'Artikel Match', body: event.data.text() };
//   }
//   event.waitUntil(
//     self.registration.showNotification(payload.title || 'Artikel Match', {
//       body: payload.body || '',
//       icon: payload.icon || '/pwa-192x192.png',
//       badge: '/pwa-192x192.png',
//       tag: payload.tag || 'artikl-push',
//       data: { url: payload.url || '/' },
//     }),
//   );
// });

// ---------------------------------------------------------------------------
// Yerli bildirişlər (cari tətbiqdən `postMessage`)
// ---------------------------------------------------------------------------
self.addEventListener('message', function (event) {
  var d = event.data;
  if (!d || d.type !== 'SHOW_LOCAL_NOTIF') return;
  var title = d.title || 'Artikel Match';
  var body = d.body || '';
  var opts = {
    body: body,
    icon: d.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: d.tag || 'artikl-local',
    renotify: true,
    data: { url: typeof d.url === 'string' ? d.url : '/' },
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if (c.url && 'focus' in c) {
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
