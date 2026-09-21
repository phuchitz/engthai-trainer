"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell worker that `npm run build` writes to out/sw.js.
 *
 * Nothing is registered in development: the worker caches aggressively on purpose, and
 * a hot-reloading dev server is exactly the thing that should not be cached. A worker
 * left behind by a production build on the same origin is unregistered instead, so
 * localhost does not keep serving yesterday's bundle.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
      return;
    }

    // After load, so registering never competes with the first paint.
    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* No offline support then; every feature still works online. */
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
