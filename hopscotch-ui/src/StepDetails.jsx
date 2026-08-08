import React, { useEffect, useMemo, useRef, useState } from "react";
import { API } from "./api";
import { vdEditorSupports } from "./VisualDesignEditor";
import { useLang } from "./i18n.jsx";

/* Mixed methods designs (pragmatist / mixed path, Step 4) */
const MIXED_DESIGN_OPTIONS = [
  { id: "convergent_parallel", label: "Convergent Parallel", description: "Run the qualitative and quantitative strands at the same time, then merge the results in interpretation." },
  { id: "explanatory_sequential", label: "Explanatory Sequential", description: "Quantitative first: the numbers show what is happening, then a qualitative phase explains why." },
  { id: "exploratory_sequential", label: "Exploratory Sequential", description: "Qualitative first: explore the phenomenon, then a quantitative phase tests the findings at scale." },
  { id: "embedded", label: "Embedded", description: "One strand is the main study; a smaller strand of the other type is embedded inside it." },
];

/**
 * Titles for the step headers
 */
const STEP_TITLES = {
  1: "Step 1: Who am I as a researcher?",
  2: "Step 2: What am I wondering about?",
  3: "Step 3: What do I already know?",
};

/**
 * Direction paragraphs (top card) for steps 1–3
 */
const STEP_DIRECTIONS = {
  1: `Step One will help you reflect on your worldview (paradigmatic positioning) as a researcher. The video and interactive resources on the left will help you learn about the different worldviews you can bring as a researcher to your studies.`,
  2: `In Step Two, you will define and narrow your research topic and goals (personal, practical, and intellectual) that will guide your proposed study. The interactive resources on the left will help you refine your topic and the goals of your study.`,
  3: `Step Three focuses primarily on your literature review within a conceptual framework that establishes the significance of your topic and clearly justifies the need for the study you are proposing. You will identify topical research \u2014 previous studies in your field that help justify the relevance of your research topic \u2014 and define the theoretical frameworks (if you choose) that support your proposed research. The interactive resources on the left will guide you through this process.`,
};

/**
 * Default empty shapes for each step's data
 */
const EMPTY_STEP_DATA = {
  1: { worldview: "", worldview_justification: "" },
  2: { topic: "", personalGoals: "", practicalGoals: "", intellectualGoals: "" },
  3: { topicalResearch: "", theoreticalFrameworks: "", gaps: "", problem_statement: "" },
};

// ---- If your backend expects worldview_id, map dropdown values to those ids
const WORLDVIEW_IDS = new Set([
  "positivist",
  "post_positivist",
  "constructivist",
  "transformative",
  "pragmatist",
]);

/**
 * Main wrapper – chooses which step layout to render.
 * Props:
 *  - step: number (1–9)
 *  - sessionId: string | null   (used for saving/loading)
 */
