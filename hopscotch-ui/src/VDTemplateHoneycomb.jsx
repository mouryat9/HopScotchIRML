// src/VDTemplateHoneycomb.jsx
// Shared visual design diagram for the qualitative honeycomb slides of
// Universal-visual-design-qualitative-studies.pptx: 7 hexagons (center =
// the design's key element, in that design's signature color) with a Context
// rail on the left, Topics under the question hexagon, and name/email top-left.
// Each design (narrative, phenomenology, ...) passes its own labels + colors.
import React from "react";

// Hexagon geometry from the PPTX (inches on a 10 x 7.5 slide, w=2.65 h=2.31)
const HEX_W = 26.5; // % of width
const HEX_H = 30.8; // % of height
const HEX_POS = {
  informants: { x: 47.6, y: 3.5 },
  other_documents: { x: 26.0, y: 19.2 },
  data_gathering: { x: 69.0, y: 19.2 },
  central_item: { x: 47.6, y: 35.3 },
  strategies: { x: 26.0, y: 51.2 },
  process_support: { x: 69.0, y: 51.2 },
  question: { x: 47.6, y: 67.1 },
};

// PowerPoint HEXAGON preset: side points at left/right, inset = 0.25 * height
function hexPoints(w = 265, h = 231) {
  const inset = 0.25 * h;
  return `${inset},0 ${w - inset},0 ${w},${h / 2} ${w - inset},${h} ${inset},${h} 0,${h / 2}`;
}

// The six gray "Context" markers on the case study / action research slides
// sit in the football-shaped notches BETWEEN the hexagons. Centers and tilt
// angles derived from the slide's freeform shapes (x/y as % of the page,
// rotation in degrees following the notch direction).
const CTX_TAGS = [
  { x: 42.4, y: 11.0, rot: -29 },  // between Other Documents and Informants
  { x: 79.2, y: 11.0, rot: 29 },   // between Informants and Data Gathering
  { x: 26.3, y: 50.6, rot: 90 },   // left edge, between the two left hexagons
  { x: 95.2, y: 50.6, rot: 90 },   // right edge, between the two right hexagons
  { x: 42.3, y: 90.3, rot: 29 },   // between Strategies and the Question hexagon
  { x: 79.3, y: 90.3, rot: -29 },  // between the Question hexagon and Process Support
];

function ContextFootball({ x, y, rot }) {
  return (
    <div className="vd-ctx-tag" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${rot}deg)` }}>
      <svg viewBox="0 0 200 52" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 4,26 Q 100,-14 196,26 Q 100,66 4,26 Z" fill="#999999" />
        <text x="100" y="33" textAnchor="middle" fill="#ffffff" fontWeight="700" fontSize="20" letterSpacing="0.5">Context</text>
      </svg>
    </div>
  );
}

export default function VDTemplateHoneycomb({ layout, name, email, fields, upd, E, activeKey, onJumpToField, embedded = false }) {
  const jump = (key) => onJumpToField && onJumpToField(key);

  const hexes = ["informants", "other_documents", "data_gathering", "central_item", "strategies", "process_support", "question"];

  function hexStyle(key) {
    if (key === "central_item") return { fill: layout.centerColor, stroke: "#0B5394", labelColor: layout.centerLabelColor };
    if (key === "question") return { fill: "#F6F6F6", stroke: "#CC0000", labelColor: "#CC0000" };
    return { fill: "#FFFFFF", stroke: "#0B5394", labelColor: "#0B5394" };
  }

  return (
    <div className={embedded ? "vd-subdiagram" : "vd-diagram"}>
      {/* Student identity (hidden when embedded in a mixed methods canvas) */}
      {!embedded && (
        <div className="vd-identity">
          <div className="vd-identity__caption">Designed by</div>
          <div className="vd-identity__name">{name}</div>
          <div className="vd-identity__email">{email}</div>
        </div>
      )}

      {/* Context rail (left, or bottom-left under Strategies in mixed strands) */}
      <div className={`vd-context${layout.contextBottom ? " vd-context--bottom" : ""}${activeKey === "context" ? " vd-context--active" : ""}`}>
        <div className="vd-context__title" onClick={() => jump("context")} title="Edit in the form">
          {layout.contextTitle}
        </div>
        <E
          value={fields.context}
          onChange={(v) => upd("context", v)}
          className="vd-context__text"
          placeholder="Describe the setting where your study will take place…"
        />
      </div>

      {/* Gray "Context" footballs in the gaps between hexagons (case study / action research) */}
      {layout.contextMarkers && CTX_TAGS.map((t, i) => (
        <ContextFootball key={`ctx-${i}`} x={t.x} y={t.y} rot={t.rot} />
      ))}

      {/* Hexagon honeycomb */}
      {hexes.map((key) => {
        const pos = HEX_POS[key];
        const style = hexStyle(key);
        const isCenter = key === "central_item";
        const isQuestion = key === "question";
        const isActive = activeKey === key;
        return (
          <div
            key={key}
            className={`vd-hex${isCenter ? " vd-hex--center" : ""}${isCenter && layout.centerDark ? " vd-hex--dark-center" : ""}${isQuestion ? " vd-hex--question" : ""}${key === "process_support" && layout.hasMinicases ? " vd-hex--split" : ""}${isActive ? " vd-hex--focus" : ""}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${HEX_W}%`, height: `${HEX_H}%` }}
          >
            <svg className="vd-hex__shape" viewBox="0 0 265 231" preserveAspectRatio="none" aria-hidden="true">
              <polygon
                className="vd-hex__poly"
                points={hexPoints()}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={isQuestion ? 5 : 3}
              />
            </svg>
            <div className="vd-hex__content">
              <div
                className="vd-hex__label"
                style={{ color: style.labelColor }}
                onClick={() => jump(key)}
                title="Edit in the form"
              >
                {layout.labels[key]}
              </div>
              <E
                value={fields[key]}
                onChange={(v) => upd(key, v)}
                className="vd-hex__text"
                placeholder="Click to write…"
              />
            </div>
          </div>
        );
      })}

      {/* Minicases (inside the lower half of the Process Support hexagon) */}
      {layout.hasMinicases && (
        <div className={`vd-minicases${activeKey === "minicases" ? " vd-minicases--active" : ""}`}>
          <div className="vd-minicases__label" onClick={() => jump("minicases")} title="Edit in the form">Minicases</div>
          <E
            value={fields.minicases}
            onChange={(v) => upd("minicases", v)}
            className="vd-minicases__text"
            placeholder="Click to write…"
          />
        </div>
      )}

      {/* Topics (inside the lower half of the question hexagon) */}
      <div className={`vd-topics${activeKey === "topics" ? " vd-topics--active" : ""}`}>
        <div className="vd-topics__rule" />
        <div className="vd-topics__label" onClick={() => jump("topics")} title="Edit in the form">Topics</div>
        <E
          value={fields.topics}
          onChange={(v) => upd("topics", v)}
          className="vd-topics__text"
          placeholder="One topic per line…"
        />
      </div>

      {/* Footer: Hopscotch 4 All logo + animated hopscotch squares + design name */}
      {!embedded && <div className="vd-logo-row">
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
      </div>}
      {!embedded && <div className="vd-design-name">{layout.designName}</div>}
    </div>
  );
}
