// src/SettingsModal.jsx
// Shared Settings modal. The Appearance and Language sections are universal
// and show on every page; pages pass extra sections (nav style, panels, …) as
// children so the modal chrome stays identical everywhere.
import { useLang, LANGS } from "./i18n.jsx";
import ModalShell from "./ModalShell";

export default function SettingsModal({ open, onClose, theme, toggleTheme, children }) {
  const { lang, setLang, t } = useLang();
  if (!open) return null;
  return (
    <ModalShell
      onClose={onClose}
      title={t("settings.title")}
      bodyClassName="hop-modal__body--cards"
      footer={<button className="btn login-btn-filled" onClick={onClose}>{t("settings.done")}</button>}
    >

      {/* Appearance - universal */}
      <section className="hop-settings__section">
        <div className="hop-settings__section-head">
          <span className="hop-settings__section-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
          </span>
          <div className="hop-settings__section-hettext">
            <span className="hop-settings__section-title">{t("settings.appearance")}</span>
            <span className="hop-settings__section-desc">{t("settings.appearanceDesc")}</span>
          </div>
        </div>
        <div className="hop-settings__section-body">
          <div className="hop-settings__seg">
            <button className={`hop-settings__seg-btn${theme !== "dark" ? " hop-settings__seg-btn--active" : ""}`} onClick={() => { if (theme === "dark") toggleTheme(); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              {t("settings.light")}
            </button>
            <button className={`hop-settings__seg-btn${theme === "dark" ? " hop-settings__seg-btn--active" : ""}`} onClick={() => { if (theme !== "dark") toggleTheme(); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              {t("settings.dark")}
            </button>
          </div>
        </div>
      </section>

      {/* Language - universal */}
      <section className="hop-settings__section">
        <div className="hop-settings__section-head">
          <span className="hop-settings__section-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </span>
          <div className="hop-settings__section-hettext">
            <span className="hop-settings__section-title">{t("settings.language")}</span>
            <span className="hop-settings__section-desc">{t("settings.languageDesc")}</span>
          </div>
        </div>
        <div className="hop-settings__section-body">
          <div className="hop-settings__seg">
            {LANGS.map((l) => (
              <button
                key={l.id}
                className={`hop-settings__seg-btn${lang === l.id ? " hop-settings__seg-btn--active" : ""}`}
                onClick={() => setLang(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {children}

    </ModalShell>
  );
}
