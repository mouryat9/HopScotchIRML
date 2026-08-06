// src/StudentDesignView.jsx - Read-only view of a student's research design (teacher overlay)
import React, { useEffect, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { API } from "./api";
import { notify } from "./Toast";
import VisualDesignReadOnly from "./VisualDesignReadOnly";
import ConceptualFrameworkReadOnly from "./ConceptualFrameworkReadOnly";
import { useLang } from "./i18n.jsx";

const STEP_COLORS = [
  "#2B5EA7", "#E8618C", "#D94040", "#1A8A7D", "#B0A47A",
  "#00AEEF", "#F0B429", "#F5922A", "#7B8794",
];

// Localized labels live in i18n.jsx (worldview.* keys)
const KNOWN_WORLDVIEWS = ["positivist", "post_positivist", "constructivist", "transformative", "pragmatist"];

function timeAgo(dateStr, t, lang) {
  if (!dateStr) return "";
  const ts = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.mAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("time.hAgo", { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t("time.dAgo", { n: days });
  return new Date(dateStr).toLocaleDateString(lang === "es" ? "es-ES" : "en-US");
}

export default function StudentDesignView({ sessionId, studentName, className: classNameProp, onClose }) {
  const { lang, t } = useLang();
  const STEP_LABELS = [
    t("strip.1"), t("sdv.step2"), t("strip.3"), t("strip.4"), t("strip.5"),
    t("sdv.step6"), t("strip.7"), t("strip.8"), t("strip.9"),
  ];
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewStep, setViewStep] = useState(1);
  const [stepConfig, setStepConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Feedback state - one feedback for the whole design
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
        if (!cancelled) setError(e.message || t("sdv.errLoadSession"));
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

  // Embedded design views (teacher sees the diagrams next to feedback)
  const [contentView, setContentView] = useState("steps"); // "steps" | "visual" | "cf"
  const [vdData, setVdData] = useState(null);
  const [vdError, setVdError] = useState("");
  const [vdLoading, setVdLoading] = useState(false);
  const [cfData, setCfData] = useState(null);
  const [cfError, setCfError] = useState("");
  const [cfLoading, setCfLoading] = useState(false);

  function showVisualDesign() {
    setContentView("visual");
    if (vdData || vdLoading) return;
    setVdLoading(true);
    setVdError("");
    API.getVisualDesignData(sessionId)
      .then(setVdData)
      .catch((e) => setVdError(e.message || t("sdv.vdError")))
      .finally(() => setVdLoading(false));
  }

  function showConceptualFramework() {
    setContentView("cf");
    if (cfData || cfLoading) return;
    setCfLoading(true);
    setCfError("");
    API.getConceptualFrameworkData(sessionId)
      .then(setCfData)
      .catch((e) => setCfError(e.message || t("sdv.cfError")))
      .finally(() => setCfLoading(false));
  }

  async function handleDownloadPDF() {
    if (!sessionId || downloading) return;
    setDownloadError("");
    setDownloading("pdf");
    try {
      await API.downloadResearchDesign(sessionId);
    } catch (e) {
      console.error("PDF download failed:", e);
      setDownloadError(t("sdv.pdfError"));
    } finally {
      setDownloading(null);
    }
  }

  // Same PDF pipeline the student uses (html2canvas + jsPDF with the logo
  // freeze), but one page per CF layout since the teacher sees all three.
  async function handleDownloadCFPdf() {
    if (downloading) return;
    const stage = document.querySelector(".sdv-vd__stage");
    const diagrams = document.querySelectorAll(".sdv-cf .cf-diagram, .sdv-cf .cfb-diagram, .sdv-cf .cfe-diagram");
    if (!diagrams.length) return;
    setDownloading("cf");
    stage && stage.classList.add("sdv-vd__stage--capture");
    try {
      let pdf = null;
      for (const el of diagrams) {
        el.classList.add("vd-diagram--print-freeze");
        await new Promise((r) => setTimeout(r, 60));
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
        el.classList.remove("vd-diagram--print-freeze");
        const w = canvas.width / 2, h = canvas.height / 2;
        if (!pdf) pdf = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "pt", format: [w, h] });
        else pdf.addPage([w, h], w >= h ? "landscape" : "portrait");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
      }
      pdf.save(`Conceptual_Framework_${(studentName || "Student").replace(/[^\w-]+/g, "_")}.pdf`);
    } catch (e) {
      console.error("CF PDF capture failed:", e);
      notify.error(t("sdv.cfPdfError"), { title: t("toast.downloadFailTitle") });
    } finally {
      diagrams.forEach((el) => el.classList.remove("vd-diagram--print-freeze"));
      stage && stage.classList.remove("sdv-vd__stage--capture");
      setDownloading(null);
    }
  }

  function handleOpenVD() {
    if (!sessionId) return;
    const url = `${window.location.origin}${window.location.pathname}?view=vd&session=${encodeURIComponent(sessionId)}`;
    window.open(url, "_blank", "noopener");
  }

  const completed = sessionData?.completed_steps || [];
  const stepNotes = sessionData?.step_notes || {};

  return (
    <div className="sdv-overlay">
      {/* Header */}
      <div className="sdv-header">
        <div className="sdv-header__left">
          <button className="sdv-close" onClick={onClose}>{t("vd.back")}</button>
          <h2 className="sdv-header__name">{studentName || sessionData?.student_name || t("sdv.student")}</h2>
          {classNameProp && <span className="sdv-header__class">{classNameProp}</span>}
          {sessionData?.worldview_label && (
            <span className="sdv-badge" style={{ background: "#2B5EA7" }}>{sessionData.worldview_label}</span>
          )}
          {sessionData?.resolved_path && (
            <span className="sdv-badge" style={{ background: "#1A8A7D" }}>
              {(sessionData.resolved_path !== "mixed" && sessionData.chosen_methodology) || sessionData.resolved_path}
            </span>
          )}
        </div>
        <div className="sdv-header__right">
          {downloadError && <span className="sdv-dl-error">{downloadError}</span>}
          <button
            className={`sdv-dl-btn${contentView === "visual" ? " sdv-dl-btn--active" : ""}`}
            onClick={() => (contentView === "visual" ? setContentView("steps") : showVisualDesign())}
            disabled={!!downloading}
            title={t("sdv.vdBtnTitle")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            {contentView === "visual" ? t("sdv.backToSteps") : t("vd.title")}
          </button>
          <button
            className={`sdv-dl-btn${contentView === "cf" ? " sdv-dl-btn--active" : ""}`}
            onClick={() => (contentView === "cf" ? setContentView("steps") : showConceptualFramework())}
            disabled={!!downloading}
            title={t("sdv.cfBtnTitle")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {contentView === "cf" ? t("sdv.backToSteps") : t("cf.title")}
          </button>
          <button className="sdv-dl-btn sdv-dl-btn--primary" onClick={handleDownloadPDF} disabled={!!downloading} title={t("sdv.pdfBtnTitle")}>
            {downloading === "pdf" ? (
              <><span className="sdv-dl-spinner sdv-dl-spinner--light" />{t("sdv.generating")}</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {t("sdv.downloadPdf")}
              </>
            )}
          </button>
        </div>
      </div>

      {loading && <div className="sdv-loading">{t("sdv.loadingDesign")}</div>}
      {error && <div className="td-alert td-alert--error" style={{ margin: 16 }}>{error}</div>}

      {!loading && !error && sessionData && (
        <div className="sdv-body sdv-body--v">
          {/* Left sidebar - step navigator */}
          <div className="sdv-strip" role="tablist" aria-label={t("sdv.stepsAria")}>
            {STEP_LABELS.map((label, i) => {
              const num = i + 1;
              const isActive = num === viewStep;
              const isDone = completed.includes(num);
              return (
                <button
                  key={num}
                  className={`sdv-chip${isActive ? " sdv-chip--active" : ""}${isDone ? " sdv-chip--done" : ""}`}
                  style={{ "--chip-color": STEP_COLORS[i] }}
                  onClick={() => { setViewStep(num); setContentView("steps"); }}
                  role="tab"
                  aria-selected={isActive}
                  title={t("panel.stepTip", { n: num, label })}
                >
                  <span className="sdv-chip__num">{isDone ? "\u2713" : num}</span>
                  <span className="sdv-chip__label">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Right side - step content + feedback */}
          <div className="sdv-right">
            {/* Step content (scrollable), or the embedded visual design */}
            <div className="sdv-content">
              {contentView === "cf" ? (
                <div className="sdv-vd">
                  <div className="sdv-vd__bar">
                    <span className="sdv-vd__title">{t("sdv.cfBarTitle")}</span>
                    <button className="sdv-vd__open" onClick={handleDownloadCFPdf} disabled={!!downloading} title={t("sdv.cfSaveTitle")}>
                      {downloading === "cf" ? t("vd.capturing") : t("vd.savePdf")}
                    </button>
                  </div>
                  {cfLoading && <div className="sdv-loading">{t("sdv.cfLoading")}</div>}
                  {cfError && <div className="sdv-vd-unsupported">{cfError}</div>}
                  {cfData && (
                    <div className="sdv-vd__stage">
                      <ConceptualFrameworkReadOnly data={cfData} />
                    </div>
                  )}
                </div>
              ) : contentView === "visual" ? (
                <div className="sdv-vd">
                  <div className="sdv-vd__bar">
                    <span className="sdv-vd__title">{t("sdv.vdBarTitle")}</span>
                    <button className="sdv-vd__open" onClick={handleOpenVD} title={t("sdv.vdOpenTitle")}>
                      {t("sdv.openFull")}
                    </button>
                  </div>
                  {vdLoading && <div className="sdv-loading">{t("sdv.vdLoading")}</div>}
                  {vdError && <div className="sdv-vd-unsupported">{vdError}</div>}
                  {vdData && (
                    <div className="sdv-vd__stage">
                      <VisualDesignReadOnly data={vdData} />
                    </div>
                  )}
                </div>
              ) : (
              <div className="sdv-doc">
                <div className="sdv-doc__eyebrow" style={{ color: STEP_COLORS[viewStep - 1] }}>
                  <span className="sdv-doc__dot" style={{ background: STEP_COLORS[viewStep - 1] }} />
                  {t("sdv.stepOf", { n: viewStep })}
                  {completed.includes(viewStep)
                    ? <span className="sdv-doc__status sdv-doc__status--done">{t("sdv.completed")}</span>
                    : <span className="sdv-doc__status">{t("sdv.inProgress")}</span>}
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
              )}
            </div>

            {/* Feedback panel - redesigned as a threaded conversation */}
            <div className="sdv-fb">
              <div className="sdv-fb__head">
                <span className="sdv-fb__head-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </span>
                <div className="sdv-fb__head-text">
                  <h4 className="sdv-fb__title">{t("sdv.fbTitle")}</h4>
                  <p className="sdv-fb__sub">{t("sdv.fbSub", { name: (studentName || t("sdv.theStudent")).split(" ")[0] })}</p>
                </div>
                {feedbackList.length > 0 && <span className="sdv-fb__count">{feedbackList.length}</span>}
              </div>

              <div className="sdv-fb__thread">
                {feedbackList.length === 0 ? (
                  <div className="sdv-fb__empty">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <p className="sdv-fb__empty-title">{t("fb.emptyTitle")}</p>
                    <span className="sdv-fb__empty-sub">{t("sdv.fbEmptySub")}</span>
                  </div>
                ) : (
                  [...feedbackList].reverse().map((fb) => (
                    <div key={fb.id} className="sdv-fb__item">
                      <span className="sdv-fb__avatar">{(fb.teacher_name || "T").charAt(0).toUpperCase()}</span>
                      <div className="sdv-fb__bubble">
                        <div className="sdv-fb__meta">
                          <strong>{fb.teacher_name}</strong>
                          <span className="sdv-fb__time">{timeAgo(fb.created_at, t, lang)}</span>
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
                  placeholder={t("sdv.fbPh")}
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
                  title={t("sdv.sendTitle")}
                >
                  {submitting ? (
                    <span className="sdv-fb__spinner" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  )}
                  <span>{submitting ? t("sdv.sending") : t("chat.send")}</span>
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
  const { t } = useLang();
  const isEmpty = !data || Object.keys(data).length === 0;

  if (isEmpty) {
    return <p className="sdv-empty">{t("sdv.stepNotCompleted")}</p>;
  }

  // Step 1: Worldview
  if (step === 1) {
    const wv = data.worldview_id || data.worldview || "";
    const label = KNOWN_WORLDVIEWS.includes(wv) ? t(`worldview.${wv}`) : (wv || t("sdv.notSelected"));
    return (
      <div className="sdv-fields">
        <ReadOnlyField label={t("strip.1")} value={label} />
        <ReadOnlyField label={t("sdv.justification")} value={data.worldview_justification} />
      </div>
    );
  }

  // Step 2: Topic & Goals
  if (step === 2) {
    return (
      <div className="sdv-fields">
        <ReadOnlyField label={t("sdv.researchTopic")} value={data.topic} />
        <ReadOnlyField label={t("sdv.personalGoals")} value={data.personalGoals || data.personal_goals} />
        <ReadOnlyField label={t("sdv.practicalGoals")} value={data.practicalGoals || data.practical_goals} />
        <ReadOnlyField label={t("sdv.intellectualGoals")} value={data.intellectualGoals || data.intellectual_goals} />
        {data.goals && !data.personalGoals && <ReadOnlyField label={t("sdv.researchGoals")} value={data.goals} />}
      </div>
    );
  }

  // Step 3: Literature
  if (step === 3) {
    return (
      <div className="sdv-fields">
        <ReadOnlyField label={t("sdv.topicalResearch")} value={data.topicalResearch || data.topical_research} />
        <ReadOnlyField label={t("sdv.theoreticalFrameworks")} value={data.theoreticalFrameworks || data.theoretical_frameworks} />
        <ReadOnlyField label={t("sdv.gapsIdentified")} value={data.gaps || data.gaps_identified} />
        <ReadOnlyField label={t("sdv.problemStatement")} value={data.problem_statement || data.problemStatement} />
      </div>
    );
  }

  // Steps 4-9: config-driven
  if (configLoading) {
    return <p className="sdv-empty">{t("sdv.loadingConfig")}</p>;
  }

  if (stepConfig && stepConfig.path) {
    return (
      <div className="sdv-fields">
        <ReadOnlyConfigFields config={stepConfig} data={data} sessionData={sessionData} />
        {data.notes && <ReadOnlyField label={t("sdv.additionalNotes")} value={data.notes} />}
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
  const { t } = useLang();
  const { field_type, field_key, options, fields } = config;

  if (field_type === "single_select") {
    const opt = (options || []).find((o) => o.id === data[field_key]);
    return (
      <ReadOnlyField
        label={t("sdv.selected")}
        value={opt ? `${opt.label}${opt.description ? ` - ${opt.description}` : ""}` : data[field_key] || t("sdv.notSelected")}
      />
    );
  }

  if (field_type === "multi_select") {
    const selected = data[field_key] || [];
    const labels = selected.map((id) => {
      const opt = (options || []).find((o) => o.id === id);
      return opt ? opt.label : id;
    });
    return <ReadOnlyField label={t("sdv.selected")} value={labels.join(", ") || t("sdv.noneSelected")} />;
  }

  if (field_type === "methodology_decision") {
    const chosen = data.chosen_methodology || sessionData?.chosen_methodology || "";
    const design = data[field_key];
    const optSet = chosen === "quantitative" ? config.quantitative_options : config.qualitative_options;
    const opt = (optSet || []).find((o) => o.id === design);
    const chosenLabel = chosen === "quantitative" ? t("meth.quantitative")
      : chosen === "qualitative" ? t("meth.qualitative")
      : chosen ? chosen.charAt(0).toUpperCase() + chosen.slice(1) : t("sdv.notChosen");
    return (
      <>
        <ReadOnlyField label={t("sdv.primaryMethodology")} value={chosenLabel} />
        {design && <ReadOnlyField label={t("dl.researchDesign")} value={opt ? opt.label : design} />}
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
              val = data[f.field_key + "_other"] || t("sdv.other");
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
  const { t } = useLang();
  const display = value && String(value).trim() ? String(value) : null;
  return (
    <div className="sdv-field">
      <div className="sdv-field__label">{label}</div>
      {display ? (
        <div className="sdv-field__value">{display}</div>
      ) : (
        <div className="sdv-field__empty">{t("sdv.notYetCompleted")}</div>
      )}
    </div>
  );
}
