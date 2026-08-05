/**
 * Registro do service worker do Vintel IA.
 *
 * Este é o ÚNICO ponto de registro. Nunca registra em desenvolvimento,
 * dentro de iframe ou nos previews da Lovable — nesses casos remove
 * registros antigos para não servir HTML/chunks obsoletos.
 * `?sw=off` funciona como kill switch.
 */
const SW_URL = '/sw.js';

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === 'undefined') return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const { hostname, search } = window.location;
  if (new URLSearchParams(search).get('sw') === 'off') return true;
  if (hostname.startsWith('id-preview--') || hostname.startsWith('preview--')) return true;
  const blockedHosts = ['lovableproject.com', 'lovableproject-dev.com', 'beta.lovable.dev'];
  return blockedHosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

async function unregisterAppWorker() {
  if (!('serviceWorker' in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.allSettled(
    registrations
      .filter((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || '';
        return url.endsWith(SW_URL);
      })
      .map((r) => r.unregister()),
  );
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (isBlockedContext()) {
    void unregisterAppWorker();
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL, { scope: '/' }).catch(() => {
      /* falha de registro não deve quebrar o app */
    });
  });
}
