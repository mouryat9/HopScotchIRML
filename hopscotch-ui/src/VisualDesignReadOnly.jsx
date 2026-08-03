// src/VisualDesignReadOnly.jsx
// Read-only render of a student's Step 4 visual design, reused by the
// teacher's review overlay. Same templates as the student editor, but text
// is plain (not contentEditable) and edits are no-ops.
import React from "react";
import { VD_FORMS } from "./VisualDesignEditor";
import VDTemplateHoneycomb from "./VDTemplateHoneycomb";
import VDTemplatePentagonFlower from "./VDTemplatePentagonFlower";
import VDTemplateMixed from "./VDTemplateMixed";

export default function VisualDesignReadOnly({ data }) {
  const embeddedHost = data.primary || "qualitative";
  const formKey = data.design === "embedded" && embeddedHost === "quantitative" ? "embedded_quant" : data.design;
  const form = VD_FORMS[formKey];
  if (!form) {
    return (
      <div className="sdv-vd-unsupported">
        This design ({data.design_label || data.design || "not chosen yet"}) does not have a visual design diagram yet.
      </div>
    );
  }

  // Static text region: same classes as the editor for identical rendering
  const E = ({ value, className = "", placeholder = "" }) => {
    const hasValue = value && value.trim();
    return (
      <span className={`vd-editable ${className}${!hasValue ? " vd-editable--placeholder" : ""}`} style={{ cursor: "default" }}>
        {hasValue ? value : placeholder}
      </span>
    );
  };
  const noop = () => {};

  const TemplateComp =
    form.layout.kind === "pentagon" ? VDTemplatePentagonFlower :
    form.layout.kind === "mixed" ? VDTemplateMixed :
    VDTemplateHoneycomb;

  return (
    <TemplateComp
      layout={form.layout}
      primary={data.design === "embedded" ? embeddedHost : data.primary}
      name={data.name}
      email={data.email}
      fields={data.fields || {}}
      upd={noop}
      E={E}
      activeKey={null}
      onJumpToField={null}
    />
  );
}
