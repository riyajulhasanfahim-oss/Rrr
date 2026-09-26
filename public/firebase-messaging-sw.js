// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Default setup based on what gets passed from index.html or hardcoded
// We can hardcode the sender ID if we know it, or pull it dynamically.
// To avoid hardcoding all config, Firebase can auto-init if config is injected, 
// but usually we must provide at least projectId and messagingSenderId.
// For security as requested, we shouldn't put secrets, but these are public identifiers.

firebase.initializeApp({
  apiKey: "AIzaSyDQLuvLjcIwkOYBgN6V80gT1Lk3q-KmNoY",
  authDomain: "rjworldbdcom.firebaseapp.com",
  databaseURL: "https://rjworldbdcom-default-rtdb.firebaseio.com",
  projectId: "rjworldbdcom",
  storageBucket: "rjworldbdcom.firebasestorage.app",
  messagingSenderId: "743174693139",
  appId: "1:743174693139:web:47bae77e08dd3880b57ae6",
  measurementId: "G-0E1W86N8WZ"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'RJ WORLD BD Notification';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/vite.svg', // Update icon path
    image: payload.notification?.image || payload.notification?.imageUrl,
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const targetUrl = event.notification.data?.route === 'product' && event.notification.data?.productId
    ? '/product/' + event.notification.data.productId
    : '/';
    
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab with the target URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
