// src/StudentDesignView.jsx — Read-only view of a student's research design (teacher overlay)
import React, { useEffect, useState } from "react";
import { API } from "./api";

const STEP_LABELS = [
  "Worldview", "Topic & Goals", "Literature", "Methodology", "Research Question",
  "Data Collection", "Analysis", "Trustworthiness", "Ethics",
];

const STEP_COLORS = [
  "#2B5EA7", "#E8618C", "#D94040", "#1A8A7D", "#B0A47A",
  "#00AEEF", "#F0B429", "#F5922A", "#7B8794",
];

const WORLDVIEW_LABELS = {
  positivist: "Positivist",
  post_positivist: "Post Positivist",
  constructivist: "Constructivist",
  transformative: "Transformative",
  pragmatist: "Pragmatist",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const ts = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function StudentDesignView({ sessionId, studentName, className: classNameProp, onClose }) {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewStep, setViewStep] = useState(1);
  const [stepConfig, setStepConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Feedback state — one feedback for the whole design
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);

  // Load full session data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    API.getStudentSession(sessionId)
      .then((data) => {
        if (cancelled) return;
        setSessionData(data);
        setFeedbackList(data.teacher_feedback || []);
        setViewStep(data.active_step || 1);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Failed to load student session");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  // Load step config for steps 4-9
  useEffect(() => {
    if (!sessionData || viewStep <= 3) {
      setStepConfig(null);
      return;
    }
    let cancelled = false;
    setConfigLoading(true);
    API.getStudentStepConfig(sessionId, viewStep)
      .then((cfg) => { if (!cancelled) setStepConfig(cfg); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setConfigLoading(false); });
    return () => { cancelled = true; };
  }, [viewStep, sessionId, sessionData]);

  async function handleSubmitFeedback() {
    if (!feedbackText.trim()) return;
    setSubmitting(true);
    try {
      const res = await API.postTeacherFeedback(sessionId, null, feedbackText.trim());
      setFeedbackList((prev) => [...prev, res.feedback]);
      setFeedbackText("");
    } catch (e) {
      console.error("Failed to post feedback:", e);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadPDF() {
    if (!sessionId) return;
    try {
      await API.downloadResearchDesign(sessionId);
    } catch (e) {
      console.error("PDF download failed:", e);
    }
  }

  const completed = sessionData?.completed_steps || [];
  const stepNotes = sessionData?.step_notes || {};

  return (
    <div className="sdv-overlay">
      {/* Header */}
      <div className="sdv-header">
        <div className="sdv-header__left">
          <button className="sdv-close" onClick={onClose}>&larr; Back</button>
          <h2 className="sdv-header__name">{studentName || sessionData?.student_name || "Student"}</h2>
          {classNameProp && <span className="sdv-header__class">{classNameProp}</span>}
          {sessionData?.worldview_label && (
            <span className="sdv-badge" style={{ background: "#2B5EA7" }}>{sessionData.worldview_label}</span>
          )}
          {sessionData?.resolved_path && (
            <span className="sdv-badge" style={{ background: "#1A8A7D" }}>{sessionData.resolved_path}</span>
          )}
        </div>
        <div className="sdv-header__right">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={handleDownloadPDF}>
            Download PDF
          </button>
        </div>
      </div>

      {loading && <div className="sdv-loading">Loading student design...</div>}
      {error && <div className="td-alert td-alert--error" style={{ margin: 16 }}>{error}</div>}

      {!loading && !error && sessionData && (
        <div className="sdv-body">
          {/* Left sidebar — step navigator */}
          <nav className="sdv-steps">
            {STEP_LABELS.map((label, i) => {
              const num = i + 1;
              const isActive = num === viewStep;
              const isDone = completed.includes(num);
              return (
                <button
                  key={num}
                  className={`sdv-step-btn${isActive ? " sdv-step-btn--active" : ""}${isDone ? " sdv-step-btn--done" : ""}`}
                  onClick={() => setViewStep(num)}
                >
                  <span
                    className="sdv-step-btn__dot"
                    style={isDone ? { background: STEP_COLORS[i] } : {}}
                  >
                    {isDone ? "\u2713" : num}
                  </span>
                  <span className="sdv-step-btn__label">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right side — step content + feedback */}
          <div className="sdv-right">
            {/* Step content (scrollable) */}
            <div className="sdv-content">
              <h3 className="sdv-content__title" style={{ borderLeftColor: STEP_COLORS[viewStep - 1] }}>
                Step {viewStep}: {STEP_LABELS[viewStep - 1]}
              </h3>

              <ReadOnlyStepContent
                step={viewStep}
                data={stepNotes[String(viewStep)] || {}}
                stepConfig={stepConfig}
                configLoading={configLoading}
                sessionData={sessionData}
              />
            </div>

            {/* Feedback section — one for the whole design */}
            <div className="sdv-feedback">
              <h4 className="sdv-feedback__title">Feedback</h4>

              {feedbackList.length > 0 && (
                <div className="sdv-feedback__list">
                  {[...feedbackList].reverse().map((fb) => (
                    <div key={fb.id} className="sdv-feedback__item">
                      <div className="sdv-feedback__meta">
                        <strong>{fb.teacher_name}</strong>
                        <span className="sdv-feedback__time">{timeAgo(fb.created_at)}</span>
                      </div>
                      <p className="sdv-feedback__text">{fb.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {feedbackList.length === 0 && (
                <p className="sdv-feedback__empty">No feedback yet.</p>
              )}

              <div className="sdv-feedback__input">
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="Write your feedback on this student's research design..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />
                <button
                  className="td-btn td-btn--primary td-btn--sm"
                  onClick={handleSubmitFeedback}
                  disabled={submitting || !feedbackText.trim()}
                >
                  {submitting ? "Sending..." : "Send Feedback"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* Read-only rendering of a single step's data */
function ReadOnlyStepContent({ step, data, stepConfig, configLoading, sessionData }) {
  const isEmpty = !data || Object.keys(data).length === 0;

  if (isEmpty) {
    return <p className="sdv-empty">This step has not been completed yet.</p>;
  }

  // Step 1: Worldview
  if (step === 1) {
    const wv = data.worldview_id || data.worldview || "";
    const label = WORLDVIEW_LABELS[wv] || wv || "Not selected";
    return (
      <div className="sdv-fields">
        <ReadOnlyField label="Worldview" value={label} />
      </div>
    );
  }

  // Step 2: Topic & Goals
  if (step === 2) {
    return (
      <div className="sdv-fields">
        <ReadOnlyField label="Research Topic" value={data.topic} />
        <ReadOnlyField label="Personal Goals" value={data.personalGoals || data.personal_goals} />
        <ReadOnlyField label="Practical Goals" value={data.practicalGoals || data.practical_goals} />
        <ReadOnlyField label="Intellectual Goals" value={data.intellectualGoals || data.intellectual_goals} />
        {data.goals && !data.personalGoals && <ReadOnlyField label="Research Goals" value={data.goals} />}
      </div>
    );
  }

  // Step 3: Literature
  if (step === 3) {
    return (
      <div className="sdv-fields">
        <ReadOnlyField label="Topical Research" value={data.topicalResearch || data.topical_research} />
        <ReadOnlyField label="Theoretical Frameworks" value={data.theoreticalFrameworks || data.theoretical_frameworks} />
      </div>
    );
  }

  // Steps 4-9: config-driven
  if (configLoading) {
    return <p className="sdv-empty">Loading step configuration...</p>;
  }

  if (stepConfig && stepConfig.path) {
    return (
      <div className="sdv-fields">
        <ReadOnlyConfigFields config={stepConfig} data={data} sessionData={sessionData} />
        {data.notes && <ReadOnlyField label="Additional Notes" value={data.notes} />}
      </div>
    );
  }

  // Fallback: render all key-value pairs
  return (
    <div className="sdv-fields">
      {Object.entries(data).map(([key, val]) => {
        if (!val) return null;
        const display = Array.isArray(val) ? val.join(", ") : String(val);
        return <ReadOnlyField key={key} label={key} value={display} />;
      })}
    </div>
  );
}


/* Render config-driven fields in read-only mode */
function ReadOnlyConfigFields({ config, data, sessionData }) {
  const { field_type, field_key, options, fields } = config;

  if (field_type === "single_select") {
    const opt = (options || []).find((o) => o.id === data[field_key]);
    return (
      <ReadOnlyField
        label="Selected"
        value={opt ? `${opt.label}${opt.description ? ` — ${opt.description}` : ""}` : data[field_key] || "Not selected"}
      />
    );
  }

  if (field_type === "multi_select") {
    const selected = data[field_key] || [];
    const labels = selected.map((id) => {
      const opt = (options || []).find((o) => o.id === id);
      return opt ? opt.label : id;
    });
    return <ReadOnlyField label="Selected" value={labels.join(", ") || "None selected"} />;
  }

  if (field_type === "methodology_decision") {
    const chosen = data.chosen_methodology || sessionData?.chosen_methodology || "";
    const design = data[field_key];
    const optSet = chosen === "quantitative" ? config.quantitative_options : config.qualitative_options;
    const opt = (optSet || []).find((o) => o.id === design);
    return (
      <>
        <ReadOnlyField label="Primary Methodology" value={chosen ? chosen.charAt(0).toUpperCase() + chosen.slice(1) : "Not chosen"} />
        {design && <ReadOnlyField label="Research Design" value={opt ? opt.label : design} />}
      </>
    );
  }

  if (field_type === "fields" && fields && fields.length > 0) {
    return (
      <>
        {fields.map((f) => {
          let val = data[f.field_key] || "";
          if (f.type === "select" && f.options && val) {
            if (val === "other") {
              val = data[f.field_key + "_other"] || "Other";
            } else {
              const opt = f.options.find((o) => o.id === val);
              if (opt) val = opt.label;
            }
          }
          return <ReadOnlyField key={f.field_key} label={f.label} value={val} />;
        })}
      </>
    );
  }

  return null;
}


function ReadOnlyField({ label, value }) {
  const display = value && String(value).trim() ? String(value) : null;
  return (
    <div className="sdv-field">
      <div className="sdv-field__label">{label}</div>
      {display ? (
        <div className="sdv-field__value">{display}</div>
      ) : (
        <div className="sdv-field__empty">Not yet completed</div>
      )}
    </div>
  );
}
