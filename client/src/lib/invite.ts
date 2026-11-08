const KEY = "corpus.pendingInvite";
const mem: { code: string | null } = { code: null };

/** Call once at startup: turns #/join/CODE into a remembered invite and cleans the URL. */
export function captureInvite(): boolean {
  const m = location.hash.match(/^#\/join\/([A-Za-z0-9]{6})\b/);
  if (!m) return false;
  const code = m[1].toUpperCase();
  mem.code = code;
  try { localStorage.setItem(KEY, code); } catch { /* private mode */ }
  history.replaceState(null, "", `${location.pathname}${location.search}#/`);
  return true;
}
/** Also catch invite links opened while the app is already running. */
export function watchInvites(onNew: () => void) {
  const h = () => { if (captureInvite()) onNew(); };
  window.addEventListener("hashchange", h);
  return () => window.removeEventListener("hashchange", h);
}
export function pendingInvite(): string | null {
  if (mem.code) return mem.code;
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function clearInvite() {
  mem.code = null;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
/** Public base URL for links (always the published address when running there). */
export function appBase() {
  if (/\.pplx\.app$/.test(location.hostname)) return `${location.origin}/`;
  return `${location.origin}${location.pathname}`;
}
export const inviteLink = (code: string) => `${appBase()}#/join/${code}`;
