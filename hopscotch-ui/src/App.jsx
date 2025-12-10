// src/App.jsx
import "./App.css";
import React, { useEffect, useState } from "react";
import { API } from "./api";
import ChatBox from "./ChatBox";
import StepDetails from "./StepDetails";

/* Small local UI helpers */
const Btn = ({ className = "", ...p }) => (
  <button {...p} className={`btn ${className}`} />
);
const Chip = ({ children }) => <span className="badge">{children}</span>;

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

/* ----- Step diagram with hotspots ----- */
function StepDiagram({ activeStep, onStepChange }) {
  return (
    <div className="step-diagram-wrap">
      <div className="step-diagram">
        <img src="/hopscotch-steps.png" alt="Hopscotch 9-step diagram" />

        <button
          className={`step-hotspot step-1 ${
            activeStep === 1 ? "active" : ""
          }`}
          onClick={() => onStepChange(1)}
          aria-label="Step 1 - Who am I as a researcher?"
        />
        <button
          className={`step-hotspot step-2 ${
            activeStep === 2 ? "active" : ""
          }`}
          onClick={() => onStepChange(2)}
          aria-label="Step 2 - What am I wondering about?"
        />
        <button
          className={`step-hotspot step-3 ${
            activeStep === 3 ? "active" : ""
          }`}
          onClick={() => onStepChange(3)}
          aria-label="Step 3 - What do I already know?"
        />
        <button
          className={`step-hotspot step-4 ${
            activeStep === 4 ? "active" : ""
          }`}
          onClick={() => onStepChange(4)}
          aria-label="Step 4 - How will I study it?"
        />
        <button
          className={`step-hotspot step-5 ${
            activeStep === 5 ? "active" : ""
          }`}
          onClick={() => onStepChange(5)}
          aria-label="Step 5 - What is my research question?"
        />
        <button
          className={`step-hotspot step-6 ${
            activeStep === 6 ? "active" : ""
          }`}
          onClick={() => onStepChange(6)}
          aria-label="Step 6 - What is the data to collect?"
        />
        <button
          className={`step-hotspot step-7 ${
            activeStep === 7 ? "active" : ""
          }`}
          onClick={() => onStepChange(7)}
          aria-label="Step 7 - How will I make sense of the data?"
        />
        <button
          className={`step-hotspot step-8 ${
            activeStep === 8 ? "active" : ""
          }`}
          onClick={() => onStepChange(8)}
          aria-label="Step 8 - How will I ensure my evidence is trustworthy?"
        />
        <button
          className={`step-hotspot step-9 ${
            activeStep === 9 ? "active" : ""
          }`}
          onClick={() => onStepChange(9)}
          aria-label="Step 9 - How will I be ethical and safe in my study?"
        />
      </div>
    </div>
  );
}

/* ----- App root ----- */

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { session_id } = await API.createSession();
        setSessionId(session_id);
      } catch (e) {
        console.error(e);
        setStatus("Failed to start session. Check backend.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      {/* Header */}
      <header className="hop-header">
        <div className="hop-header__left">
          <img
            src="/hopscotch-logo.png"
            alt="Hopscotch 4 All"
            className="hop-logo"
          />
          <div className="hop-app-title" />
        </div>
        <div className="hop-header__right">
          <Chip>
            {sessionId
              ? "Session active"
              : loading
              ? "Starting session..."
              : "No session"}
          </Chip>
          <Btn onClick={resetSession}>New Session</Btn>
        </div>
      </header>

      {/* Step diagram under header */}
      <StepDiagram activeStep={activeStep} onStepChange={setActiveStep} />

      {/* 2-column layout: left Genially, right step details + chat */}
      <div className="hop-layout">
        <aside className="hop-left-panel">
          <StepResourcePanel activeStep={activeStep} />
        </aside>

        <section className="hop-right-panel">
          {/* Step-specific directions + inputs (saved in backend) */}
          <StepDetails step={activeStep} sessionId={sessionId} />

          {/* Assistant Chat */}
          <section className="hop-wide">
            {loading && !sessionId ? (
              <div className="badge">Starting session…</div>
            ) : (
              <>
                <ChatBox sessionId={sessionId} />
                {status && (
                  <div className="badge" style={{ marginTop: 8 }}>
                    {status}
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
