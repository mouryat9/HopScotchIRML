// src/CFTemplatePolygon.jsx
import React from "react";

/**
 * Template 1: Angular polygon mosaic (matching PPTX Slide 3).
 * Two-layer approach: background polygon shapes + foreground text overlays.
 */
export default function CFTemplatePolygon({ d, upd, updTopic, updFramework, E }) {
  const topicPositions = [
    { left: "0.4%", top: "5%" },
    { left: "4%", top: "11.5%" },
    { left: "9%", top: "17.5%" },
    { left: "16%", top: "23.5%" },
    { left: "24%", top: "31.5%" },
  ];

  const fwPositions = [
    { right: "1%", top: "5%" },
    { right: "5%", top: "11%" },
    { right: "9%", top: "17%" },
    { right: "13%", top: "22%" },
    { right: "20%", top: "29%" },
  ];

  return (
    <div className="cf-page">
      <div className="cf-diagram">

        {/* ═══ Layer 1: Background polygon shapes + borders (single SVG for html2canvas compatibility) ═══ */}
        <svg className="cf-shapes-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Filled polygons (back to front by z-index) */}
          <polygon points="60.9,47.2 100,24.3 100,100 84.1,100 56.9,64.9" fill="#6AA84F" stroke="#fff" strokeWidth="0.3"/>
          <polygon points="55.8,64.8 83.9,100 100,100 100,68.2 57.9,55.6" fill="#0097A7" stroke="#fff" strokeWidth="0.3"/>
          <polygon points="0,24.5 40,47.3 44,24.3 44,100 27.7,100 0,68.2" fill="#F1C232" stroke="#fff" strokeWidth="0.3"/>
          <polygon points="44.1,64.8 15.9,100 0,100 0,68.2 42.4,54.9" fill="#7F6000" stroke="#fff" strokeWidth="0.3"/>
          <polygon points="50.6,36.4 50.6,0 100,0 100,24.6 61,47.3" fill="#FFAB40" stroke="#fff" strokeWidth="0.3"/>
          <polygon points="50.6,36.4 50.6,0 0,0 0,24.5 40,47.3" fill="#1C4587" stroke="#fff" strokeWidth="0.3"/>
          <polygon points="44.2,64.9 56.8,64.8 76.9,91.2 22.9,91.4" fill="#CC0000" stroke="#fff" strokeWidth="0.3"/>
          <polygon points="50.65,36.5 61,47.4 57,64.9 44,64.9 40.3,47.4" fill="#666666" stroke="#fff" strokeWidth="0.3"/>
          <polygon points="50.6,36.6 34.6,0 65.7,0" fill="#CFE2F3" stroke="#fff" strokeWidth="0.3"/>
        </svg>

        {/* ═══ Layer 2: Text content overlays ═══ */}

        <div className="cf-txt cf-txt--topical-label">
          <span className="cf-label cf-label--light">Topical Research</span>
        </div>
        {d.topics.map((t, i) => (
          <div key={`t${i}`} className="cf-txt cf-txt--topic" style={topicPositions[i]}>
            <E value={t} onChange={(v) => updTopic(i, v)} placeholder={`Topic ${i + 1}`} className="cf-text--light" />
          </div>
        ))}

        <div className="cf-txt cf-txt--fw-label">
          <span className="cf-label cf-label--light">Theoretical Frameworks</span>
        </div>
        {d.frameworks.map((f, i) => (
          <div key={`f${i}`} className="cf-txt cf-txt--framework" style={fwPositions[i]}>
            <E value={f} onChange={(v) => updFramework(i, v)} placeholder={`Framework ${i + 1}`} className="cf-text--light" />
          </div>
        ))}

        <div className="cf-txt cf-txt--gaps">
          <span className="cf-label cf-label--dark">Gap/s Found:</span>
          <E value={d.gaps} onChange={(v) => upd("gaps", v)} placeholder="Gaps found in literature..." className="cf-text--dark cf-text--sm" />
        </div>

        <div className="cf-txt cf-txt--topic-center">
          <span className="cf-label cf-label--light">Research Topic:</span>
          <E value={d.topic} onChange={(v) => upd("topic", v)} placeholder="Define your research topic" className="cf-text--light cf-text--sm" />
        </div>

        <div className="cf-txt cf-txt--interests">
          <span className="cf-label cf-label--dark">Personal Interests & Goals</span>
          <E value={d.personal_goals} onChange={(v) => upd("personal_goals", v)} placeholder="Your interests and goals" className="cf-text--dark cf-text--sm" />
        </div>

        <div className="cf-txt cf-txt--identity">
          <span className="cf-label cf-label--light">Identity & Positionality</span>
          <E value={d.worldview} onChange={(v) => upd("worldview", v)} placeholder="Your worldview" className="cf-text--light cf-text--sm" />
        </div>

        <div className="cf-txt cf-txt--problem">
          <span className="cf-label cf-label--light">Problem Statement:</span>
          <E value={d.problem_statement} onChange={(v) => upd("problem_statement", v)} placeholder="Define your problem" className="cf-text--light cf-text--sm" />
        </div>

        <div className="cf-txt cf-txt--design">
          <span className="cf-label cf-label--light">Research Design</span>
          <E value={d.research_design} onChange={(v) => upd("research_design", v)} placeholder="Your research design" className="cf-text--light cf-text--sm" />
        </div>

        <div className="cf-txt cf-txt--questions">
          <span className="cf-label cf-label--light">Research Questions</span>
          <E value={d.research_questions} onChange={(v) => upd("research_questions", v)} placeholder="Your research questions" className="cf-text--light cf-text--sm" />
        </div>

        {/* Footer */}
        <div className="cf-footer">
          <span className="cf-footer__left">
            Email: <E value={d.email} onChange={(v) => upd("email", v)} className="cf-text--footer" />
          </span>
          <span className="cf-footer__center">
            Conceptual Framework: <E value={d.name} onChange={(v) => upd("name", v)} className="cf-text--name" />
          </span>
          <span className="cf-footer__right">
            Date: <E value={d.date} onChange={(v) => upd("date", v)} className="cf-text--footer" />
          </span>
          <img src="/Hopscotch-4-all-logo-alpha.png" alt="Hopscotch" className="cf-footer__logo" />
          <svg className="cf-footer__grid" viewBox="0 0 128 46" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" fill="none">
            <rect x="0"  y="0"  width="18" height="22" rx="6" fill="#2B5EA7"/>
            <rect x="0"  y="24" width="18" height="22" rx="6" fill="#E8618C"/>
            <rect x="22" y="12" width="18" height="22" rx="6" fill="#D94040"/>
            <rect x="44" y="0"  width="18" height="22" rx="6" fill="#1A8A7D"/>
            <rect x="44" y="24" width="18" height="22" rx="6" fill="#B0A47A"/>
            <rect x="66" y="12" width="18" height="22" rx="6" fill="#00AEEF"/>
            <rect x="88" y="0"  width="18" height="22" rx="6" fill="#F0B429"/>
            <rect x="88" y="24" width="18" height="22" rx="6" fill="#F5922A"/>
            <path d="M110,7 A16,16 0 0,1 110,39 Z" fill="#7B8794"/>
          </svg>
        </div>

        {/* Color tile bar */}
        <div className="cf-tile-bar">
          <span style={{background:"#2B5EA7"}} />
          <span style={{background:"#E8618C"}} />
          <span style={{background:"#D94040"}} />
          <span style={{background:"#1A8A7D"}} />
          <span style={{background:"#B0A47A"}} />
          <span style={{background:"#00AEEF"}} />
          <span style={{background:"#F0B429"}} />
          <span style={{background:"#F5922A"}} />
          <span style={{background:"#7B8794"}} />
        </div>
      </div>
    </div>
  );
}
