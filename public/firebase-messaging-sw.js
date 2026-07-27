importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAMpknTt4Dpv76kYf_xjOiuETf2VvC5efw",
  authDomain: "tiendameowth.firebaseapp.com",
  projectId: "tiendameowth",
  storageBucket: "tiendameowth.firebasestorage.app",
  messagingSenderId: "81330531760",
  appId: "1:81330531760:web:610f920a48eaf6db3bba75"
});

const messaging = firebase.messaging();

// Notificación cuando la pestaña está cerrada o en segundo plano.
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const link = (payload.fcmOptions && payload.fcmOptions.link) || '/';
  self.registration.showNotification(n.title || 'La Tienda de Meowth', {
    body: n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: link }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.openWindow(url));
});
