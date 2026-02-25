// src/FeedbackPanel.jsx — Student notification bell + feedback slide-out panel
import React, { useEffect, useState, useRef } from "react";
import { API } from "./api";

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

export default function FeedbackPanel() {
  const [feedback, setFeedback] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    API.getStudentFeedback()
      .then((data) => {
        setFeedback(data.feedback || []);
        setUnread(data.unread_count || 0);
      })
      .catch(console.error);
  }, []);

  // Poll every 30 seconds for new feedback
  useEffect(() => {
    const interval = setInterval(() => {
      API.getStudentFeedback()
        .then((data) => {
          setFeedback(data.feedback || []);
          if (!open) setUnread(data.unread_count || 0);
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [open]);

  function handleToggle() {
    const opening = !open;
    setOpen(opening);
    if (opening && unread > 0) {
      API.markFeedbackRead().catch(console.error);
      setUnread(0);
    }
  }

  return (
    <>
      {/* Bell button — always visible when there's feedback or unread */}
      <button className="fb-bell" onClick={handleToggle} title="Teacher Feedback">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="fb-badge">{unread}</span>}
      </button>

      {/* Slide-out panel */}
      {open && (
        <>
          <div className="fb-backdrop" onClick={() => setOpen(false)} />
          <div className="fb-slide" ref={panelRef}>
            <div className="fb-slide__header">
              <h3 className="fb-slide__title">Teacher Feedback</h3>
              <button className="fb-slide__close" onClick={() => setOpen(false)}>&times;</button>
            </div>

            <div className="fb-slide__body">
              {feedback.length === 0 ? (
                <div className="fb-slide__empty">
                  <p>No feedback from your teacher yet.</p>
                  <p className="fb-slide__hint">Your teacher will leave feedback here as they review your research design.</p>
                </div>
              ) : (
                <div className="fb-slide__list">
                  {[...feedback].reverse().map((fb) => (
                    <div key={fb.id} className={`fb-slide__item${!fb.read ? " fb-slide__item--unread" : ""}`}>
                      <div className="fb-slide__item-header">
                        <strong>{fb.teacher_name}</strong>
                        <span className="fb-slide__time">{timeAgo(fb.created_at)}</span>
                      </div>
                      <p className="fb-slide__text">{fb.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
