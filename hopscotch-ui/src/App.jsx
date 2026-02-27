// src/App.jsx
import "./App.css";
import React, { useEffect, useState, useRef, useCallback } from "react";
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
import { Joyride, STATUS } from "react-joyride";

/* ----- Guided tour steps ----- */
const TOUR_STEPS = [
  {
    target: ".hop-header",
    title: "Welcome to Hopscotch!",
    content: "This is your research design workspace. Let\u2019s take a quick tour of the key areas so you feel right at home.",
    disableBeacon: true,
    icon: "👋",
  },
  {
    target: ".step-progress",
    title: "Step Progress",
    content: "Your 9-step research journey at a glance. Each dot lights up as you complete a step \u2014 click any to jump back.",
    icon: "🎯",
  },
  {
    target: ".hop-diagram",
    title: "Research Diagram",
    content: "A visual map showing how every step connects to the bigger picture of your research design.",
    icon: "🗺️",
  },
  {
    target: ".pin-panel--left",
    title: "Resources Panel",
    content: "Curated videos, articles, and interactive tools tailored to whichever step you\u2019re working on.",
    icon: "📚",
  },
  {
    target: ".pin-layout__main",
    title: "Your Workspace",
    content: "The heart of it all \u2014 fill in your research design fields here and the AI will guide you along the way.",
    icon: "✏️",
  },
  {
    target: ".pin-panel--right",
    title: "AI Research Assistant",
    content: "Your personal research mentor. Ask questions, get feedback, and receive step-by-step guidance anytime.",
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
    content: "When you\u2019re ready, export your completed design as a PDF or generate a Conceptual Framework diagram.",
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
  "Worldview", "Topic", "Literature", "Methodology", "Question",
  "Data", "Analysis", "Trustworthiness", "Ethics",
];

function StepProgressBar({ activeStep, completedSteps = [], onStepChange }) {
  return (
    <nav className="step-progress" aria-label="Research steps">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const isActive = num === activeStep;
        const isCompleted = completedSteps.includes(num);
        return (
          <div className="step-progress__item" key={num}>
            <button
              className={`step-progress__dot${isActive ? " step-progress__dot--active" : ""}${isCompleted ? " step-progress__dot--completed" : ""}`}
              onClick={() => onStepChange(num)}
              aria-label={`Step ${num}: ${label}`}
              title={label}
            >
              {isCompleted ? "\u2713" : num}
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
function StepDiagram({ activeStep, completedSteps = [], onStepChange }) {
  return (
    <div className="hop-diagram">
      {HOPSCOTCH_COLUMNS.map((col, ci) => (
        <div className={`hop-diagram__col hop-diagram__col--${col.type}`} key={ci}>
          {col.steps.map((stepNum) => {
            const card = STEP_CARDS[stepNum - 1];
            const isActive = activeStep === stepNum;
            const isCompleted = completedSteps.includes(stepNum);
            return (
              <button
                key={stepNum}
                className={`hop-step-card hop-step-card--img${isActive ? " hop-step-card--active" : ""}${isCompleted ? " hop-step-card--completed" : ""}`}
                style={{
                  "--card-color": card.color,
                  animationDelay: `${ci * 0.07}s`,
                }}
                onClick={() => onStepChange(stepNum)}
                aria-label={`Step ${stepNum}: ${card.label}`}
              >
                <img src={`/Step${stepNum}.png`} alt={`Step ${stepNum}: ${card.label}`} className="hop-step-card__img" />
              </button>
            );
          })}
        </div>
      ))}
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

  // Guided tour state
  const [runTour, setRunTour] = useState(false);
  const [tourActive, setTourActive] = useState(false);

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

  // Auto-start guided tour for first-time users
  useEffect(() => {
    if (!loading && sessionId && localStorage.getItem("hop_tour_done") !== "1") {
      const timer = setTimeout(() => {
        setTourActive(true);
        setRunTour(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading, sessionId]);

  function handleTourCallback(data) {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      setTourActive(false);
      localStorage.setItem("hop_tour_done", "1");
    }
  }

  function startTour() {
    setTourActive(true);
    setRunTour(true);
  }

  function handleStepChange(step) {
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

  const [cfData, setCfData] = useState(null);
  const [cfOpen, setCfOpen] = useState(false);
  const [cfLoading, setCfLoading] = useState(false);

  async function handleOpenConceptualFramework() {
    setDownloadOpen(false);
    if (!sessionId) return;
    try {
      setCfLoading(true);
      const data = await API.getConceptualFrameworkData(sessionId);
      setCfData(data);
      setCfOpen(true);
    } catch (e) {
      console.error("CF data load failed:", e);
      setStatus("Failed to load conceptual framework data.");
    } finally {
      setCfLoading(false);
    }
  }

  const step3Completed = completedSteps.includes(3);

  if (cfLoading) {
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

  if (cfOpen && cfData) {
    return <ConceptualFrameworkEditor data={cfData} onClose={() => setCfOpen(false)} />;
  }

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
            className="session-history-btn"
            onClick={() => setHistoryOpen(true)}
            aria-label="Create a new design"
            data-tooltip="Create a new design"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>
        <div className="hop-header__right">
          {user && (
            <div className="hop-user">
              <span className="hop-user__avatar">{user.name?.charAt(0).toUpperCase()}</span>
              <span className="hop-user__name">{user.name}</span>
            </div>
          )}
          <FeedbackPanel />
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? "\u2600" : "\u263E"}
          </button>
          <button className="hop-tour-btn" onClick={startTour} title="Take a guided tour">
            ?
          </button>
          <span className="hop-header__divider" />
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
                  title={!step3Completed ? "Complete Step 3 (Literature) to unlock" : "Edit & Print Conceptual Framework"}
                >
                  <span className="hop-download__icon" style={{ background: "#6AA84F" }}>CF</span>
                  Conceptual Framework
                  {!step3Completed && <span className="hop-download__lock">Step 3</span>}
                </button>
              </div>
            )}
          </div>
          <span className="hop-header__divider" />
          <button className="hop-header__signout" onClick={logout}>Sign Out</button>
        </div>
      </header>

      {/* Content area — centered max-width */}
      <div className="hop-content">
        {/* Step progress bar */}
        <StepProgressBar activeStep={activeStep} completedSteps={completedSteps} onStepChange={handleStepChange} />

        {/* Step diagram under header */}
        <StepDiagram activeStep={activeStep} completedSteps={completedSteps} onStepChange={handleStepChange} />

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
        />
      </div>

      <Joyride
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

export default function App() {
  const { user, loading } = useAuth();
  const [teacherView, setTeacherView] = useState("dashboard");

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
