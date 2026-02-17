// src/SplitPanelLayout.jsx — Inline pinnable panels: everything fits on one screen
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
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Auto-open assistant when autoMessage arrives
  useEffect(() => {
    if (autoMessage) setRightOpen(true);
  }, [autoMessage]);

  return (
    <div className="pin-layout">
      {/* Left panel: Resources */}
      <div className={`pin-panel pin-panel--left${leftOpen ? " pin-panel--open" : ""}`}>
        <div className="pin-panel__accent pin-panel__accent--navy" />
        <div className="pin-panel__inner">
          <div className="pin-panel__header pin-panel__header--navy">
            <div className="pin-panel__header-content">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <span className="pin-panel__title">Interactive Resources</span>
            </div>
            <button className="pin-panel__close" onClick={() => setLeftOpen(false)} aria-label="Close resources panel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="pin-panel__content">
            <StepResourcePanel activeStep={activeStep} />
          </div>
        </div>
      </div>

      {/* Center: Workspace (always visible, flexes to fill) */}
      <div className="pin-layout__main">
        <StepDetails
          step={activeStep}
          sessionId={sessionId}
          onChatRefresh={onChatRefresh}
          onAutoSend={onAutoSend}
          onCompletedStepsChange={onCompletedStepsChange}
        />
      </div>

      {/* Right panel: Research Assistant */}
      <div className={`pin-panel pin-panel--right${rightOpen ? " pin-panel--open" : ""}`}>
        <div className="pin-panel__accent pin-panel__accent--green" />
        <div className="pin-panel__inner">
          <div className="pin-panel__header pin-panel__header--green">
            <div className="pin-panel__header-content">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="pin-panel__title">Research Assistant</span>
            </div>
            <button className="pin-panel__close" onClick={() => setRightOpen(false)} aria-label="Close assistant panel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="pin-panel__content">
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
      <div className="cmd-bar">
        <span className="cmd-bar__hint">Personalize the layout</span>
        <div className="cmd-bar__divider" />
        <button
          className={`cmd-bar__btn cmd-bar__btn--lesson${leftOpen ? " cmd-bar__btn--active" : ""}`}
          onClick={() => setLeftOpen(!leftOpen)}
          aria-label="Toggle resources panel"
        >
          <span className="cmd-bar__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </span>
          <span className="cmd-bar__label">Resources</span>
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
    </div>
  );
}