export default function StepDetails({ step, sessionId, onChatRefresh, onAutoSend, onCompletedStepsChange }) {
  const baseShape = useMemo(() => EMPTY_STEP_DATA[step] || {}, [step]);
  const { t, lang } = useLang();

  const [data, setData] = useState(baseShape);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [worldviewStatus, setWorldviewStatus] = useState(""); // Step 1 only
  const [stepConfig, setStepConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);

  // Load path-resolved step config from backend (for steps 4-9)
  useEffect(() => {
    if (!sessionId || step <= 3) {
      setStepConfig(null);
      return;
    }
    let cancelled = false;
    setConfigLoading(true);
    API.getStepConfig(sessionId, step, lang)
      .then((cfg) => {
        if (!cancelled) setStepConfig(cfg);
      })
      .catch((err) => {
        console.error("Failed to load step config", err);
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, sessionId, lang]);

  // Load saved data whenever step or session changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setSaveError("");
      setWorldviewStatus("");
      setData(baseShape);

      if (!sessionId) return;

      try {
        const res = await API.getStepData(sessionId, step);
        if (!cancelled) {
          setData({
            ...baseShape,
            ...(res.data || {}),
          });
        }
      } catch (err) {
        console.error("Failed to load step data", err);
        if (!cancelled) {
          setSaveError("Could not load previously saved data for this step.");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [step, sessionId, baseShape]);

  // helper to update + save. Saves fire on every change, so responses can
  // return out of order - the sequence guard makes sure only the LATEST
  // save's completed_steps reaches the strip/court (a stale response used
  // to be able to flip a completed step back to unfinished).
  const saveSeqRef = useRef(0);
  const updateField = (field, value) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };

      if (sessionId) {
        setSaving(true);
        setSaveError("");
        const seq = ++saveSeqRef.current;

        API.saveStepData({
          session_id: sessionId,
          step,
          data: next,
        })
          .then((res) => {
            if (seq !== saveSeqRef.current) return; // stale response
            setSaving(false);
            if (res.completed_steps && onCompletedStepsChange) {
              onCompletedStepsChange(res.completed_steps);
            }
          })
          .catch((err) => {
            console.error("Failed to save step data", err);
            if (seq !== saveSeqRef.current) return;
            setSaving(false);
            setSaveError("Auto-save failed. Check your connection.");
          });
      }

      return next;
    });
  };

  // Step 1: when worldview changes, tell backend to set worldview
  const onWorldviewChange = async (newValue) => {
    // Update local state only - do NOT call updateField() here because
    // /step/save replaces the entire step_notes dict and would race with
    // /worldview/set, potentially overwriting the worldview_id key that
    // _compute_completed_steps needs.
    setData((prev) => ({ ...prev, worldview: newValue }));

    setWorldviewStatus("");
    setSaveError("");

    if (!sessionId) return;

    // Only call backend if it’s a real worldview id (ignore "" and "unsure")
    if (!WORLDVIEW_IDS.has(newValue)) return;

    try {
      const wvRes = await API.setWorldview(sessionId, newValue);
      if (wvRes.completed_steps && onCompletedStepsChange) {
        onCompletedStepsChange(wvRes.completed_steps);
      }
    } catch (e) {
      console.error("Failed to set worldview on backend", e);
      setSaveError("Worldview save failed. Check backend logs.");
    }
  };

  // Step 1: "Ask AI to Clarify" button - sends worldview (+ optional justification) to AI
  const onAskAIClarify = () => {
    const wv = data.worldview || "";
    const justification = (data.worldview_justification || "").trim();
    if (!WORLDVIEW_IDS.has(wv)) return;
    const label = wv.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const localLabel = t(`worldview.${wv}`);
    const text = justification
      ? t("step1.autoMsgWithJustification", { label: localLabel, justification })
      : t("step1.autoMsgNoJustification", { label: localLabel });
    if (onAutoSend) onAutoSend({
      text,
      event: t("chat.worldviewSelected", { label: localLabel }),
    });
  };

  const title = step <= 3 ? t(`step${step}.title`) : (STEP_TITLES[step] || `Step ${step}`);

  // ---------------- Step 1 ----------------
  if (step === 1) {
    return (
      <div className="step-details">
        {/* Directions card */}
        <section className="hop-card">
          <h2 className="hop-title">{title}</h2>
          <p className="hop-desc">
            <strong>{t("common.directions")}</strong>
            <br />
            {t("step1.directions")}
          </p>
        </section>

        {/* Inputs card */}
        <section className="hop-card">
          <p className="hop-desc">{t("step1.selectPrompt")}</p>

          <select
            className="input"
            value={data.worldview || ""}
            onChange={(e) => onWorldviewChange(e.target.value)}
            disabled={!sessionId}
          >
            <option value="">{t("step1.dropdownPlaceholder")}</option>
            <option value="positivist">{t("worldview.positivist")}</option>
            <option value="post_positivist">{t("worldview.post_positivist")}</option>
            <option value="constructivist">{t("worldview.constructivist")}</option>
            <option value="transformative">{t("worldview.transformative")}</option>
            <option value="pragmatist">{t("worldview.pragmatist")}</option>
            <option value="unsure">{t("worldview.unsure")}</option>
          </select>

          <p className="hop-desc" style={{ marginTop: 16 }}>{t("step1.explainPrompt")}</p>

          <textarea
            className="textarea"
            rows={5}
            placeholder={t("step1.textareaPlaceholder")}
            value={data.worldview_justification || ""}
            onChange={(e) => updateField("worldview_justification", e.target.value)}
            disabled={!sessionId}
          />

          <div style={{ marginTop: 12 }}>
            <button
              className="td-btn td-btn--primary td-btn--sm"
              onClick={onAskAIClarify}
              disabled={!sessionId || !WORLDVIEW_IDS.has(data.worldview || "")}
            >
              {t("step1.askAI")}
            </button>
          </div>

          {worldviewStatus && (
            <div className="badge">
              {worldviewStatus}
            </div>
          )}

          {saving && (
            <div className="badge">{t("common.saving")}</div>
          )}
          {saveError && (
            <div className="badge badge--error">
              {saveError}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---------------- Step 2 ----------------
  if (step === 2) {
    return (
      <div className="step-details">
        {/* Directions card */}
        <section className="hop-card">
          <h2 className="hop-title">{title}</h2>
          <p className="hop-desc">
            <strong>{t("common.directions")}</strong>
            <br />
            {t("step2.directions")}
          </p>
        </section>

        {/* Inputs card */}
        <section className="hop-card">
          <p className="hop-desc">
            {t("step2.intro")}
          </p>

          <label className="hop-desc" style={{ display: "block", marginTop: 4 }}>{t("step2.topicLabel")}</label>
          <input
            className="input"
            type="text"
            placeholder={t("step2.topicPh")}
            value={data.topic || ""}
            onChange={(e) => updateField("topic", e.target.value)}
            disabled={!sessionId}
          />

          <label className="hop-desc" style={{ display: "block", marginTop: 10 }}>{t("step2.personalLabel")}</label>
          <textarea
            className="textarea"
            rows={2}
            placeholder={t("step2.personalPh")}
            value={data.personalGoals || ""}
            onChange={(e) => updateField("personalGoals", e.target.value)}
            disabled={!sessionId}
          />

          <label className="hop-desc" style={{ display: "block", marginTop: 10 }}>{t("step2.practicalLabel")}</label>
          <textarea
            className="textarea"
            rows={2}
            placeholder={t("step2.practicalPh")}
            value={data.practicalGoals || ""}
            onChange={(e) => updateField("practicalGoals", e.target.value)}
            disabled={!sessionId}
          />

          <label className="hop-desc" style={{ display: "block", marginTop: 10 }}>{t("step2.intellectualLabel")}</label>
          <textarea
            className="textarea"
            rows={2}
            placeholder={t("step2.intellectualPh")}
            value={data.intellectualGoals || ""}
            onChange={(e) => updateField("intellectualGoals", e.target.value)}
            disabled={!sessionId}
          />

          <div className="step-save-row">
            <button
              className="btn btn--primary"
              disabled={!sessionId || !data.topic}
              onClick={() => {
                if (onAutoSend) onAutoSend(
                  t("step2.autoMsg", { topic: data.topic || "", personal: data.personalGoals || "", practical: data.practicalGoals || "", intellectual: data.intellectualGoals || "" })
                );
              }}
            >{t("common.getAI")}</button>
            {saving && <span className="badge">{t("common.saving")}</span>}
          </div>
          {saveError && (
            <div className="badge badge--error">
              {saveError}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---------------- Step 3 ----------------
  if (step === 3) {
    return (
      <div className="step-details">
        {/* Directions card */}
        <section className="hop-card">
          <h2 className="hop-title">{title}</h2>
          <p className="hop-desc">
            <strong>{t("common.directions")}</strong>
            <br />
            {t("step3.directions")}
          </p>
        </section>

        {/* Inputs card */}
        <section className="hop-card">
          <p className="hop-desc">
            After reviewing the interactive resources on the left side, please
            describe your initial topical research in terms of the field's broad
            context, identify and define relevant key concepts or theories, and
            include citations from relevant articles from your initial literature
            search. Then use the AI Assistant to help you refine and develop
            strategies for your literature search.
          </p>

          <label className="hop-desc" style={{ display: "block", marginTop: 4 }}>{t("step3.topicalLabel")}</label>
          <textarea
            className="textarea"
            rows={3}
            placeholder={t("step3.topicalPh")}
            value={data.topicalResearch || ""}
            onChange={(e) => updateField("topicalResearch", e.target.value)}
            disabled={!sessionId}
          />

          <label className="hop-desc" style={{ display: "block", marginTop: 10 }}>{t("step3.theoreticalLabel")}</label>
          <textarea
            className="textarea"
            rows={3}
            placeholder={t("step3.theoreticalPh")}
            value={data.theoreticalFrameworks || ""}
            onChange={(e) => updateField("theoreticalFrameworks", e.target.value)}
            disabled={!sessionId}
          />

          <label className="hop-desc" style={{ display: "block", marginTop: 10 }}>
            {t("step3.gapsLabel")}
          </label>
          <textarea
            className="textarea"
            rows={3}
            placeholder={t("step3.gapsPh")}
            value={data.gaps || ""}
            onChange={(e) => updateField("gaps", e.target.value)}
            disabled={!sessionId}
          />

          <label className="hop-desc" style={{ display: "block", marginTop: 10 }}>{t("step3.problemLabel")}</label>
          <details className="hop-template">
            <summary>{t("step3.helperSummary")}</summary>
            <div className="hop-template__body">
              <p><strong>{t("step3.h1t")}</strong> {t("step3.h1")}</p>
              <p><strong>{t("step3.h2t")}</strong> {t("step3.h2")}</p>
              <p><strong>{t("step3.h3t")}</strong> {t("step3.h3")}</p>
              <p><strong>{t("step3.h4t")}</strong> {t("step3.h4")}</p>
              <p><strong>{t("step3.h5t")}</strong> {t("step3.h5")}</p>
            </div>
          </details>
          <textarea
            className="textarea"
            rows={5}
            placeholder={t("step3.problemPh")}
            value={data.problem_statement || ""}
            onChange={(e) => updateField("problem_statement", e.target.value)}
            disabled={!sessionId}
          />

          <div className="step-save-row">
            <button
              className="btn btn--primary"
              disabled={!sessionId || (!data.topicalResearch && !data.theoreticalFrameworks && !data.gaps && !data.problem_statement)}
              onClick={() => {
                if (onAutoSend) onAutoSend(
                  t("step3.autoMsg", { topical: data.topicalResearch || "", theoretical: data.theoreticalFrameworks || "", gaps: data.gaps || "", problem: data.problem_statement || "" })
                );
              }}
            >{t("common.getAI")}</button>
            {saving && <span className="badge">{t("common.saving")}</span>}
          </div>
          {saveError && (
            <div className="badge badge--error">
              {saveError}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---------------- Steps 4-9: dynamic config-driven ----------------
  if (configLoading) {
    return (
      <div className="step-details">
        <section className="hop-card">
          <p className="hop-desc">Loading step configuration...</p>
        </section>
      </div>
    );
  }

  if (stepConfig && !stepConfig.path && step >= 4) {
    return (
      <div className="step-details">
        <section className="hop-card">
          <h2 className="hop-title">{stepConfig.title || `Step ${step}`}</h2>
          <p className="hop-desc">
            {stepConfig.directions || t("common.completeStep1")}
          </p>
        </section>
      </div>
    );
  }

  if (stepConfig && stepConfig.path) {
    return (
      <div className="step-details">
        <section className="hop-card">
          <h2 className="hop-title">{stepConfig.title}</h2>
          <p className="hop-desc">
            <strong>{t("common.directions")}</strong>
            <br />
            {stepConfig.directions}
          </p>
        </section>

        <section className="hop-card">
          {stepConfig.input_prompt && (
            <p className="hop-desc" style={{ marginBottom: 12 }}>
              {stepConfig.input_prompt}
            </p>
          )}
          <StepFieldRenderer
            config={stepConfig}
            data={data}
            updateField={updateField}
            sessionId={sessionId}
            disabled={!sessionId}
          />
        </section>

        {/* Additional notes textarea for every step */}
        <section className="hop-card">
          <label className="hop-desc" style={{ display: "block", marginBottom: 6 }}>
            {t("common.additionalQuestions", { n: step })}
          </label>
          <textarea
            className="textarea"
            rows={3}
            placeholder={t("common.additionalQuestionsPh", { n: step })}
            value={data.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
            disabled={!sessionId}
          />

          <div className="step-save-row">
            <button
              className="btn btn--primary"
              disabled={!sessionId}
              onClick={() => {
                const summary = Object.entries(data)
                  .filter(([, v]) => v && (typeof v === "string" ? v.trim() : true))
                  .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
                  .join(". ");
                if (onAutoSend) onAutoSend(
                  `I'm on Step ${step} (${stepConfig.title}). Here are my inputs: ${summary || "I haven't filled anything in yet"}. Can you give me feedback and guidance?`
                );
              }}
            >{t("common.getAI")}</button>
            {step === 4 && (vdEditorSupports(data.mixed_design) || vdEditorSupports(data.design)) && (
              <button
                className="btn btn--vd"
                disabled={!sessionId}
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}?view=vd&session=${encodeURIComponent(sessionId)}`;
                  window.open(url, "_blank", "noopener");
                }}
                title={t("common.createVdTitle")}
              >
                {t("common.createVd")}
              </button>
            )}
            {saving && <span className="badge">{t("common.saving")}</span>}
          </div>
          {saveError && (
            <div className="badge badge--error">
              {saveError}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Fallback for steps 4-9 if config hasn't loaded yet
  return (
    <div className="step-details">
      <section className="hop-card">
        <h2 className="hop-title">{title}</h2>
        <p className="hop-desc">
          {t("common.fallbackIntro")}
        </p>
      </section>

      <section className="hop-card">
        <label className="hop-desc" style={{ display: "block", marginBottom: 6 }}>
          {t("common.notesFor", { n: step })}
        </label>
        <textarea
          className="textarea"
          rows={5}
          placeholder={t("common.notesPh", { n: step })}
          value={data.notes || ""}
          onChange={(e) => updateField("notes", e.target.value)}
          disabled={!sessionId}
        />

        {saving && (
          <div className="badge" style={{ marginTop: 6 }}>
            {t("common.saving")}
          </div>
        )}
        {saveError && (
          <div className="badge badge--error">
            {saveError}
          </div>
        )}
      </section>
    </div>
  );
}

/* ================================================================
   Sub-components for dynamic step rendering
   ================================================================ */

/**
 * Renders the appropriate input controls based on field_type from the config.
 */
function StepFieldRenderer({ config, data, updateField, sessionId, disabled }) {
  const { t } = useLang();
  const { field_type, field_key, options, fields } = config;

  // single_select: dropdown
  if (field_type === "single_select") {
    const selectedOpt = (options || []).find((o) => o.id === data[field_key]);
    return (
      <div>
        <label className="hop-desc" style={{ display: "block", marginBottom: 6 }}>
          Select your choice:
        </label>
        <select
          className="input"
          value={data[field_key] || ""}
          onChange={(e) => updateField(field_key, e.target.value)}
          disabled={disabled}
        >
          <option value="">-- Choose one --</option>
          {(options || []).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {selectedOpt && selectedOpt.description && (
          <p
            className="hop-desc"
            style={{ marginTop: 8, fontStyle: "italic", fontSize: 13 }}
          >
            {selectedOpt.description}
          </p>
        )}
      </div>
    );
  }

  // multi_select: checkboxes
  if (field_type === "multi_select") {
    const selected = data[field_key] || [];
    const toggle = (optId) => {
      const next = selected.includes(optId)
        ? selected.filter((id) => id !== optId)
        : [...selected, optId];
      updateField(field_key, next);
    };
    return (
      <div>
        <label className="hop-desc" style={{ display: "block", marginBottom: 6 }}>
          Select all that apply:
        </label>
        {(options || []).map((opt) => (
          <label key={opt.id} className="checkbox-label">
            <input
              type="checkbox"
              checked={selected.includes(opt.id)}
              onChange={() => toggle(opt.id)}
              disabled={disabled}
            />
            <span>{opt.label}</span>
            {opt.description && (
              <span className="checkbox-desc"> - {opt.description}</span>
            )}
          </label>
        ))}
      </div>
    );
  }

  // methodology_decision: mixed-methods Step 4
  if (field_type === "methodology_decision") {
    return (
      <MethodologyDecision
        config={config}
        data={data}
        updateField={updateField}
        sessionId={sessionId}
        disabled={disabled}
      />
    );
  }

  // fields: array of text inputs / textareas (e.g. Step 5)
  if (field_type === "fields" && fields && fields.length > 0) {
    return (
      <div>
        {fields.map((f) => {
          // Conditional visibility: skip if depends_on condition not met
          if (f.depends_on && data[f.depends_on.field] !== f.depends_on.value) return null;
          return (
          <div key={f.field_key} style={{ marginBottom: 12 }}>
            <label className="hop-desc" style={{ display: "block", marginTop: 4 }}>
              {f.label}
            </label>
            {f.type === "textarea" ? (
              <textarea
                className="textarea"
                rows={3}
                placeholder={f.placeholder || ""}
                value={data[f.field_key] || ""}
                onChange={(e) => updateField(f.field_key, e.target.value)}
                disabled={disabled}
              />
            ) : f.type === "multi_select" && f.options ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {f.options.map((opt) => {
                    const sel = Array.isArray(data[f.field_key]) ? data[f.field_key] : [];
                    const active = sel.includes(opt.id);
                    return (
                      <label key={opt.id} className="checkbox-label" style={{ marginBottom: 2 }}>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {
                            const next = active
                              ? sel.filter((id) => id !== opt.id)
                              : [...sel, opt.id];
                            updateField(f.field_key, next);
                          }}
                          disabled={disabled}
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
                {(Array.isArray(data[f.field_key]) ? data[f.field_key] : []).includes("other") && (
                  <input
                    className="input"
                    type="text"
                    placeholder={t("field.describeOther")}
                    value={data[f.field_key + "_other"] || ""}
                    onChange={(e) => updateField(f.field_key + "_other", e.target.value)}
                    disabled={disabled}
                    style={{ marginTop: 8 }}
                  />
                )}
              </>
            ) : f.type === "select" && f.options ? (
              <>
                <select
                  className="input"
                  value={data[f.field_key] || ""}
                  onChange={(e) => updateField(f.field_key, e.target.value)}
                  disabled={disabled}
                >
                  <option value="">{f.placeholder || t("field.select")}</option>
                  {f.options.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                {data[f.field_key] === "other" && (
                  <input
                    className="input"
                    type="text"
                    placeholder={t("field.describeMethod")}
                    value={data[f.field_key + "_other"] || ""}
                    onChange={(e) => updateField(f.field_key + "_other", e.target.value)}
                    disabled={disabled}
                    style={{ marginTop: 8 }}
                  />
                )}
              </>
            ) : (
              <input
                className="input"
                type="text"
                placeholder={f.placeholder || ""}
                value={data[f.field_key] || ""}
                onChange={(e) => updateField(f.field_key, e.target.value)}
                disabled={disabled}
              />
            )}
          </div>
          );
        })}
      </div>
    );
  }

  // Fallback: nothing special to render
  return null;
}

/**
 * Mixed-methods Step 4: shows both quantitative and qualitative options
 * side by side and lets the student choose a primary methodology.
 */
function MethodologyDecision({ config, data, updateField, sessionId, disabled }) {
  const { t } = useLang();
  const [chosenMethodology, setChosenMethodology] = useState(
    data.chosen_methodology || ""
  );
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(!!data.chosen_methodology);

  // Sync if data loads from backend
  useEffect(() => {
    if (data.chosen_methodology) {
      setChosenMethodology(data.chosen_methodology);
      setConfirmed(true);
    }
  }, [data.chosen_methodology]);

  const confirmMethodology = async (methodology) => {
    if (!sessionId) return;
    setConfirming(true);
    try {
      await API.setMethodology(sessionId, methodology);
      setChosenMethodology(methodology);
      setConfirmed(true);
      updateField("chosen_methodology", methodology);
    } catch (e) {
      console.error("Failed to set methodology", e);
    } finally {
      setConfirming(false);
    }
  };

  const resetChoice = () => {
    setConfirmed(false);
    setChosenMethodology("");
  };

  // After confirmation, show the selected methodology's options as a dropdown
  if (confirmed && chosenMethodology) {
    const opts =
      chosenMethodology === "quantitative"
        ? config.quantitative_options
        : config.qualitative_options;
    return (
      <div>
        <div className="methodology-confirmed">
          <span>
            {t("meth.primary")}{" "}
            <strong>
              {chosenMethodology === "quantitative" ? t("meth.quantitative") : t("meth.qualitative")}
            </strong>
          </span>
          <button
            className="link-btn"
            onClick={resetChoice}
            style={{ marginLeft: 12 }}
          >{t("meth.change")}</button>
        </div>
        <label
          className="hop-desc"
          style={{ display: "block", marginTop: 12, marginBottom: 6 }}
        >
          {t("meth.selectDesign")}
        </label>
        <select
          className="input"
          value={data[config.field_key] || ""}
          onChange={(e) => updateField(config.field_key, e.target.value)}
          disabled={disabled}
        >
          <option value="">{t("meth.chooseDesign")}</option>
          {(opts || []).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {data[config.field_key] &&
          (opts || []).find((o) => o.id === data[config.field_key])
            ?.description && (
            <p
              className="hop-desc"
              style={{ marginTop: 8, fontStyle: "italic", fontSize: 13 }}
            >
              {
                (opts || []).find((o) => o.id === data[config.field_key])
                  .description
              }
            </p>
          )}
        {config.path === "mixed" && (
          <div style={{ marginTop: 16 }}>
            <label className="hop-desc" style={{ display: "block", marginBottom: 6 }}>
              {t("meth.selectMixed")}
            </label>
            <select
              className="input"
              value={data.mixed_design || ""}
              onChange={(e) => updateField("mixed_design", e.target.value)}
              disabled={disabled}
            >
              <option value="">{t("meth.chooseMixed")}</option>
              {MIXED_DESIGN_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{t(`mixed.${opt.id}.label`)}</option>
              ))}
            </select>
            {data.mixed_design && MIXED_DESIGN_OPTIONS.some((o) => o.id === data.mixed_design) && (
              <p className="hop-desc" style={{ marginTop: 8, fontStyle: "italic", fontSize: 13 }}>
                {t(`mixed.${data.mixed_design}.desc`)}
              </p>
            )}
            {data.mixed_design === "embedded" && (
              <div style={{ marginTop: 12 }}>
                <label className="hop-desc" style={{ display: "block", marginBottom: 6 }}>
                  {t("meth.hostStrand")}
                </label>
                <span className="vd-host-switch">
                  <button
                    type="button"
                    className={(data.embedded_host || data.chosen_methodology || "qualitative") === "qualitative" ? "is-active" : ""}
                    onClick={() => updateField("embedded_host", "qualitative")}
                    disabled={disabled}
                  >
                    {t("meth.hostQual")}
                  </button>
                  <button
                    type="button"
                    className={(data.embedded_host || data.chosen_methodology || "qualitative") === "quantitative" ? "is-active" : ""}
                    onClick={() => updateField("embedded_host", "quantitative")}
                    disabled={disabled}
                  >
                    {t("meth.hostQuant")}
                  </button>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Before confirmation: show both sets of options side by side
  const recommended = config.recommended_methodology; // "quantitative", "qualitative", or null

  const introText = recommended
    ? t("meth.introRecommended", { rec: t(recommended === "quantitative" ? "meth.quantitative" : "meth.qualitative").toLowerCase() })
    : t("meth.introPragmatist");

  return (
    <div>
      <p className="hop-desc">{introText}</p>

      <div className="methodology-grid">
        <div className={`methodology-col${recommended === "quantitative" ? " methodology-col--recommended" : ""}`}>
          <h4 className="methodology-heading">
            {t("meth.quantHeading")}
            {recommended === "quantitative" && (
              <span className="methodology-badge">{t("meth.recommendedBadge")}</span>
            )}
          </h4>
          <ul className="methodology-list">
            {(config.quantitative_options || []).map((o) => (
              <li key={o.id}>
                <strong>{o.label}</strong>
                {o.description && `: ${o.description}`}
              </li>
            ))}
          </ul>
          <button
            className="btn"
            onClick={() => confirmMethodology("quantitative")}
            disabled={confirming || disabled}
          >
            {confirming ? t("meth.saving") : t("meth.chooseQuant")}
          </button>
        </div>

        <div className={`methodology-col${recommended === "qualitative" ? " methodology-col--recommended" : ""}`}>
          <h4 className="methodology-heading">
            {t("meth.qualHeading")}
            {recommended === "qualitative" && (
              <span className="methodology-badge">{t("meth.recommendedBadge")}</span>
            )}
          </h4>
          <ul className="methodology-list">
            {(config.qualitative_options || []).map((o) => (
              <li key={o.id}>
                <strong>{o.label}</strong>
                {o.description && `: ${o.description}`}
              </li>
            ))}
          </ul>
          <button
            className="btn"
            onClick={() => confirmMethodology("qualitative")}
            disabled={confirming || disabled}
          >
            {confirming ? t("meth.saving") : t("meth.chooseQual")}
          </button>
        </div>
      </div>
    </div>
  );
}
