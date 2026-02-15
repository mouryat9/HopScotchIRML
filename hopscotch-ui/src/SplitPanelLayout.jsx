// src/SplitPanelLayout.jsx — Pinnable sidebar with Lesson/Assistant tabs
import { useState, useEffect } from "react";
import StepResourcePanel from "./StepResourcePanel";
import StepDetails from "./StepDetails";
import ChatBox from "./ChatBox";

export default function SplitPanelLayout({
  activeStep,
  sessionId,
  chatRefreshKey,
  autoMessage,
  onAutoMessageSent,
  onChatRefresh,
  onAutoSend,
  onCompletedStepsChange,
  loading,
  status,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [activeTab, setActiveTab] = useState("assistant"); // "lesson" | "assistant"

  // Auto-open sidebar on autoMessage
  useEffect(() => {
    if (autoMessage) {
      setSidebarOpen(true);
      setActiveTab("assistant");
    }
  }, [autoMessage]);

  const isOpen = sidebarOpen || pinned;

  return (
    <div className={`sidebar-layout${pinned ? " sidebar-layout--pinned" : ""}`}>
      {/* Workspace */}
      <div className="sidebar-layout__main">
        <StepDetails
          step={activeStep}
          sessionId={sessionId}
          onChatRefresh={onChatRefresh}
          onAutoSend={onAutoSend}
          onCompletedStepsChange={onCompletedStepsChange}
        />
      </div>

      {/* Sidebar */}
      <aside className={`sidebar${isOpen ? " sidebar--open" : ""}`}>
        <div className="sidebar__header">
          {/* Tab buttons */}
          <div className="sidebar__tabs">
            <button
              className={`sidebar__tab${activeTab === "lesson" ? " sidebar__tab--active sidebar__tab--navy" : ""}`}
              onClick={() => { setActiveTab("lesson"); setSidebarOpen(true); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              Lesson
            </button>
            <button
              className={`sidebar__tab${activeTab === "assistant" ? " sidebar__tab--active sidebar__tab--green" : ""}`}
              onClick={() => { setActiveTab("assistant"); setSidebarOpen(true); }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Assistant
            </button>
          </div>

          {/* Pin + close buttons */}
          <div className="sidebar__actions">
            <button
              className={`sidebar__pin${pinned ? " sidebar__pin--active" : ""}`}
              onClick={() => setPinned(!pinned)}
              aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
              title={pinned ? "Unpin" : "Pin open"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 17v5M9 3h6l-1 7h3l-5 7-1-7H8l1-7z" />
              </svg>
            </button>
            {!pinned && (
              <button className="sidebar__close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="sidebar__content">
          {activeTab === "lesson" ? (
            <StepResourcePanel activeStep={activeStep} />
          ) : (
            loading && !sessionId ? (
              <div className="badge badge--neutral">Starting session...</div>
            ) : (
              <>
                <ChatBox
                  sessionId={sessionId}
                  activeStep={activeStep}
                  refreshKey={chatRefreshKey}
                  autoMessage={autoMessage}
                  onAutoMessageSent={onAutoMessageSent}
                />
                {status && (
                  <div className="badge" style={{ marginTop: 8 }}>{status}</div>
                )}
              </>
            )
          )}
        </div>
      </aside>

      {/* Toggle button (visible when sidebar is closed) */}
      {!isOpen && (
        <button className="sidebar__toggle" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M15 3v18"/>
          </svg>
        </button>
      )}
    </div>
  );
}
