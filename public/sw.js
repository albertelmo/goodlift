// Service Worker 버전
const CACHE_NAME = 'goodlift-v1';
const RUNTIME_CACHE = 'goodlift-runtime-v1';

// 캐싱할 정적 파일 목록
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/adminDayCalendar.css',
  '/css/adminWeekCalendar.css',
  '/img/logo.png',
  '/js/main.js',
  '/manifest.json'
];

// 설치 이벤트: 정적 파일 캐싱
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 정적 파일 캐싱 중...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('[Service Worker] 설치 완료');
        return self.skipWaiting(); // 즉시 활성화
      })
      .catch((error) => {
        console.error('[Service Worker] 캐싱 실패:', error);
      })
  );
});

// 활성화 이벤트: 오래된 캐시 삭제
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 활성화 중...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // 현재 캐시가 아니면 삭제
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[Service Worker] 오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
    .then(() => {
      console.log('[Service Worker] 활성화 완료');
      return self.clients.claim(); // 모든 클라이언트 제어
    })
  );
});

// fetch 이벤트: 네트워크 우선, 실패 시 캐시에서 제공
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청은 네트워크만 사용 (캐싱하지 않음)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // 네트워크 실패 시 오프라인 메시지
          return new Response(
            JSON.stringify({ error: '오프라인 상태입니다. 네트워크 연결을 확인해주세요.' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // 정적 파일: 네트워크 우선, 실패 시 캐시
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 응답이 유효하고, 지원되는 스킴인 경우에만 캐시에 저장 (동적 캐싱)
        // chrome-extension, chrome 등의 스킴은 캐시하지 않음
        if (response && response.status === 200) {
          const url = new URL(request.url);
          // http/https 스킴만 캐시
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
        }
        return response;
      })
      .catch(() => {
        // 네트워크 실패 시 캐시에서 찾기
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 캐시에도 없으면 index.html 반환 (SPA 라우팅 대응)
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// 메시지 이벤트: 클라이언트와 통신
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// 알림 클릭 이벤트: 알림을 클릭하면 앱 열기
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] 알림 클릭됨:', event.notification.tag);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열려있는 창이 있으면 포커스
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // 열려있는 창이 없으면 새로 열기
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});