// src/StepResourcePanel.jsx

const STEP_GENIALLY = {
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

export default function StepResourcePanel({ activeStep }) {
  const url = STEP_GENIALLY[activeStep];

  if (!url) {
    return (
      <div className="embed-card">
        <h3 className="embed-title">Interactive resource</h3>
        <p className="embed-placeholder">
          No interactive resource has been configured for this step yet.
        </p>
      </div>
    );
  }

  return (
    <div className="embed-card">
      <div className="embed-frame-wrap">
        <iframe
          src={url}
          title={`Step ${activeStep} interactive resource`}
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
  );
}
