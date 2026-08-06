// src/CFTemplateBoxed.jsx
import React from "react";
import HopGridLoader from "./HopGridLoader";
import VDCitation from "./VDCitation";
import { useLang } from "./i18n.jsx";

/**
 * Template 2: Boxed/card layout - rectangular sections with a flowchart
 * arrangement. Matches the "Hopscotch Create your Research Design" PPTX slide.
 */
export default function CFTemplateBoxed({ d, upd, updTopic, updFramework, E }) {
  const { t } = useLang();
  return (
    <div className="cf-page">
      <div className="cfb-diagram">

        {/* ── Header row: email/date left, CF name right ── */}
        <div className="cfb-header">
          <div className="cfb-header__meta">
            <div className="cf-identity">{t("cf.email")} <E value={d.email} onChange={(v) => upd("email", v)} className="cfb-text--meta" /></div>
            <div className="cf-identity">{t("cf.date")} <E value={d.date} onChange={(v) => upd("date", v)} className="cfb-text--meta" /></div>
          </div>
          <div className="cfb-header__title">{t("cf.title")}</div>
        </div>

        {/* ── Main content area: sidebar + main flow ── */}
        <div className="cfb-content">

          {/* Left sidebar: Personal Interests + connector + Identity */}
          <div className="cfb-sidebar">
            <div className="cfb-card cfb-card--personal">
              <div className="cfb-card__header cfb-card__header--red">{t("cf.personalGoals")}</div>
              <div className="cfb-card__body">
                <E value={d.personal_goals} onChange={(v) => upd("personal_goals", v)} placeholder={t("cf.ph.personal")} className="cfb-text--body" />
              </div>
            </div>

            {/* Vertical connector + right arrow at midpoint */}
            <div className="cfb-connector-mid">
              <div className="cfb-connector-v" />
              <div className="cfb-arrow-right cfb-arrow-right--connector">&#8594;</div>
            </div>

            <div className="cfb-card cfb-card--identity">
              <div className="cfb-card__header cfb-card__header--yellow">{t("cf.identityCard")}</div>
              <div className="cfb-card__body">
                <E value={d.worldview} onChange={(v) => upd("worldview", v)} placeholder={t("cf.ph.worldview")} className="cfb-text--body" />
              </div>
            </div>
          </div>

          {/* Main flow column */}
          <div className="cfb-main">

            {/* Literature Review teal banner */}
            <div className="cfb-lit-banner">{t("cf.litReview")}</div>

            {/* 3-column literature review area with border */}
            <div className="cfb-lit-area">
              {/* Topical Research column (light blue bg) */}
              <div className="cfb-col cfb-col--topics">
                <div className="cfb-col__heading">{t("cf.topicalResearch")}</div>
                {d.topics.map((topic, i) => (
                  <div key={`t${i}`} className="cfb-col__item">
                    <E value={topic} onChange={(v) => updTopic(i, v)} placeholder={t("cf.ph.topicN", { n: i + 1 })} className="cfb-text--body" />
                  </div>
                ))}
              </div>

              {/* Research Topic (center, dark blue rounded rect) */}
              <div className="cfb-col cfb-col--center">
                <div className="cfb-topic-box">
                  <span className="cfb-topic-box__label">{t("cf.researchTopic")}</span>
                  <E value={d.topic} onChange={(v) => upd("topic", v)} placeholder={t("cf.ph.topic")} className="cf-text--light cfb-text--body" />
                </div>
              </div>

              {/* Theoretical Frameworks column (mauve bg) */}
              <div className="cfb-col cfb-col--frameworks">
                <div className="cfb-col__heading">{t("cf.frameworks")}</div>
                {d.frameworks.map((f, i) => (
                  <div key={`f${i}`} className="cfb-col__item">
                    <E value={f} onChange={(v) => updFramework(i, v)} placeholder={t("cf.ph.frameworkN", { n: i + 1 })} className="cfb-text--body" />
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow down */}
            <div className="cfb-arrow-down">&#8595;</div>

            {/* Gap/s Found */}
            <div className="cfb-flow-box cfb-flow-box--gaps">
              <span className="cfb-flow-box__label">{t("cf.gapsFound")}</span>
              <E value={d.gaps} onChange={(v) => upd("gaps", v)} placeholder={t("cf.ph.gaps")} className="cfb-text--body" />
            </div>

            {/* Arrow down */}
            <div className="cfb-arrow-down">&#8595;</div>

            {/* Problem Statement */}
            <div className="cfb-flow-box cfb-flow-box--problem">
              <span className="cfb-flow-box__label">{t("cf.problem")}:</span>
              <E value={d.problem_statement} onChange={(v) => upd("problem_statement", v)} placeholder={t("cf.ph.problem")} className="cfb-text--body" />
            </div>

            {/* Arrow down */}
            <div className="cfb-arrow-down">&#8595;</div>

            {/* Bottom row: Research Questions → Research Design */}
            <div className="cfb-bottom-row">
              <div className="cfb-flow-box cfb-flow-box--questions">
                <span className="cfb-flow-box__label">{t("cf.questions")}:</span>
                <E value={d.research_questions} onChange={(v) => upd("research_questions", v)} placeholder={t("cf.ph.questions")} className="cfb-text--body" />
              </div>
              <div className="cfb-arrow-right">&#8594;</div>
              <div className="cfb-flow-box cfb-flow-box--design">
                <span className="cfb-flow-box__label">{t("cf.design")}:</span>
                <E value={d.research_design} onChange={(v) => upd("research_design", v)} placeholder={t("cf.ph.design")} className="cfb-text--body" />
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
