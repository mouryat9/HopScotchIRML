import { useState, useEffect } from "react";
import { API } from "./api";

const STEP_COLORS = [
  "#2B5EA7", "#E8618C", "#D94040", "#1A8A7D", "#B0A47A",
  "#00AEEF", "#F0B429", "#F5922A", "#7B8794",
];
const STEP_LABELS = [
  "Worldview", "Topic", "Framework", "Design", "Research Questions",
  "Data", "Analysis", "Trustworthiness", "Ethics",
];

export default function SessionHistoryPanel({
  isOpen,
  onClose,
  currentSessionId,
  onSelectSession,
  onNewSession,
}) {
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
    if (!iso) return "Unknown date";
    try {
      return new Date(iso).toLocaleDateString("en-US", {
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
            <h2 className="session-panel__title">My Designs</h2>
            <p className="session-panel__sub">Switch between your research designs or start a new one.</p>
          </div>
          <button className="session-panel__close" onClick={onClose} aria-label="Close">
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
          Start a new design
        </button>

        {/* Session List */}
        <div className="session-panel__list">
          {loading && (
            <div className="session-panel__empty"><span className="session-spinner" />Loading your designs…</div>
          )}
          {!loading && sessions.length === 0 && (
            <div className="session-panel__empty session-panel__empty--none">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <p>No designs yet</p>
              <span>Start your first research design above.</span>
            </div>
          )}
          {!loading && sessions.map((s) => {
            const isCurrent = s.session_id === currentSessionId;
            const completed = s.completed_steps || [];
            const pct = Math.round((completed.length / 9) * 100);
            const title = s.topic || "Untitled research design";
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
                        ? <span className="session-card__path" style={{ color }}>{s.resolved_path}</span>
                        : <span className="session-card__path session-card__path--none">no path yet</span>}
                    </div>
                  </div>
                  {isCurrent && <span className="session-card__current-badge">Current</span>}
                </div>

                <div className="session-card__progress">
                  <div className="session-card__dots">
                    {STEP_COLORS.map((c, si) => {
                      const n = si + 1;
                      const done = completed.includes(n);
                      const active = s.active_step === n;
                      return (
                        <span
                          key={n}
                          className={`session-card__dot${done ? " session-card__dot--done" : ""}${active ? " session-card__dot--active" : ""}`}
                          style={done ? { background: c, borderColor: c } : (active ? { borderColor: c } : {})}
                          title={`Step ${n}: ${STEP_LABELS[si]}${done ? " (done)" : ""}`}
                        />
                      );
                    })}
                  </div>
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
