// src/SplitPanelLayout.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import TabbedPanel from "./TabbedPanel";
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
  const [leftTab, setLeftTab] = useState("resource");
  const [rightTab, setRightTab] = useState("details");
  const [splitPercent, setSplitPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // --- Tab swap: ensure no duplicate tabs ---
  const handleLeftTabChange = useCallback((newTab) => {
    if (newTab === rightTab) setRightTab(leftTab);
    setLeftTab(newTab);
  }, [leftTab, rightTab]);

  const handleRightTabChange = useCallback((newTab) => {
    if (newTab === leftTab) setLeftTab(rightTab);
    setRightTab(newTab);
  }, [leftTab, rightTab]);

  // --- Auto-switch to Chat when autoMessage arrives ---
  useEffect(() => {
    if (!autoMessage) return;
    if (leftTab !== "chat" && rightTab !== "chat") {
      // Open chat on the right, move right's current tab to left
      setLeftTab(rightTab);
      setRightTab("chat");
    }
  }, [autoMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Drag resizer (mouse + touch) ---
  const onDragStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onTouchStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    function calcPercent(clientX) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.max(25, Math.min(75, pct)));
    }

    function onMouseMove(e) { calcPercent(e.clientX); }
    function onTouchMove(e) { calcPercent(e.touches[0].clientX); }
    function onEnd() { setIsDragging(false); }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onTouchMove);
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [isDragging]);

  // --- Render content for a tab ---
  // Each component renders only once, in whichever panel has it active.
  function renderPanelContent(activeTab, side) {
    const showResource = (side === "left" && leftTab === "resource") || (side === "right" && rightTab === "resource");
    const showDetails = (side === "left" && leftTab === "details") || (side === "right" && rightTab === "details");
    const showChat = (side === "left" && leftTab === "chat") || (side === "right" && rightTab === "chat");

    return (
      <>
        {showResource && (
          <StepResourcePanel activeStep={activeStep} />
        )}
        {showDetails && (
          <StepDetails
            step={activeStep}
            sessionId={sessionId}
            onChatRefresh={onChatRefresh}
            onAutoSend={onAutoSend}
            onCompletedStepsChange={onCompletedStepsChange}
          />
        )}
        {showChat && (
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
      </>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`split-panel-layout${isDragging ? " split-panel-layout--dragging" : ""}`}
    >
      {/* Left panel */}
      <div className="split-panel" style={{ width: `${splitPercent}%` }}>
        <TabbedPanel activeTab={leftTab} onTabChange={handleLeftTabChange} variant="pill">
          {renderPanelContent(leftTab, "left")}
        </TabbedPanel>
      </div>

      {/* Drag handle */}
      <div
        className={`split-panel__handle${isDragging ? " split-panel__handle--active" : ""}`}
        onMouseDown={onDragStart}
        onTouchStart={onTouchStart}
        onDoubleClick={() => setSplitPercent(50)}
        title="Drag to resize — double-click to reset"
      />

      {/* Right panel */}
      <div className="split-panel" style={{ width: `${100 - splitPercent}%` }}>
        <TabbedPanel activeTab={rightTab} onTabChange={handleRightTabChange} variant="pill">
          {renderPanelContent(rightTab, "right")}
        </TabbedPanel>
      </div>
    </div>
  );
}
