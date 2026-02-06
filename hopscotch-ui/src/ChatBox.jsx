// src/ChatBox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API } from "./api";

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

function getLastAssistantTurn(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "assistant") return history[i];
  }
  return null;
}

// Extract bullet options used by the worldview survey
function extractSurveyOptionsFromText(text) {
  if (!text) return [];
  const marker =
    "Please respond with exactly ONE of the following options:";
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

  // Detect quick survey options
  const surveyOptions = useMemo(() => {
    const last = getLastAssistantTurn(history);
    if (!last) return [];
    return extractSurveyOptionsFromText(last.content || "");
  }, [history]);

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
      ...(opts.hideUserBubble ? [] : [{ role: "user", content: msg }]),
      { role: "assistant", content: "" },
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
          updated[updated.length - 1] = { role: "assistant", content: snap };
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

  function handleOptionClick(opt) {
    send(opt);
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
        {history.map((t, i) => (
          <ChatBubble key={i} turn={t} />
        ))}
      </div>

      {sending && (
        <div className="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}

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
