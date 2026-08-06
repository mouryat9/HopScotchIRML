// src/CFTemplateExtended.jsx
import React from "react";
import HopGridLoader from "./HopGridLoader";
import VDCitation from "./VDCitation";
import { useLang } from "./i18n.jsx";

/**
 * Template 3: Extended 3-column layout with central circle infographic.
 * Matches the "Hopscotch - Components of a Conceptual Framework" PPTX slide.
 */
export default function CFTemplateExtended({ d, upd, updTopic, updFramework, E }) {
  const { t } = useLang();
  return (
    <div className="cf-page">
      <div className="cfe-diagram">

        {/* ── Header: email/date left, research topic center, logo right ── */}
        <div className="cfe-header">
          <div className="cfe-header__meta">
            <div className="cf-identity">{t("cf.email")} <E value={d.email} onChange={(v) => upd("email", v)} className="cfe-text--meta" /></div>
            <div className="cf-identity">{t("cf.date")} <E value={d.date} onChange={(v) => upd("date", v)} className="cfe-text--meta" /></div>
          </div>
          <div className="cfe-header__topic">
            <strong>{t("cf.researchTopic")}</strong>&nbsp;
            <E value={d.topic} onChange={(v) => upd("topic", v)} placeholder={t("cf.ph.topic")} className="cfe-text--topic" />
          </div>
          <div className="cfe-header__spacer" aria-hidden="true" />
        </div>

        {/* ── 3-column body ── */}
        <div className="cfe-body">

          {/* ─── Left column: Topics + Personal Interests + Identity ─── */}
          <div className="cfe-col cfe-col--left">
            <div className="cfe-card cfe-card--topics">
              <div className="cfe-card__header">{t("cf.topicalResearch")}</div>
              <div className="cfe-card__body">
                {d.topics.map((topic, i) => (
                  <div key={`t${i}`} className="cfe-card__item">
                    <E value={topic} onChange={(v) => updTopic(i, v)} placeholder={t("cf.ph.topicN", { n: i + 1 })} className="cfe-text--body" />
                  </div>
                ))}
              </div>
            </div>

            <div className="cfe-card cfe-card--personal">
              <div className="cfe-card__header">{t("cf.personalGoals")}</div>
              <div className="cfe-card__body">
                <E value={d.personal_goals} onChange={(v) => upd("personal_goals", v)} placeholder={t("cf.ph.personal")} className="cfe-text--body" />
              </div>
            </div>

            <div className="cfe-card cfe-card--identity">
              <div className="cfe-card__header">{t("cf.identityCard")}</div>
              <div className="cfe-card__body">
                <E value={d.worldview} onChange={(v) => upd("worldview", v)} placeholder={t("cf.ph.worldview")} className="cfe-text--body" />
              </div>
            </div>
          </div>

          {/* ─── Center column: Lit Review + Circle Diagram + Research Design ─── */}
          <div className="cfe-col cfe-col--center">
            <div className="cfe-card cfe-card--litreview">
              <div className="cfe-card__header">{t("cf.litReview")}</div>
              <div className="cfe-card__body">
                <span className="cfe-card__label">{t("cf.gapsFound")}</span>
                <E value={d.gaps} onChange={(v) => upd("gaps", v)} placeholder={t("cf.ph.gaps")} className="cfe-text--body" />
              </div>
            </div>

            {/* Components infographic (decorative, static text) - hexagon core
                with contained component cards so text never overflows shapes. */}
            <div className="cfe-infographic">
              <div className="cfe-infographic__title">{t("cf.componentsTitle")}</div>

              <div className="cfe-cf">
                {/* Central hexagon core */}
                <div className="cfe-cf__core">
                  <div className="cfe-cf__hex">
                    <span className="cfe-cf__hex-label">{t("cf.title").split(" ").map((w, i) => (
                      <React.Fragment key={i}>{i > 0 && <br />}{w}</React.Fragment>
                    ))}</span>
                  </div>
                </div>

                {/* Five components - text lives inside cards, cannot spill out */}
                <div className="cfe-cf__grid">
                  {/* b = the node color mixed 30% into #e4e7ec, precomputed:
                      html2canvas cannot parse the color-mix() computed value,
                      which broke the Save PDF capture on this template. */}
                  {[
                    { c: "#1C4587", b: "#A8B6CE", t: t("cf.topicalResearch"), d: t("cf.node.topical") },
                    { c: "#1A8A7D", b: "#A7CBCB", t: t("cf.frameworks"), d: t("cf.node.theoretical") },
                    { c: "#BF9730", b: "#D9CFB4", t: t("cf.problem"), d: t("cf.node.problem") },
                    { c: "#8B3A3A", b: "#C9B3B7", t: t("cf.design"), d: t("cf.node.design") },
                    { c: "#6AA84F", b: "#BFD4BD", t: t("cf.personalConnection"), d: t("cf.node.personal") },
                  ].map((n) => (
                    <div className="cfe-cf__node" key={n.t} style={{ "--node-color": n.c, "--node-border": n.b }}>
                      <span className="cfe-cf__node-title">{n.t}</span>
                      <span className="cfe-cf__node-desc">{n.d}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cfe-infographic__citation">
                {t("cf.quote")}
              </div>
            </div>

            {/* Research Design with flanking arrows */}
            <div className="cfe-design-row">
              <div className="cfe-design-arrow cfe-design-arrow--right">&#9654;</div>
              <div className="cfe-card cfe-card--design">
                <div className="cfe-card__header">{t("cf.design")}</div>
                <div className="cfe-card__body">
                  <E value={d.research_design} onChange={(v) => upd("research_design", v)} placeholder={t("cf.ph.design")} className="cfe-text--body" />
                </div>
              </div>
              <div className="cfe-design-arrow cfe-design-arrow--left">&#9664;</div>
            </div>
          </div>

          {/* ─── Right column: Frameworks + Problem Statement + Research Questions ─── */}
          <div className="cfe-col cfe-col--right">
            <div className="cfe-card cfe-card--frameworks">
              <div className="cfe-card__header">{t("cf.frameworks")}</div>
              <div className="cfe-card__body">
                {d.frameworks.map((f, i) => (
                  <div key={`f${i}`} className="cfe-card__item">
                    <E value={f} onChange={(v) => updFramework(i, v)} placeholder={t("cf.ph.frameworkN", { n: i + 1 })} className="cfe-text--body" />
                  </div>
                ))}
              </div>
            </div>

            <div className="cfe-card cfe-card--problem">
              <div className="cfe-card__header">{t("cf.problem")}</div>
              <div className="cfe-card__body">
                <E value={d.problem_statement} onChange={(v) => upd("problem_statement", v)} placeholder={t("cf.ph.problem")} className="cfe-text--body" />
              </div>
            </div>

            <div className="cfe-card cfe-card--questions">
              <div className="cfe-card__header">{t("cf.questions")}</div>
              <div className="cfe-card__body">
                <E value={d.research_questions} onChange={(v) => upd("research_questions", v)} placeholder={t("cf.ph.questions")} className="cfe-text--body" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer strip: white space below the design with the logo + citation ── */}
        <div className="cfe-footer">
          <div className="cfe-footer__brand">
            <img src="/Hopscotch-4-all-logo-alpha.png" alt="Hopscotch" className="cfe-header__logo-img" />
            <HopGridLoader className="cfe-header__grid" />
          </div>
          <div className="cf-footer-cite"><VDCitation /></div>
        </div>
      </div>
    </div>
  );
}
