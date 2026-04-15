// Bump esta versão a cada deploy para forçar limpeza do cache antigo
const CACHE_NAME = 'booking-control-v3';

self.addEventListener('install', (event) => {
  // Ativa imediatamente, sem esperar abas antigas fecharem
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Apaga caches antigos
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      ),
      // Toma controle das abas abertas imediatamente
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Apenas GET é cacheável
  if (req.method !== 'GET') return;

  // NUNCA intercepta chamadas para o Supabase (banco e realtime)
  const url = new URL(req.url);
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in') ||
    req.headers.get('upgrade') === 'websocket'
  ) {
    return; // deixa o browser cuidar
  }

  // NETWORK-FIRST: tenta a rede primeiro; só usa cache se estiver offline.
  // Garante que correções de código entrem em vigor no próximo carregamento.
  event.respondWith(
    fetch(req)
      .then((response) => {
        // Salva no cache para fallback offline
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => caches.match(req))
  );
});
