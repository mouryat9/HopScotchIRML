import { useState, useEffect } from "react";
import { API } from "./api";
import { useLang, dateLocale } from "./i18n.jsx";

const STEP_COLORS = [
  "#2B5EA7", "#E8618C", "#D94040", "#1A8A7D", "#B0A47A",
  "#00AEEF", "#F0B429", "#F5922A", "#7B8794",
];
// Steps 1-8 as squares of the hopscotch court (same layout as the logo
// loader); step 9 is the semicircle "home". STEP_COLORS already matches the
// court's square colors 1:1.
const COURT_SQUARES = [
  { x: 0, y: 0 }, { x: 0, y: 24 },   // 1,2 pair
  { x: 22, y: 12 },                  // 3 single
  { x: 44, y: 0 }, { x: 44, y: 24 }, // 4,5 pair
  { x: 66, y: 12 },                  // 6 single
  { x: 88, y: 0 }, { x: 88, y: 24 }, // 7,8 pair
];
const COURT_IDLE = "#E4E9F0";

function HopscotchProgress({ completed, activeStep }) {
  const { t } = useLang();
  const stepTip = (n) =>
    t("panel.stepTip", { n, label: t(`strip.${n}`) }) + (completed.includes(n) ? t("panel.done") : "");
  const shapeProps = (n) => {
    const done = completed.includes(n);
    const active = activeStep === n;
    return {
      fill: done ? STEP_COLORS[n - 1] : COURT_IDLE,
      stroke: active && !done ? STEP_COLORS[n - 1] : "none",
      strokeWidth: active && !done ? 2.5 : 0,
    };
  };
  return (
    <svg className="session-card__court" viewBox="-2 -2 132 50" aria-label={`${completed.length} of 9 steps completed`}>
      {COURT_SQUARES.map((p, i) => {
        const n = i + 1;
        return (
          <rect key={n} x={p.x} y={p.y} width="18" height="22" rx="6" {...shapeProps(n)}>
            <title>{stepTip(n)}</title>
          </rect>
        );
      })}
      <path d="M110,7 A16,16 0 0,1 110,39 Z" {...shapeProps(9)}>
        <title>{stepTip(9)}</title>
      </path>
    </svg>
  );
}

export default function SessionHistoryPanel({
  isOpen,
  onClose,
  currentSessionId,
  onSelectSession,
  onNewSession,
}) {
  const { t, lang } = useLang();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch sessions whenever the panel opens
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    API.listSessions()
      .then((data) => setSessions(data.sessions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function formatDate(iso) {
    if (!iso) return t("panel.unknownDate");
    try {
      return new Date(iso).toLocaleDateString(dateLocale(lang), {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  const PATH_COLOR = { quantitative: "#2B5EA7", qualitative: "#1A8A7D", mixed: "#C0842A" };

  return (
    <>
      <div className="session-overlay" onClick={onClose} />
      <aside className="session-panel">
        {/* Header */}
        <div className="session-panel__header">
          <div className="session-panel__headtext">
            <h2 className="session-panel__title">{t("panel.title")}</h2>
            <p className="session-panel__sub">{t("panel.sub")}</p>
          </div>
          <button className="session-panel__close" onClick={onClose} aria-label={t("common.close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* New Design Button */}
        <button
          className="session-panel__new"
          onClick={() => { onNewSession(); onClose(); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t("panel.new")}
        </button>

        {/* Session List */}
        <div className="session-panel__list">
          {loading && (
            <div className="session-panel__empty"><span className="session-spinner" />{t("panel.loading")}</div>
          )}
          {!loading && sessions.length === 0 && (
            <div className="session-panel__empty session-panel__empty--none">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <p>{t("panel.emptyTitle")}</p>
              <span>{t("panel.emptySub")}</span>
            </div>
          )}
          {!loading && sessions.map((s) => {
            const isCurrent = s.session_id === currentSessionId;
            const completed = s.completed_steps || [];
            const pct = Math.round((completed.length / 9) * 100);
            const title = s.topic || t("panel.untitled");
            const color = PATH_COLOR[s.resolved_path] || "#7B8794";
            return (
              <button
                key={s.session_id}
                className={`session-card${isCurrent ? " session-card--active" : ""}`}
                onClick={() => { if (!isCurrent) onSelectSession(s); onClose(); }}
              >
                <div className="session-card__row">
                  <span className="session-card__avatar" style={{ background: color }}>
                    {title.charAt(0).toUpperCase()}
                  </span>
                  <div className="session-card__main">
                    <div className="session-card__topic" title={title}>{title}</div>
                    <div className="session-card__meta">
                      <span>{formatDate(s.created_at)}</span>
                      <span className="session-card__dotsep">•</span>
                      {s.resolved_path
                        ? <span className="session-card__path" style={{ color }}>{t(`path.${s.resolved_path}`)}</span>
                        : <span className="session-card__path session-card__path--none">{t("panel.noPath")}</span>}
                    </div>
                  </div>
                  {isCurrent && <span className="session-card__current-badge">{t("panel.current")}</span>}
                </div>

                <div className="session-card__progress">
                  <HopscotchProgress completed={completed} activeStep={s.active_step} />
                  <span className="session-card__step-count">{completed.length}/9</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
