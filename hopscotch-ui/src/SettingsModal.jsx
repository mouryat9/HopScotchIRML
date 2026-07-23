// src/SettingsModal.jsx
// Shared Settings modal. The Appearance (light/dark) section is universal and
// shows on every page; pages pass extra sections (nav style, panels, …) as
// children so the modal chrome stays identical everywhere.
export default function SettingsModal({ open, onClose, theme, toggleTheme, children }) {
  if (!open) return null;
  return (
    <div className="hop-settings" onMouseDown={onClose}>
      <div className="hop-settings__card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="hop-settings__head">
          <h3 className="hop-settings__title">Settings</h3>
          <button className="hop-settings__close" onClick={onClose} aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="hop-settings__body">

          {/* Appearance - universal */}
          <section className="hop-settings__section">
            <div className="hop-settings__section-head">
              <span className="hop-settings__section-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
              </span>
              <div className="hop-settings__section-hettext">
                <span className="hop-settings__section-title">Appearance</span>
                <span className="hop-settings__section-desc">Switch between light and dark mode.</span>
              </div>
            </div>
            <div className="hop-settings__section-body">
              <div className="hop-settings__seg">
                <button className={`hop-settings__seg-btn${theme !== "dark" ? " hop-settings__seg-btn--active" : ""}`} onClick={() => { if (theme === "dark") toggleTheme(); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                  Light
                </button>
                <button className={`hop-settings__seg-btn${theme === "dark" ? " hop-settings__seg-btn--active" : ""}`} onClick={() => { if (theme !== "dark") toggleTheme(); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                  Dark
                </button>
              </div>
            </div>
          </section>

          {children}

        </div>
        <div className="hop-settings__foot">
          <button className="btn login-btn-filled" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
