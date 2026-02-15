// src/SplitPanelLayout.jsx — Drawer layout: workspace center + floating command bar
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
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // Auto-open chat drawer when autoMessage arrives
  useEffect(() => {
    if (autoMessage) setRightOpen(true);
  }, [autoMessage]);

  return (
    <div className="drawer-layout">
      {/* Backdrop overlay */}
      {(leftOpen || rightOpen) && (
        <div
          className="drawer-overlay"
          onClick={() => { setLeftOpen(false); setRightOpen(false); }}
        />
      )}

      {/* Left drawer: Interactive Lesson */}
      <div className={`drawer drawer--left${leftOpen ? " drawer--open" : ""}`}>
        <div className="drawer__accent drawer__accent--navy" />
        <div className="drawer__inner">
          <div className="drawer__header drawer__header--navy">
            <div className="drawer__header-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <span className="drawer__title">Interactive Lesson</span>
            </div>
            <button className="drawer__close" onClick={() => setLeftOpen(false)} aria-label="Close lesson panel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="drawer__content">
            <StepResourcePanel activeStep={activeStep} />
          </div>
        </div>
      </div>

      {/* Right drawer: Research Assistant */}
      <div className={`drawer drawer--right${rightOpen ? " drawer--open" : ""}`}>
        <div className="drawer__accent drawer__accent--green" />
        <div className="drawer__inner">
          <div className="drawer__header drawer__header--green">
            <div className="drawer__header-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="drawer__title">Research Assistant</span>
            </div>
            <button className="drawer__close" onClick={() => setRightOpen(false)} aria-label="Close assistant panel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="drawer__content">
            {loading && !sessionId ? (
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
            )}
          </div>
        </div>
      </div>

      {/* Floating command bar */}
      <div className={`cmd-bar${leftOpen || rightOpen ? " cmd-bar--drawer-open" : ""}`}>
        <button
          className={`cmd-bar__btn cmd-bar__btn--lesson${leftOpen ? " cmd-bar__btn--active" : ""}`}
          onClick={() => setLeftOpen(!leftOpen)}
          aria-label="Toggle lesson panel"
        >
          <span className="cmd-bar__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </span>
          <span className="cmd-bar__label">Lesson</span>
        </button>

        <div className="cmd-bar__divider" />

        <button
          className={`cmd-bar__btn cmd-bar__btn--assistant${rightOpen ? " cmd-bar__btn--active" : ""}`}
          onClick={() => setRightOpen(!rightOpen)}
          aria-label="Toggle assistant panel"
        >
          <span className="cmd-bar__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span className="cmd-bar__label">Assistant</span>
        </button>
      </div>

      {/* Main: Workspace (always visible) */}
      <div className="drawer-layout__main">
        <StepDetails
          step={activeStep}
          sessionId={sessionId}
          onChatRefresh={onChatRefresh}
          onAutoSend={onAutoSend}
          onCompletedStepsChange={onCompletedStepsChange}
        />
      </div>
    </div>
  );
}
