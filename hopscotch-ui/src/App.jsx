// src/App.jsx
import "./App.css";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { API } from "./api";
import SplitPanelLayout from "./SplitPanelLayout";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import LoginPage from "./LoginPage";
import TeacherDashboard from "./TeacherDashboard";
import SessionHistoryPanel from "./SessionHistoryPanel";
import ConceptualFrameworkEditor from "./ConceptualFrameworkEditor";
import FeedbackPanel from "./FeedbackPanel";
import AdminDashboard from "./AdminDashboard";
import ProfileMenu from "./ProfileMenu";
import SettingsModal from "./SettingsModal";
import { Joyride, STATUS } from "react-joyride";

/* ----- Guided tour steps ----- */
const TOUR_STEPS = [
  {
    target: ".hop-header",
    title: "Welcome to Hopscotch 4-All!",
    content: "You\u2019re stepping into an engaging and accessible research design workspace built just for you. Let\u2019s take a quick tour of the key features so you feel right at home.",
    disableBeacon: true,
    icon: "👋",
  },
  {
    target: ".mini-board",
    title: "Your 9 Steps",
    content: "Your 9-step research journey at a glance. Each dot lights up as you complete a step \u2014 click any to jump back.",
    icon: "🎯",
  },
  {
    target: ".mini-board__expand",
    title: "The Hopscotch Map",
    content: "Hopscotch helps you break down the complexity of research design into nine clear, manageable, and recursive steps that guide you through your entire research journey.\nEach step is interactive and clickable, allowing you to easily \u201Chop\u201D between components of your research design as you develop, revise, and refine your ideas.",
    icon: "🗺️",
  },
  {
    target: ".pin-panel--left",
    title: "Resources Panel",
    content: "Access curated videos, links to academic articles, examples, and interactive tools carefully selected to support the specific step you\u2019re working on.\nAs you move through your research design, the Resources Panel adapts to provide targeted guidance, helpful explanations, and skill-building materials providing you with the right support at the right time.",
    icon: "📚",
  },
  {
    target: ".pin-layout__main",
    title: "Your Workspace",
    content: "The heart of it all! Build your research design by filling out the provided fields for each step with support from the AI Assistant.",
    icon: "✏️",
  },
  {
    target: ".pin-panel--right",
    title: "AI Research Assistant",
    content: "Your personal research mentor\u2014ask questions, receive expert feedback, and get clear, step-by-step guidance whenever you need it.",
    icon: "🤖",
  },
  {
    target: ".cmd-bar",
    title: "Layout Controls",
    content: "Toggle the Resources and Assistant panels on or off to create the workspace that suits you best.",
    icon: "🎛️",
  },
  {
    target: ".hop-download",
    title: "Download Your Work",
    content: "When you\u2019re ready, export your completed design as a PDF, or generate a visual representation of the Conceptual Framework emerging out of your research design.",
    icon: "📥",
  },
];

