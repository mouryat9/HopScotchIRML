// src/StudentDesignView.jsx — Read-only view of a student's research design (teacher overlay)
import React, { useEffect, useState } from "react";
import { API } from "./api";

const STEP_LABELS = [
  "Worldview", "Topic & Goals", "Framework", "Design", "Research Questions",
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

  const [downloading, setDownloading] = useState(null); // "pdf" | "cf" | null
  const [downloadError, setDownloadError] = useState("");

  async function handleDownloadPDF() {
    if (!sessionId || downloading) return;
    setDownloadError("");
    setDownloading("pdf");
    try {
      await API.downloadResearchDesign(sessionId);
    } catch (e) {
      console.error("PDF download failed:", e);
      setDownloadError("Couldn't generate the PDF. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadCF() {
    if (!sessionId || downloading) return;
    setDownloadError("");
    setDownloading("cf");
    try {
      await API.downloadConceptualFramework(sessionId);
    } catch (e) {
      console.error("Conceptual framework download failed:", e);
      setDownloadError("Couldn't generate the conceptual framework. Please try again.");
    } finally {
      setDownloading(null);
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
          {downloadError && <span className="sdv-dl-error">{downloadError}</span>}
          <button className="sdv-dl-btn" onClick={handleDownloadCF} disabled={!!downloading} title="Generate & download the conceptual framework (.pptx)">
            {downloading === "cf" ? (
              <><span className="sdv-dl-spinner" />Generating…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Conceptual Framework
              </>
            )}
          </button>
          <button className="sdv-dl-btn sdv-dl-btn--primary" onClick={handleDownloadPDF} disabled={!!downloading} title="Generate & download the research design (.pdf)">
            {downloading === "pdf" ? (
              <><span className="sdv-dl-spinner sdv-dl-spinner--light" />Generating…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {loading && <div className="sdv-loading">Loading student design...</div>}
      {error && <div className="td-alert td-alert--error" style={{ margin: 16 }}>{error}</div>}

      {!loading && !error && sessionData && (
        <div className="sdv-body sdv-body--v">
          {/* Left sidebar — step navigator */}
          <div className="sdv-strip" role="tablist" aria-label="Research steps">
            {STEP_LABELS.map((label, i) => {
              const num = i + 1;
              const isActive = num === viewStep;
              const isDone = completed.includes(num);
              return (
                <button
                  key={num}
                  className={`sdv-chip${isActive ? " sdv-chip--active" : ""}${isDone ? " sdv-chip--done" : ""}`}
                  style={{ "--chip-color": STEP_COLORS[i] }}
                  onClick={() => setViewStep(num)}
                  role="tab"
                  aria-selected={isActive}
                  title={`Step ${num}: ${label}`}
                >
                  <span className="sdv-chip__num">{isDone ? "\u2713" : num}</span>
                  <span className="sdv-chip__label">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Right side — step content + feedback */}
          <div className="sdv-right">
            {/* Step content (scrollable) */}
            <div className="sdv-content">
              <div className="sdv-doc">
                <div className="sdv-doc__eyebrow" style={{ color: STEP_COLORS[viewStep - 1] }}>
                  <span className="sdv-doc__dot" style={{ background: STEP_COLORS[viewStep - 1] }} />
                  Step {viewStep} of 9
                  {completed.includes(viewStep)
                    ? <span className="sdv-doc__status sdv-doc__status--done">Completed</span>
                    : <span className="sdv-doc__status">In progress</span>}
                </div>
                <h3 className="sdv-doc__title">{STEP_LABELS[viewStep - 1]}</h3>

                <ReadOnlyStepContent
                  step={viewStep}
                  data={stepNotes[String(viewStep)] || {}}
                  stepConfig={stepConfig}
                  configLoading={configLoading}
                  sessionData={sessionData}
                />
              </div>
            </div>

            {/* Feedback panel — redesigned as a threaded conversation */}
            <div className="sdv-fb">
              <div className="sdv-fb__head">
                <span className="sdv-fb__head-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </span>
                <div className="sdv-fb__head-text">
                  <h4 className="sdv-fb__title">Feedback</h4>
                  <p className="sdv-fb__sub">Visible to {(studentName || "the student").split(" ")[0]} in their workspace.</p>
                </div>
                {feedbackList.length > 0 && <span className="sdv-fb__count">{feedbackList.length}</span>}
              </div>

              <div className="sdv-fb__thread">
                {feedbackList.length === 0 ? (
                  <div className="sdv-fb__empty">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <p className="sdv-fb__empty-title">No feedback yet</p>
                    <span className="sdv-fb__empty-sub">Leave your first note on this research design below.</span>
                  </div>
                ) : (
                  [...feedbackList].reverse().map((fb) => (
                    <div key={fb.id} className="sdv-fb__item">
                      <span className="sdv-fb__avatar">{(fb.teacher_name || "T").charAt(0).toUpperCase()}</span>
                      <div className="sdv-fb__bubble">
                        <div className="sdv-fb__meta">
                          <strong>{fb.teacher_name}</strong>
                          <span className="sdv-fb__time">{timeAgo(fb.created_at)}</span>
                        </div>
                        <p className="sdv-fb__text">{fb.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="sdv-fb__composer">
                <textarea
                  className="sdv-fb__input"
                  rows={2}
                  placeholder="Write feedback for this student…  (⌘/Ctrl + Enter to send)"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmitFeedback(); }
                  }}
                />
                <button
                  className="sdv-fb__send"
                  onClick={handleSubmitFeedback}
                  disabled={submitting || !feedbackText.trim()}
                  title="Send feedback"
                >
                  {submitting ? (
                    <span className="sdv-fb__spinner" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  )}
                  <span>{submitting ? "Sending" : "Send"}</span>
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
        <ReadOnlyField label="Justification (Ontology & Epistemology)" value={data.worldview_justification} />
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
        <ReadOnlyField label="Gaps Identified" value={data.gaps || data.gaps_identified} />
        <ReadOnlyField label="Problem Statement" value={data.problem_statement || data.problemStatement} />
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
