// src/TabbedPanel.jsx

const TABS = [
  { id: "resource", label: "Resource" },
  { id: "details", label: "Step Details" },
  { id: "chat", label: "Chat" },
];

export default function TabbedPanel({ activeTab, onTabChange, variant = "pill", children }) {
  return (
    <div className="tabbed-panel">
      <div className={`panel-tabs--${variant}`}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`panel-tabs__btn${activeTab === tab.id ? " panel-tabs__btn--active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
}
