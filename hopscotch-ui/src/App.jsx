import "./App.css";
import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* =========================
   Small UI helpers
   ========================= */
const Btn = ({ className = "", ...p }) => <button {...p} className={`btn ${className}`} />;
const Chip = ({ children }) => <span className="badge">{children}</span>;

/* =========================
   API client
   ========================= */
const API = {
  base: "http://localhost:8000",

  async createSession() {
    const r = await fetch(`${this.base}/session`, { method: "POST" });
    if (!r.ok) throw new Error(`createSession ${r.status}`);
    return r.json();
  },

  async nextQuestion(session_id) {
    const r = await fetch(`${this.base}/step1/next-question?session_id=${encodeURIComponent(session_id)}`);
    if (!r.ok) throw new Error(`nextQuestion ${r.status}`);
    return r.json();
  },

  async submitAnswer(session_id, question_id, answer) {
    const r = await fetch(`${this.base}/step1/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, question_id, answer }),
    });
    if (!r.ok) throw new Error(`submitAnswer ${r.status}: ${await r.text()}`);
    return r.json();
  },

  async generateWorldview(session_id) {
    const r = await fetch(`${this.base}/worldview/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id }),
    });
    if (!r.ok) throw new Error(`generateWorldview ${r.status}`);
    return r.json();
  },

  async runStep(session_id, step_id, inputs) {
    const r = await fetch(`${this.base}/steps/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, step_id, inputs }),
    });
    if (!r.ok) throw new Error(`runStep ${r.status}`);
    return r.json();
  },

  async getScore(session_id) {
    const r = await fetch(`${this.base}/step1/score?session_id=${encodeURIComponent(session_id)}`).catch(() => null);
    if (!r || !r.ok) return { total: 0, by_worldview: {}, top: null };
    return r.json();
  },

  async history(session_id) {
    const r = await fetch(`${this.base}/chat/history?session_id=${encodeURIComponent(session_id)}`);
    if (!r.ok) throw new Error(`history ${r.status}: ${await r.text()}`);
    return r.json();
  },

  async chatSend(session_id, message) {
    const r = await fetch(`${this.base}/chat/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, message }),
    });
    if (!r.ok) throw new Error(`chatSend ${r.status}: ${await r.text()}`);
    return r.json();
  },
};

/* =========================
   Colors + Bands + Explainers
   ========================= */
const WV_COLORS = {
  positivist: "#3b82f6",
  post_positivist: "#22c55e",
  constructivist: "#a855f7",
  transformative: "#ef4444",
  pragmatist: "#f59e0b",
};

const CONTINUUM_BANDS = [
  { id: "positivist",      label: "Positivist",      min: 0,  max: 4 },
  { id: "post_positivist", label: "Post Positivist", min: 5,  max: 8 },
  { id: "constructivist",  label: "Constructivist",  min: 9,  max: 12 },
  { id: "transformative",  label: "Transformative",  min: 10, max: 18 }, // intentional overlap per spec
  { id: "pragmatist",      label: "Pragmatist",      min: 20, max: 60 },
];

function determineContinuum(total) {
  for (const band of CONTINUUM_BANDS) {
    if (total >= band.min && total <= band.max) return band;
  }
  return null;
}

const EXPLANATIONS = {
  positivist: "Focuses on observable, measurable facts. Prefers experiments, quant, and repeatable results.",
  post_positivist: "Values evidence while recognizing bias and uncertainty; seeks rigorous but humble conclusions.",
  constructivist: "Emphasizes meanings, experiences, and multiple valid perspectives; often uses qualitative methods.",
  transformative: "Aims for equity and change; research centers power, voice, and social justice.",
  pragmatist: "Chooses whatever methods best answer the question; outcome and utility are key.",
};

/* =========================
   Interactive Pie (no deps)
   ========================= */
