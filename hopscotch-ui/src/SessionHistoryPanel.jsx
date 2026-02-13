import { useState, useEffect } from "react";
import { API } from "./api";

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

  return (
    <>
      <div className="session-overlay" onClick={onClose} />
      <aside className="session-panel">
        {/* Header */}
        <div className="session-panel__header">
          <h2 className="session-panel__title">Session History</h2>
          <button className="session-panel__close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* New Session Button */}
        <button
          className="btn btn--primary session-panel__new"
          onClick={() => {
            onNewSession();
            onClose();
          }}
        >
          + New Session
        </button>

        {/* Session List */}
        <div className="session-panel__list">
          {loading && (
            <p className="session-panel__empty">Loading sessions...</p>
          )}
          {!loading && sessions.length === 0 && (
            <p className="session-panel__empty">No sessions yet.</p>
          )}
          {sessions.map((s) => {
            const isCurrent = s.session_id === currentSessionId;
            const completed = s.completed_steps || [];
            return (
              <button
                key={s.session_id}
                className={`session-card${isCurrent ? " session-card--active" : ""}`}
                onClick={() => {
                  if (!isCurrent) {
                    onSelectSession(s);
                  }
                  onClose();
                }}
              >
                <div className="session-card__topic">
                  {s.topic || "Untitled Research"}
                </div>
                <div className="session-card__meta">
                  <span>{formatDate(s.created_at)}</span>
                  {s.resolved_path ? (
                    <span className="session-card__path">
                      {s.resolved_path}
                    </span>
                  ) : (
                    <span className="session-card__path session-card__path--none">
                      No path yet
                    </span>
                  )}
                </div>
                <div className="session-card__progress">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span
                      key={n}
                      className={`session-card__dot${completed.includes(n) ? " session-card__dot--done" : ""}`}
                      title={`Step ${n}`}
                    />
                  ))}
                  <span className="session-card__step-count">
                    {completed.length}/9
                  </span>
                </div>
                {isCurrent && (
                  <span className="session-card__current-badge">Current</span>
                )}
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
