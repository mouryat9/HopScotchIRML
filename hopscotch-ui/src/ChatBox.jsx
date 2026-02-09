// src/ChatBox.jsx
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API } from "./api";

/* ---------- Step color + label map ---------- */
const STEP_COLORS = {
  1: "#2B5EA7",
  2: "#E8618C",
  3: "#D94040",
  4: "#1A8A7D",
  5: "#B0A47A",
  6: "#00AEEF",
  7: "#F0B429",
  8: "#F5922A",
  9: "#7B8794",
};
const STEP_LABELS = {
  1: "Who am I as a researcher?",
  2: "What am I wondering about?",
  3: "What do I already know?",
  4: "How will I study it?",
  5: "What is my research question?",
  6: "What is the data to collect?",
  7: "How will I make sense of the data?",
  8: "How will I ensure my evidence is trustworthy?",
  9: "How will I be ethical and safe in my study?",
};

/* ---------- Small helpers ---------- */

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
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

function SourceCard({ source, text }) {
  const [expanded, setExpanded] = useState(false);
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

// Split assistant content into main prose + references block
function parseAssistantMessage(md) {
  const marker = "**Quick references from our notes:**";
  const ix = md.indexOf(marker);

  if (ix === -1) return { prose: md, refs: [] };

  const prose = md.slice(0, ix).trim();
  const tail = md.slice(ix + marker.length).trim();

  const refs = [];
  tail.split("\n").forEach((line) => {
    const m = line.match(/^- \*([^*]+)\*:\s*(.+)$/i); // - *file*: summary
    if (m) refs.push({ source: m[1].trim(), text: m[2].trim() });
  });

  return { prose, refs };
}

function ChatBubble({ turn }) {
  const stepColor = STEP_COLORS[turn.step] || null;
  const borderStyle = stepColor ? { borderLeft: `4px solid ${stepColor}` } : {};

  if (turn.role === "user") {
    return (
      <div className="chat-row user">
        <div className="chat-bubble chat-bubble--user" style={borderStyle}>{turn.content}</div>
      </div>
    );
  }

  const { prose, refs } = parseAssistantMessage(turn.content || "");
  const mdToRender = refs.length ? prose : turn.content || "";

  return (
    <div className="chat-row assistant">
      <div className="chat-bubble chat-bubble--assistant" style={borderStyle}>
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

/* ---------- Step group wrapper ---------- */
function groupByStep(history) {
  const groups = [];
  let current = null;
  for (const turn of history) {
    const s = turn.step || null;
    if (!current || current.step !== s) {
      current = { step: s, turns: [] };
      groups.push(current);
    }
    current.turns.push(turn);
  }
  return groups;
}

function StepGroup({ group, isActive }) {
  const [open, setOpen] = useState(isActive);
  const color = STEP_COLORS[group.step] || "var(--hop-navy-dark)";
  const label = STEP_LABELS[group.step] || "General";
  const msgCount = group.turns.length;

  // Auto-expand when step becomes active
  useEffect(() => { if (isActive) setOpen(true); }, [isActive]);

  if (!group.step) {
    // Messages with no step — always show
    return group.turns.map((t, i) => <ChatBubble key={i} turn={t} />);
  }

  return (
    <div className="chat-step-group">
      <button
        className={`chat-step-group__header${open ? " chat-step-group__header--open" : ""}`}
        style={{ "--step-color": color }}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="chat-step-group__pill" style={{ background: color }}>
          Step {group.step}
        </span>
        <span className="chat-step-group__label">{label}</span>
        <span className="chat-step-group__count">{msgCount} msg{msgCount !== 1 ? "s" : ""}</span>
        <span className={`chat-step-group__arrow${open ? " chat-step-group__arrow--open" : ""}`}>&#9662;</span>
      </button>
      {open && (
        <div className="chat-step-group__body">
          {group.turns.map((t, i) => <ChatBubble key={i} turn={t} />)}
        </div>
      )}
    </div>
  );
}



/* ---------- Main chat component ---------- */

export default function ChatBox({ sessionId, activeStep, refreshKey, autoMessage, onAutoMessageSent }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);

  // Load history when we get a session
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
  }, [sessionId, refreshKey]);

  // Auto-scroll to bottom when history changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Auto-send message triggered by parent (e.g. worldview selection)
  useEffect(() => {
    if (autoMessage && sessionId && !sending) {
      send(autoMessage, { hideUserBubble: true });
      if (onAutoMessageSent) onAutoMessageSent();
    }
  }, [autoMessage]);


  async function send(forcedText, opts = {}) {
    const msg = (forcedText ?? input).trim();
    if (!msg || !sessionId || sending) return;

    setSending(true);
    if (!forcedText) setInput("");
    setErr("");

    // Optimistic user turn + empty assistant placeholder for streaming
    // If hideUserBubble is set, only show the assistant placeholder
    setHistory((prev) => [
      ...prev,
      ...(opts.hideUserBubble ? [] : [{ role: "user", content: msg, step: activeStep }]),
      { role: "assistant", content: "", step: activeStep },
    ]);

    try {
      const res = await API.chatSendStream(sessionId, msg, activeStep);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        // Update the last (assistant) bubble in-place
        const snap = accumulated;
        setHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: snap, step: activeStep };
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
      setErr("Send failed. Check backend logs / Network tab.");
      // Put text back in box if it was typed manually
      if (!forcedText) setInput(msg);
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
        <div className="chat-title">Research Assistant</div>
      </div>

      <div className="chat-body" ref={scrollRef}>
        {history.length === 0 && (
          <div className="chat-empty">
            Welcome! I can help you scaffold your research design step by step.
            Ask me anything or select a worldview above to get started.
          </div>
        )}
        {groupByStep(history).map((g, i) => (
          <StepGroup key={`${g.step}-${i}`} group={g} isActive={g.step === activeStep} />
        ))}
      </div>

      {sending && (
        <div className="typing-indicator">
          <svg className="hop-grid-loader" viewBox="0 0 128 46" width="64" height="23" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" fill="none" style={{background:'transparent'}} aria-label="Loading">
            {/* col 1 — pair (Steps 1,2) */}
            <rect className="hop-sq sq-1" x="0"  y="0"  width="18" height="22" rx="6" fill="#2B5EA7"/>
            <rect className="hop-sq sq-2" x="0"  y="24" width="18" height="22" rx="6" fill="#E8618C"/>
            {/* col 2 — single (Step 3) */}
            <rect className="hop-sq sq-3" x="22" y="12" width="18" height="22" rx="6" fill="#D94040"/>
            {/* col 3 — pair (Steps 4,5) */}
            <rect className="hop-sq sq-4" x="44" y="0"  width="18" height="22" rx="6" fill="#1A8A7D"/>
            <rect className="hop-sq sq-5" x="44" y="24" width="18" height="22" rx="6" fill="#B0A47A"/>
            {/* col 4 — single (Step 6) */}
            <rect className="hop-sq sq-6" x="66" y="12" width="18" height="22" rx="6" fill="#00AEEF"/>
            {/* col 5 — pair (Steps 7,8) */}
            <rect className="hop-sq sq-7" x="88" y="0"  width="18" height="22" rx="6" fill="#F0B429"/>
            <rect className="hop-sq sq-8" x="88" y="24" width="18" height="22" rx="6" fill="#F5922A"/>
            {/* col 6 — single half-circle (Step 9) */}
            <path className="hop-sq sq-9" d="M110,7 A16,16 0 0,1 110,39 Z" fill="#7B8794"/>
          </svg>
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
          className="btn btn--primary"
          onClick={() => send()}
          disabled={!input.trim() || sending || !sessionId}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      {err && <div className="badge badge--error" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}
