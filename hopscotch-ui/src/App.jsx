// src/App.jsx
import "./App.css";
import React, { useEffect, useState } from "react";
import { API } from "./api";
import ChatBox from "./ChatBox";
import StepDetails from "./StepDetails";
import { useAuth } from "./AuthContext";
import LoginPage from "./LoginPage";
import TeacherDashboard from "./TeacherDashboard";

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

function StepProgressBar({ activeStep, onStepChange }) {
  return (
    <nav className="step-progress" aria-label="Research steps">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const isActive = num === activeStep;
        const isCompleted = num < activeStep;
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

/* ----- Genially URLs per step ----- */
const STEP_GENIALLY = {
  1: "https://view.genially.com/6626b5edb31fe80014324408",
  2: "https://view.genially.com/6626b5ff75024b0014c9c279",
  3: "https://view.genially.com/6626b64db31fe8001432844c",
  4: "https://view.genially.com/6626b6648a9b7d0014fd0809",
  5: "https://view.genially.com/6626b6792aa762001439fe8f",
  6: "https://view.genially.com/6626b6a92b4ff00014385a51",
  7: "https://view.genially.com/6626b6c22b4ff000143872e2",
  8: "https://view.genially.com/6626b6e02b4ff0001438901b",
  9: "https://view.genially.com/6626b6f22aa76200143a6d36",
};

/* ----- Left panel: embedded Genially ----- */
function StepResourcePanel({ activeStep }) {
  const url = STEP_GENIALLY[activeStep];

  if (!url) {
    return (
      <div className="embed-card">
        <h3 className="embed-title">Interactive resource</h3>
        <p className="embed-placeholder">
          No interactive resource has been configured for this step yet.
        </p>
      </div>
    );
  }

  return (
    <div className="embed-card">
      <h3 className="embed-title">Interactive resource for Step {activeStep}</h3>
      <div className="embed-frame-wrap">
        <iframe
          src={url}
          title={`Step ${activeStep} interactive resource`}
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
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
function StepDiagram({ activeStep, onStepChange }) {
  return (
    <div className="hop-diagram">
      {HOPSCOTCH_COLUMNS.map((col, ci) => (
        <div className={`hop-diagram__col hop-diagram__col--${col.type}`} key={ci}>
          {col.steps.map((stepNum) => {
            const card = STEP_CARDS[stepNum - 1];
            const isActive = activeStep === stepNum;
            const isCompleted = stepNum < activeStep;
            return (
              <button
                key={stepNum}
                className={`hop-step-card${isActive ? " hop-step-card--active" : ""}${isCompleted ? " hop-step-card--completed" : ""}`}
                style={{
                  "--card-color": card.color,
                  animationDelay: `${ci * 0.07}s`,
                }}
                onClick={() => onStepChange(stepNum)}
                aria-label={`Step ${stepNum}: ${card.label}`}
              >
                <span className="hop-step-card__num">Step {stepNum}</span>
                <span className="hop-step-card__label">{card.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ----- Student App ----- */

function StudentApp() {
  const { user, logout } = useAuth();
  const [sessionId, setSessionId] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [chatRefreshKey, setChatRefreshKey] = useState(0);
  const [autoMessage, setAutoMessage] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Try to resume an existing session first
        const resumed = await API.resumeSession();
        if (resumed.found && resumed.session_id) {
          setSessionId(resumed.session_id);
          setActiveStep(resumed.active_step || 1);
        } else {
          // No existing session — create a fresh one
          const { session_id } = await API.createSession();
          setSessionId(session_id);
        }
      } catch (e) {
        console.error(e);
        setStatus("Failed to start session. Check backend.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      setStatus("Started a fresh session.");
    } catch (e) {
      console.error(e);
      setStatus("Failed to reset session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hop-wrap">
      {/* Header — edge-to-edge, matching login page style */}
      <header className="hop-header">
        <div className="hop-header__left">
          <img
            src="/hopscotch-logo.png"
            alt="Hopscotch 4 All"
            className="hop-logo"
          />
        </div>
        <div className="hop-header__right">
          {user && (
            <div className="hop-user">
              <span className="hop-user__avatar">{user.name?.charAt(0).toUpperCase()}</span>
              <span className="hop-user__name">{user.name}</span>
            </div>
          )}
          <span className="hop-header__divider" />
          <button className="hop-header__signout" onClick={logout}>Sign Out</button>
        </div>
      </header>

      {/* Content area — centered max-width */}
      <div className="hop-content">
        {/* Step progress bar */}
        <StepProgressBar activeStep={activeStep} onStepChange={handleStepChange} />

        {/* Step diagram under header */}
        <StepDiagram activeStep={activeStep} onStepChange={handleStepChange} />

        {/* 2-column layout: left Genially, right step details + chat */}
        <div className="hop-layout">
          <aside className="hop-left-panel">
            <StepResourcePanel activeStep={activeStep} />
          </aside>

          <section className="hop-right-panel">
            {/* Step-specific directions + inputs (saved in backend) */}
            <StepDetails step={activeStep} sessionId={sessionId} onChatRefresh={() => setChatRefreshKey((k) => k + 1)} onAutoSend={setAutoMessage} />

            {/* Assistant Chat */}
            {loading && !sessionId ? (
              <div className="badge badge--neutral">Starting session…</div>
            ) : (
              <>
                <ChatBox sessionId={sessionId} activeStep={activeStep} refreshKey={chatRefreshKey} autoMessage={autoMessage} onAutoMessageSent={() => setAutoMessage(null)} />
                {status && (
                  <div className="badge" style={{ marginTop: 8 }}>
                    {status}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}


/* ----- App router (default export) ----- */

export default function App() {
  const { user, loading } = useAuth();

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
  if (user.role === "teacher") return <TeacherDashboard />;
  return <StudentApp />;
}
