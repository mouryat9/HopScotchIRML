// src/ChatBox.jsx
import React, { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
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

const ChatBubble = memo(function ChatBubble({ turn, streaming }) {
  const stepColor = STEP_COLORS[turn.step] || null;
  const borderStyle = stepColor ? { borderLeft: `4px solid ${stepColor}` } : {};

  if (turn.role === "system") {
    return (
      <div className="chat-row system">
        <div className="chat-event">{turn.content}</div>
      </div>
    );
  }

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

        {!streaming && refs.length > 0 && (
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
});

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

function StepGroup({ group, isActive, streaming }) {
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
    <div className="chat-step-group" style={{ "--step-color": color }}>
      <button
        className={`chat-step-group__header${open ? " chat-step-group__header--open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="chat-step-group__pill" style={{ background: color }}>
          Step {group.step}
        </span>
        <span className="chat-step-group__label">{label}</span>
        <span className="chat-step-group__count">{msgCount} msg{msgCount !== 1 ? "s" : ""}</span>
        <span className={`chat-step-group__arrow${open ? " chat-step-group__arrow--open" : ""}`}>&#9662;</span>
      </button>
      <div className={`chat-step-group__body${open ? "" : " chat-step-group__body--collapsed"}`}>
        {group.turns.map((t, i) => (
          <ChatBubble
            key={i}
            turn={t}
            streaming={streaming && i === group.turns.length - 1 && t.role === "assistant"}
          />
        ))}
      </div>
    </div>
  );
}



/* ---------- Hide auto-generated prompts from display ---------- */
function isAutoPrompt(msg) {
  if (msg.role !== "user") return false;
  const c = msg.content || "";
  if (c.startsWith("I just selected ") && c.includes("as my worldview")) return true;
  if (c.startsWith("I'm on Step ") && c.includes("Can you give me feedback")) return true;
  return false;
}

/* ---------- Main chat component ---------- */

export default function ChatBox({ sessionId, activeStep, refreshKey, autoMessage, onAutoMessageSent }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);           // synchronous guard against double-sends
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);
  const scrolledToResponse = useRef(false);  // tracks if we've scrolled to the new response start
  const justFinishedSending = useRef(false); // prevents scroll-to-bottom after streaming ends
  const [historyReady, setHistoryReady] = useState(false);

  // Load history when we get a session
  useEffect(() => {
    let cancelled = false;
    setHistoryReady(false);
    justFinishedSending.current = false;  // allow scroll-to-bottom on history load
    (async () => {
      setErr("");
      if (!sessionId) return;
      try {
        const h = await API.history(sessionId);
        if (!cancelled) setHistory((h.history || []).filter(m => !isAutoPrompt(m)));
      } catch (e) {
        console.error(e);
        if (!cancelled) setErr("Could not load chat history.");
      } finally {
        if (!cancelled) setHistoryReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, refreshKey]);

  // Auto-scroll: scroll to bottom on history load, scroll to response start when streaming
  useEffect(() => {
    const chatBody = scrollRef.current;
    if (!chatBody) return;

    if (sending && !scrolledToResponse.current) {
      // Streaming just started — scroll to the START of the new assistant response
      // so the user can read from the beginning
      const rows = chatBody.querySelectorAll('.chat-row.assistant');
      const lastRow = rows[rows.length - 1];
      if (lastRow && lastRow.textContent) {
        lastRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
        scrolledToResponse.current = true;
      }
    } else if (!sending && !justFinishedSending.current) {
      // Only scroll to bottom on initial history load / session switch,
      // NOT after streaming just finished
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  }, [history, sending]);

  // Auto-send message triggered by parent (e.g. worldview selection)
  // Waits until history is loaded to avoid the API response overwriting streamed content
  useEffect(() => {
    if (autoMessage && sessionId && historyReady && !sendingRef.current) {
      const msg = typeof autoMessage === "string" ? autoMessage : autoMessage.text;
      const event = typeof autoMessage === "object" ? autoMessage.event : null;
      // Insert a system event message (e.g. "Worldview selected: Pragmatist")
      if (event) {
        setHistory((prev) => [...prev, { role: "system", content: event, step: activeStep }]);
      }
      send(msg, { hideUserBubble: true });
      if (onAutoMessageSent) onAutoMessageSent();
    }
  }, [autoMessage, historyReady]);


  async function send(forcedText, opts = {}) {
    const msg = (forcedText ?? input).trim();
    if (!msg || !sessionId || sendingRef.current) return;

    sendingRef.current = true;
    scrolledToResponse.current = false;  // reset so we scroll to the new response start
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2-minute timeout
      const res = await API.chatSendStream(sessionId, msg, activeStep, controller.signal);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let lastFlush = 0;
      let gotFirstChunk = false;

      function flush(text) {
        setHistory((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: text, step: activeStep };
          return updated;
        });
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!gotFirstChunk) gotFirstChunk = true;
        accumulated += decoder.decode(value, { stream: true });
        // Throttle UI updates to every 80ms to avoid excessive re-renders
        const now = Date.now();
        if (now - lastFlush >= 80) {
          lastFlush = now;
          flush(accumulated);
        }
      }
      clearTimeout(timeoutId);
      // Final flush to ensure all text is shown
      if (accumulated) {
        flush(accumulated);
      } else {
        // Empty response — remove the placeholder
        setHistory((prev) => prev.slice(0, -1));
        setErr("AI returned an empty response. Please try again.");
      }
    } catch (e) {
      console.error(e);
      if (e.name === "AbortError") {
        setErr("Response timed out. The AI model may be loading — please try again in a moment.");
      } else {
        setErr("Send failed — please try again. If the problem persists, reload the page.");
      }
      // Put text back in box if it was typed manually
      if (!forcedText) setInput(msg);
      // Remove the empty assistant placeholder on error
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      sendingRef.current = false;
      justFinishedSending.current = true;  // prevent scroll-to-bottom when sending flips to false
      setSending(false);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const groups = useMemo(() => groupByStep(history), [history]);

  const handleChatBodyClick = useCallback((e) => {
    const rect = scrollRef.current.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 0.6;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top + scrollRef.current.scrollTop - size / 2;
    const ripple = document.createElement("span");
    ripple.className = "chat-ripple";
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    scrollRef.current.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }, []);

  return (
    <div className="chat-wrap">
      <div className="chat-body" ref={scrollRef} onClick={handleChatBodyClick}>
        {history.length === 0 && (
          <div className="chat-empty">
            Welcome! I can help you scaffold your research design step by step.
            Ask me anything or select a worldview above to get started.
          </div>
        )}
        {groups.map((g, i) => (
          <StepGroup
            key={`${g.step}-${i}`}
            group={g}
            isActive={g.step === activeStep}
            streaming={sending && i === groups.length - 1}
          />
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
