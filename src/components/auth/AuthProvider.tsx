"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createApiClient } from "@/lib/api";
import type { User } from "@/types/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

/** Same-origin auth gateway: login/session plus the public account-email actions. */
export function authGatewayClient() {
  return createApiClient({
    baseUrl: new URL("/api/auth", window.location.origin).href,
  });
}

async function readSession(signal?: AbortSignal) {
  return authGatewayClient().get<{ user: User | null }>("session", { signal });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  async function refresh() {
    try {
      const session = await readSession();
      setUser(session.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }
  async function signOut() {
    await authGatewayClient().post("logout");
    setUser(null);
  }
  useEffect(() => {
    const controller = new AbortController();
    readSession(controller.signal)
      .then((session) => {
        if (!controller.signal.aborted) {
          setUser(session.user);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setUser(null);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);
  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider.");
  return auth;
}
