// src/FeedbackPanel.jsx - Student notification bell + feedback slide-out panel.
// Premium behavior: new feedback is an event (bell swing + badge pulse + toast),
// the panel slides in/out, and unread items sit in a "New" section that keeps
// its highlight while you read (server mark-read happens on open, the visual
// grouping clears when you close).
import React, { useEffect, useState, useRef } from "react";
import { API } from "./api";
import { notify } from "./Toast";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const ts = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// Stable avatar color per teacher, drawn from the hopscotch court palette
const AVATAR_COLORS = ["#2B5EA7", "#1A8A7D", "#D94040", "#B0762A", "#7B5EA7", "#0B7285"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name = "") {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] || "").join("").toUpperCase() || "T";
}

export default function FeedbackPanel() {
  const [feedback, setFeedback] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [newIds, setNewIds] = useState(() => new Set());
  const prevUnreadRef = useRef(null);
  const openRef = useRef(false);
  openRef.current = open;

  const load = (announce) => {
    API.getStudentFeedback()
      .then((data) => {
        const items = data.feedback || [];
        const count = data.unread_count || 0;
        setFeedback(items);
        if (!openRef.current) setUnread(count);
        // Arrival moment: unread grew since the last poll
        const prev = prevUnreadRef.current;
        if (announce && prev !== null && count > prev && !openRef.current) {
          setRinging(true);
          setTimeout(() => setRinging(false), 1200);
          const latest = items[items.length - 1];
          notify.info(
            latest?.teacher_name ? `from ${latest.teacher_name}` : "Your teacher left you feedback.",
            { title: "💬 New feedback" }
          );
        }
        prevUnreadRef.current = count;
      })
      .catch(() => {});
  };

  useEffect(() => { load(false); }, []);
  useEffect(() => {
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, []);

  function openPanel() {
    // Snapshot the unread items so the "New" section keeps its highlight
    // while the panel is open, even though the server marks them read now.
    setNewIds(new Set(feedback.filter((f) => !f.read).map((f) => f.id)));
    setOpen(true);
    setClosing(false);
    if (unread > 0) {
      API.markFeedbackRead().catch(() => {});
      setUnread(0);
    }
  }
  function closePanel() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); setNewIds(new Set()); }, 240);
  }
  const handleToggle = () => (open ? closePanel() : openPanel());

  const ordered = [...feedback].reverse();
  const fresh = ordered.filter((f) => newIds.has(f.id));
  const earlier = ordered.filter((f) => !newIds.has(f.id));

  const Item = ({ fb, isNew }) => (
    <div className={`fb-slide__item${isNew ? " fb-slide__item--unread" : ""}`}>
      <div className="fb-slide__item-header">
        <span className="fb-avatar" style={{ background: avatarColor(fb.teacher_name) }}>
          {initials(fb.teacher_name)}
        </span>
        <strong>{fb.teacher_name}</strong>
        {isNew && <span className="fb-newdot" aria-label="New" />}
        <span className="fb-slide__time">{timeAgo(fb.created_at)}</span>
      </div>
      <p className="fb-slide__text">{fb.text}</p>
    </div>
  );

  return (
    <>
      <button
        className={`fb-bell${ringing ? " fb-bell--ring" : ""}`}
        onClick={handleToggle}
        title="Teacher Feedback"
        aria-label={unread > 0 ? `Teacher feedback, ${unread} unread` : "Teacher feedback"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="fb-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <>
          <div className={`fb-backdrop${closing ? " fb-backdrop--closing" : ""}`} onClick={closePanel} />
          <div className={`fb-slide${closing ? " fb-slide--closing" : ""}`} role="dialog" aria-label="Teacher feedback">
            <div className="fb-slide__header">
              <h3 className="fb-slide__title">Teacher Feedback</h3>
              <button className="fb-slide__close" onClick={closePanel} aria-label="Close">&times;</button>
            </div>

            <div className="fb-slide__body">
              {ordered.length === 0 ? (
                <div className="fb-slide__empty">
                  <span className="fb-slide__empty-icon" aria-hidden="true">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </span>
                  <p>No feedback yet</p>
                  <p className="fb-slide__hint">When your teacher reviews your research design, their feedback will appear here - and you'll see it arrive on the bell.</p>
                </div>
              ) : (
                <div className="fb-slide__list">
                  {fresh.length > 0 && (
                    <>
                      <div className="fb-section">New</div>
                      {fresh.map((fb) => <Item key={fb.id} fb={fb} isNew />)}
                    </>
                  )}
                  {earlier.length > 0 && (
                    <>
                      {fresh.length > 0 && <div className="fb-section">Earlier</div>}
                      {earlier.map((fb) => <Item key={fb.id} fb={fb} isNew={false} />)}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
