// src/ConceptualFrameworkEditor.jsx
// Conceptual Framework editor (Step 3), rebuilt on the Step 4 Visual Design
// editor pattern. Left: guided form fields. Right: the live diagram (three
// templates: Mosaic / Boxed / Extended). Both sides edit the same data;
// changes auto-save to the session. Save PDF captures the diagram with the
// animated hopscotch squares frozen at full color.
import React, { useState, useRef, useEffect, useCallback } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { API } from "./api";
import { notify } from "./Toast";
import { useLang } from "./i18n.jsx";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import ProfileMenu from "./ProfileMenu";
import SettingsModal from "./SettingsModal";
import CFTemplatePolygon from "./CFTemplatePolygon";
import CFTemplateBoxed from "./CFTemplateBoxed";
import CFTemplateExtended from "./CFTemplateExtended";

/* Guided form fields. `list` fields map to the 5-slot arrays in the data. */
const CF_FORM_FIELDS = [
  {
    key: "topic",
    label: "Research Topic",
    hint: "The topic at the center of your framework",
    help: "State your research topic in a short phrase. It sits at the center of the conceptual framework - everything else (your goals, the literature, the gap, the problem) connects back to it.",
  },
  {
    key: "personal_goals",
    label: "Personal Interests & Goals",
    hint: "Personal, practical and intellectual goals",
    help: "Why does this study matter to you? Summarize your personal, practical and intellectual goals - they shape every decision in your design and belong at the start of the framework.",
  },
  {
    key: "worldview",
    label: "Identity & Positionality",
    hint: "Your worldview and where you stand",
    help: "Describe your positionality and worldview (i.e. constructivist, post-positivist, transformative, pragmatist) and how your identity relates to the study.",
  },
  {
    key: "topics",
    list: true,
    label: "Topical Research",
    hint: "Up to 5 areas from your literature review",
    help: "Which areas of topical research inform your study? List up to five - each appears as its own tile in the framework.",
    placeholder: "One topic per line (up to 5)",
  },
  {
    key: "frameworks",
    list: true,
    label: "Theoretical Frameworks",
    hint: "Up to 5 frameworks and their authors",
    help: "Which theoretical frameworks ground your study? Include the author and year when you can (i.e. Communities of Practice - Wenger, 1998). List up to five.",
    placeholder: "One framework per line (up to 5)",
  },
  {
    key: "gaps",
    label: "Gap/s Found",
    hint: "What is missing in the literature?",
    help: "Which gap or gaps did your review of the literature reveal? The gap is what your study will help fill.",
  },
  {
    key: "problem_statement",
    label: "Problem Statement",
    hint: "The problem your study addresses",
    help: "State the problem that emerges from the gap - the concrete issue your study addresses, and for whom it matters.",
  },
  {
    key: "research_questions",
    label: "Research Question/s",
    hint: "The question/s driving your study",
    help: "Include the research question or questions (or aims and hypotheses for quantitative studies) that will drive your study.",
  },
  {
    key: "research_design",
    label: "Research Design",
    hint: "The design that will answer your question/s",
    help: "Which research design will you use to answer your question/s? i.e. Case Study, Phenomenology, Experimental, Convergent Parallel Mixed Methods.",
  },
];

