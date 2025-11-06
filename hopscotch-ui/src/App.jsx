import './App.css';
import React, { useEffect, useState } from "react";

// tiny UI helpers
const Btn = ({ className = "", ...p }) => <button {...p} className={`btn ${className}`} />;
const Chip = ({ children }) => <span className="badge">{children}</span>;

// API client
const API = {
  base: "http://localhost:8000",
  async createSession() {
    const r = await fetch(`${this.base}/session`, { method: "POST" });
    return r.json();
  },
  async nextQuestion(session_id) {
    const r = await fetch(`${this.base}/step1/next-question?session_id=${encodeURIComponent(session_id)}`);
    return r.json();
  },
  async submitAnswer(session_id, question_id, answer) {
    const r = await fetch(`${this.base}/step1/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, question_id, answer }),
    });
    return r.json();
  },
  async generateWorldview(session_id) {
    const r = await fetch(`${this.base}/worldview/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id }),
    });
    return r.json();
  },
  async runStep(session_id, step_id, inputs) {
    const r = await fetch(`${this.base}/steps/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, step_id, inputs }),
    });
    return r.json();
  },
  async getScore(session_id) {
    const r = await fetch(`${this.base}/step1/score?session_id=${encodeURIComponent(session_id)}`).catch(() => null);
    return r ? r.json() : { total: 0, by_worldview: {}, top: null };
  }
};

// colors
const WV_COLORS = {
  positivist: "#3b82f6",
  post_positivist: "#22c55e",
  constructivist: "#a855f7",
  transformative: "#ef4444",
  pragmatist: "#f59e0b",
};

// CONTINUUM BANDS (by TOTAL score)
const CONTINUUM_BANDS = [
  { id: "positivist",      label: "Positivist",      min: 0,  max: 4 },
  { id: "post_positivist", label: "Post Positivist", min: 5,  max: 8 },
  { id: "constructivist",  label: "Constructivist",  min: 9,  max: 12 },
  { id: "transformative",  label: "Transformative",  min: 10, max: 18 }, // overlap per spec
  { id: "pragmatist",      label: "Pragmatist",      min: 20, max: 60 }
];

// pick first band whose range contains total (if overlapping, first wins)
function determineContinuum(total) {
  for (const band of CONTINUUM_BANDS) {
    if (total >= band.min && total <= band.max) return band;
  }
  return null;
}

// DUMMY EXPLANATIONS (replace later with your real content)
const EXPLANATIONS = {
  positivist: "Focuses on observable, measurable facts. Prefers experiments, quant, and repeatable results.",
  post_positivist: "Values evidence while recognizing bias and uncertainty; seeks rigorous but humble conclusions.",
  constructivist: "Emphasizes meanings, experiences, and multiple valid perspectives; often uses qualitative methods.",
  transformative: "Aims for equity and change; research centers power, voice, and social justice.",
  pragmatist: "Chooses whatever methods best answer the question; outcome and utility are key."
};

// ----------- Interactive Pie (no deps) -----------
function PieChartInteractive({ data, size = 200, stroke = 24, hoveredId, setHoveredId }) {
  // data = [{ id, label, value, color }]
  const total = Math.max(0, data.reduce((s, d) => s + (d.value || 0), 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <g transform={`translate(${size/2}, ${size/2})`}>
        {/* bg ring */}
        <circle r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        {data.map((d) => {
          const pct = total ? d.value / total : 0;
          const dash = pct * c;
          const rotate = (acc / total) * 360 - 90;
          acc += d.value || 0;
          const active = hoveredId === d.id;
          return (
            <g key={d.id}
               onMouseEnter={() => setHoveredId(d.id)}
               onMouseLeave={() => setHoveredId(null)}
               style={{ cursor: "pointer" }}>
              <circle
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={active ? stroke + 4 : stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                transform={`rotate(${rotate})`}
                strokeLinecap="butt"
              />
            </g>
          );
        })}
        {/* total in center */}
        <text y="6" textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">
          {total}
        </text>
      </g>
    </svg>
  );
}

// question input
function QuestionInput({ q, value, onChange }) {
  if (!q) return null;
  switch (q.type) {
    case "short":
      return <input className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Type a short answer" />;
    case "long":
      return <textarea className="textarea" rows={5} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Type a detailed answer" />;
    case "mcq":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.options?.map((opt) => (
            <label key={opt} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, cursor: "pointer", background: value === opt ? "#f7f7f7" : "white" }}>
              <input type="radio" name={q.id} checked={value === opt} onChange={() => onChange(opt)} style={{ marginRight: 8 }} />
              {opt}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.options?.map((opt) => (
            <label key={opt} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={Array.isArray(value) ? value.includes(opt) : false}
                onChange={(e) => {
                  const prev = Array.isArray(value) ? value : [];
                  onChange(e.target.checked ? [...prev, opt] : prev.filter((v) => v !== opt));
                }}
                style={{ marginRight: 8 }}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "scale": {
      const min = q.scale?.min ?? 0;
      const max = q.scale?.max ?? 20;
      return (
        <div>
          <input type="range" min={min} max={max} value={typeof value === "number" ? value : min}
                 onChange={(e) => onChange(parseInt(e.target.value))} style={{ width: "100%" }} />
          <div className="badge">Value: {value ?? min}</div>
        </div>
      );
    }
    case "date":
      return <input type="date" className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "time":
      return <input type="time" className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <div>Unsupported question type.</div>;
  }
}

// app
export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [pendingQ, setPendingQ] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [score, setScore] = useState(0);

  // scoring detail from backend
  const [scoreDetail, setScoreDetail] = useState({ total: 0, top: null, by_worldview: {} });

  // hover state for pie
  const [hoveredId, setHoveredId] = useState(null);

  // boot
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { session_id } = await API.createSession();
      setSessionId(session_id);
      const nq = await API.nextQuestion(session_id);
      setPendingQ(nq.question ?? null);
      const s = await API.getScore(session_id);
      setScore(s?.total ?? 0);
      setScoreDetail(s);
      setLoading(false);
    })();
  }, []);

  async function refreshScores() {
    if (!sessionId) return;
    const s = await API.getScore(sessionId);
    setScore(s?.total ?? 0);
    setScoreDetail(s);
  }

  async function submit() {
    if (!sessionId || !pendingQ) return;
    const val = answers[pendingQ.id];
    if (pendingQ.required && (val == null || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && val.length === 0))) {
      setStatus("This question is required.");
      return;
    }
    setStatus("");
    const res = await API.submitAnswer(sessionId, pendingQ.id, val);
    setPendingQ(res.question ?? null);
    await refreshScores();
  }

  async function regenerateWorldview() {
    if (!sessionId) return;
    const res = await API.generateWorldview(sessionId);
    setStatus("Worldview generated (stub): " + JSON.stringify(res.worldview));
  }

  async function resetSession() {
    setLoading(true);
    const { session_id } = await API.createSession();
    setSessionId(session_id);
    setAnswers({});
    const nq = await API.nextQuestion(session_id);
    setPendingQ(nq.question ?? null);
    const s = await API.getScore(session_id);
    setScore(s?.total ?? 0);
    setScoreDetail(s);
    setLoading(false);
  }

  const resourcesByStep = {
    1: [
      { label: "IRML Guide", href: "#" },
      { label: "AP Research Decision Tree", href: "#" },
      { label: "Example Prompts", href: "#" }
    ],
    2: [{ label: "Step 2 Rubric", href: "#" }]
  };

  // compute continuum band from TOTAL score
  const continuum = determineContinuum(scoreDetail.total);

  // build pie data from backend per-category counts (we won't list these elsewhere)
  const pieData = Object.entries(scoreDetail.by_worldview || {})
    .map(([id, value]) => ({
      id,
      label: id.replace("_", " "),
      value,
      color: WV_COLORS[id] || "#94a3b8"
    }))
    .filter(d => d.value > 0);

  // currently hovered explanation
  const hoverKey = hoveredId || (pieData[0] && pieData[0].id) || null;
  const hoverLabel = hoverKey ? hoverKey.replace("_", " ") : "—";
  const hoverText = hoverKey ? (EXPLANATIONS[hoverKey] || "—") : "—";

  return (
    <div className="hop-wrap">
      {/* HEADER with logo */}
      <header className="hop-header">
        <div className="hop-header__left">
          <img src="/hopscotch-logo.png" alt="Hopscotch 4 All" className="hop-logo" />
          <div className="hop-app-title">Hopscotch 4 All</div>
        </div>
        <div className="hop-header__right">
          <Chip>Score: {score}</Chip>
          <Btn onClick={resetSession}>New Session</Btn>
        </div>
      </header>

      {/* 3-pane body */}
      <div className="hop-shell">
        {/* LEFT: steps */}
        <aside className="hop-sidebar">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} className={`step-btn ${activeStep===n ? 'active':''}`} onClick={() => setActiveStep(n)}>
              {`Step ${n}`}
            </button>
          ))}
          <button className="step-btn">…</button>
        </aside>

        {/* CENTER: main */}
        <main className="hop-main">
          <section className="hop-card">
            <div className="hop-title">Step {activeStep}:</div>
            {activeStep === 1 ? (
              <p className="hop-desc">
                <strong>Based on the questionnaire and the decision tree</strong> provided in the AP research instructional
                resources, we will create a set of prompts to guide the learner. The assistant will help the user answer
                and determine their worldview among the four categories.
              </p>
            ) : (
              <p className="hop-desc">Step {activeStep} content will appear here.</p>
            )}
          </section>

          <section className="hop-wide">
            {activeStep !== 1 && (
              <div className="badge" style={{ marginBottom: 8 }}>
                This area will hold Step {activeStep} outputs. (Right now only Step 1 is interactive.)
              </div>
            )}

            {activeStep === 1 && (
              loading ? (
                <div className="badge">Loading survey…</div>
              ) : pendingQ ? (
                <>
                  <div className="badge" style={{ marginBottom: 6 }}>
                    Required: {pendingQ.required ? "Yes" : "No"}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{pendingQ.text}</div>
                  <QuestionInput
                    q={pendingQ}
                    value={answers[pendingQ.id]}
                    onChange={(v) => setAnswers((s) => ({ ...s, [pendingQ.id]: v }))}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Btn className="dark" onClick={submit}>Submit</Btn>
                    <Btn onClick={regenerateWorldview}>Generate Worldview</Btn>
                    <Btn onClick={resetSession}>New Session</Btn>
                  </div>
                  {status && <div className="badge" style={{ marginTop: 8 }}>{status}</div>}
                </>
              ) : (
                <div>
                  {/* RESULTS VIEW (total-based + interactive pie with explanations) */}
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>All questions answered 🎉</div>
                  <div className="badge" style={{ marginBottom: 12 }}>
                    Your worldview is determined by your <strong>total score</strong>.
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
                    {/* Left: interactive pie */}
                    <div style={{ position: "relative" }}>
                      <PieChartInteractive
                        data={pieData}
                        size={220}
                        stroke={26}
                        hoveredId={hoveredId}
                        setHoveredId={setHoveredId}
                      />
                      <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                        Hover a slice to see an explanation
                      </div>
                    </div>

                    {/* Right: summary + explanation */}
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>
                        Worldview Band (by total):{" "}
                        <span style={{ textTransform: "capitalize" }}>
                          {determineContinuum(scoreDetail.total)
                            ? `${determineContinuum(scoreDetail.total).label} (${determineContinuum(scoreDetail.total).min}–${determineContinuum(scoreDetail.total).max})`
                            : "—"}
                        </span>
                      </div>
                      <div className="badge" style={{ marginBottom: 10 }}>
                        Total: {scoreDetail.total}
                      </div>

                      {/* hover explanation */}
                      <div style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 12,
                        background: "#fff"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: 3,
                            background: WV_COLORS[hoverKey] || "#94a3b8", display: "inline-block"
                          }} />
                          <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{hoverLabel}</div>
                        </div>
                        <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                          {hoverText}
                        </div>
                      </div>

                      {/* static bands legend */}
                      <div style={{ fontWeight: 700, marginTop: 14, marginBottom: 6 }}>Bands reference</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {[
                          "pragmatist",
                          "constructivist",
                          "transformative",
                          "post_positivist",
                          "positivist"
                        ]
                          .map(id => CONTINUUM_BANDS.find(b => b.id === id))
                          .filter(Boolean)
                          .map(b => (
                            <div
                              key={b.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "6px 8px",
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                background: determineContinuum(scoreDetail.total)?.id === b.id ? "#f3f4f6" : "white"
                              }}
                            >
                              <span style={{ minWidth: 160, textTransform: "capitalize" }}>{b.label}:</span>
                              <strong>{b.min}–{b.max}</strong>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <Btn onClick={regenerateWorldview}>Regenerate Worldview</Btn>
                    <Btn onClick={resetSession}>New Session</Btn>
                  </div>
                </div>
              )
            )}
          </section>
        </main>

        {/* RIGHT: resources */}
        <aside className="hop-resources">
          <h3>IRML Resources and Links for Step {activeStep}</h3>
          <ul>
            {(resourcesByStep[activeStep] ?? [{ label: "Add links in code", href: "#" }]).map((r, i) => (
              <li key={i}><a href={r.href}>{r.label}</a></li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
