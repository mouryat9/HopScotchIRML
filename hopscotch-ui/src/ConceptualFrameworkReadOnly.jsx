// src/ConceptualFrameworkReadOnly.jsx
// Read-only render of a student's conceptual framework for the teacher's
// review overlay: all three templates (Boxed, Mosaic, Extended) stacked, so
// the teacher sees every layout at a glance. Text is plain, edits are no-ops.
import React from "react";
import CFTemplateBoxed from "./CFTemplateBoxed";
import CFTemplatePolygon from "./CFTemplatePolygon";
import CFTemplateExtended from "./CFTemplateExtended";

export default function ConceptualFrameworkReadOnly({ data }) {
  const d = {
    ...data,
    topics: [...(data.topics || ["", "", "", "", ""])],
    frameworks: [...(data.frameworks || ["", "", "", "", ""])],
  };
  const noop = () => {};
  const E = ({ value, className = "", placeholder = "" }) => {
    const hasValue = value && value.trim();
    return (
      <span className={`cf-editable ${className}${!hasValue ? " cf-editable--placeholder" : ""}`} style={{ cursor: "default" }}>
        {hasValue ? value : placeholder}
      </span>
    );
  };
  const shared = { d, upd: noop, updTopic: noop, updFramework: noop, E };

  return (
    <div className="sdv-cf">
      <div className="sdv-cf__block">
        <div className="sdv-cf__label">Boxed</div>
        <CFTemplateBoxed {...shared} />
      </div>
      <div className="sdv-cf__block">
        <div className="sdv-cf__label">Mosaic</div>
        <CFTemplatePolygon {...shared} />
      </div>
      <div className="sdv-cf__block">
        <div className="sdv-cf__label">Extended</div>
        <CFTemplateExtended {...shared} />
      </div>
    </div>
  );
}
