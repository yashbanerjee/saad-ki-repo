"use client";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

const DB_NAME = "taskflow-fcm";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFirebaseConfig(config: FirebaseWebConfig) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(config, "config");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function enableBrowserPush(config: FirebaseWebConfig): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return null;
  }

  const { initializeApp, getApps } = await import("firebase/app");
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return null;

  await saveFirebaseConfig(config);
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: "INIT_FIREBASE", config });

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const app =
    getApps()[0] ||
    initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });

  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: config.vapidKey,
    serviceWorkerRegistration: registration,
  });
  return token || null;
}

export async function listenForForegroundPush(
  config: FirebaseWebConfig,
  onMessage: (payload: { title?: string; body?: string }) => void,
) {
  if (typeof window === "undefined") return () => undefined;
  const { initializeApp, getApps } = await import("firebase/app");
  const { getMessaging, onMessage: bind, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return () => undefined;

  const app =
    getApps()[0] ||
    initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });

  return bind(getMessaging(app), (payload) => {
    onMessage({
      title: payload.notification?.title,
      body: payload.notification?.body,
    });
  });
}