/* ----- Custom tour tooltip component ----- */
function TourTooltip({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  size,
}) {
  const progress = ((index + 1) / size) * 100;
  return (
    <div {...tooltipProps} className="tour-tooltip">
      {/* Progress bar across top */}
      <div className="tour-tooltip__progress-track">
        <div className="tour-tooltip__progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="tour-tooltip__body">
        {/* Icon + step counter */}
        <div className="tour-tooltip__top">
          {step.icon && <span className="tour-tooltip__icon">{step.icon}</span>}
          <span className="tour-tooltip__counter">
            {index + 1} of {size}
          </span>
        </div>

        {/* Title */}
        {step.title && <h3 className="tour-tooltip__title">{step.title}</h3>}

        {/* Content */}
        <p className="tour-tooltip__content">{step.content}</p>

        {/* Buttons */}
        <div className="tour-tooltip__footer">
          <button
            aria-label={skipProps["aria-label"]}
            data-action={skipProps["data-action"]}
            onClick={skipProps.onClick}
            role={skipProps.role}
            className="tour-tooltip__skip"
          >
            Skip Tour
          </button>
          <div className="tour-tooltip__nav">
            {index > 0 && (
              <button
                aria-label={backProps["aria-label"]}
                data-action={backProps["data-action"]}
                onClick={backProps.onClick}
                role={backProps.role}
                className="tour-tooltip__back"
              >
                Back
              </button>
            )}
            <button
              aria-label={primaryProps["aria-label"]}
              data-action={primaryProps["data-action"]}
              onClick={primaryProps.onClick}
              role={primaryProps.role}
              className="tour-tooltip__next"
            >
              {index === size - 1 ? "Let\u2019s Go!" : "Next"}
              {index < size - 1 && <span className="tour-tooltip__arrow">{"\u2192"}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small local UI helpers */
const Btn = ({ className = "", ...p }) => (
  <button {...p} className={`btn ${className}`} />
);
const Chip = ({ variant, children }) => (
  <span className={`badge${variant ? ` badge--${variant}` : ""}`}>
    {children}
  </span>
);

/* ----- Step labels for progress bar ----- */
const STEP_LABELS = [
  "Worldview", "Topic", "Framework", "Design", "Research Questions",
  "Data", "Analysis", "Trustworthiness", "Ethics",
];

/* ----- Teacher-controlled access/pacing (Phase 2). Mirrors backend logic. ----- */
const STEP_PHASES = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
function phaseOfStep(step) {
  const i = STEP_PHASES.findIndex((ph) => ph.includes(step));
  return i >= 0 ? i + 1 : 1;
}
function isStepLocked(step, accessMode = "full", unlockedPhase = null, completedSteps = []) {
  if (accessMode === "step") {
    if (step <= 1 || completedSteps.includes(step)) return false;
    let firstIncomplete = 10;
    for (let n = 1; n <= 9; n++) { if (!completedSteps.includes(n)) { firstIncomplete = n; break; } }
    return step > firstIncomplete;
  }
  if (accessMode === "phase") {
    return phaseOfStep(step) > (unlockedPhase || 1);
  }
  return false;
}

function StepProgressBar({ activeStep, completedSteps = [], onStepChange, lockedSteps = [] }) {
  return (
    <nav className="step-progress" aria-label="Research steps">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const isActive = num === activeStep;
        const isCompleted = completedSteps.includes(num);
        const isLocked = lockedSteps.includes(num);
        return (
          <div className="step-progress__item" key={num}>
            <button
              className={`step-progress__dot${isActive ? " step-progress__dot--active" : ""}${isCompleted ? " step-progress__dot--completed" : ""}${isLocked ? " step-progress__dot--locked" : ""}`}
              onClick={() => !isLocked && onStepChange(num)}
              disabled={isLocked}
              aria-label={`Step ${num}: ${label}${isLocked ? " (locked by your teacher)" : ""}`}
              title={isLocked ? `${label} \u2014 locked by your teacher` : label}
            >
              {isLocked ? "\ud83d\udd12" : isCompleted ? "\u2713" : num}
            </button>
            {num < 9 && <div className={`step-progress__line${isCompleted ? " step-progress__line--completed" : ""}`} />}
          </div>
        );
      })}
    </nav>
  );
}

/* ----- Hopscotch step cards config ----- */
const STEP_CARDS = [
  { num: 1, label: "Who am I as a researcher?", color: "#2B5EA7" },
  { num: 2, label: "What am I wondering about?", color: "#E8618C" },
  { num: 3, label: "What do I already know?", color: "#D94040" },
  { num: 4, label: "How will I study it?", color: "#1A8A7D" },
  { num: 5, label: "What is my research question?", color: "#B0A47A" },
  { num: 6, label: "What is the data to collect?", color: "#00AEEF" },
  { num: 7, label: "How will I make sense of the data?", color: "#F0B429" },
  { num: 8, label: "How will I ensure my evidence is trustworthy?", color: "#F5922A" },
  { num: 9, label: "How will I be ethical and safe in my study?", color: "#7B8794" },
];

/* Hopscotch layout: pairs (stacked) alternate with singles (centered) */
const HOPSCOTCH_COLUMNS = [
  { type: "pair", steps: [1, 2] },
  { type: "single", steps: [3] },
  { type: "pair", steps: [4, 5] },
  { type: "single", steps: [6] },
  { type: "pair", steps: [7, 8] },
  { type: "single", steps: [9] },
];

