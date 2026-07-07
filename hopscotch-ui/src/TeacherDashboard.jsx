// src/TeacherDashboard.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { API } from "./api";
import StudentDesignView from "./StudentDesignView";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const STEP_LABELS = [
  "Worldview", "Topic", "Literature", "Methodology", "Question",
  "Data", "Analysis", "Trustworthiness", "Ethics",
];

const STEP_COLORS = [
  "#2B5EA7", "#E8618C", "#D94040", "#1A8A7D", "#B0A47A",
  "#00AEEF", "#F0B429", "#F5922A", "#7B8794",
];

// Class avatar helpers — deterministic initials + color for a professional anchor
const CLASS_COLORS = [
  "#2B5EA7", "#1A8A7D", "#7A4FBF", "#C0562B", "#3D7A2E",
  "#B0842A", "#0E7490", "#B23A6E",
];
function classInitials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "C";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
function classColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CLASS_COLORS[h % CLASS_COLORS.length];
}

// Access/pacing (Phase 2) — 9 steps grouped into 3 phases (mirrors backend)
const ACCESS_MODES = [
  { id: "full", label: "Full access" },
  { id: "step", label: "Step-by-step" },
  { id: "phase", label: "Phase unlock" },
];
const ACCESS_PHASES = [
  { n: 1, label: "Phase 1", name: "Foundations", range: "Steps 1–3" },
  { n: 2, label: "Phase 2", name: "Design & Data", range: "Steps 4–6" },
  { n: 3, label: "Phase 3", name: "Analysis & Integrity", range: "Steps 7–9" },
];

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const ts = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function TeacherDashboard({ onOpenDesigns }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState("classes");

  // Class management state
  const [classes, setClasses] = useState([]);
  const [className, setClassName] = useState("");
  const [studentCount, setStudentCount] = useState(10);
  const [classPassword, setClassPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [createResult, setCreateResult] = useState(null);
  const [classError, setClassError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedClass, setExpandedClass] = useState(null);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Student progress state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [progressFilter, setProgressFilter] = useState("all");

  // Student design view overlay
  const [viewingStudent, setViewingStudent] = useState(null); // { session_id, name, class_name }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingClasses(true);
      try {
        const data = await API.getTeacherClasses();
        if (!cancelled) setClasses(data.classes || []);
      } catch (e) {
        console.error("Failed to load classes:", e);
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function loadSessions() {
    setLoadingSessions(true);
    setSessionsError("");
    try {
      const data = await API.getStudentSessions();
      setSessions(data.sessions || []);
    } catch (e) {
      setSessionsError("Failed to load student sessions.");
      console.error(e);
    } finally {
      setLoadingSessions(false);
    }
  }

  function handleTabChange(t) {
    setTab(t);
    if (t === "progress" && sessions.length === 0) {
      loadSessions();
    }
  }

  async function handleCreateClass(e) {
    e.preventDefault();
    if (creatingRef.current) return;
    creatingRef.current = true;
    setClassError("");
    setCreateResult(null);
    setCreating(true);
    try {
      const data = await API.createClass({
        class_name: className,
        student_count: studentCount,
        password: classPassword,
      });
      setCreateResult(data);
      setClassName("");
      setStudentCount(10);
      setClassPassword("");
      try {
        const fresh = await API.getTeacherClasses();
        setClasses(fresh.classes || []);
      } catch {}
    } catch (err) {
      setClassError(err.message || "Failed to create class");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  // Copy-to-clipboard for class credentials (small professional touch)
  const [copied, setCopied] = useState(null); // `${class_id}:${field}`
  async function copyValue(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
    } catch {}
  }

  const [detailClass, setDetailClass] = useState(null); // class object shown in the detail modal

  function closeCreate() {
    setShowCreate(false);
    setCreateResult(null);
    setClassError("");
    setClassName("");
    setStudentCount(10);
    setClassPassword("");
  }

  // Profile dropdown (top-right)
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  // Teacher-controlled AI mode: turn the assistant on/off for a whole class.
  const [savingSettings, setSavingSettings] = useState(null); // class_id being saved
  async function toggleClassAI(cls) {
    const next = !(cls.settings?.ai_enabled ?? true);
    setSavingSettings(cls.class_id);
    // Optimistic update
    setClasses((prev) => prev.map((c) =>
      c.class_id === cls.class_id
        ? { ...c, settings: { ...(c.settings || {}), ai_enabled: next } }
        : c
    ));
    try {
      const res = await API.updateClassSettings(cls.class_id, { ai_enabled: next });
      setClasses((prev) => prev.map((c) =>
        c.class_id === cls.class_id ? { ...c, settings: res.settings } : c
      ));
    } catch (err) {
      // Revert on failure
      setClasses((prev) => prev.map((c) =>
        c.class_id === cls.class_id
          ? { ...c, settings: { ...(c.settings || {}), ai_enabled: !next } }
          : c
      ));
      setClassError(err.message || "Failed to update AI setting");
    } finally {
      setSavingSettings(null);
    }
  }

  // Generic class-settings patch (access mode, phase unlock, …) with optimistic update.
  async function patchClassSettings(cls, patch) {
    setSavingSettings(cls.class_id);
    setClasses((prev) => prev.map((c) =>
      c.class_id === cls.class_id ? { ...c, settings: { ...(c.settings || {}), ...patch } } : c
    ));
    try {
      const res = await API.updateClassSettings(cls.class_id, patch);
      setClasses((prev) => prev.map((c) =>
        c.class_id === cls.class_id ? { ...c, settings: res.settings } : c
      ));
    } catch (err) {
      setClassError(err.message || "Failed to update settings");
      try { const fresh = await API.getTeacherClasses(); setClasses(fresh.classes || []); } catch {}
    } finally {
      setSavingSettings(null);
    }
  }

  function handlePrintCredentials(cls) {
    const win = window.open("", "_blank");
    if (!win) return;
    const students = cls.students || [];
    const pw = cls.password || "N/A";
    win.document.write(`
      <html><head><title>Class Credentials: ${cls.class_name}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 2rem; color: #1a2332; }
        h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
        .meta { color: #6b7280; font-size: 0.9rem; margin-bottom: 1.5rem; }
        .meta strong { color: #1a2332; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 0.9rem; }
        th { font-weight: 600; background: #f9fafb; }
        .note { margin-top: 1.5rem; font-size: 0.8rem; color: #6b7280; }
        @media print { .note { page-break-before: avoid; } }
      </style></head><body>
      <h1>${cls.class_name}</h1>
      <div class="meta">Class Code: <strong>${cls.class_code}</strong> &nbsp;|&nbsp; Password: <strong>${pw}</strong></div>
      <table>
        <thead><tr><th>#</th><th>Username</th><th>Password</th><th>Student Name</th></tr></thead>
        <tbody>
          ${students.map((s, i) => `<tr><td>${i + 1}</td><td>${s.username}</td><td>${pw}</td><td>${s.name}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="note">Students log in at hopscotchai.us using their username and the shared class password.</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  // Summary stats
  const totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0);
  const filteredSessions = progressFilter === "all"
    ? sessions
    : sessions.filter((s) => s.class_code === progressFilter);

  // Unique class codes from sessions for filter dropdown
  const sessionClassCodes = [...new Set(sessions.map((s) => s.class_code).filter(Boolean))];

  // Chart data — computed from filtered sessions so charts respond to class filter
  const chartData = useMemo(() => {
    if (filteredSessions.length === 0) return null;

    // 1. Step completion: how many students completed each step
    const stepCompletion = STEP_LABELS.map((label, i) => ({
      step: `S${i + 1}`,
      fullLabel: `Step ${i + 1}: ${label}`,
      students: filteredSessions.filter((s) => (s.completed_steps || []).includes(i + 1)).length,
      color: STEP_COLORS[i],
    }));

    // 2. Progress distribution: bucket students into ranges
    const buckets = { "Not Started": 0, "1-3 Steps": 0, "4-6 Steps": 0, "7-9 Steps": 0 };
    filteredSessions.forEach((s) => {
      const c = (s.completed_steps || []).length;
      if (c === 0) buckets["Not Started"]++;
      else if (c <= 3) buckets["1-3 Steps"]++;
      else if (c <= 6) buckets["4-6 Steps"]++;
      else buckets["7-9 Steps"]++;
    });
    const PIE_COLORS = ["#7B8794", "#F0B429", "#00AEEF", "#1A8A7D"];
    const progressDist = Object.entries(buckets).map(([name, value], i) => ({
      name, value, color: PIE_COLORS[i],
    })).filter((d) => d.value > 0);

    // 3. Class average progress — last 5 most recently active classes
    const classGroups = {};
    sessions.forEach((s) => {
      const key = s.class_name || s.class_code || "Unknown";
      if (!classGroups[key]) classGroups[key] = { counts: [], latest: null };
      classGroups[key].counts.push((s.completed_steps || []).length);
      const ts = s.updated_at || s.created_at;
      if (ts && (!classGroups[key].latest || ts > classGroups[key].latest)) {
        classGroups[key].latest = ts;
      }
    });
    const classAvg = Object.entries(classGroups)
      .map(([name, { counts, latest }]) => ({
        name,
        avg: Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10,
        students: counts.length,
        latest,
      }))
      .sort((a, b) => (b.latest || "").localeCompare(a.latest || ""))
      .slice(0, 5);

    return { stepCompletion, progressDist, classAvg };
  }, [filteredSessions, sessions]);

  const NAV_ITEMS = [
    { id: "classes", label: "My Classes", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    ) },
    { id: "progress", label: "Student Progress", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    ) },
  ];
  const pageTitle = tab === "classes" ? "My Classes" : "Student Progress";
  const pageSub = tab === "classes"
    ? "Create classes, share logins, and control each class's AI access."
    : "Track how your students are progressing through the 9-step research design.";

  return (
    <div className="td td--shell">
      <aside className="td-sidebar">
        <div className="td-sidebar__brand">
          <img
            src={theme === "dark" ? "/Hopscotch4-all-logo-White-alpha.png" : "/Hopscotch-4-all-logo-alpha.png"}
            alt="Hopscotch"
            className="td-sidebar__logo"
          />
        </div>
        <nav className="td-sidebar__nav">
          {NAV_ITEMS.map((t) => (
            <button
              key={t.id}
              className={`td-sidebar__item${tab === t.id ? " td-sidebar__item--active" : ""}`}
              onClick={() => handleTabChange(t.id)}
            >
              <span className="td-sidebar__item-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="td-main">
        <header className="td-main__head">
          <div className="td-main__headtext">
            <h1 className="td-main__title">{pageTitle}</h1>
            <p className="td-main__sub">{pageSub}</p>
          </div>
          <div className="td-main__actions">
            {onOpenDesigns && (
              <button className="td-btn td-btn--primary td-btn--sm" onClick={onOpenDesigns}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Design
              </button>
            )}
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? "☀" : "☾"}
            </button>
            {user && (
              <div className="hop-profile" ref={profileRef}>
                <button
                  className={`hop-profile__trigger${profileOpen ? " hop-profile__trigger--open" : ""}`}
                  onClick={() => setProfileOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  title={user.name}
                >
                  <span className="hop-user__avatar">{user.name?.charAt(0).toUpperCase()}</span>
                  <span className="hop-user__name">{user.name}</span>
                  <span className={`hop-profile__arrow${profileOpen ? " hop-profile__arrow--open" : ""}`}>&#9662;</span>
                </button>
                {profileOpen && (
                  <div className="hop-profile__menu" role="menu">
                    <div className="hop-profile__info">
                      <span className="hop-user__avatar hop-user__avatar--lg">{user.name?.charAt(0).toUpperCase()}</span>
                      <div className="hop-profile__info-text">
                        <span className="hop-profile__name">{user.name}</span>
                        <span className="hop-profile__email">{user.education_level === "higher_ed" ? "Faculty" : "Teacher"}</span>
                      </div>
                    </div>
                    <div className="hop-profile__sep" />
                    <button className="hop-profile__item" onClick={logout} role="menuitem">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

      {/* ── Summary stats ── */}
      <div className="td-stats">
        <div className="td-stats__card">
          <span className="td-stats__icon td-stats__icon--blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </span>
          <div className="td-stats__text">
            <span className="td-stats__number">{classes.length}</span>
            <span className="td-stats__label">Classes</span>
          </div>
        </div>
        <div className="td-stats__card">
          <span className="td-stats__icon td-stats__icon--green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          <div className="td-stats__text">
            <span className="td-stats__number">{totalStudents}</span>
            <span className="td-stats__label">Students</span>
          </div>
        </div>
        <div className="td-stats__card">
          <span className="td-stats__icon td-stats__icon--amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </span>
          <div className="td-stats__text">
            <span className="td-stats__number">{sessions.length}</span>
            <span className="td-stats__label">Active Sessions</span>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main className="td-content">

        {/* ===== MY CLASSES TAB ===== */}
        {tab === "classes" && (
          <div className="td-classes">
            {/* Class card grid */}
            <section className="td-section">
              <div className="td-section__head">
                <h2 className="td-section__title">
                  Your Classes
                  {!loadingClasses && <span className="td-section__count">{classes.length}</span>}
                </h2>
                <button
                  className="td-btn td-btn--primary td-btn--sm"
                  onClick={() => { setClassError(""); setCreateResult(null); setShowCreate(true); }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Class
                </button>
              </div>

              {loadingClasses && <p className="td-muted">Loading classes...</p>}

              <div className="td-cardgrid">
                {/* Add-class tile */}
                {!loadingClasses && (
                  <button
                    className="td-addcard"
                    onClick={() => { setClassError(""); setCreateResult(null); setShowCreate(true); }}
                  >
                    <span className="td-addcard__icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </span>
                    <span className="td-addcard__label">New Class</span>
                    <span className="td-addcard__desc">Auto-generate student logins</span>
                  </button>
                )}
                {!loadingClasses && classes.map((cls) => {
                  const students = cls.students || [];
                  const aiOn = cls.settings?.ai_enabled ?? true;
                  const saving = savingSettings === cls.class_id;
                  return (
                    <div className="td-ccard" key={cls.class_id}>
                      <div className="td-ccard__top">
                        <span className="td-ccard__avatar" style={{ background: classColor(cls.class_name) }}>
                          {classInitials(cls.class_name)}
                        </span>
                        <div className="td-ccard__titlewrap">
                          <div className="td-ccard__title" title={cls.class_name}>{cls.class_name}</div>
                          <span className="td-class__tag">{cls.class_code}</span>
                        </div>
                        <span className={`td-pill${aiOn ? " td-pill--on" : " td-pill--off"}`}>
                          <span className="td-pill__dot" /> AI {aiOn ? "On" : "Off"}
                        </span>
                      </div>

                      <div className="td-ccard__meta">
                        <span className="td-ccard__metaitem">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                          {students.length} students
                        </span>
                        <span className="td-ccard__metaitem td-ccard__metaitem--muted">
                          {cls.created_at ? new Date(cls.created_at).toLocaleDateString() : ""}
                        </span>
                      </div>

                      {/* AI toggle right on the card */}
                      <div className="td-ccard__ai">
                        <span className="td-ccard__ai-label">AI Assistant</span>
                        <button
                          type="button"
                          className={`td-switch${aiOn ? " td-switch--on" : ""}`}
                          role="switch"
                          aria-checked={aiOn}
                          aria-label="Toggle AI assistant for this class"
                          disabled={saving}
                          onClick={() => toggleClassAI(cls)}
                        >
                          <span className="td-switch__track"><span className="td-switch__thumb" /></span>
                          <span className="td-switch__state">{saving ? "…" : aiOn ? "On" : "Off"}</span>
                        </button>
                      </div>

                      <div className="td-ccard__actions">
                        <button className="td-btn td-btn--outline td-btn--sm" onClick={() => setDetailClass(cls)}>
                          Manage
                        </button>
                        <button className="td-btn td-btn--ghost td-btn--sm" onClick={() => handlePrintCredentials(cls)}>
                          Print
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ===== STUDENT PROGRESS TAB ===== */}
        {tab === "progress" && (
          <div className="td-progress">
            {/* Filter bar */}
            {sessions.length > 0 && sessionClassCodes.length > 0 && (
              <div className="td-progress__filter">
                <label className="td-progress__filter-label">Filter by class:</label>
                <select
                  className="td-progress__select"
                  value={progressFilter}
                  onChange={(e) => setProgressFilter(e.target.value)}
                >
                  <option value="all">All Classes</option>
                  {sessionClassCodes.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Charts */}
            {!loadingSessions && chartData && (
              <h2 className="td-section__title td-section__title--progress">Class Overview</h2>
            )}
            {!loadingSessions && chartData && (
              <div className="td-charts">
                {/* Step Completion Bar Chart */}
                <div className="td-chart-card">
                  <h3 className="td-chart-card__title">Step Completion Overview</h3>
                  <p className="td-chart-card__desc">Number of students who completed each step</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData.stepCompletion} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border)" />
                      <XAxis dataKey="step" tick={{ fontSize: 11, fill: "var(--hop-muted)" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--hop-muted)" }} />
                      <Tooltip
                        formatter={(val, _, props) => [`${val} students`, props.payload.fullLabel]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--hop-border)" }}
                      />
                      <Bar dataKey="students" radius={[4, 4, 0, 0]}>
                        {chartData.stepCompletion.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Progress Distribution Donut */}
                <div className="td-chart-card">
                  <h3 className="td-chart-card__title">Progress Distribution</h3>
                  <p className="td-chart-card__desc">Where students are in the 9-step process</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={chartData.progressDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartData.progressDist.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => [`${val} students`]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Class Average Progress */}
                {chartData.classAvg.length > 1 && (
                  <div className="td-chart-card td-chart-card--wide">
                    <h3 className="td-chart-card__title">Average Progress by Class</h3>
                    <p className="td-chart-card__desc">Average steps completed per class</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData.classAvg} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--hop-muted)" }} />
                        <YAxis domain={[0, 9]} tick={{ fontSize: 11, fill: "var(--hop-muted)" }} />
                        <Tooltip
                          formatter={(val, _, props) => [`${val} avg steps (${props.payload.students} students)`]}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--hop-border)" }}
                        />
                        <Bar dataKey="avg" fill="#6C63FF" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {loadingSessions && <p className="td-muted">Loading student sessions...</p>}
            {sessionsError && <div className="td-alert td-alert--error">{sessionsError}</div>}

            {!loadingSessions && sessions.length === 0 && !sessionsError && (
              <div className="td-empty">
                <p>No student sessions found yet. Students need to log in and start working first.</p>
              </div>
            )}

            {!loadingSessions && filteredSessions.length > 0 && (
              <h2 className="td-section__title td-section__title--progress">
                Students
                <span className="td-section__count">{filteredSessions.length}</span>
              </h2>
            )}

            {!loadingSessions && filteredSessions.length > 0 && (
              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Worldview</th>
                      <th>Path</th>
                      <th>Current Step</th>
                      <th>Progress</th>
                      <th>Last Activity</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((s, i) => {
                      const completed = s.completed_steps || [];
                      const pct = Math.round((completed.length / 9) * 100);
                      return (
                        <tr key={s.session_id || `student-${s.user?.username || i}`} className={!s.session_id ? "td-table__row--inactive" : ""}>
                          <td>
                            <div className="td-table__student">
                              <span className="td-table__student-avatar">
                                {(s.user?.name || "?").charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <div className="td-table__name">{s.user?.name || "\u2014"}</div>
                                <div className="td-table__mono">{s.user?.username || s.user?.email || ""}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {s.class_name ? (
                              <span className="td-class__tag">{s.class_name}</span>
                            ) : "\u2014"}
                          </td>
                          <td>{s.worldview_label || "\u2014"}</td>
                          <td className="td-table__cap">{s.resolved_path || "\u2014"}</td>
                          <td>
                            {!s.session_id ? (
                              <span className="td-table__not-started">Not started</span>
                            ) : s.active_step ? (
                              <span className="td-step-badge" style={{ borderLeftColor: STEP_COLORS[s.active_step - 1] || "#ccc" }}>
                                Step {s.active_step}: {STEP_LABELS[s.active_step - 1] || ""}
                              </span>
                            ) : "\u2014"}
                          </td>
                          <td>
                            <div className="td-progress-cell">
                              <div className="td-progress-bar">
                                <div className="td-progress-bar__fill" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="td-progress-dots">
                                {STEP_LABELS.map((label, si) => (
                                  <span
                                    key={si}
                                    className={`td-dots__dot${completed.includes(si + 1) ? " td-dots__dot--done" : ""}${s.active_step === si + 1 ? " td-dots__dot--active" : ""}`}
                                    title={`Step ${si + 1}: ${label}${completed.includes(si + 1) ? " (completed)" : ""}`}
                                    style={completed.includes(si + 1) ? { background: STEP_COLORS[si] } : {}}
                                  />
                                ))}
                              </div>
                              <span className="td-progress-pct">{completed.length}/9</span>
                            </div>
                          </td>
                          <td className="td-table__muted">
                            {!s.session_id ? "Never" : timeAgo(s.updated_at || s.created_at)}
                          </td>
                          <td>
                            {s.session_id && (
                              <button
                                className="td-btn td-btn--outline td-btn--sm"
                                onClick={() => setViewingStudent({
                                  session_id: s.session_id,
                                  name: s.user?.username || s.user?.name || "Student",
                                  class_name: s.class_name || "",
                                })}
                              >
                                View
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
      </div>

      {/* Student Design View overlay */}
      {viewingStudent && (
        <StudentDesignView
          sessionId={viewingStudent.session_id}
          studentName={viewingStudent.name}
          className={viewingStudent.class_name}
          onClose={() => setViewingStudent(null)}
        />
      )}

      {/* Class detail modal */}
      {detailClass && (() => {
        const live = classes.find((c) => c.class_id === detailClass.class_id) || detailClass;
        const students = live.students || [];
        const aiOn = live.settings?.ai_enabled ?? true;
        const saving = savingSettings === live.class_id;
        return (
          <div className="td-modal" onMouseDown={() => setDetailClass(null)}>
            <div className="td-modal__card" onMouseDown={(e) => e.stopPropagation()}>
              <div className="td-modal__head">
                <span className="td-ccard__avatar" style={{ background: classColor(live.class_name) }}>
                  {classInitials(live.class_name)}
                </span>
                <div className="td-modal__headtext">
                  <h3 className="td-modal__title">{live.class_name}</h3>
                  <span className="td-class__tag">{live.class_code}</span>
                </div>
                <button className="td-modal__close" onClick={() => setDetailClass(null)} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div className="td-modal__body">
                {/* Credentials */}
                <div className="td-cred">
                  {[
                    { label: "Class code", value: live.class_code, field: "code" },
                    { label: "Shared password", value: live.password || "Not available", field: "pw" },
                  ].map(({ label, value, field }) => {
                    const key = `${live.class_id}:${field}`;
                    return (
                      <div className="td-cred__item" key={field}>
                        <span className="td-cred__label">{label}</span>
                        <div className="td-cred__value">
                          <code>{value}</code>
                          <button type="button" className="td-copy" onClick={() => copyValue(value, key)} title={`Copy ${label.toLowerCase()}`}>
                            {copied === key ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI toggle */}
                <div className="td-mode-row">
                  <div className="td-mode-row__text">
                    <span className="td-mode-row__label">AI Assistant</span>
                    <span className="td-mode-row__desc">
                      {aiOn
                        ? "Students can use the AI research assistant."
                        : "AI is off — students work on their own. Turn it on when they're ready."}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`td-switch${aiOn ? " td-switch--on" : ""}`}
                    role="switch"
                    aria-checked={aiOn}
                    aria-label="Toggle AI assistant for this class"
                    disabled={saving}
                    onClick={() => toggleClassAI(live)}
                  >
                    <span className="td-switch__track"><span className="td-switch__thumb" /></span>
                    <span className="td-switch__state">{saving ? "…" : aiOn ? "On" : "Off"}</span>
                  </button>
                </div>

                {/* Access / pacing mode */}
                {(() => {
                  const mode = live.settings?.access_mode || "full";
                  const up = live.settings?.unlocked_phase || 1;
                  return (
                    <div className="td-access">
                      <div className="td-mode-row__text" style={{ marginBottom: 8 }}>
                        <span className="td-mode-row__label">Student access</span>
                        <span className="td-mode-row__desc">Control which steps students can work on.</span>
                      </div>
                      <div className="td-segment">
                        {ACCESS_MODES.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`td-segment__btn${mode === opt.id ? " td-segment__btn--active" : ""}`}
                            disabled={saving}
                            onClick={() => patchClassSettings(live, {
                              access_mode: opt.id,
                              ...(opt.id === "phase" && !live.settings?.unlocked_phase ? { unlocked_phase: 1 } : {}),
                            })}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {mode === "step" && (
                        <p className="td-access__hint">Students must complete each step before the next one unlocks.</p>
                      )}

                      {mode === "phase" && (
                        <div className="td-phases">
                          {ACCESS_PHASES.map((ph) => {
                            const unlocked = up >= ph.n;
                            return (
                              <button
                                key={ph.n}
                                type="button"
                                className={`td-phase${unlocked ? " td-phase--unlocked" : ""}`}
                                disabled={saving}
                                onClick={() => patchClassSettings(live, { unlocked_phase: ph.n })}
                                title={`Unlock through ${ph.label}`}
                              >
                                <span className="td-phase__icon">{unlocked ? "🔓" : "🔒"}</span>
                                <span className="td-phase__text">
                                  <span className="td-phase__label">{ph.label} · {ph.name}</span>
                                  <span className="td-phase__range">{ph.range}</span>
                                </span>
                              </button>
                            );
                          })}
                          <p className="td-access__hint">Click a phase to unlock everything up to and including it.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Roster */}
                <div className="td-class__subhead">
                  Student logins <span className="td-class__count-mini">{students.length}</span>
                </div>
                <div className="td-roster">
                  {students.map((s) => (
                    <span className="td-roster__chip" key={s.username}>{s.username}</span>
                  ))}
                </div>
              </div>

              <div className="td-modal__foot">
                <button className="td-btn td-btn--outline td-btn--sm" onClick={() => handlePrintCredentials(live)}>
                  Print Credentials
                </button>
                <button className="td-btn td-btn--primary td-btn--sm" onClick={() => setDetailClass(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create class modal */}
      {showCreate && (
        <div className="td-modal" onMouseDown={closeCreate}>
          <div className="td-modal__card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="td-modal__head">
              <div className="td-modal__headtext">
                <h3 className="td-modal__title">{createResult ? "Class created" : "Create a new class"}</h3>
                {!createResult && (
                  <span className="td-modal__subtitle">Student logins are auto-generated with your shared password.</span>
                )}
              </div>
              <button className="td-modal__close" onClick={closeCreate} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="td-modal__body">
              {!createResult ? (
                <form className="td-form" onSubmit={handleCreateClass}>
                  <div className="td-form__group">
                    <label className="td-form__label">Class Name</label>
                    <input
                      type="text"
                      className="td-form__input"
                      placeholder="e.g. Period 3 Research"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                  <div className="td-form__grid" style={{ marginTop: 12 }}>
                    <div className="td-form__group td-form__group--narrow">
                      <label className="td-form__label">Students</label>
                      <input
                        type="number"
                        className="td-form__input"
                        min={1}
                        max={100}
                        value={studentCount}
                        onChange={(e) => setStudentCount(parseInt(e.target.value) || 1)}
                        required
                      />
                    </div>
                    <div className="td-form__group td-form__group--grow">
                      <label className="td-form__label">Shared Password</label>
                      <input
                        type="text"
                        className="td-form__input"
                        placeholder="Password for all students"
                        value={classPassword}
                        onChange={(e) => setClassPassword(e.target.value)}
                        required
                        minLength={4}
                      />
                    </div>
                  </div>
                  {classError && <div className="td-alert td-alert--error" style={{ marginTop: 12 }}>{classError}</div>}
                  <div className="td-modal__foot td-modal__foot--inline">
                    <button type="button" className="td-btn td-btn--ghost td-btn--sm" onClick={closeCreate}>Cancel</button>
                    <button type="submit" className="td-btn td-btn--primary td-btn--sm" disabled={creating}>
                      {creating ? "Creating…" : "Create Class"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="td-cred">
                    {[
                      { label: "Class code", value: createResult.class_code, field: "code" },
                      { label: "Shared password", value: createResult.password, field: "pw" },
                    ].map(({ label, value, field }) => {
                      const key = `new:${field}`;
                      return (
                        <div className="td-cred__item" key={field}>
                          <span className="td-cred__label">{label}</span>
                          <div className="td-cred__value">
                            <code>{value}</code>
                            <button type="button" className="td-copy" onClick={() => copyValue(value, key)}>
                              {copied === key ? "Copied" : "Copy"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="td-class__subhead">
                    Student logins <span className="td-class__count-mini">{createResult.students?.length || 0}</span>
                  </div>
                  <div className="td-roster">
                    {(createResult.students || []).map((s) => (
                      <span className="td-roster__chip" key={s.username}>{s.username}</span>
                    ))}
                  </div>
                  <p className="td-modal__note">Share the class code and password with your students, or print the credentials.</p>
                </>
              )}
            </div>

            {createResult && (
              <div className="td-modal__foot">
                <button className="td-btn td-btn--outline td-btn--sm" onClick={() => handlePrintCredentials(createResult)}>
                  Print Credentials
                </button>
                <button className="td-btn td-btn--primary td-btn--sm" onClick={closeCreate}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