const listToText = (arr) => (arr || []).filter((v) => (v || "").trim()).join("\n");
const textToList = (text) => {
  const lines = (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  return (lines.concat(["", "", "", "", ""])).slice(0, 5);
};

const CF_FIELDS_ES = {
  topic: {
    label: "Tema de investigación", hint: "El tema al centro de tu marco",
    help: "Enuncia tu tema de investigación en una frase corta. Está al centro del marco conceptual: todo lo demás (tus metas, la literatura, el vacío, el problema) se conecta con él.",
  },
  personal_goals: {
    label: "Intereses y metas personales", hint: "Metas personales, prácticas e intelectuales",
    help: "¿Por qué te importa este estudio? Resume tus metas personales, prácticas e intelectuales: moldean cada decisión de tu diseño y pertenecen al inicio del marco.",
  },
  worldview: {
    label: "Identidad y posicionalidad", hint: "Tu cosmovisión y desde dónde investigas",
    help: "Describe tu posicionalidad y cosmovisión (p. ej., constructivista, pospositivista, transformativa, pragmatista) y cómo tu identidad se relaciona con el estudio.",
  },
  topics: {
    label: "Investigación temática", hint: "Hasta 5 áreas de tu revisión de literatura", placeholder: "Un tema por línea (hasta 5)",
    help: "¿Qué áreas de investigación temática informan tu estudio? Enumera hasta cinco: cada una aparece como su propio mosaico en el marco.",
  },
  frameworks: {
    label: "Marcos teóricos", hint: "Hasta 5 marcos con sus autores", placeholder: "Un marco por línea (hasta 5)",
    help: "¿Qué marcos teóricos fundamentan tu estudio? Incluye autor y año cuando puedas (p. ej., Comunidades de práctica - Wenger, 1998). Enumera hasta cinco.",
  },
  gaps: {
    label: "Vacíos encontrados", hint: "¿Qué falta en la literatura?",
    help: "¿Qué vacío o vacíos reveló tu revisión de la literatura? El vacío es lo que tu estudio ayudará a llenar.",
  },
  problem_statement: {
    label: "Planteamiento del problema", hint: "El problema que aborda tu estudio",
    help: "Enuncia el problema que surge del vacío: el asunto concreto que aborda tu estudio y para quién importa.",
  },
  research_questions: {
    label: "Pregunta(s) de investigación", hint: "La(s) pregunta(s) que guían tu estudio",
    help: "Incluye la pregunta o preguntas de investigación (o los objetivos e hipótesis en estudios cuantitativos) que guiarán tu estudio.",
  },
  research_design: {
    label: "Diseño de investigación", hint: "El diseño que responderá tu(s) pregunta(s)",
    help: "¿Qué diseño de investigación usarás para responder tu(s) pregunta(s)? P. ej., estudio de caso, fenomenología, experimental, métodos mixtos convergente paralelo.",
  },
};

const CF_FIELDS_ZH = {
  topic: {
    label: "研究主题", hint: "你的概念框架所围绕的核心主题",
    help: "用一个短语写出你的研究主题。它位于概念框架的中心：其他一切（你的目标、文献、空白、问题）都与它相连。",
  },
  personal_goals: {
    label: "个人兴趣与目标", hint: "个人、实践和学术层面的目标",
    help: "这项研究为什么对你重要？总结你的个人、实践和学术目标：它们影响你设计中的每一个决定，属于框架的起点。",
  },
  worldview: {
    label: "身份与立场", hint: "你的世界观以及你开展研究的立场",
    help: "描述你的立场和世界观（例如：建构主义、后实证主义、变革性、实用主义），以及你的身份与研究的关系。",
  },
  topics: {
    label: "主题式文献研究", hint: "文献综述中最多 5 个研究领域", placeholder: "每行一个主题（最多 5 个）",
    help: "哪些主题式文献研究领域为你的研究提供依据？最多列出五个：每个都会作为独立的板块出现在框架中。",
  },
  frameworks: {
    label: "理论框架", hint: "最多 5 个框架及其作者", placeholder: "每行一个框架（最多 5 个）",
    help: "哪些理论框架为你的研究奠定基础？尽量注明作者和年份（例如：实践共同体 - Wenger, 1998）。最多列出五个。",
  },
  gaps: {
    label: "发现的研究空白", hint: "文献中还缺少什么？",
    help: "你的文献综述揭示了哪个或哪些空白？空白正是你的研究将帮助填补的内容。",
  },
  problem_statement: {
    label: "问题陈述", hint: "你的研究要解决的问题",
    help: "写出从空白中浮现的问题：你的研究要解决的具体问题，以及它对谁重要。",
  },
  research_questions: {
    label: "研究问题", hint: "引导你研究的问题",
    help: "写出将引导你研究的研究问题（定量研究则写目标和假设）。",
  },
  research_design: {
    label: "研究设计", hint: "用于回答研究问题的设计",
    help: "你将用哪种研究设计来回答你的研究问题？例如：个案研究、现象学、实验、聚敛式平行混合研究方法。",
  },
};

// Per-language field overlays; English (or any missing language) uses the base fields.
const CF_FIELDS_BY_LANG = { es: CF_FIELDS_ES, zh: CF_FIELDS_ZH };

export default function ConceptualFrameworkEditor({ data, sessionId, onClose }) {
  const { t, lang } = useLang();
  const [d, setD] = useState(() => ({
    ...data,
    topics: [...(data.topics || ["", "", "", "", ""])],
    frameworks: [...(data.frameworks || ["", "", "", "", ""])],
  }));
  const [template, setTemplate] = useState("boxed");
  const [printing, setPrinting] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveState, setSaveState] = useState("saved"); // saved | dirty | saving | error
  const [activeKey, setActiveKey] = useState(null);
  const [showIdentity, setShowIdentity] = useState(true);
  // Raw textarea text for the list fields - kept separate so typing (including
  // blank lines mid-edit) is never mangled by the text<->array round trip.
  const [listText, setListText] = useState(() => ({
    topics: listToText(data.topics),
    frameworks: listToText(data.frameworks),
  }));
  const saveTimer = useRef(null);
  const dRef = useRef(d);
  dRef.current = d;

  const markDirty = () => setSaveState("dirty");

  function upd(key, val) {
    setD((prev) => (prev[key] === val ? prev : { ...prev, [key]: val }));
    markDirty();
  }
  function updTopic(i, val) {
    setD((prev) => {
      const t = [...prev.topics];
      t[i] = val;
      setListText((lt) => ({ ...lt, topics: listToText(t) }));
      return { ...prev, topics: t };
    });
    markDirty();
  }
  function updFramework(i, val) {
    setD((prev) => {
      const f = [...prev.frameworks];
      f[i] = val;
      setListText((lt) => ({ ...lt, frameworks: listToText(f) }));
      return { ...prev, frameworks: f };
    });
    markDirty();
  }

  const doSave = useCallback(async () => {
    if (!sessionId) return;
    setSaveState("saving");
    try {
      const cur = dRef.current;
      await API.saveConceptualFrameworkData(sessionId, {
        topic: cur.topic || "",
        worldview: cur.worldview || "",
        personal_goals: cur.personal_goals || "",
        gaps: cur.gaps || "",
        problem_statement: cur.problem_statement || "",
        research_questions: cur.research_questions || "",
        research_design: cur.research_design || "",
        topics: cur.topics || [],
        frameworks: cur.frameworks || [],
      });
      setSaveState("saved");
    } catch (e) {
      console.error("Conceptual framework save failed:", e);
      setSaveState("error");
      notify.error(t("vd.saveFailedMsg"), { title: t("vd.saveFailedTitle") });
    }
  }, [sessionId]);

  // Debounced auto-save whenever the data changes
  useEffect(() => {
    if (saveState !== "dirty") return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [d, saveState, doSave]);

  // Flush a pending save when the tab is closed
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        doSave();
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [doSave]);

  async function handlePrint() {
    const diagram = document.querySelector(".cf-diagram, .cfb-diagram, .cfe-diagram");
    if (!diagram) return;
    setPrinting(true);
    setActiveKey(null);
    // Freeze the animated hopscotch squares at full color for the capture
    diagram.classList.add("vd-diagram--print-freeze");
    try {
      await new Promise((r) => setTimeout(r, 60));
      const canvas = await html2canvas(diagram, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      // PDF page matches the diagram exactly (2 canvas px = 1 pt) - no popup
      // windows, no browser print headers, always the right size.
      const w = canvas.width / 2, h = canvas.height / 2;
      const pdf = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "pt", format: [w, h] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
      pdf.save("Conceptual_Framework.pdf");
    } catch (e) {
      console.error("PDF capture failed:", e);
      window.print();
    } finally {
      diagram.classList.remove("vd-diagram--print-freeze");
      setPrinting(false);
    }
  }

  /* Editable region used inside the diagram (same behavior as the VD editor:
     value is escaped, the placeholder clears on focus and is never saved). */
  const E = ({ value, onChange, className = "", placeholder = "" }) => {
    const hasValue = value && value.trim();
    const display = hasValue
      ? value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")
      : placeholder.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return (
      <span
        className={`cf-editable ${className}${!hasValue ? " cf-editable--placeholder" : ""}`}
        contentEditable
        suppressContentEditableWarning
        onFocus={(e) => {
          if (!hasValue) {
            e.target.innerText = "";
            e.target.classList.remove("cf-editable--placeholder");
          }
        }}
        onBlur={(e) => {
          const text = e.target.innerText.trim();
          onChange(text === placeholder ? "" : text);
          if (!text) {
            e.target.innerText = placeholder;
            e.target.classList.add("cf-editable--placeholder");
          }
        }}
        dangerouslySetInnerHTML={{ __html: display }}
      />
    );
  };

  const TemplateComponent =
    template === "boxed" ? CFTemplateBoxed :
    template === "extended" ? CFTemplateExtended :
    CFTemplatePolygon;

  const formValue = (f) => (f.list ? listText[f.key] || "" : d[f.key] || "");
  const filledCount = CF_FORM_FIELDS.filter((f) => formValue(f).trim()).length;
  const progressPct = Math.round((filledCount / CF_FORM_FIELDS.length) * 100);

  const saveLabel =
    saveState === "saving" ? t("vd.saving") :
    saveState === "dirty" ? t("vd.unsaved") :
    saveState === "error" ? t("vd.saveFailed") :
    t("vd.saved");

  return (
    <div className={`vd-overlay${showIdentity ? "" : " vd-overlay--anon"}`}>
      {/* Toolbar (VD shell + the CF template toggle) */}
      <div className="vd-toolbar no-print">
        <div className="vd-toolbar__left">
          <button className="vd-btn vd-btn--ghost" onClick={onClose} title={t("vd.closeTabTip")}>
            {t("vd.back")}
          </button>
          <div className="vd-toolbar__titles">
            <span className="vd-toolbar__title">{t("cf.title")}</span>
          </div>
        </div>
        <div className="cf-toolbar__template-toggle">
          {[["polygon", t("cf.mosaic")], ["boxed", t("cf.boxed")], ["extended", t("cf.extended")]].map(([id, label]) => (
            <button
              key={id}
              className={`cf-toolbar__template-btn${template === id ? " cf-toolbar__template-btn--active" : ""}`}
              onClick={() => setTemplate(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="vd-toolbar__right">
          <span className={`vd-save-state vd-save-state--${saveState}`} title={t("vd.autoSaveTip")}>
            <span className="vd-save-state__dot" />{saveLabel}
          </span>
          <label className="vd-identity-toggle" title={t("vd.anonTip")}>
            <input
              type="checkbox"
              checked={showIdentity}
              onChange={(e) => setShowIdentity(e.target.checked)}
            />
            {t("cf.showIdentity")}
          </label>
          <button className="vd-btn vd-btn--primary" onClick={handlePrint} disabled={printing}>
            {printing ? t("vd.capturing") : t("vd.savePdf")}
          </button>
          {user && (
            <ProfileMenu
              user={user}
              onSignOut={logout}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} toggleTheme={toggleTheme} />

      {/* Body: form (left) + diagram (right) */}
      <div className="vd-body">
        <div className="vd-form no-print">
          <div className="vd-form__header">
            <p className="vd-form__intro">
              {t("cf.intro")}
            </p>
            <div className="vd-form__progress">
              <div className="vd-form__progress-bar">
                <div className="vd-form__progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="vd-form__progress-text">{t("vd.progress", { a: filledCount, b: CF_FORM_FIELDS.length })}</span>
            </div>
          </div>

          {CF_FORM_FIELDS.map((f0, i) => {
            const ov = (CF_FIELDS_BY_LANG[lang] || {})[f0.key] || {};
            const f = { ...f0, label: ov.label || f0.label, hint: ov.hint || f0.hint, placeholder: ov.placeholder || f0.placeholder, help: ov.help || f0.help };
            const val = formValue(f);
            const filled = val.trim();
            return (
              <div
                key={f.key}
                className={`vd-field${activeKey === f.key ? " vd-field--active" : ""}${filled ? " vd-field--filled" : ""}`}
              >
                <div className="vd-field__head">
                  <span className="vd-field__num">{filled ? "✓" : i + 1}</span>
                  <div className="vd-field__titles">
                    <label className="vd-field__label" htmlFor={`cf-${f.key}`}>{f.label}</label>
                    <span className="vd-field__hint">{f.hint}</span>
                  </div>
                </div>
                <details className="vd-field__guide">
                  <summary>{t("vd.guide")}</summary>
                  <p>{f.help}</p>
                </details>
                <textarea
                  id={`cf-${f.key}`}
                  className="vd-field__input"
                  rows={f.list ? 5 : 3}
                  placeholder={f.placeholder || t("vd.writeHere")}
                  value={val}
                  onChange={(e) => {
                    if (f.list) {
                      const text = e.target.value;
                      setListText((lt) => ({ ...lt, [f.key]: text }));
                      setD((prev) => ({ ...prev, [f.key]: textToList(text) }));
                      markDirty();
                    } else {
                      upd(f.key, e.target.value);
                    }
                  }}
                  onFocus={() => setActiveKey(f.key)}
                  onBlur={() => setActiveKey(null)}
                />
              </div>
            );
          })}
        </div>

        <div className="vd-stage">
          <div className="vd-stage__inner">
            <TemplateComponent
              d={d}
              upd={upd}
              updTopic={updTopic}
              updFramework={updFramework}
              E={E}
            />
            <p className="vd-stage__hint no-print">
              {t("cf.stageHint")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
