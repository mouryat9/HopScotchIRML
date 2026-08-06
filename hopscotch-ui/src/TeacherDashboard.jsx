// src/TeacherDashboard.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { API } from "./api";
import StudentDesignView from "./StudentDesignView";
import ProfileMenu from "./ProfileMenu";
import SettingsModal from "./SettingsModal";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";

const STEP_LABELS = [
  "Worldview", "Topic", "Framework", "Design", "Research Questions",
  "Data", "Analysis", "Trustworthiness", "Ethics",
];

const STEP_COLORS = [
  "#2B5EA7", "#E8618C", "#D94040", "#1A8A7D", "#B0A47A",
  "#00AEEF", "#F0B429", "#F5922A", "#7B8794",
];

// Class avatar helpers - deterministic initials + color for a professional anchor
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

// Access/pacing (Phase 2) - 9 steps grouped into 3 phases (mirrors backend)
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
  const [classQuery, setClassQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
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
    // Sessions feed the per-class progress/activity shown on the class cards
    loadSessions();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-class stats for the card grid: average progress + last activity
  const classStats = useMemo(() => {
    const byCode = {};
    for (const s of sessions) {
      if (!s.class_code || !s.session_id) continue;
      const entry = byCode[s.class_code] || { pcts: [], last: "" };
      entry.pcts.push(((s.completed_steps || []).length / 9) * 100);
      const ts = s.updated_at || s.created_at || "";
      if (ts > entry.last) entry.last = ts;
      byCode[s.class_code] = entry;
    }
    const out = {};
    for (const [code, e] of Object.entries(byCode)) {
      out[code] = {
        avg: e.pcts.length ? Math.round(e.pcts.reduce((a, b) => a + b, 0) / e.pcts.length) : 0,
        active: e.pcts.length,
        last: e.last,
      };
    }
    return out;
  }, [sessions]);

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

  // Settings modal (shared with every page)
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  // Actionable dashboard tiles: who's working, who needs feedback, who finished
  const [progressFocus, setProgressFocus] = useState(null); // null | "week" | "feedback" | "done"
  const WEEK_MS = 7 * 24 * 3600 * 1000;
  const isThisWeek = (s) => {
    const ts = s.updated_at || s.created_at;
    if (!ts) return false;
    return Date.now() - new Date(ts.endsWith("Z") ? ts : ts + "Z").getTime() < WEEK_MS;
  };
  const needsFeedback = (s) =>
    !!s.session_id && (s.completed_steps || []).length > 0 &&
    (!s.last_feedback_at || (s.updated_at || "") > s.last_feedback_at);
  const isDone = (s) => (s.completed_steps || []).length === 9;
  const dashStats = useMemo(() => ({
    week: sessions.filter((s) => s.session_id && isThisWeek(s)).length,
    feedback: sessions.filter(needsFeedback).length,
    done: sessions.filter(isDone).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sessions]);

  const focusFiltered = (list) => {
    if (progressFocus === "week") return list.filter((s) => s.session_id && isThisWeek(s));
    if (progressFocus === "feedback") return list.filter(needsFeedback);
    if (progressFocus === "done") return list.filter(isDone);
    return list;
  };
  const filteredSessions = focusFiltered(progressFilter === "all"
    ? sessions
    : sessions.filter((s) => s.class_code === progressFilter));

  // Chart click-to-filter: charts drive the student table below
  const [chartFilter, setChartFilter] = useState(null); // {type:"step",step} | {type:"band",code,name,band}
  const BAND_LABELS = ["Not started", "Steps 1-3", "Steps 4-6", "Steps 7-9"];
  const BAND_COLORS = ["#B9C2CE", "#F0B429", "#00AEEF", "#1A8A7D"];
  const firstIncomplete = (s) => {
    const done = s.completed_steps || [];
    for (let n = 1; n <= 9; n++) if (!done.includes(n)) return n;
    return 10; // finished
  };
  const bandOf = (count) => (count === 0 ? 0 : count <= 3 ? 1 : count <= 6 ? 2 : 3);
  const applyChartFilter = (list) => {
    if (!chartFilter) return list;
    if (chartFilter.type === "step") {
      return list.filter((s) => s.session_id && firstIncomplete(s) === chartFilter.step);
    }
    return list.filter((s) =>
      (!chartFilter.code || s.class_code === chartFilter.code) &&
      bandOf((s.completed_steps || []).length) === chartFilter.band);
  };

  // Table rows: class-filtered sessions narrowed by chart clicks + search.
  // (Charts read filteredSessions, so clicking a chart filters the TABLE
  // without the chart filtering itself.)
  const sq = studentQuery.trim().toLowerCase();
  const chartFiltered = applyChartFilter(filteredSessions);
  const tableSessions = sq
    ? chartFiltered.filter((s) =>
        (s.user?.name || "").toLowerCase().includes(sq) ||
        (s.user?.username || "").toLowerCase().includes(sq) ||
        (s.user?.email || "").toLowerCase().includes(sq))
    : chartFiltered;

  // Unique class codes from sessions for filter dropdown
  const sessionClassCodes = [...new Set(sessions.map((s) => s.class_code).filter(Boolean))];

  // Chart data - computed from filtered sessions so charts respond to class filter
  const chartData = useMemo(() => {
    if (filteredSessions.length === 0) return null;

    // 1. Step completion: how many students completed each step
    const started = filteredSessions.filter((s) => s.session_id);
    const stepCompletion = STEP_LABELS.map((label, i) => ({
      step: `S${i + 1}`,
      stepNum: i + 1,
      fullLabel: `Step ${i + 1}: ${label}`,
      students: filteredSessions.filter((s) => (s.completed_steps || []).includes(i + 1)).length,
      pct: started.length ? filteredSessions.filter((s) => (s.completed_steps || []).includes(i + 1)).length / started.length : 0,
      color: STEP_COLORS[i],
    }));

    // Bottleneck: the step most students are currently working on
    const curCounts = Array(11).fill(0);
    for (const s of started) {
      const done = s.completed_steps || [];
      let cur = 10;
      for (let n = 1; n <= 9; n++) if (!done.includes(n)) { cur = n; break; }
      curCounts[cur]++;
    }
    let bottleneck = null;
    for (let n = 1; n <= 9; n++) {
      if (curCounts[n] > 0 && (bottleneck === null || curCounts[n] > curCounts[bottleneck])) bottleneck = n;
    }
    const bottleneckCount = bottleneck ? curCounts[bottleneck] : 0;

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

    // 3. Per-class progress distribution (stacked bands) - averages hide the
    // spread, so each class row shows how its students are distributed
    const classGroups = {};
    sessions.forEach((s) => {
      const key = s.class_name || s.class_code || "Unknown";
      if (!classGroups[key]) classGroups[key] = { counts: [], latest: null, code: s.class_code || "" };
      classGroups[key].counts.push((s.completed_steps || []).length);
      const ts = s.updated_at || s.created_at;
      if (ts && (!classGroups[key].latest || ts > classGroups[key].latest)) {
        classGroups[key].latest = ts;
      }
    });
    // Show ALL classes (scales to many), sorted by average progress
    const classAvg = Object.entries(classGroups)
      .map(([name, { counts, latest, code }]) => ({
        name,
        code,
        avg: Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10,
        students: counts.length,
        latest,
        b0: counts.filter((c) => c === 0).length,
        b1: counts.filter((c) => c >= 1 && c <= 3).length,
        b2: counts.filter((c) => c >= 4 && c <= 6).length,
        b3: counts.filter((c) => c >= 7).length,
      }))
      .sort((a, b) => b.avg - a.avg || (b.latest || "").localeCompare(a.latest || ""));

    const totalStudents = filteredSessions.length;
    return { stepCompletion, progressDist, classAvg, totalStudents, bottleneck, bottleneckCount, startedCount: started.length };
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
    ? `${classes.length} ${classes.length === 1 ? "class" : "classes"} · ${totalStudents} ${totalStudents === 1 ? "student" : "students"} - create classes, share logins, and control AI access.`
    : "Track how your students are progressing through the 9-step research design.";

  return (
    <div className="td-wrap">
      {/* Full-width top nav bar - matches the design page */}
      <header className="hop-header">
        <div className="hop-header__left">
          <img
            src={theme === "dark" ? "/Hopscotch4-all-logo-White-alpha.png" : "/Hopscotch-4-all-logo-alpha.png"}
            alt="Hopscotch 4 All"
            className="hop-logo"
          />
        </div>
        <div className="hop-header__right">
          {onOpenDesigns && (
            <button className="td-btn td-btn--primary td-btn--sm" onClick={onOpenDesigns}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Design
            </button>
          )}
          <span className="hop-header__divider" />
          <ProfileMenu
            user={user}
            onSignOut={logout}
            onOpenSettings={() => setSettingsOpen(true)}
            roleLabel={user?.education_level === "higher_ed" ? "Faculty" : "Teacher"}
          />
        </div>
      </header>

      <div className="td td--shell">
        <aside className="td-sidebar">
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
        </header>

      {/* ── Actionable tiles: who's working, who needs feedback, who finished ── */}
      <div className="td-stats">
        <button className="td-stats__card td-stats__card--action" onClick={() => { setProgressFocus("week"); handleTabChange("progress"); }}>
          <span className="td-stats__icon td-stats__icon--blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </span>
          <div className="td-stats__text">
            <span className="td-stats__number">{dashStats.week}</span>
            <span className="td-stats__label">Active this week</span>
            <span className="td-stats__hint">students working in the last 7 days</span>
          </div>
        </button>
        <button className="td-stats__card td-stats__card--action" onClick={() => { setProgressFocus("feedback"); handleTabChange("progress"); }}>
          <span className="td-stats__icon td-stats__icon--amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </span>
          <div className="td-stats__text">
            <span className="td-stats__number">{dashStats.feedback}</span>
            <span className="td-stats__label">Awaiting your feedback</span>
            <span className="td-stats__hint">progressed since you last commented</span>
          </div>
        </button>
        <button className="td-stats__card td-stats__card--action" onClick={() => { setProgressFocus("done"); handleTabChange("progress"); }}>
          <span className="td-stats__icon td-stats__icon--green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </span>
          <div className="td-stats__text">
            <span className="td-stats__number">{dashStats.done}</span>
            <span className="td-stats__label">Designs completed</span>
            <span className="td-stats__hint">all 9 steps finished</span>
          </div>
        </button>
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
                  All Classes
                  {!loadingClasses && <span className="td-section__count">{classes.length}</span>}
                </h2>
                <div className="td-section__head-actions">
                  <div className="td-search">
                    <svg className="td-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="text"
                      className="td-search__input"
                      placeholder="Search classes or students…"
                      value={classQuery}
                      onChange={(e) => setClassQuery(e.target.value)}
                      aria-label="Search classes"
                    />
                    {classQuery && (
                      <button className="td-search__clear" onClick={() => setClassQuery("")} aria-label="Clear search">×</button>
                    )}
                  </div>
                  <button
                    className="td-btn td-btn--primary td-btn--sm"
                    onClick={() => { setClassError(""); setCreateResult(null); setShowCreate(true); }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Class
                  </button>
                </div>
              </div>

              {loadingClasses && <p className="td-muted">Loading classes...</p>}

              {(() => {
                const q = classQuery.trim().toLowerCase();
                const shown = q
                  ? classes.filter((c) =>
                      (c.class_name || "").toLowerCase().includes(q) ||
                      (c.class_code || "").toLowerCase().includes(q) ||
                      (c.students || []).some((s) => (s.username || "").toLowerCase().includes(q)))
                  : classes;
                if (!loadingClasses && q && shown.length === 0) {
                  return <div className="td-empty">No classes match “{classQuery}”.</div>;
                }
                return (
              <div className="tdc-grid">
                {!loadingClasses && shown.map((cls, ci) => {
                  const students = cls.students || [];
                  const aiOn = cls.settings?.ai_enabled ?? true;
                  const saving = savingSettings === cls.class_id;
                  const COURT = ["#2B5EA7", "#E8618C", "#D94040", "#1A8A7D", "#B0A47A", "#00AEEF", "#F0B429", "#F5922A", "#7B8794"];
                  let h = 0;
                  for (let i = 0; i < (cls.class_code || "").length; i++) h = (h * 31 + cls.class_code.charCodeAt(i)) >>> 0;
                  const accent = COURT[h % COURT.length];
                  const stats = classStats[cls.class_code];
                  const shownAvatars = students.slice(0, 4);
                  return (
                    <div className="tdc-card" key={cls.class_id} style={{ "--tdc-accent": accent }}>
                      <div className="tdc-card__stripe" />
                      <div className="tdc-card__body">
                        <div className="tdc-card__top">
                          <button className="tdc-card__name" onClick={() => setDetailClass(cls)} title={`Manage ${cls.class_name}`}>
                            {cls.class_name}
                          </button>
                          <button
                            type="button"
                            className={`tdc-ai${aiOn ? " tdc-ai--on" : ""}`}
                            role="switch"
                            aria-checked={aiOn}
                            disabled={saving}
                            onClick={() => toggleClassAI(cls)}
                            title="Toggle the AI assistant for this class"
                          >
                            <span className="tdc-ai__dot" />
                            {saving ? "…" : aiOn ? "AI on" : "AI off"}
                          </button>
                        </div>

                        <div className="tdc-card__students">
                          <span className="tdc-avatars">
                            {shownAvatars.map((st, si) => (
                              <span className="tdc-avatar" key={st.username || si} style={{ background: COURT[(h + si) % COURT.length] }} title={st.username || st.name}>
                                {(st.username || st.name || "?").slice(-2)}
                              </span>
                            ))}
                            {students.length > 4 && <span className="tdc-avatar tdc-avatar--more">+{students.length - 4}</span>}
                          </span>
                          <span className="tdc-card__count">{students.length} student{students.length === 1 ? "" : "s"}</span>
                        </div>

                        <div className="tdc-card__progress">
                          <div className="tdc-bar" role="img" aria-label={stats ? `${stats.avg}% average progress` : "No activity yet"}>
                            <div className="tdc-bar__fill" style={{ width: `${stats ? stats.avg : 0}%` }} />
                          </div>
                          <span className="tdc-card__pct">
                            {stats ? `${stats.avg}% avg` : "No activity yet"}
                          </span>
                        </div>

                        <div className="tdc-card__meta">
                          <span className="tdc-card__code">code {cls.class_code}</span>
                          {stats?.last && <span>· active {timeAgo(stats.last)}</span>}
                        </div>

                        <div className="tdc-card__actions">
                          <button className="tdc-act" onClick={() => setDetailClass(cls)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                            Manage
                          </button>
                          <button className="tdc-act" onClick={() => { setProgressFilter(cls.class_code); handleTabChange("progress"); }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                            Progress
                          </button>
                          <button className="tdc-act tdc-act--icon" onClick={() => handlePrintCredentials(cls)} title="Print login credentials" aria-label="Print login credentials">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
                );
              })()}
            </section>
          </div>
        )}

        {/* ===== STUDENT PROGRESS TAB ===== */}
        {tab === "progress" && (
          <div className="td-progress">
            {/* Filter bar */}
            {sessions.length > 0 && (
              <div className="td-progress__filter">
                {sessionClassCodes.length > 0 && (
                  <>
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
                  </>
                )}
                {progressFocus && (
                  <button className="td-focus-chip" onClick={() => setProgressFocus(null)} title="Clear this filter">
                    {progressFocus === "week" ? "Active this week" : progressFocus === "feedback" ? "Awaiting your feedback" : "Designs completed"}
                    <span aria-hidden="true">×</span>
                  </button>
                )}
                {chartFilter && (
                  <button className="td-focus-chip" onClick={() => setChartFilter(null)} title="Clear this filter">
                    {chartFilter.type === "step"
                      ? `Working on Step ${chartFilter.step}: ${STEP_LABELS[chartFilter.step - 1]}`
                      : `${chartFilter.name} · ${BAND_LABELS[chartFilter.band]}`}
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
            )}

            {/* Charts */}
            {!loadingSessions && chartData && (
              <h2 className="td-section__title td-section__title--progress">Class Overview</h2>
            )}
            {!loadingSessions && chartData && (
              <div className="td-charts">
                {/* Step Completion Bar Chart */}
                <div className="td-chart-card td-chart-card--purple">
                  <h3 className="td-chart-card__title">
                    <span className="td-chart-card__ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
                    Step Completion Overview
                  </h3>
                  <p className="td-chart-card__desc">Students who completed each step - click a bar to see who's working on it</p>
                  {chartData.bottleneck && chartData.bottleneckCount > 1 && (
                    <button
                      className="td-bottleneck"
                      onClick={() => setChartFilter({ type: "step", step: chartData.bottleneck })}
                      title="Show these students in the table below"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                      Most students ({chartData.bottleneckCount}) are working on Step {chartData.bottleneck}: {STEP_LABELS[chartData.bottleneck - 1]}
                    </button>
                  )}
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData.stepCompletion} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border)" />
                      <XAxis dataKey="step" tick={{ fontSize: 11, fill: "var(--hop-muted)" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--hop-muted)" }} />
                      <Tooltip
                        formatter={(val, _, props) => [`${val} students`, props.payload.fullLabel]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--hop-border)" }}
                      />
                      <Bar
                        dataKey="students"
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                        onClick={(d) => d && setChartFilter({ type: "step", step: d.payload.stepNum })}
                      >
                        {chartData.stepCompletion.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Class hopscotch court: each square lights up with the share
                    of the class that completed that step */}
                <div className="td-chart-card td-chart-card--green">
                  <h3 className="td-chart-card__title">
                    <span className="td-chart-card__ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg></span>
                    Class Hopscotch Court
                  </h3>
                  <p className="td-chart-card__desc">The brighter a square, the more of the class completed that step - click one to see who's on it</p>
                  <div className="td-court">
                    <svg viewBox="-2 -8 132 62" className="td-court__svg" aria-label="Class step completion court">
                      {[
                        { x: 0, y: 0 }, { x: 0, y: 24 }, { x: 22, y: 12 }, { x: 44, y: 0 },
                        { x: 44, y: 24 }, { x: 66, y: 12 }, { x: 88, y: 0 }, { x: 88, y: 24 },
                      ].map((p, i) => {
                        const e = chartData.stepCompletion[i];
                        return (
                          <g key={i} className="td-court__sq" onClick={() => setChartFilter({ type: "step", step: i + 1 })}>
                            <rect x={p.x} y={p.y} width="18" height="22" rx="6"
                              fill={e.color} fillOpacity={0.14 + 0.86 * e.pct}
                              stroke={e.color} strokeWidth="1.2" strokeOpacity="0.75">
                              <title>{`${e.fullLabel} - ${Math.round(e.pct * 100)}% of the class completed`}</title>
                            </rect>
                            <text x={p.x + 9} y={p.y + 11} textAnchor="middle" dominantBaseline="central" fontSize="6.5" fontWeight="700"
                              fill={e.pct > 0.55 ? "#fff" : "var(--hop-ink-secondary)"} pointerEvents="none">
                              {Math.round(e.pct * 100)}%
                            </text>
                          </g>
                        );
                      })}
                      {(() => {
                        const e = chartData.stepCompletion[8];
                        return (
                          <g className="td-court__sq" onClick={() => setChartFilter({ type: "step", step: 9 })}>
                            <path d="M110,7 A16,16 0 0,1 110,39 Z"
                              fill={e.color} fillOpacity={0.14 + 0.86 * e.pct}
                              stroke={e.color} strokeWidth="1.2" strokeOpacity="0.75">
                              <title>{`${e.fullLabel} - ${Math.round(e.pct * 100)}% of the class completed`}</title>
                            </path>
                            <text x="116.8" y="23" textAnchor="middle" dominantBaseline="central" fontSize="6.5" fontWeight="700"
                              fill={e.pct > 0.55 ? "#fff" : "var(--hop-ink-secondary)"} pointerEvents="none">
                              {Math.round(e.pct * 100)}%
                            </text>
                          </g>
                        );
                      })()}
                    </svg>
                    <div className="td-court__legend">
                      {STEP_LABELS.map((l, i) => (
                        <span key={i} className="td-court__leg" style={{ "--leg": STEP_COLORS[i] }}>
                          <span className="td-court__leg-dot" />S{i + 1} {l}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Class Average Progress - horizontal bars, scales to any number of classes */}
                {chartData.classAvg.length > 1 && (
                  <div className="td-chart-card td-chart-card--wide td-chart-card--amber">
                    <h3 className="td-chart-card__title">
                      <span className="td-chart-card__ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></span>
                      Average Progress by Class
                    </h3>
                    <p className="td-chart-card__desc">
                      How each class's students are spread across the journey · {chartData.classAvg.length} classes (sorted by average, click a segment to see those students)
                    </p>
                    <div className="td-band-legend">
                      {BAND_LABELS.map((l, i) => (
                        <span key={l} className="td-band-legend__item">
                          <span className="td-band-legend__dot" style={{ background: BAND_COLORS[i] }} />{l}
                        </span>
                      ))}
                    </div>
                    <div className="td-chart-scroll" style={{ maxHeight: 320, overflowY: chartData.classAvg.length > 8 ? "auto" : "visible" }}>
                      <ResponsiveContainer width="100%" height={Math.max(160, chartData.classAvg.length * 34 + 20)}>
                        <BarChart
                          layout="vertical"
                          data={chartData.classAvg}
                          margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                          barCategoryGap="22%"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border)" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--hop-muted)" }} />
                          <YAxis
                            type="category" dataKey="name" width={130}
                            tick={{ fontSize: 11, fill: "var(--hop-ink-secondary)" }}
                            interval={0}
                            tickFormatter={(n) => (n.length > 18 ? n.slice(0, 17) + "…" : n)}
                          />
                          <Tooltip
                            formatter={(val, key, props) => {
                              const idx = { b0: 0, b1: 1, b2: 2, b3: 3 }[key];
                              return [`${val} student${val === 1 ? "" : "s"}`, `${props.payload.name} · ${BAND_LABELS[idx]}`];
                            }}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--hop-border)" }}
                          />
                          {["b0", "b1", "b2", "b3"].map((key, bi) => (
                            <Bar
                              key={key}
                              dataKey={key}
                              stackId="bands"
                              fill={BAND_COLORS[bi]}
                              maxBarSize={22}
                              cursor="pointer"
                              radius={bi === 3 ? [0, 6, 6, 0] : 0}
                              onClick={(d) => d && setChartFilter({ type: "band", code: d.payload.code, name: d.payload.name, band: bi })}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
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
              <div className="td-section__head td-students__head">
                <h2 className="td-section__title td-section__title--progress">
                  Students
                  <span className="td-section__count">{tableSessions.length}</span>
                </h2>
                <div className="td-search">
                  <svg className="td-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    className="td-search__input"
                    placeholder="Search students…"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    aria-label="Search students by name or username"
                  />
                  {studentQuery && (
                    <button className="td-search__clear" onClick={() => setStudentQuery("")} aria-label="Clear search">×</button>
                  )}
                </div>
              </div>
            )}

            {!loadingSessions && filteredSessions.length > 0 && tableSessions.length === 0 && (
              <div className="td-empty">No students match “{studentQuery}”.</div>
            )}

            {!loadingSessions && tableSessions.length > 0 && (
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
                    {tableSessions.map((s, i) => {
                      const completed = s.completed_steps || [];
                      const pct = Math.round((completed.length / 9) * 100);
                      return (
                        <tr key={s.session_id || `student-${s.user?.username || i}`} className={!s.session_id ? "td-table__row--inactive" : ""}>
                          <td>
                            <div className="td-table__student">
                              <span className="td-table__student-avatar" style={{ background: classColor(s.user?.name || s.user?.username || "?") }}>
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
                          <td className="td-table__cap">{(s.resolved_path !== "mixed" && s.chosen_methodology) || s.resolved_path || "\u2014"}</td>
                          <td>
                            {!s.session_id ? (
                              <span className="td-table__not-started">Not started</span>
                            ) : s.active_step ? (
                              <span className="td-step-badge" style={{ "--step-color": STEP_COLORS[s.active_step - 1] || "#94a3b8" }}>
                                <span className="td-step-badge__dot" />
                                Step {s.active_step} · {STEP_LABELS[s.active_step - 1] || ""}
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
        const mode = live.settings?.access_mode || "full";
        const up = live.settings?.unlocked_phase || 1;
        return (
          <div className="mcm-overlay" onMouseDown={() => setDetailClass(null)}>
            <div className="mcm" onMouseDown={(e) => e.stopPropagation()}>
              <header className="mcm__head">
                <div className="mcm__headtext">
                  <span className="mcm__eyebrow">Manage class</span>
                  <h3 className="mcm__title">{live.class_name}</h3>
                </div>
                <button className="mcm__close" onClick={() => setDetailClass(null)} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </header>

              <div className="mcm__body">
                {/* Credentials */}
                <div className="mcm-cred">
                  {[
                    { label: "Class code", value: live.class_code, field: "code" },
                    { label: "Shared password", value: live.password || "Not available", field: "pw" },
                  ].map(({ label, value, field }) => {
                    const key = `${live.class_id}:${field}`;
                    return (
                      <div className="mcm-cred__field" key={field}>
                        <span className="mcm-cred__label">{label}</span>
                        <div className="mcm-cred__row">
                          <code className="mcm-cred__value">{value}</code>
                          <button type="button" className="mcm-cred__copy" onClick={() => copyValue(value, key)} title={`Copy ${label.toLowerCase()}`}>
                            {copied === key ? (
                              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied</>
                            ) : (
                              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI Assistant */}
                <div className="mcm-row">
                  <div className="mcm-row__text">
                    <span className="mcm-row__label">AI Assistant</span>
                    <span className="mcm-row__desc">
                      {aiOn
                        ? "Students can use the AI research assistant."
                        : "AI is off - students work on their own. Turn it on when they're ready."}
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

                {/* Student access */}
                <div className="mcm-section">
                  <div className="mcm-row__text mcm-section__head">
                    <span className="mcm-row__label">Student access</span>
                    <span className="mcm-row__desc">Control which steps students can work on.</span>
                  </div>
                  <div className="mcm-seg">
                    {ACCESS_MODES.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`mcm-seg__btn${mode === opt.id ? " mcm-seg__btn--active" : ""}`}
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
                    <p className="mcm-hint">Students must complete each step before the next one unlocks.</p>
                  )}

                  {mode === "phase" && (
                    <div className="mcm-phases">
                      {ACCESS_PHASES.map((ph) => {
                        const unlocked = up >= ph.n;
                        return (
                          <button
                            key={ph.n}
                            type="button"
                            className={`mcm-phase${unlocked ? " mcm-phase--unlocked" : ""}`}
                            disabled={saving}
                            onClick={() => patchClassSettings(live, { unlocked_phase: ph.n })}
                          >
                            <span className="mcm-phase__icon">
                              {unlocked ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                              )}
                            </span>
                            <span className="mcm-phase__text">
                              <span className="mcm-phase__label">{ph.label} · {ph.name}</span>
                              <span className="mcm-phase__range">{ph.range}</span>
                            </span>
                            {unlocked && <span className="mcm-phase__tag">Unlocked</span>}
                          </button>
                        );
                      })}
                      <p className="mcm-hint">Click a phase to unlock everything up to and including it.</p>
                    </div>
                  )}
                </div>

                {/* Roster */}
                <div className="mcm-section">
                  <div className="mcm-roster__head">
                    <span className="mcm-row__label">Student logins</span>
                    <span className="mcm-count">{students.length}</span>
                  </div>
                  <div className="mcm-roster">
                    {students.map((s) => (
                      <span className="mcm-roster__chip" key={s.username}>{s.username}</span>
                    ))}
                  </div>
                </div>
              </div>

              <footer className="mcm__foot">
                <button className="td-btn td-btn--ghost td-btn--sm" onClick={() => handlePrintCredentials(live)}>
                  Print credentials
                </button>
                <button className="td-btn td-btn--primary td-btn--sm" onClick={() => setDetailClass(null)}>
                  Done
                </button>
              </footer>
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

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} toggleTheme={toggleTheme} />
      </div>
    </div>
  );
}
