// src/ProfileMenu.jsx
// Shared profile dropdown used on every page (design workspace, teacher
// dashboard, admin) so the avatar menu, Settings and Sign Out are identical.
import { useState, useRef, useEffect } from "react";

export default function ProfileMenu({
  user,
  onSignOut,
  onOpenSettings,
  onStartTour,   // optional - when provided, shows "Take a guided tour"
  roleLabel,     // optional - shown under the name when the user has no email
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;
  const initial = user.name?.charAt(0).toUpperCase();
  const subline = user.email || roleLabel;

  return (
    <div className="hop-profile" ref={ref}>
      <button
        className={`hop-profile__trigger${open ? " hop-profile__trigger--open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.name}
      >
        <span className="hop-user__avatar">{initial}</span>
        <span className="hop-user__name">{user.name}</span>
        <span className={`hop-profile__arrow${open ? " hop-profile__arrow--open" : ""}`}>&#9662;</span>
      </button>
      {open && (
        <div className="hop-profile__menu" role="menu">
          <div className="hop-profile__info">
            <span className="hop-user__avatar hop-user__avatar--lg">{initial}</span>
            <div className="hop-profile__info-text">
              <span className="hop-profile__name">{user.name}</span>
              {subline && <span className="hop-profile__email">{subline}</span>}
            </div>
          </div>
          <div className="hop-profile__sep" />
          {onOpenSettings && (
            <button
              className="hop-profile__item"
              onClick={() => { setOpen(false); onOpenSettings(); }}
              role="menuitem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>
          )}
          {onStartTour && (
            <button
              className="hop-profile__item"
              onClick={() => { setOpen(false); onStartTour(); }}
              role="menuitem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Take a guided tour
            </button>
          )}
          <div className="hop-profile__sep" />
          <button className="hop-profile__item" onClick={onSignOut} role="menuitem">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
