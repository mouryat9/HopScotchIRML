// src/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { API } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { token, email, name, role }
  const [loading, setLoading] = useState(true);

  // Validate the stored session against the server instead of blindly trusting
  // whatever is in localStorage. An expired/invalid token is cleared (so the
  // app shows the login screen instead of a logged-in-but-broken state); a
  // transient network/server error keeps the session as-is.
  const validate = useCallback(async () => {
    const stored = localStorage.getItem("hopscotch_user");
    if (!stored) { setUser(null); return; }
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch {
      localStorage.removeItem("hopscotch_user");
      setUser(null);
      return;
    }
    if (!parsed || !parsed.token) {
      localStorage.removeItem("hopscotch_user");
      setUser(null);
      return;
    }
    const r = await API.validateSession();
    if (r.status === "expired") {
      localStorage.removeItem("hopscotch_user");
      setUser(null);
    } else if (r.status === "ok") {
      // Keep the token, refresh the profile fields from the server
      const merged = { ...parsed, ...r.user };
      setUser(merged);
      localStorage.setItem("hopscotch_user", JSON.stringify(merged));
    } else {
      // Network/server hiccup - keep the stored session rather than logging out
      setUser(parsed);
    }
  }, []);

  // On mount: validate before rendering the app so a stale token never shows a
  // logged-in-but-empty screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await validate();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [validate]);

  // Self-heal when the tab is refocused or restored from the back-forward cache
  // (the "reopen the tab days later" case), and log out on any global 401 that
  // the API layer reports.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") validate(); };
    const onPageShow = (e) => { if (e.persisted) validate(); };
    const onUnauthorized = () => {
      localStorage.removeItem("hopscotch_user");
      setUser(null);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("hopscotch:unauthorized", onUnauthorized);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("hopscotch:unauthorized", onUnauthorized);
    };
  }, [validate]);

  function login(userData) {
    setUser(userData);
    localStorage.setItem("hopscotch_user", JSON.stringify(userData));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("hopscotch_user");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, revalidate: validate }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