/* ----- Animated step diagram ----- */
function StepDiagram({ activeStep, completedSteps = [], onStepChange, lockedSteps = [] }) {
  return (
    <div className="hop-diagram">
      {HOPSCOTCH_COLUMNS.map((col, ci) => (
        <div className={`hop-diagram__col hop-diagram__col--${col.type}`} key={ci}>
          {col.steps.map((stepNum) => {
            const card = STEP_CARDS[stepNum - 1];
            const isActive = activeStep === stepNum;
            const isCompleted = completedSteps.includes(stepNum);
            const isLocked = lockedSteps.includes(stepNum);
            return (
              <button
                key={stepNum}
                className={`hop-step-card hop-step-card--img${isActive ? " hop-step-card--active" : ""}${isCompleted ? " hop-step-card--completed" : ""}${isLocked ? " hop-step-card--locked" : ""}`}
                style={{
                  "--card-color": card.color,
                  animationDelay: `${ci * 0.07}s`,
                }}
                onClick={() => !isLocked && onStepChange(stepNum)}
                disabled={isLocked}
                aria-label={`Step ${stepNum}: ${card.label}${isLocked ? " (locked by your teacher)" : ""}`}
                title={isLocked ? "Locked by your teacher" : card.label}
              >
                <img src={`/Step${stepNum}.png`} alt={`Step ${stepNum}: ${card.label}`} className="hop-step-card__img" />
                {isLocked && <span className="hop-step-card__lock">🔒</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ----- Compact step strip: 9 colored chips + Map button (replaces the
   stacked dots row + always-open diagram so the workspace gets the screen) ----- */
function StepStrip({ activeStep, completedSteps = [], onStepChange, lockedSteps = [], onOpenMap, mapOpen = false }) {
  return (
    <div className="step-strip">
      <div className="step-strip__chips" role="tablist" aria-label="Research steps">
        {STEP_CARDS.map((card) => {
          const num = card.num;
          const isActive = num === activeStep;
          const isCompleted = completedSteps.includes(num);
          const isLocked = lockedSteps.includes(num);
          return (
            <button
              key={num}
              className={`step-chip${isActive ? " step-chip--active" : ""}${isCompleted ? " step-chip--done" : ""}${isLocked ? " step-chip--locked" : ""}`}
              style={{ "--chip-color": card.color }}
              onClick={() => !isLocked && onStepChange(num)}
              disabled={isLocked}
              role="tab"
              aria-selected={isActive}
              aria-label={`Step ${num}: ${card.label}${isCompleted ? " (completed)" : ""}${isLocked ? " (locked by your teacher)" : ""}`}
              title={isLocked ? `${card.label} — locked by your teacher` : isCompleted ? `${card.label} — done` : card.label}
            >
              {isCompleted && !isLocked && (
                <span className="step-chip__medal" aria-hidden="true">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
              )}
              <span className="step-chip__num">{isLocked ? "🔒" : num}</span>
              <span className="step-chip__label">{STEP_LABELS[num - 1]}</span>
            </button>
          );
        })}
      </div>
      <button
        className={`step-strip__map${mapOpen ? " step-strip__map--open" : ""}`}
        onClick={onOpenMap}
        aria-expanded={mapOpen}
        title={mapOpen ? "Collapse the Hopscotch board" : "Open the Hopscotch board — see your whole research journey"}
      >
        <svg width="16" height="16" viewBox="0 0 128 46" fill="none" aria-hidden="true">
          <rect x="0" y="0" width="34" height="20" rx="5" fill="#2B5EA7"/>
          <rect x="0" y="26" width="34" height="20" rx="5" fill="#E8618C"/>
          <rect x="42" y="13" width="34" height="20" rx="5" fill="#1A8A7D"/>
          <rect x="84" y="0" width="34" height="20" rx="5" fill="#F0B429"/>
          <rect x="84" y="26" width="34" height="20" rx="5" fill="#F5922A"/>
        </svg>
        Hopscotch
        <span className={`step-strip__chevron${mapOpen ? " step-strip__chevron--open" : ""}`} aria-hidden="true">&#9662;</span>
      </button>
    </div>
  );
}

/* ----- Persistent mini Hopscotch board (always-visible navigator) ----- */
function MiniBoard({ activeStep, completedSteps = [], onStepChange, lockedSteps = [], onOpenMap }) {
  const doneCount = completedSteps.length;
  return (
    <div className="mini-board" aria-label="Hopscotch board — research steps">
      <div className="mini-board__track">
        {HOPSCOTCH_COLUMNS.map((col, ci) => (
          <div className={`mini-col mini-col--${col.type}`} key={ci}>
            {col.steps.map((num) => {
              const card = STEP_CARDS[num - 1];
              const isActive = num === activeStep;
              const isCompleted = completedSteps.includes(num);
              const isLocked = lockedSteps.includes(num);
              return (
                <button
                  key={num}
                  className={`mini-sq${isActive ? " mini-sq--active" : ""}${isCompleted ? " mini-sq--done" : ""}${isLocked ? " mini-sq--locked" : ""}${num === 9 ? " mini-sq--finish" : ""}`}
                  style={{ "--sq-color": card.color }}
                  onClick={() => !isLocked && onStepChange(num)}
                  disabled={isLocked}
                  aria-label={`Step ${num}: ${card.label}${isCompleted ? " (done)" : ""}${isLocked ? " (locked)" : ""}`}
                  aria-current={isActive ? "step" : undefined}
                  title={isLocked ? `${card.label} — locked by your teacher` : card.label}
                >
                  <span className="mini-sq__mark">{isLocked ? "🔒" : isCompleted ? "✓" : num}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mini-board__side">
        <div className="mini-board__now">
          <span className="mini-board__now-label">Step {activeStep}</span>
          <span className="mini-board__now-name">{STEP_LABELS[activeStep - 1]}</span>
        </div>
        <div className="mini-board__progress" title={`${doneCount} of 9 steps complete`}>
          <span className="mini-board__progress-val">{doneCount}/9</span>
        </div>
        <button className="mini-board__expand" onClick={onOpenMap} title="Open the full Hopscotch board">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ----- Student App ----- */

function StudentApp({ onBackToDashboard }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sessionId, setSessionId] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const [autoMessage, setAutoMessage] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Teacher-controlled modes: AI on/off + access/pacing (Phase 2).
  // Seeded from the login response, then kept fresh so teacher changes propagate.
  const [aiEnabled, setAiEnabled] = useState(user?.ai_enabled ?? true);
  const [accessMode, setAccessMode] = useState(user?.access_mode || "full");
  const [unlockedPhase, setUnlockedPhase] = useState(user?.unlocked_phase ?? null);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const me = await API.me();
        if (cancelled) return;
        if (typeof me.ai_enabled === "boolean") setAiEnabled(me.ai_enabled);
        if (me.access_mode) setAccessMode(me.access_mode);
        setUnlockedPhase(me.unlocked_phase ?? null);
      } catch {}
    };
    refresh();
    const id = setInterval(refresh, 45000); // pick up teacher changes within ~45s
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Layout personalization: which side panels are open (lifted here so the
  // toggle controls can live in the header)
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Auto-open the assistant when an auto-message arrives
  useEffect(() => {
    if (autoMessage) setRightOpen(true);
  }, [autoMessage]);

  // Guided tour state
  const [runTour, setRunTour] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourKey, setTourKey] = useState(0); // bump to remount Joyride so it restarts from step 0

  // Hopscotch board shown as an on-demand overlay (opened from the step strip)
  const [mapOpen, setMapOpen] = useState(false);

  // Per-user preference: step navigator style ("strip" = chips [default], "board" = mini Hopscotch board)
  const prefKey = `hop_pref_nav_${user?.email || user?.username || "anon"}`;
  const [navStyle, setNavStyle] = useState(() => localStorage.getItem(prefKey) || "strip");
  const chooseNavStyle = (id) => { setNavStyle(id); localStorage.setItem(prefKey, id); };
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Surface the patented Hopscotch board automatically: whenever a step is newly
  // completed, reveal the board (the student sees their "hop" + the new medallion),
  // then it tucks away so it never permanently costs screen space.
  const prevCompletedRef = useRef(null);
  useEffect(() => {
    const n = completedSteps.length;
    if (prevCompletedRef.current === null) { prevCompletedRef.current = n; return; }
    if (n > prevCompletedRef.current) {
      prevCompletedRef.current = n;
      setMapOpen(true);
      const t = setTimeout(() => setMapOpen(false), 5000);
      return () => clearTimeout(t);
    }
    prevCompletedRef.current = n;
  }, [completedSteps]);

  // Workspace layout — locked to the Hero concept
  const layoutMode = "hero";

  // Reading mode: expand the Assistant (Resources tucks away) for long exchanges
  const [assistantFocus, setAssistantFocus] = useState(false);

  // Force both panels open during the guided tour
  useEffect(() => {
    if (tourActive) {
      setLeftOpen(true);
      setRightOpen(true);
    }
  }, [tourActive]);

  // Persist session ID to localStorage so refresh stays on the same session
  useEffect(() => {
    if (sessionId) localStorage.setItem("hop_session_id", sessionId);
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const savedId = localStorage.getItem("hop_session_id");

        if (savedId) {
          // Try to load the previously active session
          try {
            const sessions = await API.listSessions();
            if (cancelled) return;
            const match = (sessions.sessions || []).find((s) => s.session_id === savedId);
            if (match) {
              setSessionId(match.session_id);
              setActiveStep(match.active_step || 1);
              setCompletedSteps(match.completed_steps || []);
              setLoading(false);
              return;
            }
          } catch {}
        }

        // Fallback: resume most recent session
        const resumed = await API.resumeSession();
        if (cancelled) return;
        if (resumed.found && resumed.session_id) {
          setSessionId(resumed.session_id);
          setActiveStep(resumed.active_step || 1);
          setCompletedSteps(resumed.completed_steps || []);
        } else {
          // No existing session — create a fresh one
          const { session_id } = await API.createSession();
          if (cancelled) return;
          setSessionId(session_id);
          setCompletedSteps([]);
        }
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setStatus("Failed to start session. Check backend.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-start the guided tour only once per account (on first login).
  // Marked "seen" the moment it opens, so a hard refresh won't re-trigger it —
  // students can always re-open it from the profile menu's "Take a guided tour".
  const tourSeenKey = `hop_tour_seen_${user?.email || user?.username || "anon"}`;
  useEffect(() => {
    if (!loading && sessionId && localStorage.getItem(tourSeenKey) !== "1") {
      const timer = setTimeout(() => {
        localStorage.setItem(tourSeenKey, "1");
        setTourActive(true);
        setRunTour(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading, sessionId, tourSeenKey]);

  function handleTourCallback(data) {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      setTourActive(false);
      localStorage.setItem(tourSeenKey, "1");
    }
  }

  function startTour() {
    setRunTour(false);
    setTourKey((k) => k + 1); // remount Joyride so it always starts fresh from step 0
    setTourActive(true);
    // Start on the next tick after the remount so react-joyride picks it up
    setTimeout(() => setRunTour(true), 50);
  }

  // Steps locked by the teacher's access/pacing mode (Phase 2)
  const lockedSteps = useMemo(() => {
    if (accessMode === "full") return [];
    const locked = [];
    for (let n = 1; n <= 9; n++) {
      if (isStepLocked(n, accessMode, unlockedPhase, completedSteps)) locked.push(n);
    }
    return locked;
  }, [accessMode, unlockedPhase, completedSteps]);

  function handleStepChange(step) {
    if (lockedSteps.includes(step)) return; // teacher has locked this step
    setActiveStep(step);
    if (sessionId) {
      API.updateActiveStep(sessionId, step).catch(console.error);
    }
  }

  async function resetSession() {
    setLoading(true);
    try {
      const { session_id } = await API.createSession();
      setSessionId(session_id);
      setActiveStep(1);
      setCompletedSteps([]);
      setChatRefreshKey((k) => k + 1);
      setAutoMessage(null);
      setStatus("Started a fresh session.");
    } catch (e) {
      console.error("resetSession error:", e);
      if (e.message?.includes("401")) {
        setStatus("Session expired. Please sign out and log back in.");
      } else {
        setStatus(`Failed to reset session: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  function loadSession(session) {
    setSessionId(session.session_id);
    setActiveStep(session.active_step || 1);
    setCompletedSteps(session.completed_steps || []);
    setChatRefreshKey((k) => k + 1);
    setAutoMessage(null);
    setStatus("");
  }

  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!downloadOpen) return;
    function handleClick(e) {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) {
        setDownloadOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [downloadOpen]);

  async function handleDownloadPDF() {
    setDownloadOpen(false);
    if (!sessionId) return;
    try {
      await API.downloadResearchDesign(sessionId);
    } catch (e) {
      console.error("PDF download failed:", e);
      setStatus("Failed to download research design PDF.");
    }
  }

  // Open the Conceptual Framework editor in a NEW TAB so students can keep their
  // research design open alongside it and edit back and forth. The new tab loads
  // the app with ?view=cf&session=<id>, which renders the standalone CF page.
  function handleOpenConceptualFramework() {
    setDownloadOpen(false);
    if (!sessionId) return;
    const url = `${window.location.origin}${window.location.pathname}?view=cf&session=${encodeURIComponent(sessionId)}`;
    window.open(url, "_blank", "noopener");
  }

  const step3Completed = completedSteps.includes(3);

  return (
    <div className={`hop-wrap${tourActive ? " hop-wrap--touring" : ""}`}>
      {/* Header — edge-to-edge, matching login page style */}
      <header className="hop-header">
        <div className="hop-header__left">
          <img
            src={theme === "dark" ? "/Hopscotch4-all-logo-White-alpha.png" : "/Hopscotch-4-all-logo-alpha.png"}
            alt="Hopscotch 4 All"
            className="hop-logo"
          />
          {onBackToDashboard && (
            <button
              className="hop-header__back-btn"
              onClick={onBackToDashboard}
            >
              &larr; Dashboard
            </button>
          )}
          <button
            className="hop-header__designs"
            onClick={() => setHistoryOpen(true)}
            aria-label="My designs — view, switch, or start a new research design"
            title="View your designs or start a new one"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            My Designs
          </button>
        </div>
        {/* Center: Layout personalization — toggle side panels */}
        <div className="hop-header__center">
          <div className="cmd-bar cmd-bar--header" role="group" aria-label="Show or hide the side panels">
            <button
              className={`cmd-bar__btn cmd-bar__btn--lesson${leftOpen ? " cmd-bar__btn--active" : ""}`}
              onClick={() => setLeftOpen((o) => !o)}
              aria-label="Toggle resources panel"
              aria-pressed={leftOpen}
            >
              <span className="cmd-bar__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </span>
              <span className="cmd-bar__label">Resources</span>
            </button>
            <button
              className={`cmd-bar__btn cmd-bar__btn--assistant${rightOpen ? " cmd-bar__btn--active" : ""}`}
              onClick={() => setRightOpen((o) => !o)}
              aria-label="Toggle assistant panel"
              aria-pressed={rightOpen}
            >
              <span className="cmd-bar__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </span>
              <span className="cmd-bar__label">Assistant</span>
            </button>
          </div>
        </div>
        <div className="hop-header__right">
          <FeedbackPanel />
          <div className="hop-download" ref={downloadRef}>
            <button
              className="hop-header__download"
              onClick={() => setDownloadOpen((o) => !o)}
              title="Download designs"
            >
              Download Design
              <span className={`hop-download__arrow${downloadOpen ? " hop-download__arrow--open" : ""}`}>&#9662;</span>
            </button>
            {downloadOpen && (
              <div className="hop-download__menu">
                <button className="hop-download__item" onClick={handleDownloadPDF}>
                  <span className="hop-download__icon">PDF</span>
                  Research Design
                </button>
                <button
                  className={`hop-download__item${!step3Completed ? " hop-download__item--disabled" : ""}`}
                  onClick={step3Completed ? handleOpenConceptualFramework : undefined}
                  disabled={!step3Completed}
                  title={!step3Completed ? "Complete Step 3 (Literature) to unlock" : "Edit & Print Conceptual Framework (opens in a new tab)"}
                >
                  <span className="hop-download__icon" style={{ background: "#6AA84F" }}>CF</span>
                  Conceptual Framework
                  {!step3Completed ? (
                    <span className="hop-download__lock">Step 3</span>
                  ) : (
                    <span className="hop-download__newtab" aria-hidden="true" title="Opens in a new tab">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
          {user && (
            <>
              <span className="hop-header__divider" />
              <ProfileMenu
                user={user}
                onSignOut={logout}
                onOpenSettings={() => setSettingsOpen(true)}
                onStartTour={startTour}
              />
            </>
          )}
        </div>
      </header>

      {/* Content area — full-height app shell */}
      <div className="hop-content">
        {/* Step navigator — user-selectable style (Settings) */}
        {navStyle === "strip" ? (
          <StepStrip
            activeStep={activeStep}
            completedSteps={completedSteps}
            onStepChange={handleStepChange}
            lockedSteps={lockedSteps}
            mapOpen={mapOpen}
            onOpenMap={() => setMapOpen((o) => !o)}
          />
        ) : (
          <MiniBoard
            activeStep={activeStep}
            completedSteps={completedSteps}
            onStepChange={handleStepChange}
            lockedSteps={lockedSteps}
            onOpenMap={() => setMapOpen((o) => !o)}
          />
        )}

        {/* Hopscotch board: collapses into the strip; expands inline and
            auto-collapses after the student hops to a step */}
        <div className={`hop-board-collapse${mapOpen ? " hop-board-collapse--open" : ""}`} aria-hidden={!mapOpen}>
          <div className="hop-board-collapse__inner">
            <StepDiagram
              activeStep={activeStep}
              completedSteps={completedSteps}
              lockedSteps={lockedSteps}
              onStepChange={(n) => { handleStepChange(n); setMapOpen(false); }}
            />
          </div>
        </div>

        {/* Split-panel tabbed layout: Resource / Step Details / Chat */}
        <SplitPanelLayout
          activeStep={activeStep}
          sessionId={sessionId}
          chatRefreshKey={chatRefreshKey}
          autoMessage={autoMessage}
          onAutoMessageSent={() => setAutoMessage(null)}
          onChatRefresh={() => setChatRefreshKey((k) => k + 1)}
          onAutoSend={setAutoMessage}
          onCompletedStepsChange={setCompletedSteps}
          loading={loading}
          status={status}
          educationLevel={user?.education_level || "high_school"}
          tourActive={tourActive}
          leftOpen={leftOpen}
          rightOpen={rightOpen}
          onCloseLeft={() => setLeftOpen(false)}
          onCloseRight={() => setRightOpen(false)}
          aiEnabled={aiEnabled}
          layoutMode={layoutMode}
          assistantFocus={assistantFocus}
          onToggleAssistantFocus={() => setAssistantFocus((f) => !f)}
        />
      </div>

      {/* Settings modal — shared chrome + universal Appearance section */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} toggleTheme={toggleTheme}>

              {/* ── Step navigation ── */}
              <section className="hop-settings__section">
                <div className="hop-settings__section-head">
                  <span className="hop-settings__section-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
                  </span>
                  <div className="hop-settings__section-hettext">
                    <span className="hop-settings__section-title">Step navigation</span>
                    <span className="hop-settings__section-desc">How the 9 research steps appear at the top of your workspace.</span>
                  </div>
                </div>
                <div className="hop-settings__section-body">
                  <div className="hop-settings__choices">
                    {[
                      { id: "board", title: "Hopscotch Board", desc: "The classic board — squares light up as you progress." },
                      { id: "strip", title: "Step Strip", desc: "A compact single row of labelled step chips." },
                    ].map((opt) => (
                      <button key={opt.id} className={`hop-settings__choice${navStyle === opt.id ? " hop-settings__choice--active" : ""}`} onClick={() => chooseNavStyle(opt.id)}>
                        <span className={`hop-settings__preview hop-settings__preview--${opt.id}`} aria-hidden="true">
                          {opt.id === "board" ? (
                            <>
                              <span style={{ background: "#2B5EA7" }} /><span style={{ background: "#E8618C" }} />
                              <span style={{ background: "#1A8A7D" }} /><span style={{ background: "#F0B429" }} />
                              <span style={{ background: "#F5922A" }} /><span style={{ background: "#7B8794" }} />
                            </>
                          ) : (<><i /><i /><i /><i /></>)}
                        </span>
                        <span className="hop-settings__choice-text">
                          <span className="hop-settings__choice-title">{opt.title}</span>
                          <span className="hop-settings__choice-desc">{opt.desc}</span>
                        </span>
                        <span className="hop-settings__radio" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Panels ── */}
              <section className="hop-settings__section">
                <div className="hop-settings__section-head">
                  <span className="hop-settings__section-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                  </span>
                  <div className="hop-settings__section-hettext">
                    <span className="hop-settings__section-title">Panels</span>
                    <span className="hop-settings__section-desc">Show or hide the side panels in your workspace.</span>
                  </div>
                </div>
                <div className="hop-settings__section-body">
                  <div className="hop-settings__toggles">
                    {[
                      { on: leftOpen, set: () => setLeftOpen((o) => !o), title: "Interactive Resources", desc: "Videos, interactive activities, and the glossary." },
                      { on: rightOpen, set: () => setRightOpen((o) => !o), title: "Research Assistant", desc: "Your AI research mentor chat." },
                    ].map((row, idx) => (
                      <div className="hop-settings__toggle" key={idx}>
                        <div className="hop-settings__toggle-text">
                          <span className="hop-settings__toggle-title">{row.title}</span>
                          <span className="hop-settings__toggle-desc">{row.desc}</span>
                        </div>
                        <button type="button" className={`hop-switch${row.on ? " hop-switch--on" : ""}`} role="switch" aria-checked={row.on} aria-label={`Toggle ${row.title}`} onClick={row.set}>
                          <span className="hop-switch__thumb" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

      </SettingsModal>

      <Joyride
        key={tourKey}
        steps={TOUR_STEPS}
        run={runTour}
        continuous
        showSkipButton
        disableScrolling
        disableOverlayClose
        spotlightPadding={12}
        callback={handleTourCallback}
        tooltipComponent={TourTooltip}
        styles={{
          options: {
            zIndex: 10000,
            overlayColor: "rgba(18, 21, 26, 0.25)",
          },
          spotlight: {
            borderRadius: 12,
          },
        }}
        floaterProps={{
          styles: {
            floater: { filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.18))" },
          },
        }}
      />

      <SessionHistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentSessionId={sessionId}
        onSelectSession={loadSession}
        onNewSession={resetSession}
      />
    </div>
  );
}


/* ----- App router (default export) ----- */

/* ----- Standalone Conceptual Framework page (opened in its own tab) ----- */
function ConceptualFrameworkPage({ sessionId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await API.getConceptualFrameworkData(sessionId);
        if (!cancelled) setData(d);
      } catch (e) {
        console.error("CF data load failed:", e);
        if (!cancelled) setError("Failed to load your conceptual framework. Please return to your design and try again.");
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Closing returns to the design: close this tab if it was opened by the app,
  // otherwise fall back to navigating home.
  const handleClose = () => {
    window.close();
    window.location.href = window.location.pathname;
  };

  if (error) {
    return (
      <div className="cf-loading-overlay">
        <div className="cf-loading-card">
          <p className="cf-loading-text">Couldn’t open the Conceptual Framework</p>
          <p className="cf-loading-sub">{error}</p>
          <button className="hop-header__back-btn" style={{ marginTop: 12 }} onClick={handleClose}>Close tab</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cf-loading-overlay">
        <div className="cf-loading-card">
          <div className="cf-loading-spinner" />
          <p className="cf-loading-text">Generating Conceptual Framework...</p>
          <p className="cf-loading-sub">The AI is analyzing your research data to structure the diagram.</p>
        </div>
      </div>
    );
  }

  return <ConceptualFrameworkEditor data={data} onClose={handleClose} />;
}

export default function App() {
  const { user, loading } = useAuth();
  const [teacherView, setTeacherView] = useState("dashboard");

  // Detect the standalone Conceptual Framework tab (?view=cf&session=<id>)
  const cfParams = new URLSearchParams(window.location.search);
  const cfSessionId = cfParams.get("view") === "cf" ? cfParams.get("session") : null;

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  // Standalone Conceptual Framework tab — render the editor directly regardless of role
  if (cfSessionId) return <ConceptualFrameworkPage sessionId={cfSessionId} />;
  if (user.role === "admin") return <AdminDashboard />;
  // All teachers/faculty get dashboard + ability to create research designs
  if (user.role === "teacher") {
    if (teacherView === "designs") {
      return <StudentApp onBackToDashboard={() => setTeacherView("dashboard")} />;
    }
    return <TeacherDashboard onOpenDesigns={() => setTeacherView("designs")} />;
  }
  return <StudentApp />;
}
