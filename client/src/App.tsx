import { createContext, useContext, useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { StoreProvider, useStore } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth";
import AuthScreen from "@/pages/Auth";
import { Toast, useToast } from "@/components/ui";
import { GrainOverlay, applyInk } from "@/components/riso";
import { NotifPlanSync, useDeepLinks } from "@/components/Notifications";
applyInk();
import Onboarding from "@/pages/Onboarding";
import Today from "@/pages/Today";
import Train from "@/pages/Train";
import Progress from "@/pages/Progress";
import Spotters from "@/pages/Spotters";
import ProfilePage from "@/pages/Profile";
import { CheckInSheet } from "@/pages/CheckIn";
import { NutritionSheet } from "@/pages/Nutrition";
import { InviteHandler } from "@/components/InviteHandler";
import PrivacyPage from "@/pages/Privacy";
import DevReadiness from "@/pages/DevReadiness";
import { CoachChat } from "@/pages/Coach";
import { Tour } from "@/components/Tour";
import ClientsPage from "@/pages/Clients";
import { useUnreadMessages } from "@/components/MessageThread";

export type Tab = "today" | "train" | "progress" | "social" | "clients" | "profile";
export type SheetName = "checkin" | "nutrition" | "coach" | null;
export interface UI {
  tab: Tab; setTab: (t: Tab) => void;
  /** Tab to return to from Profile (opened from the header avatar). */
  prevTab: Exclude<Tab, "profile">;
  /** Current sub-section of each tab, e.g. sub.train = "program". */
  sub: Partial<Record<Tab, string>>; setSub: (t: Tab, s: string) => void;
  sheet: SheetName; open: (s: SheetName) => void;
  toast: (m: string) => void;
}
const UICtx = createContext<UI | null>(null);
export const useUI = () => useContext(UICtx)!;

function ViewBanner() {
  const { viewing, viewAs } = useAuth();
  if (!viewing) return null;
  return (
    <div className="view-banner" data-testid="banner-viewing">
      <Eye size={15} />
      <span className="flex-1 min0 truncate text-[13px]">Viewing <b>{viewing.name}</b> · read-only</span>
      <button className="btn btn-sm" onClick={() => viewAs(null)} data-testid="button-exit-view">Exit</button>
    </div>
  );
}

function Shell() {
  const { state, mode } = useStore();
  const { viewing, viewAs, me } = useAuth();
  // Coaches get a fifth tab for their clients; offline Coach mode shows the sample clients there.
  const isCoach = mode === "remote" ? me?.role === "coach" : !!state.profile?.coachMode;
  const { total: unreadMsgs } = useUnreadMessages(mode === "remote" && isCoach && !viewing, 60_000);
  const [tab, setTabState] = useState<Tab>("today");
  const [prevTab, setPrevTab] = useState<UI["prevTab"]>("today");
  const [sub, setSubs] = useState<UI["sub"]>({});
  const [sheet, open] = useState<SheetName>(null);
  const t = useToast();
  const setTab = (x: Tab) => {
    if (x === "profile" && tab !== "profile") setPrevTab(tab as UI["prevTab"]);
    setTabState(x); window.scrollTo({ top: 0 });
  };
  const setSub = (x: Tab, s: string) => setSubs((o) => ({ ...o, [x]: s }));
  const ui: UI = { tab, setTab, prevTab, sub, setSub, sheet, open, toast: t.show };
  useDeepLinks(ui, !!state.profile?.onboarded && !viewing);

  if (viewing && !state.profile?.onboarded) return (
    <div className="app viewing"><ViewBanner />
      <div className="screen"><div className="empty mt-6">{viewing.name} hasn't finished setting up their account yet.</div>
        <button className="btn btn-block mt-4" onClick={() => viewAs(null)}>Back to my account</button></div>
    </div>
  );
  if (!state.profile?.onboarded) return <UICtx.Provider value={ui}><Onboarding /><Toast msg={t.msg} /></UICtx.Provider>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "train", label: "Train" },
    { id: "progress", label: "Progress" },
    { id: "social", label: "Social" },
    ...(isCoach ? [{ id: "clients" as Tab, label: "Clients" }] : []),
  ];
  const surface = "surface-riso";
  return (
    <UICtx.Provider value={ui}>
      <div className={`app ${surface} ${viewing ? "viewing" : ""}`}>
        <ViewBanner />
        {!viewing && <NotifPlanSync />}
        {tab === "today" && <Today />}
        {tab === "train" && <Train />}
        {tab === "progress" && <Progress />}
        {tab === "social" && <Spotters />}
        {tab === "clients" && (isCoach ? <ClientsPage /> : <Today />)}
        {tab === "profile" && <ProfilePage />}
        <nav className={`tabbar ${tabs.length === 5 ? "tabs-5" : ""}`} aria-label="Main">
          {tabs.map((x) => (
            <button key={x.id} aria-current={tab === x.id ? "page" : undefined} onClick={() => setTab(x.id)} data-testid={`tab-${x.id}`}>
              <span>{x.label}</span>
              {x.id === "clients" && unreadMsgs > 0 && <span className="tab-badge" data-testid="text-tab-clients-unread">{unreadMsgs}</span>}
            </button>
          ))}
        </nav>
        {sheet === "checkin" && <CheckInSheet onClose={() => open(null)} />}
        {sheet === "nutrition" && <NutritionSheet onClose={() => open(null)} />}
        {sheet === "coach" && <CoachChat onClose={() => open(null)} />}
        {/* First-run tour: only new accounts start with tourDone === false (demo data and older accounts never do). */}
        {!viewing && state.profile?.tourDone === false && <Tour />}
        <Toast msg={t.msg} />
      </div>
    </UICtx.Provider>
  );
}

function useRoute() {
  const get = () => (location.hash.startsWith("#/privacy") ? "privacy" : location.hash.startsWith("#/dev/readiness") ? "dev-readiness" : "app");
  const [r, setR] = useState(get);
  useEffect(() => { const f = () => { setR(get()); window.scrollTo({ top: 0 }); }; window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return r;
}

function Root() {
  const auth = useAuth();
  const route = useRoute();
  if (auth.status === "loading") return <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", color: "var(--muted)" }} className="mono text-xs" data-testid="status-loading">Loading</div>;
  if (route === "privacy") return <PrivacyPage onBack={() => { location.hash = "#/"; }} />;
  if (route === "dev-readiness") return <DevReadiness onBack={() => { location.hash = "#/"; }} />;
  if (auth.status === "anon") return <AuthScreen />;
  if (auth.viewing) return <StoreProvider key={`view-${auth.viewing.id}`} mode="readonly" initial={auth.viewing.state}><Shell /></StoreProvider>;
  if (auth.status === "authed" && auth.me) return <StoreProvider key={`u-${auth.me.id}`} mode="remote" onAuthLost={auth.logout}><Shell /></StoreProvider>;
  return <StoreProvider mode="offline"><Shell /></StoreProvider>;
}

export default function App() {
  return <AuthProvider><Root /><InviteHandler /><GrainOverlay /></AuthProvider>;
}
