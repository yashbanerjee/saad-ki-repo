/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("taskflow-fcm", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadConfig() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const get = tx.objectStore("kv").get("config");
    get.onsuccess = () => resolve(get.result);
    get.onerror = () => reject(get.error);
  });
}

function initFirebase(config) {
  if (!config || !config.apiKey || !config.projectId || !config.appId) return;
  if (!self.firebase.apps.length) {
    self.firebase.initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
  }
  self.firebase.messaging();
}

loadConfig()
  .then(initFirebase)
  .catch(() => undefined);

self.addEventListener("message", (event) => {
  if (event.data?.type === "INIT_FIREBASE" && event.data.config) {
    initFirebase(event.data.config);
  }
});
