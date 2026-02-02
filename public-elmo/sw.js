// Elmo Service Worker 캐시 버전 (캐시 무효화 필요 시에만 변경)
const VERSION = '2026-02-02-manifest-only';
const CACHE_NAME = `elmo-${VERSION}`;
const RUNTIME_CACHE = `elmo-runtime-${VERSION}`;

// 캐싱할 정적 파일 목록
const STATIC_CACHE_URLS = [
  '/elmo/',
  '/elmo/index.html',
  '/elmo/css/elmo.css',
  '/elmo/js/elmo-main.js',
  '/elmo/manifest.json'
];

// 설치 이벤트: 정적 파일 캐싱
self.addEventListener('install', (event) => {
  console.log('[Elmo SW] 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Elmo SW] 정적 파일 캐싱 중...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('[Elmo SW] 설치 완료 - 활성화 대기 중');
        // skipWaiting() 제거 - 사용자가 "업데이트" 버튼을 클릭할 때까지 대기
      })
      .catch((error) => {
        console.error('[Elmo SW] 설치 오류:', error);
      })
  );
});

// 활성화 이벤트: 이전 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('[Elmo SW] 활성화 중...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log('[Elmo SW] 이전 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Elmo SW] 활성화 완료');
        return self.clients.claim(); // 즉시 제어권 획득
      })
  );
});

// fetch 이벤트: 네트워크 우선, 캐시 폴백
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
  
    // /elmo 경로가 아닌 요청은 처리하지 않음
    if (!url.pathname.startsWith('/elmo/')) {
        return;
    }
  
    // API 요청은 네트워크만 사용
    if (url.pathname.startsWith('/api/elmo/')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return new Response(JSON.stringify({ error: '네트워크 오류' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }
  
    // HTML 파일은 항상 네트워크에서 가져오기 (캐시 무시)
    if (event.request.mode === 'navigate' || url.pathname === '/elmo/' || url.pathname === '/elmo/index.html') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // 네트워크에서 가져온 HTML을 캐시에 저장 (다음번에는 사용)
                    const responseToCache = response.clone();
                    caches.open(RUNTIME_CACHE)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    return response;
                })
                .catch(() => {
                    // 네트워크 실패 시에만 캐시 사용
                    return caches.match(event.request)
                        .then((cachedResponse) => {
                            return cachedResponse || caches.match('/elmo/index.html');
                        });
                })
        );
        return;
    }
  
    // 정적 파일: 캐시 우선, 네트워크 폴백
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
        
                return fetch(event.request)
                    .then((response) => {
                        // 유효한 응답만 캐시
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
            
                        const responseToCache = response.clone();
            
                        caches.open(RUNTIME_CACHE)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
            
                        return response;
                    })
                    .catch(() => {
                        // 오프라인 시 기본 페이지 반환
                        if (event.request.mode === 'navigate') {
                            return caches.match('/elmo/index.html');
                        }
                    });
            })
    );
});

// 메시지 이벤트: 클라이언트와 통신
self.addEventListener('message', (event) => {
  // 새 버전 즉시 활성화 요청
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Elmo SW] SKIP_WAITING 요청 받음 - 즉시 활성화');
    self.skipWaiting();
  }
});