function PieChartInteractive({ data, size = 200, stroke = 24, hoveredId, setHoveredId }) {
  const total = Math.max(0, data.reduce((s, d) => s + (d.value || 0), 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        <circle r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        {data.map((d) => {
          const pct = total ? d.value / total : 0;
          const dash = pct * c;
          const rotate = (acc / total) * 360 - 90;
          acc += d.value || 0;
          const active = hoveredId === d.id;
          return (
            <g
              key={d.id}
              onMouseEnter={() => setHoveredId(d.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: "pointer" }}
            >
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
        <text y="6" textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">
          {total}
        </text>
      </g>
    </svg>
  );
}

/* =========================
   Survey input renderer
   ========================= */
function QuestionInput({ q, value, onChange }) {
  if (!q) return null;
  switch (q.type) {
    case "short":
      return (
        <input
          className="input"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type a short answer"
        />
      );
    case "long":
      return (
        <textarea
          className="textarea"
          rows={5}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type a detailed answer"
        />
      );
    case "mcq":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.options?.map((opt) => (
            <label
              key={opt}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 8,
                cursor: "pointer",
                background: value === opt ? "#f7f7f7" : "white",
              }}
            >
              <input
                type="radio"
                name={q.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
                style={{ marginRight: 8 }}
              />
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
          <input
            type="range"
            min={min}
            max={max}
            value={typeof value === "number" ? value : min}
            onChange={(e) => onChange(parseInt(e.target.value))}
            style={{ width: "100%" }}
          />
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

/* =========================
   Chat components (polished)
   ========================= */

// simple collapsible
function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="collapsible">
      <button className="collapsible__btn" onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className={`chev ${open ? "up" : "down"}`}>▾</span>
      </button>
      {open && <div className="collapsible__body">{children}</div>}
    </div>
  );
}

// trimmed reference card
function SourceCard({ source, text }) {
  const [expanded, setExpanded] = React.useState(false);
  const short = text.length > 380 ? text.slice(0, 380) + "…" : text;
  return (
    <div className="source-card">
      <div className="source-card__head">
        <span className="source-chip">{source}</span>
      </div>
      <div className="source-card__text">{expanded ? text : short}</div>
      {text.length > 380 && (
        <button className="link-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// pull out “Quick references…” section from assistant message into cards
function parseAssistantMessage(md) {
  const marker = "**Quick references from our notes:**";
  const ix = md.indexOf(marker);

  if (ix === -1) {
    return { prose: md, refs: [] };
  }

  const prose = md.slice(0, ix).trim();
  const tail = md.slice(ix + marker.length).trim();

  // lines in form: "- *filename.pdf*: some snippet…"
  const refs = [];
  tail.split("\n").forEach((line) => {
    const m = line.match(/^- \*([^*]+)\*:\s*(.+)$/i);
    if (m) refs.push({ source: m[1].trim(), text: m[2].trim() });
  });

  return { prose, refs };
}

function ChatBubble({ turn }) {
  if (turn.role === "user") {
    return (
      <div className="chat-row user">
        <div className="chat-bubble chat-bubble--user">{turn.content}</div>
      </div>
    );
  }

  const { prose, refs } = parseAssistantMessage(turn.content || "");
  // If no marker found, just render entire content as markdown
  const mdToRender = refs.length ? prose : (turn.content || "");

  return (
    <div className="chat-row assistant">
      <div className="chat-bubble chat-bubble--assistant">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{mdToRender}</ReactMarkdown>
        {refs.length > 0 && (
          <Collapsible title={`References (${refs.length})`}>
            <div className="source-grid">
              {refs.map((r, i) => (
                <SourceCard key={i} source={r.source} text={r.text} />
              ))}
            </div>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

function ChatBox({ sessionId }) {
  const [history, setHistory] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState("");
  const scrollRef = React.useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setErr("");
      if (!sessionId) return;
      try {
        const h = await API.history(sessionId);
        if (!cancelled) setHistory(h.history || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setErr("Could not load chat history.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  async function send() {
    const msg = input.trim();
    if (!msg || !sessionId || sending) return;
    setSending(true);
    setInput("");
    setErr("");
    try {
      const res = await API.chatSend(sessionId, msg);
      setHistory(res.history || []);
    } catch (e) {
      console.error(e);
      setErr("Send failed. Check backend logs / Network tab.");
      setInput(msg); // restore
    } finally {
      setSending(false);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="chat-wrap">
      <div className="chat-head">
        <div className="chat-title">Assistant Chat</div>
        <div className="chat-hint">Tutor-style answers • cites notes below</div>
      </div>

      <div className="chat-body" ref={scrollRef}>
        {history.length === 0 && <div className="chat-empty">Ask me anything about your research worldview.</div>}
        {history.map((t, i) => <ChatBubble key={i} turn={t} />)}
      </div>

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type your message and press Enter…"
          rows={2}
          disabled={!sessionId || sending}
        />
        <button className="btn dark" onClick={send} disabled={!input.trim() || sending || !sessionId}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      {err && <div className="badge" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

/* =========================
   App
   ========================= */
export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [pendingQ, setPendingQ] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [score, setScore] = useState(0);

  const [scoreDetail, setScoreDetail] = useState({ total: 0, top: null, by_worldview: {} });
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { session_id } = await API.createSession();
        setSessionId(session_id);
        const nq = await API.nextQuestion(session_id);
        setPendingQ(nq.question ?? null);
        const s = await API.getScore(session_id);
        setScore(s?.total ?? 0);
        setScoreDetail(s);
      } catch (e) {
        console.error(e);
        setStatus("Failed to start session.");
      } finally {
        setLoading(false);
      }
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
    try {
      const res = await API.submitAnswer(sessionId, pendingQ.id, val);
      setPendingQ(res.question ?? null);
      await refreshScores();
    } catch (e) {
      console.error(e);
      setStatus("Submit failed. Check backend logs.");
    }
  }

  async function regenerateWorldview() {
    if (!sessionId) return;
    try {
      const res = await API.generateWorldview(sessionId);
      setStatus("Worldview generated (stub): " + JSON.stringify(res.worldview));
    } catch {
      setStatus("Worldview generation failed.");
    }
  }

  async function resetSession() {
    setLoading(true);
    try {
      const { session_id } = await API.createSession();
      setSessionId(session_id);
      setAnswers({});
      const nq = await API.nextQuestion(session_id);
      setPendingQ(nq.question ?? null);
      const s = await API.getScore(session_id);
      setScore(s?.total ?? 0);
      setScoreDetail(s);
    } catch {
      setStatus("Failed to reset session.");
    } finally {
      setLoading(false);
    }
  }

  const resourcesByStep = {
    1: [
      { label: "IRML Guide", href: "#" },
      { label: "AP Research Decision Tree", href: "#" },
      { label: "Example Prompts", href: "#" },
    ],
    2: [{ label: "Step 2 Rubric", href: "#" }],
  };

  const continuum = determineContinuum(scoreDetail.total);

  const pieData = Object.entries(scoreDetail.by_worldview || {})
    .map(([id, value]) => ({
      id,
      label: id.replace("_", " "),
      value,
      color: WV_COLORS[id] || "#94a3b8",
    }))
    .filter((d) => d.value > 0);

  const hoverKey = hoveredId || (pieData[0] && pieData[0].id) || null;
  const hoverLabel = hoverKey ? hoverKey.replace("_", " ") : "—";
  const hoverText = hoverKey ? EXPLANATIONS[hoverKey] || "—" : "—";

  return (
    <div className="hop-wrap">
      {/* Header */}
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

      {/* Body */}
      <div className="hop-shell">
        {/* Steps */}
        <aside className="hop-sidebar">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              className={`step-btn ${activeStep === n ? "active" : ""}`}
              onClick={() => setActiveStep(n)}
            >
              {`Step ${n}`}
            </button>
          ))}
          <button className="step-btn">…</button>
        </aside>

        {/* Main */}
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
            {/* Step 1 */}
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

                  {/* Chat below the survey */}
                  <div className="section-divider" />
                  <ChatBox sessionId={sessionId} />
                </>
              ) : (
                // Results (total-based + interactive pie + explanations)
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>All questions answered 🎉</div>
                  <div className="badge" style={{ marginBottom: 12 }}>
                    Your worldview is determined by your <strong>total score</strong>.
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "260px 1fr",
                      gap: 16,
                      alignItems: "start",
                    }}
                  >
                    {/* Pie */}
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

                    {/* Summary + Explanation */}
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

                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: 12,
                          background: "#fff",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              background: WV_COLORS[hoverKey] || "#94a3b8",
                              display: "inline-block",
                            }}
                          />
                          <div style={{ fontWeight: 700, textTransform: "capitalize" }}>{hoverLabel}</div>
                        </div>
                        <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{hoverText}</div>
                      </div>

                      {/* Bands legend */}
                      <div style={{ fontWeight: 700, marginTop: 14, marginBottom: 6 }}>Bands reference</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {["pragmatist", "constructivist", "transformative", "post_positivist", "positivist"]
                          .map((id) => CONTINUUM_BANDS.find((b) => b.id === id))
                          .filter(Boolean)
                          .map((b) => (
                            <div
                              key={b.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "6px 8px",
                                border: "1px solid #e5e7eb",
                                borderRadius: 8,
                                background: determineContinuum(scoreDetail.total)?.id === b.id ? "#f3f4f6" : "white",
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

                  {/* Chat below results */}
                  <div className="section-divider" />
                  <ChatBox sessionId={sessionId} />
                </div>
              )
            )}

            {/* Steps 2–9 — show chat under a small banner */}
            {activeStep !== 1 && (
              <>
                <div className="badge" style={{ marginBottom: 8 }}>
                  {`Step ${activeStep}`} Assistant — chat below.
                </div>

                {/* step-specific UI could go here */}

                <div className="section-divider" />
                <ChatBox sessionId={sessionId} />
              </>
            )}
          </section>
        </main>

        {/* Resources */}
        <aside className="hop-resources">
          <h3>IRML Resources and Links for Step {activeStep}</h3>
          <ul>
            {(resourcesByStep[activeStep] ?? [{ label: "Add links in code", href: "#" }]).map((r, i) => (
              <li key={i}>
                <a href={r.href}>{r.label}</a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
