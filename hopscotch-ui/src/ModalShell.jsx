// src/ModalShell.jsx
// The single modal shell used by every dialog in the app (Settings, teacher
// class modals, admin CRUD dialogs) so the backdrop, card, header, close
// affordance and footer look identical everywhere.
import { useLang } from "./i18n.jsx";

export default function ModalShell({
  onClose,
  title,
  eyebrow,        // optional small uppercase label above the title
  subtitle,       // optional muted line under the title
  footer,         // optional footer content (buttons); omitted = no footer bar
  wide = false,   // 560px card instead of 480px
  bodyClassName,  // extra class on the body (e.g. "hop-modal__body--cards")
  children,
}) {
  const { t } = useLang();
  return (
    <div className="hop-modal" onMouseDown={onClose}>
      <div
        className={`hop-modal__card${wide ? " hop-modal__card--wide" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="hop-modal__head">
          <div className="hop-modal__headtext">
            {eyebrow && <span className="hop-modal__eyebrow">{eyebrow}</span>}
            <h3 className="hop-modal__title">{title}</h3>
            {subtitle && <span className="hop-modal__subtitle">{subtitle}</span>}
          </div>
          <button className="hop-modal__close" onClick={onClose} aria-label={t("common.close")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>
        <div className={`hop-modal__body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
        {footer && <footer className="hop-modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}
