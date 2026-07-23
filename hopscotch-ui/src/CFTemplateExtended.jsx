// src/CFTemplateExtended.jsx
import React from "react";

/**
 * Template 3: Extended 3-column layout with central circle infographic.
 * Matches the "Hopscotch - Components of a Conceptual Framework" PPTX slide.
 */
export default function CFTemplateExtended({ d, upd, updTopic, updFramework, E }) {
  return (
    <div className="cf-page">
      <div className="cfe-diagram">

        {/* ── Header: email/date left, research topic center, logo right ── */}
        <div className="cfe-header">
          <div className="cfe-header__meta">
            <div>Email: <E value={d.email} onChange={(v) => upd("email", v)} className="cfe-text--meta" /></div>
            <div>Date: <E value={d.date} onChange={(v) => upd("date", v)} className="cfe-text--meta" /></div>
          </div>
          <div className="cfe-header__topic">
            <strong>Research Topic:</strong>&nbsp;
            <E value={d.topic} onChange={(v) => upd("topic", v)} placeholder="<<Define your research topic>>" className="cfe-text--topic" />
          </div>
          <div className="cfe-header__logo">
            <img src="/Hopscotch-4-all-logo-alpha.png" alt="Hopscotch" className="cfe-header__logo-img" />
            <svg className="cfe-header__grid" viewBox="0 0 128 46" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" fill="none">
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
        </div>

        {/* ── 3-column body ── */}
        <div className="cfe-body">

          {/* ─── Left column: Topics + Personal Interests + Identity ─── */}
          <div className="cfe-col cfe-col--left">
            <div className="cfe-card cfe-card--topics">
              <div className="cfe-card__header">Topical Research</div>
              <div className="cfe-card__body">
                {d.topics.map((t, i) => (
                  <div key={`t${i}`} className="cfe-card__item">
                    <E value={t} onChange={(v) => updTopic(i, v)} placeholder={`<<Topic ${i + 1}>>`} className="cfe-text--body" />
                  </div>
                ))}
              </div>
            </div>

            <div className="cfe-card cfe-card--personal">
              <div className="cfe-card__header">Personal Interests &amp; Goals</div>
              <div className="cfe-card__body">
                <E value={d.personal_goals} onChange={(v) => upd("personal_goals", v)} placeholder="<<Define your Personal Interests and Goals>>" className="cfe-text--body" />
              </div>
            </div>

            <div className="cfe-card cfe-card--identity">
              <div className="cfe-card__header">Identity &amp; Positionality</div>
              <div className="cfe-card__body">
                <E value={d.worldview} onChange={(v) => upd("worldview", v)} placeholder="<<Describe your positionality and worldview >>" className="cfe-text--body" />
              </div>
            </div>
          </div>

          {/* ─── Center column: Lit Review + Circle Diagram + Research Design ─── */}
          <div className="cfe-col cfe-col--center">
            <div className="cfe-card cfe-card--litreview">
              <div className="cfe-card__header">Literature Review</div>
              <div className="cfe-card__body">
                <span className="cfe-card__label">Gap/s Found:</span>
                <E value={d.gaps} onChange={(v) => upd("gaps", v)} placeholder="<<Gap/s found in the review of your topical research>>" className="cfe-text--body" />
              </div>
            </div>

            {/* Components infographic (decorative, static text) - hexagon core
                with contained component cards so text never overflows shapes. */}
            <div className="cfe-infographic">
              <div className="cfe-infographic__title">Components of a Conceptual Framework</div>

              <div className="cfe-cf">
                {/* Central hexagon core */}
                <div className="cfe-cf__core">
                  <div className="cfe-cf__hex">
                    <span className="cfe-cf__hex-label">Conceptual<br/>Framework</span>
                  </div>
                </div>

                {/* Five components - text lives inside cards, cannot spill out */}
                <div className="cfe-cf__grid">
                  {[
                    { c: "#1C4587", t: "Topical Research", d: "Empirical work in your area of interest - journals, books, and policy reports." },
                    { c: "#1A8A7D", t: "Theoretical Frameworks", d: "Formal theories and constructs that examine relationships and guide the study." },
                    { c: "#BF9730", t: "Problem Statement", d: "Establishes the intent of the study - clear, specific, and informative." },
                    { c: "#8B3A3A", t: "Research Design", d: "The methods and procedures used: quantitative, qualitative, or mixed." },
                    { c: "#6AA84F", t: "Personal Connection", d: "Your interests, goals, and the worldview you bring as a researcher." },
                  ].map((n) => (
                    <div className="cfe-cf__node" key={n.t} style={{ "--node-color": n.c }}>
                      <span className="cfe-cf__node-title">{n.t}</span>
                      <span className="cfe-cf__node-desc">{n.d}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cfe-infographic__citation">
                “A conceptual framework is an argument about why a topic matters and why the means proposed to
                study it are appropriate and rigorous.” - Ravitch &amp; Riggan (2016)
              </div>
            </div>

            {/* Research Design with flanking arrows */}
            <div className="cfe-design-row">
              <div className="cfe-design-arrow cfe-design-arrow--right">&#9654;</div>
              <div className="cfe-card cfe-card--design">
                <div className="cfe-card__header">Research Design</div>
                <div className="cfe-card__body">
                  <E value={d.research_design} onChange={(v) => upd("research_design", v)} placeholder="<<Define your Research Design>>" className="cfe-text--body" />
                </div>
              </div>
              <div className="cfe-design-arrow cfe-design-arrow--left">&#9664;</div>
            </div>
          </div>

          {/* ─── Right column: Frameworks + Problem Statement + Research Questions ─── */}
          <div className="cfe-col cfe-col--right">
            <div className="cfe-card cfe-card--frameworks">
              <div className="cfe-card__header">Theoretical Frameworks</div>
              <div className="cfe-card__body">
                {d.frameworks.map((f, i) => (
                  <div key={`f${i}`} className="cfe-card__item">
                    <E value={f} onChange={(v) => updFramework(i, v)} placeholder={`<<Theoretical Framework ${i + 1}>>`} className="cfe-text--body" />
                  </div>
                ))}
              </div>
            </div>

            <div className="cfe-card cfe-card--problem">
              <div className="cfe-card__header">Problem Statement</div>
              <div className="cfe-card__body">
                <E value={d.problem_statement} onChange={(v) => upd("problem_statement", v)} placeholder="<<Define your Problem Statement>>" className="cfe-text--body" />
              </div>
            </div>

            <div className="cfe-card cfe-card--questions">
              <div className="cfe-card__header">Research Questions</div>
              <div className="cfe-card__body">
                <E value={d.research_questions} onChange={(v) => upd("research_questions", v)} placeholder="<<Define your Research Question/s>>" className="cfe-text--body" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
