// src/CFTemplateBoxed.jsx
import React from "react";
import HopGridLoader from "./HopGridLoader";
import VDCitation from "./VDCitation";

/**
 * Template 2: Boxed/card layout - rectangular sections with a flowchart
 * arrangement. Matches the "Hopscotch Create your Research Design" PPTX slide.
 */
export default function CFTemplateBoxed({ d, upd, updTopic, updFramework, E }) {
  return (
    <div className="cf-page">
      <div className="cfb-diagram">

        {/* ── Header row: email/date left, CF name right ── */}
        <div className="cfb-header">
          <div className="cfb-header__meta">
            <div className="cf-identity">Email: <E value={d.email} onChange={(v) => upd("email", v)} className="cfb-text--meta" /></div>
            <div className="cf-identity">Date: <E value={d.date} onChange={(v) => upd("date", v)} className="cfb-text--meta" /></div>
          </div>
          <div className="cfb-header__title">Conceptual Framework</div>
        </div>

        {/* ── Main content area: sidebar + main flow ── */}
        <div className="cfb-content">

          {/* Left sidebar: Personal Interests + connector + Identity */}
          <div className="cfb-sidebar">
            <div className="cfb-card cfb-card--personal">
              <div className="cfb-card__header cfb-card__header--red">Personal Interests &amp; Goals</div>
              <div className="cfb-card__body">
                <E value={d.personal_goals} onChange={(v) => upd("personal_goals", v)} placeholder="<<Define your Personal Interests and Goals>>" className="cfb-text--body" />
              </div>
            </div>

            {/* Vertical connector + right arrow at midpoint */}
            <div className="cfb-connector-mid">
              <div className="cfb-connector-v" />
              <div className="cfb-arrow-right cfb-arrow-right--connector">&#8594;</div>
            </div>

            <div className="cfb-card cfb-card--identity">
              <div className="cfb-card__header cfb-card__header--yellow">Identity &amp; Positionality</div>
              <div className="cfb-card__body">
                <E value={d.worldview} onChange={(v) => upd("worldview", v)} placeholder="<<Describe your positionality and worldview >>" className="cfb-text--body" />
              </div>
            </div>
          </div>

          {/* Main flow column */}
          <div className="cfb-main">

            {/* Literature Review teal banner */}
            <div className="cfb-lit-banner">Literature Review</div>

            {/* 3-column literature review area with border */}
            <div className="cfb-lit-area">
              {/* Topical Research column (light blue bg) */}
              <div className="cfb-col cfb-col--topics">
                <div className="cfb-col__heading">Topical Research</div>
                {d.topics.map((t, i) => (
                  <div key={`t${i}`} className="cfb-col__item">
                    <E value={t} onChange={(v) => updTopic(i, v)} placeholder={`<<Topic ${i + 1}>>`} className="cfb-text--body" />
                  </div>
                ))}
              </div>

              {/* Research Topic (center, dark blue rounded rect) */}
              <div className="cfb-col cfb-col--center">
                <div className="cfb-topic-box">
                  <span className="cfb-topic-box__label">Research Topic:</span>
                  <E value={d.topic} onChange={(v) => upd("topic", v)} placeholder="<<Define your research topic>>" className="cf-text--light cfb-text--body" />
                </div>
              </div>

              {/* Theoretical Frameworks column (mauve bg) */}
              <div className="cfb-col cfb-col--frameworks">
                <div className="cfb-col__heading">Theoretical Frameworks</div>
                {d.frameworks.map((f, i) => (
                  <div key={`f${i}`} className="cfb-col__item">
                    <E value={f} onChange={(v) => updFramework(i, v)} placeholder={`<<Theoretical Framework ${i + 1}>>`} className="cfb-text--body" />
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow down */}
            <div className="cfb-arrow-down">&#8595;</div>

            {/* Gap/s Found */}
            <div className="cfb-flow-box cfb-flow-box--gaps">
              <span className="cfb-flow-box__label">Gap/s Found:</span>
              <E value={d.gaps} onChange={(v) => upd("gaps", v)} placeholder="<<Gap/s found in the review of your topical research>>" className="cfb-text--body" />
            </div>

            {/* Arrow down */}
            <div className="cfb-arrow-down">&#8595;</div>

            {/* Problem Statement */}
            <div className="cfb-flow-box cfb-flow-box--problem">
              <span className="cfb-flow-box__label">Problem Statement:</span>
              <E value={d.problem_statement} onChange={(v) => upd("problem_statement", v)} placeholder="<<Define your Problem Statement>>" className="cfb-text--body" />
            </div>

            {/* Arrow down */}
            <div className="cfb-arrow-down">&#8595;</div>

            {/* Bottom row: Research Questions → Research Design */}
            <div className="cfb-bottom-row">
              <div className="cfb-flow-box cfb-flow-box--questions">
                <span className="cfb-flow-box__label">Research Questions:</span>
                <E value={d.research_questions} onChange={(v) => upd("research_questions", v)} placeholder="<<Define your Research Question/s>>" className="cfb-text--body" />
              </div>
              <div className="cfb-arrow-right">&#8594;</div>
              <div className="cfb-flow-box cfb-flow-box--design">
                <span className="cfb-flow-box__label">Research Design:</span>
                <E value={d.research_design} onChange={(v) => upd("research_design", v)} placeholder="<<Define your Research Design>>" className="cfb-text--body" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="cfb-footer">
          <img src="/Hopscotch-4-all-logo-alpha.png" alt="Hopscotch" className="cfb-footer__logo" />
          <HopGridLoader className="cfb-footer__grid" />
          <div className="cf-footer-cite"><VDCitation /></div>
        </div>
      </div>
    </div>
  );
}
