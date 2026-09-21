/**
 * App-shell service worker for the static export.
 *
 * PRECACHE and VERSION are injected by scripts/generate-sw.mjs after `next build`,
 * from the real contents of out/. Hand-listing them would go stale the moment a chunk
 * hash changed, and a shell that is missing one chunk is a shell that does not open.
 *
 * Lesson and progress data are not cached here: they live in IndexedDB, which is
 * already offline. This worker only has to make sure the app that reads them loads.
 */
const VERSION = "__VERSION__";
const CACHE = `engthai-shell-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // One at a time rather than addAll: a single 404 must not throw away the
      // other two hundred files and leave the app with no shell at all.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            /* A file that will not precache is still fetchable while online. */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("engthai-shell-") && n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Static export: /lessons/ is a directory index, so that is the document to look for. */
function documentUrl(url) {
  const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return new URL(path, url.origin).toString();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(request);
          // Only a real page is worth keeping; an error page is not the shell.
          if (fresh.ok) cache.put(documentUrl(url), fresh.clone());
          return fresh;
        } catch {
          const hit = await cache.match(documentUrl(url));
          if (hit) return hit;

          // Falling back to the dashboard here would answer "200, here is a page" for
          // a URL that does not exist. A wrong page that claims to be the right one is
          // worse offline than online, because there is nothing to correct it.
          const notFound = await cache.match("/404.html");
          if (notFound) {
            return new Response(await notFound.blob(), { status: 404, headers: notFound.headers });
          }
          return new Response("<h1>Offline</h1><p>This page has not been downloaded yet.</p>", {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  // Build output is content-hashed, so a cache hit can never be the wrong version.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // ignoreVary: precached entries were fetched without the RSC headers that Next
      // adds to client-side navigation requests, and a Vary miss on those would drop
      // the app back to a full page load for every link while offline.
      const hit = await cache.match(request, { ignoreVary: true });
      if (hit) return hit;
      const fresh = await fetch(request);
      if (fresh.ok && fresh.type === "basic") cache.put(request, fresh.clone());
      return fresh;
    })(),
  );
});
