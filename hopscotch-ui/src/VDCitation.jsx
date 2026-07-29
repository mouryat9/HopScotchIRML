// src/VDCitation.jsx
// APA "How to cite" block shown under the H4-All logo on every visual design
// diagram. Two formats: the reference-list entry (printed on the diagram) and
// a figure note for when students embed the diagram as a figure. Copy buttons
// are screen-only - they are hidden during the PDF/print capture.
import React, { useState } from "react";

const AUTHORS =
  "Jorrín-Abellán, I. M., Kunuku, M. T., Noble-Healy, J., Dehbozorgi, N., Chang, M., Vásquez, A., Zhang, X., Koz, O., & González Suárez, R.";
const YEAR = 2026;
const URL = "https://hopscotch4all.com";
const PUBLISHER = "Interactive Research Methods Lab, Kennesaw State University.";

// Plain-text versions used by the copy buttons (no markup).
const REFERENCE = `${AUTHORS} (${YEAR}). Hopscotch 4-All [Web application]. ${PUBLISHER} ${URL}`;
const FIGURE_NOTE = `Note. One-page visual design of the study created with Hopscotch 4-All (Jorrín-Abellán et al., ${YEAR}). ${URL}`;

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through to legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch (e) {
    return false;
  }
}

export default function VDCitation() {
  const [copied, setCopied] = useState(null); // "ref" | "note" | null

  const doCopy = async (which, text) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    }
  };

  return (
    <div className="vd-citation">
      <span className="vd-citation__ref">
        <strong>How to cite:</strong> {AUTHORS} ({YEAR}). <em>Hopscotch 4-All</em> [Web application]. {PUBLISHER} {URL}
      </span>
      <span className="vd-citation__actions">
        <button type="button" className="vd-citation__copy" onClick={() => doCopy("ref", REFERENCE)}>
          {copied === "ref" ? "Copied ✓" : "Copy citation"}
        </button>
        <button type="button" className="vd-citation__copy" onClick={() => doCopy("note", FIGURE_NOTE)}>
          {copied === "note" ? "Copied ✓" : "Copy figure note"}
        </button>
      </span>
    </div>
  );
}
