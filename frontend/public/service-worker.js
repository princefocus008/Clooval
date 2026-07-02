// Service Worker for Clooval PWA and push notifications
// This file is registered at the root scope to enable installability

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push notification received but has no data');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.id || 'notification',
      requireInteraction: true,
      data: {
        url: data.url || '/',
        requestId: data.requestId,
        notificationId: data.id,
      },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Clooval Notification', options)
    );
  } catch (error) {
    console.error('Error handling push notification:', error);
    event.waitUntil(
      self.registration.showNotification('Clooval Notification', {
        body: event.data.text ? event.data.text() : 'New notification',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'notification',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const requestId = event.notification.data?.requestId;
  const targetUrl = requestId ? `/request/${requestId}` : url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});
