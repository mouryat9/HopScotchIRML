// src/VDTemplateMixed.jsx
// Composite visual designs for mixed methods studies, built from Julie's
// Mixed-Methods PPTX templates. Variants:
//  - convergent:   qual + quant side by side, results converge (+)
//  - explanatory:  Phase I quant -> Results -> Inform -> Phase II qual
//  - exploratory:  Phase I qual -> Results -> Inform -> Phase II quant -> INTERPRETATION
//  - embedded:     portrait; the primary strand hosts a smaller embedded study
// Reuses VDTemplateHoneycomb and VDTemplatePentagonFlower in embedded mode.
import React from "react";
import VDTemplateHoneycomb from "./VDTemplateHoneycomb";
import VDTemplatePentagonFlower from "./VDTemplatePentagonFlower";
import VDCitation from "./VDCitation";

// Generic qualitative strand layout used by the mixed templates (Julie's mixed
// PPTX uses the generic labels, not a specific tradition's). Center hexagon
// color from the mixed PPTX files.
const QUAL_STRAND_LAYOUT = {
  designName: "Qualitative Study",
  contextTitle: "Context of the Study",
  contextBottom: true,
  centerColor: "#A64D79",
  centerLabelColor: "#FFFFFF",
  centerDark: true,
  labels: {
    informants: "Informants",
    other_documents: "Other Documents",
    data_gathering: "Data Gathering Methods",
    central_item: "Phenomenon under study",
    strategies: "Strategies",
    process_support: "Process Support",
    question: "Issues",
  },
};

// Quantitative strand layout (teal center from the mixed PPTX; the fixed
// chips mirror the generic fill-in slide of the quantitative template)
const QUANT_STRAND_LAYOUT = {
  kind: "pentagon",
  designName: "Quantitative Study",
  titleName: "",
  centerColor: "#0097A7",
  sliders: { variance: 0.3, causality: 0.3, ivControl: 0.3 },
  fixed: {
    type: "Exploratory/Descriptive",
    groups: "No control group",
    representativeness: "Desirable",
  },
};

// The quantitative strand reuses the quantitative field keys, except the ones
// that would collide with the qualitative strand - those map to mm_* keys.
const QUANT_KEY_MAP = {
  question: "mm_question",
  data_gathering: "mm_data_gathering",
  process_support: "mm_process_support",
};
const QUANT_ONLY_KEYS = new Set(["variables", "sample", "groups", "data_analysis", "study_type"]);
const QUANT_REVERSE_MAP = { mm_question: "question", mm_data_gathering: "data_gathering", mm_process_support: "process_support" };

function Identity({ name, email }) {
  return (
    <div className="vd-identity">
      <div className="vd-identity__caption">Designed by</div>
      <div className="vd-identity__name">{name}</div>
      <div className="vd-identity__email">{email}</div>
    </div>
  );
}

function LogoRow() {
  return (
    <div className="vd-logo-row">
      <div className="vd-logo-row__brand">
        <img className="vd-logo" src="/Hopscotch-4-all-logo-alpha.png" alt="Hopscotch 4 All" />
        <svg className="hop-grid-loader vd-logo-loader" viewBox="0 0 128 46" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" fill="none" aria-hidden="true">
          <rect className="hop-sq sq-1" x="0" y="0" width="18" height="22" rx="6" fill="#2B5EA7" />
          <rect className="hop-sq sq-2" x="0" y="24" width="18" height="22" rx="6" fill="#E8618C" />
          <rect className="hop-sq sq-3" x="22" y="12" width="18" height="22" rx="6" fill="#D94040" />
          <rect className="hop-sq sq-4" x="44" y="0" width="18" height="22" rx="6" fill="#1A8A7D" />
          <rect className="hop-sq sq-5" x="44" y="24" width="18" height="22" rx="6" fill="#B0A47A" />
          <rect className="hop-sq sq-6" x="66" y="12" width="18" height="22" rx="6" fill="#00AEEF" />
          <rect className="hop-sq sq-7" x="88" y="0" width="18" height="22" rx="6" fill="#F0B429" />
          <rect className="hop-sq sq-8" x="88" y="24" width="18" height="22" rx="6" fill="#F5922A" />
          <path className="hop-sq sq-9" d="M110,7 A16,16 0 0,1 110,39 Z" fill="#7B8794" />
        </svg>
      </div>
      <VDCitation />
    </div>
  );
}

