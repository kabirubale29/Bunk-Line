const CACHE_NAME = 'bunkline-cache-v6';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
];

// Helper: Read key from BunkLine IndexedDB
function getFromIDB(key) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('BunkLine');
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('offline_store')) return resolve(null);
        const tx = db.transaction('offline_store', 'readonly');
        const store = tx.objectStore('offline_store');
        const getReq = store.get(key);
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => resolve(null);
      };
    } catch (e) {
      resolve(null);
    }
  });
}

// Helper: Save key to BunkLine IndexedDB
function setToIDB(key, value) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('BunkLine');
      req.onerror = () => resolve(false);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('offline_store')) return resolve(false);
        const tx = db.transaction('offline_store', 'readwrite');
        const store = tx.objectStore('offline_store');
        const putReq = store.put(value, key);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => resolve(false);
      };
    } catch (e) {
      resolve(false);
    }
  });
}

// Install service worker and cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static shell assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Failed to cache assets during install. SW will run but some assets may not work offline yet.', err);
      });
    })
  );
});

// Message listener to trigger SKIP_WAITING when user taps Update Toast
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch cache first, fallback to network for static files
self.addEventListener('fetch', (event) => {
  // Bypass caching for Supabase API calls or auth requests
  if (
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('/api/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version immediately
        // Fetch new version in background to update cache (Stale-While-Revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {/* ignore background fetch errors when offline */});
        return cachedResponse;
      }

      // Fallback to network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

// Interactive Notification Click / Action Handler (Lock-Screen Quick Mark)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};
  const { slot, subject, date, termId, userId } = data;

  if (action === 'present' || action === 'absent') {
    event.waitUntil(
      (async () => {
        const slotId = slot?.isExtra ? null : (slot?.override_id ? slot?.original_slot_id : slot?.id);
        const overrideId = slot?.override_id || null;
        const subjectId = slot?.subject_id || subject?.id;

        const newRecord = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
          term_id: termId,
          user_id: userId,
          date: date,
          slot_id: slotId,
          override_id: overrideId,
          subject_id: subjectId,
          status: action,
          marked_at: new Date().toISOString(),
          edited: false
        };

        // 1. Update IndexedDB records
        const records = (await getFromIDB('attendance_records')) || [];
        const existingIdx = records.findIndex(r => 
          r.date === date && 
          (overrideId ? (r.override_id === overrideId || (slotId && r.slot_id === slotId)) : (slotId && r.slot_id === slotId))
        );

        if (existingIdx !== -1) {
          newRecord.id = records[existingIdx].id;
          records[existingIdx] = { ...records[existingIdx], ...newRecord };
        } else {
          records.push(newRecord);
        }
        await setToIDB('attendance_records', records);

        // 2. Enqueue sync
        const queue = (await getFromIDB('sync_queue')) || [];
        queue.push({
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
          action: 'attendance/upsert',
          payload: newRecord,
          timestamp: Date.now()
        });
        await setToIDB('sync_queue', queue);

        // 3. Notify open client windows
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({
            type: 'NOTIFICATION_ATTENDANCE_MARKED',
            record: newRecord
          });
        }

        // 4. Show confirmation notification
        const statusEmoji = action === 'present' ? '✅' : '❌';
        const statusText = action === 'present' ? 'Present' : 'Absent';
        await self.registration.showNotification(`Marked ${statusText} ${statusEmoji}`, {
          body: `${subject?.name || 'Class'} was marked ${statusText.toLowerCase()} directly from your lock screen!`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `confirm-${Date.now()}`
        });
      })()
    );
  } else {
    // Tapped the notification body -> Focus or Open the app
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
    );
  }
});
