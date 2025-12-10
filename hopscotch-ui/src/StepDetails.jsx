import React, { useEffect, useState } from "react";
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
  1: {
    worldview: "",
  },
  2: {
    topic: "",
    goals: "",
  },
  3: {
    topicalResearch: "",
    theoreticalFrameworks: "",
  },
};

/**
 * Main wrapper – chooses which step layout to render.
 * Props:
 *  - step: number (1–9)
 *  - sessionId: string | null   (used for saving/loading)
 */
export default function StepDetails({ step, sessionId }) {
  const [data, setData] = useState(EMPTY_STEP_DATA[step] || {});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Load data whenever step or session changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setSaveError("");
      const base = EMPTY_STEP_DATA[step] || {};
      setData(base);

      if (!sessionId) return;

      try {
        const res = await API.getStepData(sessionId, step);
        if (!cancelled) {
          setData({
            ...base,
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
  }, [step, sessionId]);

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
          .then(() => {
            setSaving(false);
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

  const title = STEP_TITLES[step] || `Step ${step}`;

  // Route to specific layouts
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
            onChange={(e) => updateField("worldview", e.target.value)}
            disabled={!sessionId}
          >
            <option value="">Choose the worldview that best aligns with who you are</option>
            <option value="positivist">Positivist</option>
            <option value="post_positivist">Post-positivist</option>
            <option value="constructivist">Constructivist</option>
            <option value="transformative">Transformative</option>
            <option value="pragmatist">Pragmatist</option>
            <option value="unsure">I’m not sure yet</option>
          </select>

          {saving && (
            <div className="badge" style={{ marginTop: 6 }}>
              Saving…
            </div>
          )}
          {saveError && (
            <div className="badge" style={{ marginTop: 6 }}>
              {saveError}
            </div>
          )}
        </section>
      </div>
    );
  }

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

          <label
            className="hop-desc"
            style={{ display: "block", marginTop: 10 }}
          >
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

          {saving && (
            <div className="badge" style={{ marginTop: 6 }}>
              Saving…
            </div>
          )}
          {saveError && (
            <div className="badge" style={{ marginTop: 6 }}>
              {saveError}
            </div>
          )}
        </section>
      </div>
    );
  }

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

          <label
            className="hop-desc"
            style={{ display: "block", marginTop: 10 }}
          >
            Theoretical frameworks
          </label>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Please describe your theoretical frameworks…"
            value={data.theoreticalFrameworks || ""}
            onChange={(e) =>
              updateField("theoreticalFrameworks", e.target.value)
            }
            disabled={!sessionId}
          />

          {saving && (
            <div className="badge" style={{ marginTop: 6 }}>
              Saving…
            </div>
          )}
          {saveError && (
            <div className="badge" style={{ marginTop: 6 }}>
              {saveError}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Generic fallback for steps 4–9 for now
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
          placeholder={`Write your notes for Step ${step} here…`}
          value={data.notes || ""}
          onChange={(e) => updateField("notes", e.target.value)}
          disabled={!sessionId}
        />
        {saving && (
          <div className="badge" style={{ marginTop: 6 }}>
            Saving…
          </div>
        )}
        {saveError && (
          <div className="badge" style={{ marginTop: 6 }}>
            {saveError}
          </div>
        )}
      </section>
    </div>
  );
}
