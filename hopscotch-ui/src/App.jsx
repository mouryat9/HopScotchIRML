import "./App.css";
import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* =========================
   Small UI helpers
   ========================= */
const Btn = ({ className = "", ...p }) => (
  <button {...p} className={`btn ${className}`} />
);
const Chip = ({ children }) => <span className="badge">{children}</span>;

/* =========================
   API client (chat-first)
   ========================= */
const API = {
  base: "http://localhost:8000",

  async createSession() {
    const r = await fetch(`${this.base}/session`, { method: "POST" });
    if (!r.ok) throw new Error(`createSession ${r.status}`);
    return r.json();
  },

  async history(session_id) {
    const r = await fetch(
      `${this.base}/chat/history?session_id=${encodeURIComponent(session_id)}`
    );
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
   Chat helpers (visual)
   ========================= */

// simple collapsible
function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="collapsible">
      <button
        className="collapsible__btn"
        onClick={() => setOpen((o) => !o)}
      >
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
        <button
          className="link-btn"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

/**
 * Tries to split the assistant message into:
 * - main explanation (Markdown)
 * - "Quick references from our notes" → rendered as source cards
 */
function parseAssistantMessage(md) {
  const marker = "**Quick references from our notes:**";
  const ix = md.indexOf(marker);

  if (ix === -1) {
    return { prose: md, refs: [] };
  }

  const prose = md.slice(0, ix).trim();
  const tail = md.slice(ix + marker.length).trim();

  const refs = [];
  tail.split("\n").forEach((line) => {
    // pattern: - *filename.pdf*: snippet...
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
  const mdToRender = refs.length ? prose : turn.content || "";

  return (
    <div className="chat-row assistant">
      <div className="chat-bubble chat-bubble--assistant">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {mdToRender}
        </ReactMarkdown>

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

// Get the last assistant message from history
function getLastAssistantTurn(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant") return history[i];
  }
  return null;
}

// Parse bullet options after the marker line
function extractSurveyOptionsFromText(text) {
  if (!text) return [];
  const marker = "Please respond with exactly ONE of the following options:";
  const idx = text.indexOf(marker);
  if (idx === -1) return [];

  const tail = text.slice(idx + marker.length).split("\n");
  const opts = [];
  for (const line of tail) {
    const m = line.match(/^\s*[-•]\s*(.+)\s*$/);
    if (m && m[1]) {
      opts.push(m[1].trim());
    }
  }
  return opts;
}

/* =========================
   ChatBox (center column)
   ========================= */
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
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history]);

  // ---------- survey quick options ----------
  const surveyOptions = React.useMemo(() => {
    const last = getLastAssistantTurn(history);
    if (!last) return [];
    return extractSurveyOptionsFromText(last.content || "");
  }, [history]);

  async function send(forcedText) {
    const msg = (forcedText ?? input).trim();
    if (!msg || !sessionId || sending) return;
    setSending(true);
    if (!forcedText) setInput("");
    setErr("");
    try {
      const res = await API.chatSend(sessionId, msg);
      setHistory(res.history || []);
    } catch (e) {
      console.error(e);
      setErr("Send failed. Check backend logs / Network tab.");
      if (!forcedText) setInput(msg); // restore manual input
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

  function handleOptionClick(opt) {
    // send the option directly (no need to type)
    send(opt);
  }

  return (
    <div className="chat-wrap">
      <div className="chat-head">
        <div className="chat-title">Assistant Chat</div>
        <div className="chat-hint">Tutor-style answers • cites notes below</div>
      </div>

      <div className="chat-body" ref={scrollRef}>
        {history.length === 0 && (
          <div className="chat-empty">
            Ask me anything about your research worldview or let’s start the short survey.
          </div>
        )}
        {history.map((t, i) => <ChatBubble key={i} turn={t} />)}
      </div>

      {/* Quick survey options, when present */}
      {surveyOptions.length > 0 && (
        <div className="quick-options">
          {surveyOptions.map((opt) => (
            <button
              key={opt}
              className="btn pill"
              type="button"
              disabled={sending || !sessionId}
              onClick={() => handleOptionClick(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type your message and press Enter…"
          rows={2}
          disabled={!sessionId || sending}
        />
        <button
          className="btn dark"
          onClick={() => send()}
          disabled={!input.trim() || sending || !sessionId}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      {err && <div className="badge" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}

/* =========================
   Step metadata / resources
   ========================= */

const STEP_DESCRIPTIONS = {
  1: "Clarify your research worldview and how it shapes your questions and choices.",
  2: "Align your problem statement with your worldview and research purpose.",
  3: "Decide on methods that match your worldview and research questions.",
  4: "Plan sampling and participants in an ethical, coherent way.",
  5: "Choose data collection tools that fit your paradigm.",
  6: "Plan data analysis strategies that align with your worldview.",
  7: "Think about validity, trustworthiness, and limitations.",
  8: "Reflect on ethics, power, and impact in your study.",
  9: "Synthesize everything into a coherent design and narrative.",
};

const resourcesByStep = {
  1: [
    { label: "IRML Worldview Guide", href: "#" },
    { label: "Paradigm Decision Tree", href: "#" },
    { label: "Sample worldview write-up", href: "#" },
  ],
  2: [{ label: "Problem statements vs. paradigms", href: "#" }],
  3: [{ label: "Methods cheat sheet (quant / qual / mixed)", href: "#" }],
  4: [{ label: "Sampling strategies overview", href: "#" }],
  5: [{ label: "Data collection instruments examples", href: "#" }],
  6: [{ label: "Analysis approaches per paradigm", href: "#" }],
  7: [{ label: "Validity & trustworthiness checklist", href: "#" }],
  8: [{ label: "Ethics and power in research", href: "#" }],
  9: [{ label: "Full Hopscotch 9-step template", href: "#" }],
};

/* Step colors (your mapping) */
const STEP_COLORS = {
  1: "#126697",
  2: "#da5898",
  3: "#d13938",
  4: "#058495",
  5: "#d3c08a",
  6: "#0ca3dc",
  7: "#f7ba00",
  8: "#ff9300",
  9: "#797979",
};

/* =========================
   App (3-column layout)
   ========================= */
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
          <div className="hop-app-title">Hopscotch 4 All</div>
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

      {/* Body shell: left steps, center chat, right resources */}
      <div className="hop-shell">
        {/* Steps (left sidebar) */}
        <aside className="hop-sidebar">
          {[
            { n: 1, color: STEP_COLORS[1] },
            { n: 2, color: STEP_COLORS[2] },
            { n: 3, color: STEP_COLORS[3] },
            { n: 4, color: STEP_COLORS[4] },
            { n: 5, color: STEP_COLORS[5] },
            { n: 6, color: STEP_COLORS[6] },
            { n: 7, color: STEP_COLORS[7] },
            { n: 8, color: STEP_COLORS[8] },
            { n: 9, color: STEP_COLORS[9] },
          ].map(({ n, color }) => (
            <button
              key={n}
              className={`step-btn ${activeStep === n ? "active" : ""}`}
              onClick={() => setActiveStep(n)}
              style={{
                backgroundColor: color,
                color: "white",
                borderColor: activeStep === n ? "#00000055" : "transparent",
                fontWeight: activeStep === n ? "700" : "500",
              }}
            >
              {`Step ${n}`}
            </button>
          ))}
          <button className="step-btn">…</button>
        </aside>

        {/* Main center column */}
        <main className="hop-main">
          {/* Step title / description card */}
          <section className="hop-card">
            <div className="hop-title">Step {activeStep}:</div>
            <p className="hop-desc">
              {STEP_DESCRIPTIONS[activeStep] ||
                "Use this step to refine your design with help from the assistant."}
            </p>
          </section>

          {/* Chat card */}
          <section className="hop-wide">
            {loading && !sessionId ? (
              <div className="badge">Starting session…</div>
            ) : (
              <>
                <ChatBox sessionId={sessionId} step={activeStep} />
                {status && (
                  <div className="badge" style={{ marginTop: 8 }}>
                    {status}
                  </div>
                )}
              </>
            )}
          </section>
        </main>

        {/* Resources (right column) */}
        <aside className="hop-resources">
          <h3>IRML Resources and Links for Step {activeStep}</h3>
          <ul>
            {(resourcesByStep[activeStep] ??
              [{ label: "Add links in code", href: "#" }]).map((r, i) => (
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
