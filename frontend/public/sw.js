// Service Worker for handling push notifications
// This allows notifications even when the app is closed

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push notification received but has no data');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
    body: data.body || 'New notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
      tag: data.id || 'notification',
      requireInteraction: true, // Keeps notification visible until user interacts
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
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'notification',
      })
    );
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data?.url || '/';
  const requestId = event.notification.data?.requestId;
  
  // Navigate to the notification or request details
  const targetUrl = requestId ? `/request/${requestId}` : url;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open
      for (let client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});
