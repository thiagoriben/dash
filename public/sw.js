// Service worker do Dash (PWA).
// Mantém o app instalável e exibe as notificações agendadas de tarefas.

const CACHE = "dash-v1"

self.addEventListener("install", (event) => {
  // Ativa imediatamente a nova versão.
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Limpa caches antigos.
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

// Estratégia network-first simples: tenta a rede, cai pro cache quando offline.
// Ignora requisições não-GET e chamadas de API/auth (dinâmicas).
self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request)
        const cache = await caches.open(CACHE)
        cache.put(request, fresh.clone())
        return fresh
      } catch {
        const cached = await caches.match(request)
        if (cached) return cached
        // Fallback pra navegação: devolve a home cacheada, se houver.
        if (request.mode === "navigate") {
          const home = await caches.match("/")
          if (home) return home
        }
        throw new Error("offline")
      }
    })(),
  )
})

// Mensagem vinda da página para disparar uma notificação (lembrete de tarefa).
self.addEventListener("message", (event) => {
  const data = event.data
  if (!data || data.type !== "notify") return
  const { title, body, tag } = data
  self.registration.showNotification(title || "Lembrete", {
    body: body || "",
    tag: tag || undefined,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [80, 40, 80],
    data: { url: data.url || "/organizacao/tarefas" },
  })
})

// Clique na notificação abre/foca o app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || "/organizacao/tarefas"
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of all) {
        if ("focus" in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })(),
  )
})
