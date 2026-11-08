import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";
import type { AppState } from "./types";

export interface PubUser { id: string; username: string; displayName: string }
export interface Me extends PubUser {
  role: "athlete" | "coach";
  inviteCode: string;
  shareFeed: boolean;
  shareLifts: boolean;
  shareVaultWithCoach: boolean;
  isDemo: boolean;
  hasRecovery?: boolean;
  recoverySetAt?: string | null;
  coaches: PubUser[];
  clientCount: number;
}
export type AuthStatus = "loading" | "offline" | "anon" | "authed";
export interface ViewAs { id: string; name: string; state: AppState }

interface Ctx {
  status: AuthStatus;
  me: Me | null;
  setMe: (m: Me) => void;
  signedIn: (m: Me) => void;
  logout: () => Promise<void>;
  viewing: ViewAs | null;
  viewAs: (v: ViewAs | null) => void;
  /** true when social features talk to the real server */
  live: boolean;
}
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMeState] = useState<Me | null>(null);
  const [viewing, setViewing] = useState<ViewAs | null>(null);
  useEffect(() => {
    api<Me>("GET", "/api/me", undefined, { timeoutMs: 6000 })
      .then((m) => { setMeState(m); setStatus("authed"); })
      .catch((e) => setStatus(e instanceof ApiError && e.status === 401 ? "anon" : "offline"));
  }, []);
  const setMe = useCallback((m: Me) => setMeState(m), []);
  const signedIn = useCallback((m: Me) => { setMeState(m); setViewing(null); setStatus("authed"); }, []);
  const logout = useCallback(async () => {
    try { await api("POST", "/api/auth/logout"); } catch { /* ignore */ }
    setMeState(null); setViewing(null); setStatus("anon");
  }, []);
  const viewAs = useCallback((v: ViewAs | null) => { setViewing(v); window.scrollTo({ top: 0 }); }, []);
  return (
    <AuthCtx.Provider value={{ status, me, setMe, signedIn, logout, viewing, viewAs, live: status === "authed" }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}
