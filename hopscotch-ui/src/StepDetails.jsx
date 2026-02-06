import React, { useEffect, useMemo, useState } from "react";
import { API } from "./api";

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
  1: `This step will help you reflect on your paradigmatic positioning as a researcher (worldview).
The interactive resource on the left side panel will help you learn about the different worldviews you can bring
as a researcher to your studies.`,
  2: `In this second step, you will define and narrow down your research topic and goals (personal, practical, and intellectual)
that will be driving the study you are proposing. The interactive resource on the left will help you refine your topic
as well as the goals of your proposed study.`,
  3: `The third step focuses on your literature review. You will identify topical research — previous studies in your field that
help justify the relevance of your research topic — and define the theoretical frameworks that support your proposed research.
To guide you through this process, please explore the interactive resource on the left pane.`,
};

/**
 * Default empty shapes for each step's data
 */
const EMPTY_STEP_DATA = {
  1: { worldview: "" },
  2: { topic: "", goals: "" },
  3: { topicalResearch: "", theoreticalFrameworks: "" },
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
    API.getStepConfig(sessionId, step)
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
  }, [step, sessionId]);

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

  // helper to update + save
  const updateField = (field, value) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };

      if (sessionId) {
        setSaving(true);
        setSaveError("");

        API.saveStepData({
          session_id: sessionId,
          step,
          data: next,
        })
          .then((res) => {
            setSaving(false);
            if (res.completed_steps && onCompletedStepsChange) {
              onCompletedStepsChange(res.completed_steps);
            }
          })
          .catch((err) => {
            console.error("Failed to save step data", err);
            setSaving(false);
            setSaveError("Auto-save failed. Check your connection.");
          });
      }

      return next;
    });
  };

  // Step 1: when worldview changes, also tell backend to disable survey and set worldview
  const onWorldviewChange = async (newValue) => {
    updateField("worldview", newValue);

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
      // Trigger a streaming welcome message in the chat
      const label = newValue.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      if (onAutoSend) onAutoSend(`I just selected ${label} as my worldview. Can you give me a personalised welcome explaining what this means for my research approach and methodology pathway?`);
    } catch (e) {
      console.error("Failed to set worldview on backend", e);
      setSaveError("Worldview save failed. Check backend logs.");
    }
  };

  const title = STEP_TITLES[step] || `Step ${step}`;

  // ---------------- Step 1 ----------------
  if (step === 1) {
    return (
      <div className="step-details">
        {/* Directions card */}
        <section className="hop-card">
          <h2 className="hop-title">{title}</h2>
          <p className="hop-desc">
            <strong>Directions</strong>
            <br />
            {STEP_DIRECTIONS[1]}
          </p>
        </section>

        {/* Inputs card */}
        <section className="hop-card">
          <p className="hop-desc">
            After checking the interactive resources on the left side, please
            select the worldview that best represents who you are as a
            researcher:
          </p>

          <select
            className="input"
            value={data.worldview || ""}
            onChange={(e) => onWorldviewChange(e.target.value)}
            disabled={!sessionId}
          >
            <option value="">
              Choose the worldview that best aligns with who you are
            </option>
            <option value="positivist">Positivist</option>
            <option value="post_positivist">Post-positivist</option>
            <option value="constructivist">Constructivist</option>
            <option value="transformative">Transformative</option>
            <option value="pragmatist">Pragmatist</option>
            <option value="unsure">I’m not sure yet</option>
          </select>

          {worldviewStatus && (
            <div className="badge">
              {worldviewStatus}
            </div>
          )}

          {saving && (
            <div className="badge">
              Saving…
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

  // ---------------- Step 2 ----------------
  if (step === 2) {
    return (
      <div className="step-details">
        {/* Directions card */}
        <section className="hop-card">
          <h2 className="hop-title">{title}</h2>
          <p className="hop-desc">
            <strong>Directions</strong>
            <br />
            {STEP_DIRECTIONS[2]}
          </p>
        </section>

        {/* Inputs card */}
        <section className="hop-card">
          <p className="hop-desc">
            After checking the interactive resources on the left side, please
            define your topic and research goals:
          </p>

          <label className="hop-desc" style={{ display: "block", marginTop: 4 }}>
            Research topic
          </label>
          <input
            className="input"
            type="text"
            placeholder="Please describe your research topic…"
            value={data.topic || ""}
            onChange={(e) => updateField("topic", e.target.value)}
            disabled={!sessionId}
          />

          <label className="hop-desc" style={{ display: "block", marginTop: 10 }}>
            Research goals
          </label>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Please describe your research goals…"
            value={data.goals || ""}
            onChange={(e) => updateField("goals", e.target.value)}
            disabled={!sessionId}
          />

          <div className="step-save-row">
            <button
              className="btn btn--primary"
              disabled={!sessionId || !data.topic}
              onClick={() => {
                if (onAutoSend) onAutoSend(
                  `I'm on Step 2. My research topic is: "${data.topic || ""}". My research goals are: "${data.goals || ""}". Can you give me feedback on my topic and goals, and help me refine them?`
                );
              }}
            >
              Get AI Guidance
            </button>
            {saving && <span className="badge">Saving…</span>}
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
            <strong>Directions</strong>
            <br />
            {STEP_DIRECTIONS[3]}
          </p>
        </section>

        {/* Inputs card */}
        <section className="hop-card">
          <p className="hop-desc">
            After checking the interactive resources on the left side, please
            define your topical research and theoretical frameworks:
          </p>

          <label className="hop-desc" style={{ display: "block", marginTop: 4 }}>
            Topical research
          </label>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Please describe your topical research…"
            value={data.topicalResearch || ""}
            onChange={(e) => updateField("topicalResearch", e.target.value)}
            disabled={!sessionId}
          />

          <label className="hop-desc" style={{ display: "block", marginTop: 10 }}>
            Theoretical frameworks
          </label>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Please describe your theoretical frameworks…"
            value={data.theoreticalFrameworks || ""}
            onChange={(e) => updateField("theoreticalFrameworks", e.target.value)}
            disabled={!sessionId}
          />

          <div className="step-save-row">
            <button
              className="btn btn--primary"
              disabled={!sessionId || (!data.topicalResearch && !data.theoreticalFrameworks)}
              onClick={() => {
                if (onAutoSend) onAutoSend(
                  `I'm on Step 3. My topical research is: "${data.topicalResearch || ""}". My theoretical frameworks are: "${data.theoreticalFrameworks || ""}". Can you give me feedback and help me strengthen my literature review?`
                );
              }}
            >
              Get AI Guidance
            </button>
            {saving && <span className="badge">Saving…</span>}
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
            {stepConfig.directions || "Please complete Step 1 (worldview selection) before proceeding to this step."}
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
            <strong>Directions</strong>
            <br />
            {stepConfig.directions}
          </p>
        </section>

        <section className="hop-card">
          <StepFieldRenderer
            config={stepConfig}
            data={data}
            updateField={updateField}
            sessionId={sessionId}
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
            >
              Get AI Guidance
            </button>
            {saving && <span className="badge">Saving...</span>}
          </div>
          {saveError && (
            <div className="badge badge--error">
              {saveError}
            </div>
          )}
        </section>

        {/* Additional notes textarea for every step */}
        <section className="hop-card">
          <label className="hop-desc" style={{ display: "block", marginBottom: 6 }}>
            Additional notes for Step {step}
          </label>
          <textarea
            className="textarea"
            rows={3}
            placeholder={`Write any extra notes for Step ${step} here...`}
            value={data.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
            disabled={!sessionId}
          />
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
          Use this step to refine your research design. After exploring the
          interactive resource on the left, jot down any key decisions or notes
          you want to remember.
        </p>
      </section>

      <section className="hop-card">
        <label className="hop-desc" style={{ display: "block", marginBottom: 6 }}>
          Notes for Step {step}
        </label>
        <textarea
          className="textarea"
          rows={5}
          placeholder={`Write your notes for Step ${step} here...`}
          value={data.notes || ""}
          onChange={(e) => updateField("notes", e.target.value)}
          disabled={!sessionId}
        />

        {saving && (
          <div className="badge" style={{ marginTop: 6 }}>
            Saving...
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
        {fields.map((f) => (
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
        ))}
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
            Primary methodology:{" "}
            <strong>
              {chosenMethodology === "quantitative"
                ? "Quantitative"
                : "Qualitative"}
            </strong>
          </span>
          <button
            className="link-btn"
            onClick={resetChoice}
            style={{ marginLeft: 12 }}
          >
            Change
          </button>
        </div>
        <label
          className="hop-desc"
          style={{ display: "block", marginTop: 12, marginBottom: 6 }}
        >
          Now select your research design:
        </label>
        <select
          className="input"
          value={data[config.field_key] || ""}
          onChange={(e) => updateField(config.field_key, e.target.value)}
          disabled={disabled}
        >
          <option value="">-- Choose a design --</option>
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
      </div>
    );
  }

  // Before confirmation: show both sets of options side by side
  return (
    <div>
      <p className="hop-desc">
        As a pragmatist, you can draw from both quantitative and qualitative
        approaches. Explore the options below and chat with the AI assistant to
        help decide which fits your study. Then confirm your choice.
      </p>

      <div className="methodology-grid">
        <div className="methodology-col">
          <h4 className="methodology-heading">Quantitative Designs</h4>
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
            {confirming ? "Saving..." : "Choose Quantitative"}
          </button>
        </div>

        <div className="methodology-col">
          <h4 className="methodology-heading">Qualitative Designs</h4>
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
            {confirming ? "Saving..." : "Choose Qualitative"}
          </button>
        </div>
      </div>
    </div>
  );
}
