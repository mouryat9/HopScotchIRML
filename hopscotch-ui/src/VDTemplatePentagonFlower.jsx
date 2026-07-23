// src/VDTemplatePentagonFlower.jsx
// Shared visual design diagram for the quantitative slides of
// Universal-visual-design-quantitative-studies.pptx: a flower of 6 pentagons.
// Center = the Descriptive <-> Experimental continuum (Control of Variance /
// Causality sliders) + the phenomenon under study. Around it: Hypothesis &
// Research Question (top), Data Gathering (left), Process Support (right),
// Type / #Groups / Analysis (bottom-left), IV control / Groups /
// Representativeness / Sample (bottom-right).
// Each design passes fixed characteristic values + slider positions.
import React from "react";

const PENT_W = 28.4; // % of width
const PENT_H = 35.1; // % of height
const PENT_POS = {
  top: { x: 45.5, y: 3.7 },
  left: { x: 21.6, y: 26.4 },
  right: { x: 69.4, y: 26.4 },
  center: { x: 45.5, y: 40.0 },
  bottom_left: { x: 30.8, y: 62.3 },
  bottom_right: { x: 60.3, y: 62.3 },
};

// Regular pentagon, apex at top (PowerPoint REGULAR_PENTAGON preset).
// The center pentagon is rotated 180 degrees in the PPTX (point-down) so it
// nests between the five upright pentagons and completes the flower.
const PENT_POINTS = "50,0 100,38.2 81,100 19,100 0,38.2";
const PENT_POINTS_FLIPPED = "50,100 0,61.8 19,0 81,0 100,61.8";

const STROKE = "#005493";
// The center pentagon is filled bright blue on the PPTX reference slides
const CENTER_FILL = "#51A7F9";

