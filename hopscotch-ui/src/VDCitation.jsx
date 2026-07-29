// src/VDCitation.jsx
// APA "How to cite" block shown under the H4-All logo on every visual design
// diagram. Two formats: the reference-list entry (printed on the diagram) and
// a figure note for when students embed the diagram as a figure. Copy buttons
// are screen-only - they are hidden during the PDF/print capture.
//
// The tool is unpublished (patent pending), so the reference intentionally
// uses (n.d.) with a retrieval date generated at render/print time - keep this
// unless the tool gets a formal publication year.
import React, { useState } from "react";

const AUTHORS =
  "Jorrín-Abellán, I. M., Kunuku, M. T., Noble-Healy, J., Dehbozorgi, N., Chang, M., Vásquez, A., Zhang, X., Koz, O., & González Suárez, R.";
const URL = "https://hopscotch4all.com";
const PUBLISHER = "Interactive Research Methods Lab, Kennesaw State University.";

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
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Plain-text versions used by the copy buttons (no markup).
  const reference = `${AUTHORS} (n.d.). Hopscotch 4-All [Web application]. ${PUBLISHER} Retrieved ${date}, from ${URL}`;
  const figureNote = `Note. One-page visual design of the study created with Hopscotch 4-All (Jorrín-Abellán et al., n.d.). ${URL}`;

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
        <strong>How to cite:</strong> {AUTHORS} (n.d.). <em>Hopscotch 4-All</em> [Web application]. {PUBLISHER} Retrieved {date}, from {URL}
      </span>
      <span className="vd-citation__actions">
        <button type="button" className="vd-citation__copy" onClick={() => doCopy("ref", reference)}>
          {copied === "ref" ? "Copied ✓" : "Copy citation"}
        </button>
        <button type="button" className="vd-citation__copy" onClick={() => doCopy("note", figureNote)}>
          {copied === "note" ? "Copied ✓" : "Copy figure note"}
        </button>
      </span>
    </div>
  );
}