export default function VDTemplateMixed({ layout, name, email, fields, upd, E, activeKey, onJumpToField, primary = "qualitative" }) {
  // Proxy the fields/updates for the quantitative strand
  const quantFields = { ...fields };
  for (const [pentKey, mmKey] of Object.entries(QUANT_KEY_MAP)) {
    quantFields[pentKey] = fields[mmKey];
  }
  const quantUpd = (key, val) => upd(QUANT_KEY_MAP[key] || key, val);
  const quantJump = (key) => onJumpToField && onJumpToField(QUANT_KEY_MAP[key] || key);

  // Route the focus highlight to the right strand (central_item is shared)
  const quantActive =
    QUANT_REVERSE_MAP[activeKey] ||
    (QUANT_ONLY_KEYS.has(activeKey) || activeKey === "central_item" ? activeKey : null);
  const qualActive =
    QUANT_REVERSE_MAP[activeKey] || QUANT_ONLY_KEYS.has(activeKey) ? null : activeKey;

  const variant = layout.variant || "convergent";

  const qualStrand = (
    <div className="vd-mixed__strand-canvas">
      <VDTemplateHoneycomb
        embedded
        layout={QUAL_STRAND_LAYOUT}
        fields={fields}
        upd={upd}
        E={E}
        activeKey={qualActive}
        onJumpToField={onJumpToField}
      />
    </div>
  );
  const quantStrand = (withType) => (
    <div className="vd-mixed__strand-canvas">
      {withType && (
        <div className="vd-mixed__quant-type">
          <E
            value={fields.study_type}
            onChange={(v) => upd("study_type", v)}
            className="vd-mixed__quant-type-text"
            placeholder="Type of quantitative research design…"
          />
        </div>
      )}
      <VDTemplatePentagonFlower
        embedded
        layout={QUANT_STRAND_LAYOUT}
        fields={quantFields}
        upd={quantUpd}
        E={E}
        activeKey={quantActive}
        onJumpToField={quantJump}
      />
    </div>
  );

  const title = (
    <div className="vd-mixed__title">
      <span className="vd-mixed__title-name">{layout.titleText}</span>
      <E
        value={fields.research_topic}
        onChange={(v) => upd("research_topic", v)}
        className="vd-mixed__title-topic"
        placeholder="Your research topic…"
      />
    </div>
  );

  /* ---- Embedded (portrait): the primary strand hosts a smaller study
     rendered as a dashed hexagon cluster continuing the honeycomb ---- */
  if (variant === "embedded") {
    const quantHost = primary === "quantitative";

    // Hexagon geometry shared with the honeycomb template
    const EMB_HEX_POINTS = "57.75,0 207.25,0 265,115.5 207.25,231 57.75,231 0,115.5";
    // The host strand shifts left (its layout reserved room for the removed
    // context rail) so the composition centers; the cluster follows its columns
    const hostShift = quantHost ? 8 : 10;
    const c1 = 47.6 - hostShift;
    const c2 = 69 - hostShift;
    const EMB_HEXES = quantHost
      ? [
          { key: null, solid: true, x: c2, y: 0 },
          { key: "data_gathering", label: "Data Gathering", x: c1, y: 16.6 },
          { key: "strategies", label: "Strategies", x: c2, y: 33.3 },
          { key: "informants", label: "Informants", x: c1, y: 49.9 },
          { key: "context", label: "Context", x: c2, y: 66.6 },
        ]
      : [
          { key: null, solid: true, x: c2, y: 0 },
          { key: "mm_data_gathering", label: "Data Gathering", x: c1, y: 16.6 },
          { key: "mm_process_support", label: "Process Support", x: c2, y: 33.3 },
          { key: "data_analysis", label: "Analysis", x: c1, y: 49.9 },
          { key: "sample", label: "Sample", x: c2, y: 66.6 },
        ];
    const clusterColor = quantHost ? "#A64D79" : "#0097A7";
    const clusterTitle = quantHost ? "Embedded Qualitative Study" : "Embedded Quantitative Study";
    const rqKey = quantHost ? "question" : "mm_question";
    const rqLabel = quantHost ? "Qualitative Research Question" : "Research Question";

    return (
      <div className="vd-diagram vd-diagram--embedded">
        <Identity name={name} email={email} />
        {title}
        <div className="vd-embedded__host-label">{quantHost ? "PRIMARY: QUANTITATIVE STUDY" : "PRIMARY: QUALITATIVE STUDY"}</div>
        <div className={`vd-embedded__host ${quantHost ? "vd-embedded__host--quant" : "vd-embedded__host--qual"}`}>
          {quantHost ? quantStrand(true) : (
            <div className="vd-mixed__strand-canvas">
              <VDTemplateHoneycomb
                embedded
                layout={{ ...QUAL_STRAND_LAYOUT, hideContext: true }}
                fields={fields}
                upd={upd}
                E={E}
                activeKey={qualActive}
                onJumpToField={onJumpToField}
              />
            </div>
          )}
        </div>

        {/* Embedded study: dashed hexagon cluster nesting into the honeycomb */}
        <div className="vd-embhex" style={{ "--emb-color": clusterColor }}>
          {/* dashed arc: from the Analysis hexagon's left tip up to the
              Topics hexagon - the embedded results inform the understanding */}
          <svg className="vd-embhex__arc" style={{ left: `${c1 - 29}%` }} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M96,2 C20,14 20,84 96,96" stroke={clusterColor} strokeWidth="2" strokeDasharray="6 7" fill="none" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="vd-embhex__arc-label" style={{ left: `${c1 - 33}%` }}>Informs the understanding</span>

          {EMB_HEXES.map((hx, i) => (
            <div key={i} className="vd-embhex__hex" style={{ left: `${hx.x}%`, top: `${hx.y}%` }}>
              <svg className="vd-embhex__shape" viewBox="0 0 265 231" preserveAspectRatio="none" aria-hidden="true">
                <polygon
                  points={EMB_HEX_POINTS}
                  fill={hx.solid ? clusterColor : "#FFFFFF"}
                  stroke={hx.solid ? clusterColor : clusterColor}
                  strokeWidth="3"
                  strokeDasharray="14 10"
                />
              </svg>
              <div className="vd-embhex__content">
                {hx.solid ? (
                  <div className="vd-embhex__title">{clusterTitle}</div>
                ) : (
                  <>
                    <div className="vd-embhex__label" onClick={() => onJumpToField && onJumpToField(hx.key)} title="Edit in the form">{hx.label}</div>
                    <E
                      value={fields[hx.key]}
                      onChange={(v) => upd(hx.key, v)}
                      className="vd-embhex__text"
                      placeholder="Click to write…"
                    />
                  </>
                )}
              </div>
            </div>
          ))}

          {/* the embedded study's research question closes the cluster
              (qual host: right under the Analysis hexagon) */}
          <div className="vd-embhex__rq" style={quantHost ? { left: `${c2 - 5}%` } : { left: `${c1 - 4.5}%`, top: "85%", width: "26%" }}>
            <span className="vd-embhex__rq-label">{rqLabel}</span>
            <E
              value={fields[rqKey]}
              onChange={(v) => upd(rqKey, v)}
              className="vd-embhex__rq-text"
              placeholder="The question the embedded study answers…"
            />
          </div>
        </div>

        <div className="vd-embedded__footer">
          <LogoRow />
          <div className="vd-design-name">{layout.designName}</div>
        </div>
      </div>
    );
  }

  /* ---- Sequential variants: phase containers, arrows, results flow ---- */
  const isExplanatory = variant === "explanatory";
  const isExploratory = variant === "exploratory";

  if (isExplanatory || isExploratory) {
    const quantLeft = isExplanatory;

    const quantBox = (
      <>
        <div className="vd-seq__type">
          <E
            value={fields.study_type}
            onChange={(v) => upd("study_type", v)}
            className="vd-seq__type-text"
            placeholder="Type of quantitative research design…"
          />
        </div>
        <div className="vd-seq__canvas vd-seq__canvas--quant">{quantStrand(false)}</div>
        <div className="vd-seq__footline">
          <span className="vd-seq__footline-label">Hypothesis</span>
          <E
            value={fields.hypothesis}
            onChange={(v) => upd("hypothesis", v)}
            className="vd-seq__footline-text"
            placeholder="Your hypothesis…"
          />
        </div>
      </>
    );
    const qualBox = (
      <>
        <div className="vd-seq__type">
          <E
            value={fields.qual_tradition}
            onChange={(v) => upd("qual_tradition", v)}
            className="vd-seq__type-text"
            placeholder="Type of qualitative research tradition…"
          />
        </div>
        <div className="vd-seq__canvas vd-seq__canvas--qual">{qualStrand}</div>
        <div className="vd-seq__footline">
          <span className="vd-seq__footline-label">Qualitative Research Question</span>
          <E
            value={fields.qual_question}
            onChange={(v) => upd("qual_question", v)}
            className="vd-seq__footline-text"
            placeholder="Your qualitative research question…"
          />
        </div>
      </>
    );

    const resultsFirst = quantLeft ? "Results Quantitative Study" : "Results Qualitative Study";
    const resultsFirstClass = quantLeft ? "vd-mixed__chip--quant" : "vd-mixed__chip--qual";
    const resultsFinal = quantLeft ? "Results Qualitative Study" : "Results Quantitative Study";
    const resultsFinalClass = quantLeft ? "vd-mixed__chip--qual" : "vd-mixed__chip--quant";

    return (
      <div className={`vd-diagram vd-diagram--mixed vd-diagram--seq vd-diagram--${variant}`}>
        <Identity name={name} email={email} />
        {title}

        {/* PHASE I ----> PHASE II header (each centered over its box) */}
        <div className="vd-seq__phases" aria-hidden="true">
          <span className="vd-seq__phase vd-seq__phase--one">PHASE I</span>
          <span className="vd-seq__dash" />
          <span className="vd-seq__phase vd-seq__phase--two">PHASE II</span>
        </div>

        {/* Phase I container */}
        <div className="vd-seq__box vd-seq__box--left">
          {quantLeft ? quantBox : qualBox}
        </div>

        {/* Solid arrows between the phases */}
        <span className="vd-seq__flow-arrow vd-seq__flow-arrow--top" aria-hidden="true" />
        <span className="vd-seq__flow-arrow vd-seq__flow-arrow--bottom" aria-hidden="true" />

        {/* Phase I results at the container border, fed by a dashed diagonal
            arrow from the phenomenon shape (teal from the pentagon in
            explanatory, plum from the hexagon in exploratory) */}
        <span className="vd-seq__phen-arrow" aria-hidden="true"><span className="vd-seq__phen-arrow-head" /></span>
        <span className={`vd-mixed__chip ${resultsFirstClass} vd-seq__chip-flower`}>{resultsFirst}</span>

        {/* results chip -> down -> Inform -> curve into Phase II */}
        <span className="vd-seq__inform-drop" aria-hidden="true" />
        <span className="vd-mixed__seq-inform vd-seq__inform-below" aria-hidden="true">Inform</span>
        <svg className="vd-seq__inform-curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="vdInformArrow" markerWidth="5.5" markerHeight="5.5" refX="4" refY="2.75" orient="auto">
              <path d="M0,0 L5.5,2.75 L0,5.5 Z" fill="#222222" />
            </marker>
          </defs>
          <path d="M20,6 Q28,74 86,88" stroke="#222222" strokeWidth="1.8" fill="none" vectorEffect="non-scaling-stroke" markerEnd="url(#vdInformArrow)" />
        </svg>

        {/* Phase II container */}
        <div className="vd-seq__box vd-seq__box--right">
          {quantLeft ? qualBox : quantBox}
        </div>

        {/* The second phase's results close the sequence */}
        <span className="vd-seq__final-arrow" aria-hidden="true" />
        <span className={`vd-mixed__chip ${resultsFinalClass} vd-mixed__chip--final`}>{resultsFinal}</span>

        {/* INTERPRETATION rail on the far right, fed by a solid arrow from Phase II */}
        <span className="vd-seq__flow-arrow vd-seq__flow-arrow--interp" aria-hidden="true" />
        <div className="vd-seq__interp" aria-hidden="true">
          <span className="vd-seq__interp-label">INTERPRETATION</span>
        </div>

        <LogoRow />
        <div className="vd-design-name">{layout.designName}</div>
      </div>
    );
  }

  /* ---- Convergent parallel: both strands in one container, results
     compared and interpreted together ---- */
  return (
    <div className="vd-diagram vd-diagram--mixed vd-diagram--conv">
      <Identity name={name} email={email} />
      {title}

      {/* Strand type titles */}
      <div className="vd-seq__type vd-conv__type vd-conv__type--left">
        <E
          value={fields.qual_tradition}
          onChange={(v) => upd("qual_tradition", v)}
          className="vd-seq__type-text"
          placeholder="Type of qualitative research tradition…"
        />
      </div>
      <div className="vd-seq__type vd-conv__type vd-conv__type--right">
        <E
          value={fields.study_type}
          onChange={(v) => upd("study_type", v)}
          className="vd-seq__type-text"
          placeholder="Type of quantitative research design…"
        />
      </div>

      <div className="vd-mixed__half vd-mixed__half--left">{qualStrand}</div>
      <div className="vd-mixed__half vd-mixed__half--right">{quantStrand(false)}</div>

      {/* Center flow: both results rise along dashed rails into the
          comparison, which is then interpreted */}
      <span className="vd-conv__compare-label" aria-hidden="true">Comparison<br />of Results</span>
      <span className="vd-conv__interp-line" aria-hidden="true">
        <span className="vd-conv__interp-line-arrow">&#9660;</span>
      </span>
      <span className="vd-conv__interp-label" aria-hidden="true">Interpretation</span>
      <span className="vd-conv__rail vd-conv__rail--qual" aria-hidden="true">
        <span className="vd-conv__rail-arrow">&#10148;</span>
      </span>
      <span className="vd-conv__rail vd-conv__rail--quant" aria-hidden="true">
        <span className="vd-conv__rail-arrow vd-conv__rail-arrow--flip">&#10148;</span>
      </span>

      {/* L-shaped dashed connectors: each strand's driving question flows into its results */}
      <div className="vd-conv__connector" aria-hidden="true">
        <span className="vd-conv__connector-arrow">&#10148;</span>
      </div>
      <div className="vd-conv__connector vd-conv__connector--quant" aria-hidden="true">
        <span className="vd-conv__connector-arrow vd-conv__connector-arrow--flip">&#10148;</span>
      </div>

      {/* Both strands' results feed the comparison */}
      <div className="vd-conv__results" aria-hidden="true">
        <span className="vd-conv__result-text vd-conv__result-text--qual">Results<br />Qualitative<br />Study</span>
        <span className="vd-conv__result-text vd-conv__result-text--quant">Results<br />Quantitative<br />Study</span>
      </div>

      {/* Footlines under each strand */}
      <div className="vd-seq__footline vd-conv__footline--left">
        <span className="vd-seq__footline-label">Qualitative Research Question</span>
        <E
          value={fields.qual_question}
          onChange={(v) => upd("qual_question", v)}
          className="vd-seq__footline-text"
          placeholder="Your qualitative research question…"
        />
      </div>
      <div className="vd-seq__footline vd-conv__footline--right">
        <span className="vd-seq__footline-label">Hypothesis</span>
        <E
          value={fields.hypothesis}
          onChange={(v) => upd("hypothesis", v)}
          className="vd-seq__footline-text"
          placeholder="Your hypothesis…"
        />
      </div>

      <LogoRow />
      <div className="vd-design-name">{layout.designName}</div>
    </div>
  );
}
