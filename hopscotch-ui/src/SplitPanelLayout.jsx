// src/SplitPanelLayout.jsx — Inline pinnable panels: everything fits on one screen
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
  educationLevel = "high_school",
  tourActive = false,
  // Panel open state is owned by the parent (toggles live in the header)
  leftOpen = true,
  rightOpen = true,
  onCloseLeft,
  onCloseRight,
}) {
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
            <button className="pin-panel__close" onClick={onCloseLeft} aria-label="Close resources panel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="pin-panel__content">
            <StepResourcePanel activeStep={activeStep} educationLevel={educationLevel} />
          </div>
        </div>
      </div>

      {/* Center: Workspace (always visible, flexes to fill) */}
      <div className="pin-layout__main">
        <h2 className="pin-layout__main-title">My Research Design</h2>
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
            <button className="pin-panel__close" onClick={onCloseRight} aria-label="Close assistant panel">
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

    </div>
  );
}
