/**
 * TV_Abdul: development-only log forwarding.
 * Active only when the app is built with VITE_DEBUG_HOST set (see scripts/dev/tv-log-server.js).
 * It only sends console output out; it never receives or runs anything.
 */

const host = import.meta.env && import.meta.env.VITE_DEBUG_HOST;

export const isDebugBuild = Boolean(host);

function stringify(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}

export function startDebugBridge() {
  if (!host || typeof window === 'undefined') return;
  const send = (line) => {
    fetch(`http://${host}:9333/log`, { method: 'POST', body: line }).catch(() => {});
  };

  ['log', 'warn', 'error'].forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      send(`[${level}] ${args.map(stringify).join(' ')}`);
    };
  });
  window.addEventListener('error', (e) => send(`[uncaught] ${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) =>
    send(`[rejection] ${stringify(e.reason && (e.reason.message || e.reason))}`)
  );
  console.log('[debug] log forwarding active', navigator.userAgent);
}