function Slider({ label, value, onChange }) {
  const trackRef = React.useRef(null);
  const clamped = Math.max(0, Math.min(1, value));
  const pct = clamped * 100;
  const step = (d) => onChange && onChange(Math.max(0, Math.min(1, clamped + d)));
  const fromEvent = (e) => {
    if (!trackRef.current) return clamped;
    const r = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  const onPointerDown = (e) => {
    if (!onChange) return;
    e.preventDefault();
    onChange(fromEvent(e));
    const move = (ev) => onChange(fromEvent(ev));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("mouseup", up);
    };
    // Listen to both pointer and mouse events so dragging works everywhere
    window.addEventListener("pointermove", move);
    window.addEventListener("mousemove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("mouseup", up);
  };
  return (
    <div className="vdq-slider">
      <div className="vdq-slider__label">{label}</div>
      <div className="vdq-slider__track">
        <button type="button" className="vdq-slider__pole" onClick={() => step(-0.1)} title="Move towards the descriptive end">-</button>
        <div className="vdq-slider__line" ref={trackRef} onPointerDown={onPointerDown} title="Drag or click to position your study on the continuum">
          <span className="vdq-slider__marker" style={{ left: `${pct}%` }} />
        </div>
        <button type="button" className="vdq-slider__pole" onClick={() => step(0.1)} title="Move towards the experimental end">+</button>
      </div>
    </div>
  );
}

// Module-level components: defining these inside the parent would give them a
// new identity every render, forcing React to remount the subtree (which broke
// slider dragging and wasted work).
function Pent({ pos, focusKeys, activeKey, flip = false, children }) {
  const isActive = focusKeys.some((k) => activeKey === k);
  const p = PENT_POS[pos];
  return (
    <div
      className={`vdq-pent${isActive ? " vdq-pent--focus" : ""}${flip ? " vdq-pent--flip" : ""}`}
      style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${PENT_W}%`, height: `${PENT_H}%` }}
    >
      <svg className="vdq-pent__shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon className="vdq-pent__poly" points={flip ? PENT_POINTS_FLIPPED : PENT_POINTS} fill={flip ? CENTER_FILL : "#FFFFFF"} stroke={STROKE} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={`vdq-pent__content${flip ? " vdq-pent__content--flip" : ""}`}>{children}</div>
    </div>
  );
}

function Label({ k, jump, children }) {
  return (
    <div className="vdq-label" onClick={() => jump(k)} title="Edit in the form">{children}</div>
  );
}

export default function VDTemplatePentagonFlower({ layout, name, email, fields, upd, E, activeKey, onJumpToField }) {
  const jump = (key) => onJumpToField && onJumpToField(key);

  // Slider values: the student's saved position (0-100 string), falling back
  // to the design's default place on the descriptive<->experimental continuum
  const sliderVal = (key, fallback) => {
    const raw = fields[key];
    const n = raw === "" || raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n / 100)) : fallback;
  };
  const setSlider = (key) => (v) => upd(key, String(Math.round(v * 100)));

  return (
    <div className="vd-diagram vd-diagram--pentagon">
      {/* Identity */}
      <div className="vd-identity">
        <div className="vd-identity__caption">Designed by</div>
        <div className="vd-identity__name">{name}</div>
        <div className="vd-identity__email">{email}</div>
      </div>

      {/* Design title (independent of the identity box so it survives anonymized prints) */}
      <div className="vdq-title">
        <span className="vdq-title__name">{layout.titleName}</span>
        <E
          value={fields.study_type}
          onChange={(v) => upd("study_type", v)}
          className="vdq-title__type"
          placeholder="Type of study…"
        />
      </div>

      {/* Top pentagon: Hypothesis / Variables + Research Question */}
      <Pent activeKey={activeKey} pos="top" focusKeys={["variables", "question"]}>
        <Label jump={jump} k="variables">Hypothesis: Variables</Label>
        <E value={fields.variables} onChange={(v) => upd("variables", v)} className="vdq-text" placeholder="Click to write…" />
        <div className="vdq-divider" />
        <Label jump={jump} k="question">Research Question</Label>
        <E value={fields.question} onChange={(v) => upd("question", v)} className="vdq-text vdq-text--grow" placeholder="Click to write…" />
      </Pent>

      {/* Left pentagon: Data Gathering */}
      <Pent activeKey={activeKey} pos="left" focusKeys={["data_gathering"]}>
        <Label jump={jump} k="data_gathering">Data Gathering</Label>
        <E value={fields.data_gathering} onChange={(v) => upd("data_gathering", v)} className="vdq-text" placeholder="Click to write…" />
      </Pent>

      {/* Right pentagon: Process Support */}
      <Pent activeKey={activeKey} pos="right" focusKeys={["process_support"]}>
        <Label jump={jump} k="process_support">Process Support</Label>
        <E value={fields.process_support} onChange={(v) => upd("process_support", v)} className="vdq-text" placeholder="Click to write…" />
      </Pent>

      {/* Center pentagon (point-down): continuum sliders + phenomenon */}
      <Pent activeKey={activeKey} pos="center" focusKeys={["central_item"]} flip>
        <Slider label="Control of Variance" value={sliderVal("slider_variance", layout.sliders.variance)} onChange={setSlider("slider_variance")} />
        <Slider label="Causality" value={sliderVal("slider_causality", layout.sliders.causality)} onChange={setSlider("slider_causality")} />
        <div className="vdq-poles">
          <span>Descriptive</span>
          <span>Experimental</span>
        </div>
        <Label jump={jump} k="central_item">Phenomenon under Study</Label>
        <E value={fields.central_item} onChange={(v) => upd("central_item", v)} className="vdq-text vdq-text--grow" placeholder="Click to write…" />
      </Pent>

      {/* Bottom-left pentagon: Type / # of Groups / Analysis */}
      <Pent activeKey={activeKey} pos="bottom_left" focusKeys={["groups", "data_analysis"]}>
        <div className="vdq-label">Type</div>
        <div className="vdq-fixed">{layout.fixed.type}</div>
        <div className="vdq-divider" />
        <Label jump={jump} k="groups"># of Groups</Label>
        <E value={fields.groups} onChange={(v) => upd("groups", v)} className="vdq-text" placeholder="Click to write…" />
        <div className="vdq-divider" />
        <Label jump={jump} k="data_analysis">Analysis</Label>
        <E value={fields.data_analysis} onChange={(v) => upd("data_analysis", v)} className="vdq-text vdq-text--grow" placeholder="Click to write…" />
      </Pent>

      {/* Bottom-right pentagon: IV control / Groups / Representativeness / Sample */}
      <Pent activeKey={activeKey} pos="bottom_right" focusKeys={["sample"]}>
        <Slider label="Control of Independent Variable" value={sliderVal("slider_iv_control", layout.sliders.ivControl)} onChange={setSlider("slider_iv_control")} />
        <div className="vdq-row">
          <span className="vdq-row__key">Groups</span>
          <span className="vdq-fixed">{layout.fixed.groups}</span>
        </div>
        <div className="vdq-row">
          <span className="vdq-row__key">Representativeness</span>
          <span className="vdq-fixed">{layout.fixed.representativeness}</span>
        </div>
        <div className="vdq-divider" />
        <Label jump={jump} k="sample">Sample</Label>
        <E value={fields.sample} onChange={(v) => upd("sample", v)} className="vdq-text vdq-text--grow" placeholder="Click to write…" />
      </Pent>

      {/* Footer: Hopscotch 4 All logo + animated hopscotch squares */}
      <div className="vd-logo-row">
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
      <div className="vd-design-name">{layout.designName}</div>
    </div>
  );
}
