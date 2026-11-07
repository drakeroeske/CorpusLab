import { createContext, useContext, useState, type ReactNode } from "react";
import { Activity, Dumbbell, Gauge, User, Users } from "lucide-react";
import { StoreProvider, useStore } from "@/lib/store";
import { Toast, useToast } from "@/components/ui";
import Onboarding from "@/pages/Onboarding";
import Today from "@/pages/Today";
import Train from "@/pages/Train";
import Body from "@/pages/Body";
import Spotters from "@/pages/Spotters";
import ProfilePage from "@/pages/Profile";
import { CheckInSheet } from "@/pages/CheckIn";
import { NutritionSheet } from "@/pages/Nutrition";
import { CoachChat } from "@/pages/Coach";

export type Tab = "today" | "train" | "body" | "spotters" | "profile";
export type SheetName = "checkin" | "nutrition" | "coach" | null;
interface UI {
  tab: Tab; setTab: (t: Tab) => void;
  trainSub: string; setTrainSub: (s: string) => void;
  sheet: SheetName; open: (s: SheetName) => void;
  toast: (m: string) => void;
}
const UICtx = createContext<UI | null>(null);
export const useUI = () => useContext(UICtx)!;

function Shell() {
  const { state } = useStore();
  const [tab, setTabState] = useState<Tab>("today");
  const [trainSub, setTrainSub] = useState("session");
  const [sheet, open] = useState<SheetName>(null);
  const t = useToast();
  const setTab = (x: Tab) => { setTabState(x); window.scrollTo({ top: 0 }); };
  const ui: UI = { tab, setTab, trainSub, setTrainSub, sheet, open, toast: t.show };

  if (!state.profile?.onboarded) return <UICtx.Provider value={ui}><Onboarding /><Toast msg={t.msg} /></UICtx.Provider>;

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "today", label: "Today", icon: <Gauge size={20} /> },
    { id: "train", label: "Train", icon: <Dumbbell size={20} /> },
    { id: "body", label: "Body", icon: <Activity size={20} /> },
    { id: "spotters", label: "Spotters", icon: <Users size={20} /> },
    { id: "profile", label: "Profile", icon: <User size={20} /> },
  ];
  return (
    <UICtx.Provider value={ui}>
      <div className="app">
        {tab === "today" && <Today />}
        {tab === "train" && <Train />}
        {tab === "body" && <Body />}
        {tab === "spotters" && <Spotters />}
        {tab === "profile" && <ProfilePage />}
        <nav className="tabbar" aria-label="Main">
          {tabs.map((x) => (
            <button key={x.id} aria-current={tab === x.id ? "page" : undefined} onClick={() => setTab(x.id)} data-testid={`tab-${x.id}`}>
              {x.icon}
              <span>{x.label}</span>
              <span className="tab-dot" />
            </button>
          ))}
        </nav>
        {sheet === "checkin" && <CheckInSheet onClose={() => open(null)} />}
        {sheet === "nutrition" && <NutritionSheet onClose={() => open(null)} />}
        {sheet === "coach" && <CoachChat onClose={() => open(null)} />}
        <Toast msg={t.msg} />
      </div>
    </UICtx.Provider>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
