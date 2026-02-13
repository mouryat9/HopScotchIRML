// src/ConceptualFrameworkEditor.jsx
import React, { useState, useRef } from "react";
import CFTemplatePolygon from "./CFTemplatePolygon";
import CFTemplateBoxed from "./CFTemplateBoxed";
import CFTemplateExtended from "./CFTemplateExtended";

/**
 * Wrapper component for the Conceptual Framework editor.
 * Provides toolbar with template toggle + print, and renders the
 * selected template (Polygon mosaic or Boxed card layout).
 */
export default function ConceptualFrameworkEditor({ data, onClose }) {
  const [d, setD] = useState(() => ({
    ...data,
    topics: [...(data.topics || ["", "", "", "", ""])],
    frameworks: [...(data.frameworks || ["", "", "", "", ""])],
  }));
  const [template, setTemplate] = useState("polygon");
  const printRef = useRef(null);

  function upd(key, val) {
    setD((prev) => ({ ...prev, [key]: val }));
  }
  function updTopic(i, val) {
    setD((prev) => {
      const t = [...prev.topics];
      t[i] = val;
      return { ...prev, topics: t };
    });
  }
  function updFramework(i, val) {
    setD((prev) => {
      const f = [...prev.frameworks];
      f[i] = val;
      return { ...prev, frameworks: f };
    });
  }

  function handlePrint() {
    window.print();
  }

  /* Editable span helper — shared across all templates */
  const E = ({ value, onChange, className = "", placeholder = "" }) => (
    <span
      className={`cf-editable ${className}`}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.target.innerText)}
      dangerouslySetInnerHTML={{ __html: value || placeholder }}
    />
  );

  const TemplateComponent =
    template === "boxed" ? CFTemplateBoxed :
    template === "extended" ? CFTemplateExtended :
    CFTemplatePolygon;

  return (
    <div className="cf-overlay">
      {/* Toolbar */}
      <div className="cf-toolbar no-print">
        <div className="cf-toolbar__left">
          <button className="cf-toolbar__btn" onClick={onClose}>&larr; Back</button>
          <span className="cf-toolbar__title">Conceptual Framework Editor</span>
        </div>
        <div className="cf-toolbar__center">
          <div className="cf-toolbar__template-toggle">
            <button
              className={`cf-toolbar__template-btn${template === "polygon" ? " cf-toolbar__template-btn--active" : ""}`}
              onClick={() => setTemplate("polygon")}
            >
              Mosaic
            </button>
            <button
              className={`cf-toolbar__template-btn${template === "boxed" ? " cf-toolbar__template-btn--active" : ""}`}
              onClick={() => setTemplate("boxed")}
            >
              Boxed
            </button>
            <button
              className={`cf-toolbar__template-btn${template === "extended" ? " cf-toolbar__template-btn--active" : ""}`}
              onClick={() => setTemplate("extended")}
            >
              Extended
            </button>
          </div>
        </div>
        <div className="cf-toolbar__right">
          <span className="cf-toolbar__hint">Click any text to edit</span>
          <button className="cf-toolbar__btn cf-toolbar__btn--primary" onClick={handlePrint}>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Selected template */}
      <TemplateComponent
        d={d}
        upd={upd}
        updTopic={updTopic}
        updFramework={updFramework}
        E={E}
      />
    </div>
  );
}
