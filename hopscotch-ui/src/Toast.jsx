// src/Toast.jsx
// Premium toast notifications: stacked bottom-right, spring entrance, auto-
// dismiss with hover-to-pause, per-type tinted icons, dedupe, dark mode and
// reduced-motion aware. Use anywhere:
//   import { notify } from "./Toast";
//   notify.success("Design saved");
//   notify.error("Could not save", { title: "Save failed" });
// <Toaster /> is mounted once at the App root.
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLang } from "./i18n.jsx";

let pushExternal = null;
let idCounter = 0;

const DURATIONS = { success: 4000, info: 4500, warning: 5500, error: 6500 };

function emit(type, message, opts = {}) {
  if (!pushExternal) return;
  pushExternal({
    id: ++idCounter,
    type,
    message: String(message || ""),
    title: opts.title || null,
    duration: opts.duration || DURATIONS[type] || 4500,
  });
}

export const notify = {
  success: (msg, opts) => emit("success", msg, opts),
  error: (msg, opts) => emit("error", msg, opts),
  warning: (msg, opts) => emit("warning", msg, opts),
  info: (msg, opts) => emit("info", msg, opts),
};

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 9v4" /><path d="M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 16v-5" /><path d="M12 8h.01" />
    </svg>
  ),
};

const MAX_VISIBLE = 4;

export function Toaster() {
  const { t: tr } = useLang();
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map()); // id -> { timeout, expiresAt, remaining }
  const pausedRef = useRef(false);

  const startExit = useCallback((id) => {
    const t = timers.current.get(id);
    if (t?.timeout) clearTimeout(t.timeout);
    timers.current.delete(id);
    setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, exiting: true } : x)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 260);
  }, []);

  const arm = useCallback((id, ms) => {
    const timeout = setTimeout(() => startExit(id), ms);
    timers.current.set(id, { timeout, expiresAt: Date.now() + ms, remaining: ms });
  }, [startExit]);

  useEffect(() => {
    pushExternal = (toast) => {
      setToasts((prev) => {
        // Dedupe: identical visible message just re-arms its timer
        const dup = prev.find((x) => !x.exiting && x.type === toast.type && x.message === toast.message);
        if (dup) {
          const t = timers.current.get(dup.id);
          if (t?.timeout) clearTimeout(t.timeout);
          if (!pausedRef.current) arm(dup.id, toast.duration);
          return prev.map((x) => (x.id === dup.id ? { ...x, bump: (x.bump || 0) + 1 } : x));
        }
        const next = [...prev, toast];
        // Overflow: push the oldest out
        const active = next.filter((x) => !x.exiting);
        if (active.length > MAX_VISIBLE) startExit(active[0].id);
        return next;
      });
      if (!pausedRef.current) arm(toast.id, toast.duration);
    };
    return () => { pushExternal = null; };
  }, [arm, startExit]);

  // Hover anywhere over the stack pauses every timer; leaving resumes with
  // the remaining time (minimum 1.2s so nothing vanishes instantly).
  const pauseAll = () => {
    pausedRef.current = true;
    for (const [, t] of timers.current) {
      if (t.timeout) clearTimeout(t.timeout);
      t.timeout = null;
      t.remaining = Math.max(0, t.expiresAt - Date.now());
    }
  };
  const resumeAll = () => {
    pausedRef.current = false;
    for (const [id, t] of timers.current) {
      const ms = Math.max(1200, t.remaining || 0);
      t.timeout = setTimeout(() => startExit(id), ms);
      t.expiresAt = Date.now() + ms;
    }
  };

  useEffect(() => () => { for (const [, t] of timers.current) t.timeout && clearTimeout(t.timeout); }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="hop-toaster"
      onMouseEnter={pauseAll}
      onMouseLeave={resumeAll}
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={`${t.id}-${t.bump || 0}`}
          className={`hop-toast hop-toast--${t.type}${t.exiting ? " hop-toast--exit" : ""}${t.bump ? " hop-toast--bump" : ""}`}
          role={t.type === "error" ? "alert" : "status"}
        >
          <span className="hop-toast__icon">{ICONS[t.type]}</span>
          <div className="hop-toast__body">
            {t.title && <div className="hop-toast__title">{t.title}</div>}
            <div className="hop-toast__msg">{t.message}</div>
          </div>
          <button className="hop-toast__close" onClick={() => startExit(t.id)} aria-label={tr("toast.dismiss")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
