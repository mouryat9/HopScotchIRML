// src/SplitPanelLayout.jsx - Workspace with switchable layout concepts.
// layoutMode: "columns" (classic) | "hero" | "tabbed" | "float"
import { useState, useRef, useEffect } from "react";
import StepResourcePanel from "./StepResourcePanel";
import StepDetails from "./StepDetails";
import ChatBox from "./ChatBox";

const ResIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const AsstIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

function PanelHeader({ icon, title, tone, onClose, onFocus, focused }) {
  return (
    <div className={`pin-panel__header pin-panel__header--${tone}`}>
      <div className="pin-panel__header-content">{icon}<span className="pin-panel__title">{title}</span></div>
      <div className="pin-panel__header-actions">
        {onFocus && (
          <button className="pin-panel__icon-btn" onClick={onFocus} aria-pressed={focused}
                  title={focused ? "Exit reading mode" : "Expand for reading"} aria-label={focused ? "Collapse assistant" : "Expand assistant"}>
            {focused ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            )}
          </button>
        )}
        {onClose && (
          <button className="pin-panel__close" onClick={onClose} aria-label={`Close ${title}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function SplitPanelLayout({
  activeStep, sessionId, chatRefreshKey, autoMessage, onAutoMessageSent,
  onChatRefresh, onAutoSend, onCompletedStepsChange, loading, status,
  educationLevel = "high_school", tourActive = false,
  leftOpen = true, rightOpen = true, onCloseLeft, onCloseRight,
  aiEnabled = true, layoutMode = "columns",
  assistantFocus = false, onToggleAssistantFocus,
}) {
  // ---- Shared content blocks (reused across every layout) ----
  const resources = <StepResourcePanel activeStep={activeStep} educationLevel={educationLevel} />;

  const design = (
    <>
      <h2 className="pin-layout__main-title">My Research Design</h2>
      <StepDetails
        step={activeStep} sessionId={sessionId}
        onChatRefresh={onChatRefresh} onAutoSend={onAutoSend}
        onCompletedStepsChange={onCompletedStepsChange}
      />
    </>
  );

  const assistant = (
    <div className={`pin-panel__content${!aiEnabled ? " pin-panel__content--ai-off" : ""}`}>
      {loading && !sessionId ? (
        <div className="badge badge--neutral">Starting session...</div>
      ) : (
        <>
          <ChatBox
            sessionId={sessionId} activeStep={activeStep} refreshKey={chatRefreshKey}
            autoMessage={autoMessage} onAutoMessageSent={onAutoMessageSent} aiEnabled={aiEnabled}
          />
          {status && <div className="badge" style={{ marginTop: 8 }}>{status}</div>}
          {!aiEnabled && (
            <div className="ai-off-overlay">
              <div className="ai-off-overlay__card">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="4" y1="4" x2="20" y2="20" />
                </svg>
                <div className="ai-off-overlay__title">AI assistant is turned off</div>
                <div className="ai-off-overlay__text">
                  Your teacher has turned off the AI assistant for now. Need help with a tricky term?
                  Open the <strong>Glossary</strong> tab in the Resources panel.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ================= TABBED: design + one helper with tabs =================
  const [helperTab, setHelperTab] = useState("resources");
  if (layoutMode === "tabbed") {
    return (
      <div className="pin-layout pin-layout--tabbed">
        <div className="pin-layout__main">{design}</div>
        <div className="pin-panel pin-panel--open wl-helper">
          <div className="pin-panel__inner">
            <div className="wl-helper__tabs">
              <button className={`wl-helper__tab${helperTab === "resources" ? " wl-helper__tab--active" : ""}`} onClick={() => setHelperTab("resources")}>{ResIcon}<span>Resources</span></button>
              <button className={`wl-helper__tab${helperTab === "assistant" ? " wl-helper__tab--active" : ""}`} onClick={() => setHelperTab("assistant")}>{AsstIcon}<span>Assistant</span></button>
            </div>
            {helperTab === "resources"
              ? <div className="pin-panel__content">{resources}</div>
              : assistant}
          </div>
        </div>
      </div>
    );
  }

  // ================= FLOAT: full canvas + draggable helper cards =================
  if (layoutMode === "float") {
    return (
      <div className="pin-layout pin-layout--float">
        <div className="pin-layout__main pin-layout__main--full">{design}</div>
        <FloatCard id="resources" title="Interactive Resources" icon={ResIcon} tone="navy" start={{ x: 24, y: 90 }} initialOpen>
          <div className="pin-panel__content">{resources}</div>
        </FloatCard>
        <FloatCard id="assistant" title="Research Assistant" icon={AsstIcon} tone="green" start={{ x: null, y: 90 }} initialOpen>
          {assistant}
        </FloatCard>
      </div>
    );
  }

  // ================= HERO & COLUMNS (share structure, differ by CSS) =================
  const modeClass = layoutMode === "hero" ? " pin-layout--hero" : "";
  const focusClass = assistantFocus ? " pin-layout--focus" : "";
  return (
    <div className={`pin-layout${modeClass}${focusClass}`}>
      <div className={`pin-panel pin-panel--left${leftOpen ? " pin-panel--open" : ""}`}>
        <div className="pin-panel__inner">
          <PanelHeader icon={ResIcon} title="Interactive Resources" tone="navy" onClose={onCloseLeft} />
          <div className="pin-panel__content">{resources}</div>
        </div>
      </div>

      <div className="pin-layout__main">{design}</div>

      <div className={`pin-panel pin-panel--right${rightOpen ? " pin-panel--open" : ""}`}>
        <div className="pin-panel__inner">
          <PanelHeader icon={AsstIcon} title="Research Assistant" tone="green"
                       onClose={onCloseRight} onFocus={onToggleAssistantFocus} focused={assistantFocus} />
          {assistant}
        </div>
      </div>
    </div>
  );
}

/* Draggable, minimizable floating card (picture-in-picture helper) */
function FloatCard({ id, title, icon, tone, start, initialOpen = true, children }) {
  const [open, setOpen] = useState(initialOpen);
  const [pos, setPos] = useState(null); // {left, top} once moved
  const [size, setSize] = useState(null);
  const ref = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    function move(e) {
      if (!drag.current) return;
      const { sx, sy, ox, oy } = drag.current;
      setPos({ left: ox + (e.clientX - sx), top: oy + (e.clientY - sy) });
    }
    function up() { drag.current = null; document.body.classList.remove("wl-dragging"); }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  function onDown(e) {
    if (e.target.closest("button")) return;
    const r = ref.current.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top };
    setPos({ left: r.left, top: r.top });
    document.body.classList.add("wl-dragging");
  }

  const style = {};
  if (pos) { style.left = pos.left; style.top = pos.top; style.right = "auto"; }
  else if (start.x === null) { style.right = 24; style.top = start.y; }
  else { style.left = start.x; style.top = start.y; }
  if (size) { style.width = size.w; style.height = size.h; }

  if (!open) {
    return (
      <button className={`wl-float-pill wl-float-pill--${tone}`} onClick={() => setOpen(true)} style={start.x === null ? { right: 24 } : { left: 24 }}>
        {icon}<span>{title}</span>
      </button>
    );
  }

  return (
    <div className={`wl-float wl-float--${tone}`} ref={ref} style={style}>
      <div className="wl-float__head" onPointerDown={onDown}>
        <div className="wl-float__title">{icon}<span>{title}</span></div>
        <button className="wl-float__min" onClick={() => setOpen(false)} aria-label="Minimize" title="Minimize">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div className="wl-float__body">{children}</div>
    </div>
  );
}
