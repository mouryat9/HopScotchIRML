// src/StepResourcePanel.jsx
import { useState } from "react";

const STEP_VIDEOS = {
  1: "https://share.synthesia.io/embeds/videos/29442014-85bd-4e46-993b-c27216013d33",
  2: "https://share.synthesia.io/embeds/videos/bbc3d87a-2b09-4920-a3f8-bc6b868717bf",
  3: "https://share.synthesia.io/embeds/videos/a451443c-e24e-466f-8fea-7c084b0afddf",
  4: "https://share.synthesia.io/embeds/videos/9504ed58-2e8c-468f-b034-9f131594d9ff",
  5: "https://share.synthesia.io/embeds/videos/53d60b55-659c-4cf7-bf76-2161982d24b1",
  6: "https://share.synthesia.io/embeds/videos/321e953d-68e2-4bdd-8a24-5fe3c5951618",
  7: "https://share.synthesia.io/embeds/videos/97b73f09-c293-4416-b8a1-232bd18cb3a7",
  8: "https://share.synthesia.io/embeds/videos/80fa7610-b9f2-481f-8160-e9086db5ef63",
  9: "https://share.synthesia.io/embeds/videos/d9104c4d-75cd-4fde-bf9a-c5c85c7ad706",
};

const STEP_GENIALLY_HIGH_SCHOOL = {
  1: "https://view.genially.com/6626b5edb31fe80014324408",
  2: "https://view.genially.com/6626b5ff75024b0014c9c279",
  3: "https://view.genially.com/6626b64db31fe8001432844c",
  4: "https://view.genially.com/6626b6648a9b7d0014fd0809",
  5: "https://view.genially.com/6626b6792aa762001439fe8f",
  6: "https://view.genially.com/6626b6a92b4ff00014385a51",
  7: "https://view.genially.com/6626b6c22b4ff000143872e2",
  8: "https://view.genially.com/6626b6e02b4ff0001438901b",
  9: "https://view.genially.com/6626b6f22aa76200143a6d36",
};

const STEP_GENIALLY_HIGHER_ED = {
  1: "https://view.genially.com/5f37277f06a4070d7cba0c5d",
  2: "https://view.genially.com/5f37f51e5635db0d754e977c",
  3: "https://view.genially.com/5f4e7d0234ffdc0d8de5b73a",
  4: "https://view.genially.com/5f5ab6efe232c50d95078afd",
  5: "https://view.genially.com/5f5abc6775c8e90d887bb76b",
  6: "https://view.genially.com/5f614bfe8cc8340d8feec7fe",
  7: "https://view.genially.com/5f9ae42970a5c30cfcf89865/vertical-infographic-step-7-data-analysis",
  8: "https://view.genially.com/5f614daa8cc8340d8feec81d/vertical-infographic-step-8-trustworthiness-and-validity",
  9: "https://view.genially.com/5f614e378cc8340d8feec824",
};

export default function StepResourcePanel({ activeStep, educationLevel = "high_school" }) {
  const isHighSchool = educationLevel !== "higher_ed";
  const hasVideos = isHighSchool;

  const [tab, setTab] = useState(hasVideos ? "video" : "resource");

  const videoUrl = STEP_VIDEOS[activeStep];
  const geniallyUrls = isHighSchool ? STEP_GENIALLY_HIGH_SCHOOL : STEP_GENIALLY_HIGHER_ED;
  const geniallyUrl = geniallyUrls[activeStep];

  // Higher ed: just show the Genially embed, no tabs
  if (!hasVideos) {
    return (
      <div className="embed-card">
        <div className="embed-frame-wrap">
          {geniallyUrl ? (
            <iframe
              src={geniallyUrl}
              title={`Step ${activeStep} interactive resource`}
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <p className="embed-placeholder">No interactive resource available for this step yet.</p>
          )}
        </div>
      </div>
    );
  }

  // High school: video + interactive resource tabs
  return (
    <div className="embed-card">
      <div className="embed-tabs">
        <button
          className={`embed-tabs__btn${tab === "video" ? " embed-tabs__btn--active" : ""}`}
          onClick={() => setTab("video")}
        >
          Video
        </button>
        <button
          className={`embed-tabs__btn${tab === "resource" ? " embed-tabs__btn--active" : ""}`}
          onClick={() => setTab("resource")}
        >
          Interactive Resource
        </button>
      </div>

      <div className="embed-frame-wrap">
        {tab === "video" && videoUrl && (
          <iframe
            src={videoUrl}
            title={`Step ${activeStep} video`}
            loading="lazy"
            allowFullScreen
            allow="encrypted-media; fullscreen; microphone; screen-wake-lock;"
          />
        )}
        {tab === "resource" && geniallyUrl && (
          <iframe
            src={geniallyUrl}
            title={`Step ${activeStep} interactive resource`}
            loading="lazy"
            allowFullScreen
          />
        )}
        {tab === "video" && !videoUrl && (
          <p className="embed-placeholder">No video available for this step yet.</p>
        )}
        {tab === "resource" && !geniallyUrl && (
          <p className="embed-placeholder">No interactive resource available for this step yet.</p>
        )}
      </div>
    </div>
  );
}
