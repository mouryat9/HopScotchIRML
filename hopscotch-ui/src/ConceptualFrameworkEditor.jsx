// src/ConceptualFrameworkEditor.jsx
import React, { useState, useRef } from "react";
import html2canvas from "html2canvas";
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
  const [template, setTemplate] = useState("boxed");
  const [printing, setPrinting] = useState(false);

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

  async function handlePrint() {
    const diagram = document.querySelector('.cf-diagram, .cfb-diagram, .cfe-diagram');
    if (!diagram) return;
    setPrinting(true);
    try {
      // Capture the diagram as a high-resolution image
      const canvas = await html2canvas(diagram, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');

      // Open a new window with just the image and print it
      const printWin = window.open('', '_blank');
      if (!printWin) {
        alert('Please allow pop-ups to print the Conceptual Framework.');
        return;
      }
      printWin.document.write(`
        <html>
        <head><title>Conceptual Framework</title>
        <style>
          @page { size: landscape; margin: 0.25in; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
          img { max-width: 100%; max-height: 100vh; object-fit: contain; }
        </style>
        </head>
        <body>
          <img src="${imgData}" onload="setTimeout(function(){window.print();},200);" />
        </body>
        </html>
      `);
      printWin.document.close();
    } catch (e) {
      console.error('Print capture failed:', e);
      // Fallback: use browser print directly
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  /* Editable span helper — shared across all templates */
  const E = ({ value, onChange, className = "", placeholder = "" }) => {
    const hasValue = value && value.trim();
    const display = hasValue
      ? value
      : placeholder.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return (
      <span
        className={`cf-editable ${className}${!hasValue ? ' cf-editable--placeholder' : ''}`}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onChange(e.target.innerText)}
        dangerouslySetInnerHTML={{ __html: display }}
      />
    );
  };

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
          <button
            className="cf-toolbar__btn cf-toolbar__btn--primary"
            onClick={handlePrint}
            disabled={printing}
          >
            {printing ? "Capturing..." : "Print / Save PDF"}
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
