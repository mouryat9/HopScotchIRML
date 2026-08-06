// src/LangSwitcher.jsx
// Globe language dropdown (login header + profile menu). Shows the current
// language on a compact pill trigger; the menu lists every language in its
// own script with the English name as a caption and a check on the active
// one. Flags are deliberately avoided - flags mean countries, not languages.
import { useState, useRef, useEffect } from "react";
import { useLang, LANGS } from "./i18n.jsx";

// English captions shown under the native names (none needed for English)
const ENGLISH_NAMES = { es: "Spanish", zh: "Chinese" };

export default function LangSwitcher({ align = "right" }) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LANGS.find((l) => l.id === lang) || LANGS[0];

  return (
    <div className="hop-langdd" ref={ref}>
      <button
        type="button"
        className={`hop-langdd__trigger${open ? " hop-langdd__trigger--open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("profile.language")}
      >
        <svg className="hop-langdd__globe" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{current.label}</span>
        <span className={`hop-langdd__chev${open ? " hop-langdd__chev--open" : ""}`} aria-hidden="true">&#9662;</span>
      </button>
      {open && (
        <ul className={`hop-langdd__menu${align === "left" ? " hop-langdd__menu--left" : ""}`} role="listbox" aria-label={t("profile.language")}>
          {LANGS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={lang === l.id}
                className={`hop-langdd__item${lang === l.id ? " hop-langdd__item--active" : ""}`}
                onClick={() => { setLang(l.id); setOpen(false); }}
              >
                <span className="hop-langdd__names">
                  <span className="hop-langdd__native">{l.label}</span>
                  {ENGLISH_NAMES[l.id] && <span className="hop-langdd__english">{ENGLISH_NAMES[l.id]}</span>}
                </span>
                {lang === l.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
