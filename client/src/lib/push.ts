/** Browser side of Web Push: permission, subscription, and syncing preferences to the server. */
import { api } from "./api";
import { isStandalone, isIOS } from "./install";

export interface NotifPrefs {
  spotters: boolean; coach: boolean;
  checkin: boolean; checkinHour: number;
  meals: boolean;
  streak: boolean; streakHour: number;
}
export const DEFAULT_PREFS: NotifPrefs = { spotters: true, coach: true, checkin: true, checkinHour: 8, meals: true, streak: true, streakHour: 18 };

export type PushSupport = "ok" | "no-sw" | "no-push" | "ios-not-installed" | "insecure";

/** Why push may not work here, in priority order. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "no-sw";
  if (!window.isSecureContext) return "insecure";
  if (!("serviceWorker" in navigator)) return "no-sw";
  if (isIOS() && !isStandalone()) return "ios-not-installed"; // iPhone only delivers push to home-screen apps
  if (!("PushManager" in window) || !("Notification" in window)) return "no-push";
  return "ok";
}

export function permissionState(): NotificationPermission | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function b64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  return navigator.serviceWorker.register("./sw.js");
}

/** Current subscription on this device, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  try { const reg = await registration(); return await reg.pushManager.getSubscription(); } catch { return null; }
}

/** Ask permission (must be called from a tap), subscribe, and register the device with the server. */
export async function enablePush(prefs: NotifPrefs): Promise<{ ok: true } | { ok: false; reason: string }> {
  const sup = pushSupport();
  if (sup !== "ok") return { ok: false, reason: sup };
  const cfg = await api<{ enabled: boolean; publicKey: string }>("GET", "/api/push/config");
  if (!cfg.enabled || !cfg.publicKey) return { ok: false, reason: "server" };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: perm === "denied" ? "denied" : "dismissed" };
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.publicKey) as BufferSource });
  await api("POST", "/api/push/subscribe", { subscription: sub.toJSON(), prefs });
  return { ok: true };
}

/**
 * If this device subscribed with an older server key (the server's push keys were replaced),
 * quietly subscribe again with the current key and keep the same notification settings.
 * Only runs when permission is already granted, so it never shows a prompt.
 */
export async function refreshPushKey(): Promise<boolean> {
  if (pushSupport() !== "ok" || permissionState() !== "granted") return false;
  const sub = await currentSubscription();
  const have = sub?.options?.applicationServerKey;
  if (!sub || !have) return false;
  const cfg = await api<{ enabled: boolean; publicKey: string }>("GET", "/api/push/config").catch(() => null);
  if (!cfg?.enabled || !cfg.publicKey) return false;
  const want = b64ToBytes(cfg.publicKey);
  const h = new Uint8Array(have);
  if (h.length === want.length && h.every((b, i) => b === want[i])) return false;
  const mine = await api<{ prefs: NotifPrefs | null }>("GET", "/api/push/subscriptions").catch(() => null);
  const oldEndpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch { /* already gone */ }
  const reg = await registration();
  const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want as BufferSource });
  await api("DELETE", "/api/push/subscribe", { endpoint: oldEndpoint }).catch(() => undefined);
  await api("POST", "/api/push/subscribe", { subscription: fresh.toJSON(), prefs: mine?.prefs ?? DEFAULT_PREFS });
  return true;
}

/** Unsubscribe this device and forget it on the server. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  const endpoint = sub?.endpoint;
  try { await sub?.unsubscribe(); } catch { /* already gone */ }
  if (endpoint) await api("DELETE", "/api/push/subscribe", { endpoint }).catch(() => undefined);
}

export async function savePrefs(prefs: NotifPrefs): Promise<void> {
  await api("PUT", "/api/push/prefs", { prefs });
}

export async function sendTest(): Promise<number> {
  const r = await api<{ sent: number }>("POST", "/api/push/test");
  return r.sent;
}

/** Deep links from notifications: /?go=train&sub=program&open=checkin */
export function readDeepLink(url: string = window.location.href): { go?: string; sub?: string; open?: string; client?: string; coach?: string } | null {
  try {
    const u = new URL(url, window.location.origin);
    const go = u.searchParams.get("go");
    if (!go) return null;
    return { go, sub: u.searchParams.get("sub") ?? undefined, open: u.searchParams.get("open") ?? undefined, client: u.searchParams.get("client") ?? undefined, coach: u.searchParams.get("coach") ?? undefined };
  } catch { return null; }
}
export function clearDeepLink() {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has("go")) return;
    ["go", "sub", "open"].forEach((k) => u.searchParams.delete(k));
    window.history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch { /* ignore */ }
}
