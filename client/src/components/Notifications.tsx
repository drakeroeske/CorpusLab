import { useInstallBannerShown } from "@/components/Install";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { UI } from "@/App";
import { addDays, dateKey, dayForDate, userStreak } from "@/lib/engine";
import { DEFAULT_PREFS, clearDeepLink, currentSubscription, disablePush, enablePush, permissionState, pushSupport, readDeepLink, savePrefs, sendTest, type NotifPrefs } from "@/lib/push";

const HOURS = Array.from({ length: 24 }, (_, h) => ({ v: h, l: h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm` }));

/* ------------------------------------------------------------------ plan sync */
/** Keeps state.notifPlan current so the server can send reminders at the right local time. */
export function NotifPlanSync() {
  const { state, set, targets, mode } = useStore();
  const last = useRef("");
  useEffect(() => {
    if (mode !== "remote") return;
    const today = dateKey();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const plannedDates = Array.from({ length: 14 }, (_, i) => addDays(today, i)).filter((d) => !!dayForDate(state.program, d));
    const plan = { tz, plannedDates, proteinTarget: Math.round(targets.protein || 0), streak: userStreak(state, today) };
    const sig = JSON.stringify(plan);
    const prevSig = JSON.stringify({ tz: state.notifPlan?.tz, plannedDates: state.notifPlan?.plannedDates, proteinTarget: state.notifPlan?.proteinTarget, streak: state.notifPlan?.streak });
    if (sig === last.current || sig === prevSig) { last.current = sig; return; }
    last.current = sig;
    set((s) => ({ ...s, notifPlan: { ...plan, updatedAt: new Date().toISOString() } }));
  }, [state.program, state.sessions, targets.protein, mode, set, state]);
  return null;
}

/* ------------------------------------------------------------------ deep links */
const TAB: Record<string, UI["tab"]> = { today: "today", train: "train", body: "body", spotters: "spotters", me: "profile", profile: "profile" };
/** Opens the right screen when the app is launched from a notification (or receives one while open). */
export function useDeepLinks(ui: UI, ready: boolean) {
  const uiRef = useRef(ui); uiRef.current = ui;
  useEffect(() => {
    if (!ready) return;
    const go = (url?: string) => {
      const d = readDeepLink(url);
      if (!d) return;
      const u = uiRef.current;
      const tab = TAB[d.go ?? ""];
      if (tab) u.setTab(tab);
      if (tab === "train" && d.sub) u.setTrainSub(d.sub);
      if (d.open === "checkin") u.open("checkin");
      if (d.open === "fuel" || d.open === "nutrition") u.open("nutrition");
      if (!url) clearDeepLink();
    };
    go();
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "rxs:open") go(e.data.url); };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, [ready]);
}

/* ------------------------------------------------------------------ settings card */
function usePushStatus() {
  const [sub, setSub] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { let on = true; currentSubscription().then((s) => on && setSub(!!s)); return () => { on = false; }; }, [tick]);
  return { subscribed: sub, perm: permissionState(), support: pushSupport(), refresh: () => setTick((n) => n + 1) };
}

const SUPPORT_TEXT: Record<string, string> = {
  "ios-not-installed": "On iPhone, notifications only work once RXS is on your home screen. Add it (see above), open it from there, and come back here.",
  "no-push": "This browser can't receive push notifications. Chrome, Edge, Firefox, and Safari 16.4+ do.",
  "no-sw": "This browser can't run the background worker notifications need.",
  insecure: "Notifications need a secure (https) connection.",
  server: "Notifications aren't set up on this server yet.",
};

export function NotificationsCard() {
  const { state, set } = useStore();
  const auth = useAuth();
  const st = usePushStatus();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const prefs: NotifPrefs = { ...DEFAULT_PREFS, ...(state.notifPrefs ?? {}) };
  const demo = !!auth.me?.isDemo;
  const on = st.subscribed === true && st.perm === "granted";

  const setPrefs = async (patch: Partial<NotifPrefs>) => {
    const next = { ...prefs, ...patch };
    set((s) => ({ ...s, notifPrefs: next }));
    if (on) { try { await savePrefs(next); } catch (e) { setMsg((e as Error).message); } }
  };
  const turnOn = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await enablePush(prefs);
      if (r.ok) { setMsg("On. We sent a test so you can see where they land."); try { await sendTest(); } catch { /* ignore */ } }
      else setMsg(r.reason === "denied" ? "Notifications are blocked for RXS in your browser settings. Allow them there, then try again." : r.reason === "dismissed" ? "No permission given. Tap again when you're ready." : SUPPORT_TEXT[r.reason] ?? "Couldn't turn notifications on.");
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false); st.refresh();
  };
  const turnOff = async () => { setBusy(true); try { await disablePush(); setMsg("Off on this device."); } catch (e) { setMsg((e as Error).message); } setBusy(false); st.refresh(); };

  return (
    <div className="card stack" data-testid="card-notifications">
      <div className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
        <span className="flex items-center gap-2">{on ? <Bell size={18} className="lime" /> : <BellOff size={18} className="muted" />}<span><span className="text-sm font-semibold block">Notifications on this device</span><span className="text-xs muted">{on ? "Spotter activity, coach changes, and reminders" : "Off"}</span></span></span>
        {demo ? <span className="chip">Sample</span> : on
          ? <button className="btn btn-sm" onClick={turnOff} disabled={busy} data-testid="button-push-off">Turn off</button>
          : <button className="btn btn-sm btn-primary" onClick={turnOn} disabled={busy || st.support !== "ok"} data-testid="button-push-on">Turn on</button>}
      </div>
      {demo && <p className="text-xs muted">Sample accounts can't receive notifications. Create your own account to try them.</p>}
      {!demo && st.support !== "ok" && <p className="text-xs muted" data-testid="text-push-support">{SUPPORT_TEXT[st.support]}</p>}
      {msg && <p className="text-xs" data-testid="text-push-msg">{msg}</p>}

      <div className="stack" style={{ gap: 10 }}>
        <Row title="Spotters" sub="Requests, accepts, respect and comments on your workouts" checked={prefs.spotters} onChange={(v) => setPrefs({ spotters: v })} id="spotters" />
        <Row title="Coach" sub="Program changes, programs sent to you, notes on your sessions" checked={prefs.coach} onChange={(v) => setPrefs({ coach: v })} id="coach" />
        <Row title="Morning check-in" sub="Only if you haven't checked in yet" checked={prefs.checkin} onChange={(v) => setPrefs({ checkin: v })} id="checkin" />
        {prefs.checkin && <HourPick label="Check-in time" value={prefs.checkinHour} onChange={(h) => setPrefs({ checkinHour: h })} id="checkin-hour" />}
        <Row title="Meals" sub="1 pm if nothing is logged; 7 pm if protein is well short" checked={prefs.meals} onChange={(v) => setPrefs({ meals: v })} id="meals" />
        <Row title="Streak" sub="A planned training day you haven't logged yet" checked={prefs.streak} onChange={(v) => setPrefs({ streak: v })} id="streak" />
        {prefs.streak && <HourPick label="Streak nudge time" value={prefs.streakHour} onChange={(h) => setPrefs({ streakHour: h })} id="streak-hour" />}
      </div>
      {on && <button className="btn btn-block" onClick={async () => { setBusy(true); try { const n = await sendTest(); setMsg(n ? "Test sent." : "No devices registered. Turn notifications off and on again."); } catch (e) { setMsg((e as Error).message); } setBusy(false); }} disabled={busy} data-testid="button-push-test">Send a test notification</button>}
      <p className="text-xs faint">Each device you turn this on becomes its own subscription; the switches above apply to all of them. Times follow this device's clock.</p>
    </div>
  );
}

function Row({ title, sub, checked, onChange, id }: { title: string; sub: string; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label className="flex items-center justify-between gap-3" style={{ minHeight: 44 }}>
      <span><span className="text-sm font-semibold block">{title}</span><span className="text-xs muted">{sub}</span></span>
      <input type="checkbox" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={`toggle-notif-${id}`} />
    </label>
  );
}
function HourPick({ label, value, onChange, id }: { label: string; value: number; onChange: (h: number) => void; id: string }) {
  return (
    <label className="field"><span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} data-testid={`select-${id}`}>
        {HOURS.map((h) => <option key={h.v} value={h.v}>{h.l}</option>)}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ Today nudge */
/** One-time card on Today: turn notifications on. Hidden when on, dismissed, unsupported, or a sample account. */
export function NotifNudge({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { state, set, mode } = useStore();
  const auth = useAuth();
  const st = usePushStatus();
  const installShown = useInstallBannerShown();
  if (mode !== "remote" || auth.me?.isDemo || state.notifNudgeDismissed || st.subscribed !== false || st.perm === "denied") return null;
  if (st.support !== "ok" && st.support !== "ios-not-installed") return null;
  // One nudge at a time: wait until the home-screen banner is gone and the lifter has finished a session.
  if (installShown || !state.sessions.some((x) => x.end)) return null;
  const dismiss = () => set((s) => ({ ...s, notifNudgeDismissed: true }));
  return (
    <div className="card" data-testid="card-notif-nudge">
      <div className="flex items-start gap-3">
        <Bell size={18} className="lime" style={{ flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1 min0">
          <div className="text-sm font-semibold">Turn on notifications</div>
          <p className="text-xs muted mt-1">Spotter requests, coach changes, and a nudge when a check-in, meal, or planned session is still open.{st.support === "ios-not-installed" ? " On iPhone this needs RXS on your home screen first." : ""}</p>
          <button className="btn btn-sm btn-primary mt-2" onClick={onOpenSettings} data-testid="button-notif-nudge-open">{st.support === "ios-not-installed" ? "Show me how" : "Set up"}</button>
        </div>
        <button className="icon-btn" aria-label="Dismiss" onClick={dismiss} data-testid="button-notif-nudge-dismiss"><X size={16} /></button>
      </div>
    </div>
  );
}
