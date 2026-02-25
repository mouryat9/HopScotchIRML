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

  return (
    <div className="td">
      {/* ── Header ── */}
      <header className="td-header">
        <div className="td-header__left">
          <img
            src={theme === "dark" ? "/Hopscotch4-all-logo-White-alpha.png" : "/Hopscotch-4-all-logo-alpha.png"}
            alt="Hopscotch"
            className="td-header__logo"
          />
        </div>
        <div className="td-header__right">
          {user && (
            <div className="td-header__user">
              <span className="td-header__avatar">{user.name?.charAt(0).toUpperCase()}</span>
              <span className="td-header__name">{user.name}</span>
            </div>
          )}
          {onOpenDesigns && (
            <button className="td-btn td-btn--primary td-btn--sm" onClick={onOpenDesigns}>
              Create Research Design
            </button>
          )}
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? "\u2600" : "\u263E"}
          </button>
          <button className="td-header__signout" onClick={logout}>Sign Out</button>
        </div>
      </header>

      {/* ── Summary stats ── */}
      <div className="td-stats">
        <div className="td-stats__card">
          <span className="td-stats__number">{classes.length}</span>
          <span className="td-stats__label">Classes</span>
        </div>
        <div className="td-stats__card">
          <span className="td-stats__number">{totalStudents}</span>
          <span className="td-stats__label">Students</span>
        </div>
        <div className="td-stats__card">
          <span className="td-stats__number">{sessions.length}</span>
          <span className="td-stats__label">Active Sessions</span>
        </div>
      </div>

      {/* ── Nav tabs ── */}
      <nav className="td-nav">
        <div className="td-nav__inner">
          {[
            { id: "classes", label: "My Classes" },
            { id: "progress", label: "Student Progress" },
          ].map((t) => (
            <button
              key={t.id}
              className={`td-nav__tab${tab === t.id ? " td-nav__tab--active" : ""}`}
              onClick={() => handleTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="td-content">

        {/* ===== MY CLASSES TAB ===== */}
        {tab === "classes" && (
          <div className="td-classes">
            {/* Create form */}
            <section className="td-card">
              <div className="td-card__header">
                <h2 className="td-card__title">Create a New Class</h2>
                <p className="td-card__desc">
                  Student accounts will be auto-generated with the shared password you set below.
                </p>
              </div>
              <form className="td-form" onSubmit={handleCreateClass}>
                <div className="td-form__grid">
                  <div className="td-form__group td-form__group--grow">
                    <label className="td-form__label">Class Name</label>
                    <input
                      type="text"
                      className="td-form__input"
                      placeholder="e.g. Period 3 Research"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      required
                    />
                  </div>
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
                {classError && <div className="td-alert td-alert--error">{classError}</div>}
                <button type="submit" className="td-btn td-btn--primary" disabled={creating}>
                  {creating ? "Creating..." : "Create Class"}
                </button>
              </form>

              {/* Success result */}
              {createResult && (
                <div className="td-result">
                  <div className="td-result__header">
                    <span className="td-result__badge">Created</span>
                    <button className="td-result__dismiss" onClick={() => setCreateResult(null)}>&times;</button>
                  </div>
                  <div className="td-kv-row">
                    <div className="td-kv">
                      <span className="td-kv__label">Class Code</span>
                      <span className="td-kv__value">{createResult.class_code}</span>
                    </div>
                    <div className="td-kv">
                      <span className="td-kv__label">Password</span>
                      <span className="td-kv__value">{createResult.password}</span>
                    </div>
                    <div className="td-kv">
                      <span className="td-kv__label">Students</span>
                      <span className="td-kv__value">{createResult.students?.length || 0}</span>
                    </div>
                  </div>
                  <div className="td-roster">
                    {(createResult.students || []).map((s) => (
                      <span className="td-roster__chip" key={s.username}>{s.username}</span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Class list */}
            <section className="td-section">
              <h2 className="td-section__title">
                Your Classes
                {!loadingClasses && <span className="td-section__count">{classes.length}</span>}
              </h2>

              {loadingClasses && <p className="td-muted">Loading classes...</p>}

              {!loadingClasses && classes.length === 0 && (
                <div className="td-empty">
                  <p>No classes yet. Create one above to get started.</p>
                </div>
              )}

              <div className="td-class-list">
                {!loadingClasses && classes.map((cls) => {
                  const isExpanded = expandedClass === cls.class_id;
                  const students = cls.students || [];
                  return (
                    <div className={`td-class${isExpanded ? " td-class--open" : ""}`} key={cls.class_id}>
                      <button
                        className="td-class__header"
                        onClick={() => setExpandedClass(isExpanded ? null : cls.class_id)}
                      >
                        <div className="td-class__title">{cls.class_name}</div>
                        <div className="td-class__meta">
                          <span className="td-class__tag">{cls.class_code}</span>
                          <span className="td-class__stat">{students.length} students</span>
                          <span className="td-class__date">
                            {cls.created_at ? new Date(cls.created_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <span className={`td-class__chevron${isExpanded ? " td-class__chevron--open" : ""}`}>
                          &#9662;
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="td-class__body">
                          <div className="td-kv-row">
                            <div className="td-kv">
                              <span className="td-kv__label">Class Code</span>
                              <span className="td-kv__value">{cls.class_code}</span>
                            </div>
                            <div className="td-kv">
                              <span className="td-kv__label">Password</span>
                              <span className="td-kv__value">{cls.password || "Not available"}</span>
                            </div>
                            <div className="td-kv">
                              <span className="td-kv__label">Students</span>
                              <span className="td-kv__value">{students.length}</span>
                            </div>
                          </div>
                          <div className="td-roster">
                            {students.map((s) => (
                              <span className="td-roster__chip" key={s.username}>{s.username}</span>
                            ))}
                          </div>
                          <div className="td-class__actions">
                            <button className="td-btn td-btn--outline td-btn--sm" onClick={() => handlePrintCredentials(cls)}>
                              Print Credentials
                            </button>
                          </div>
                        </div>
                      )}
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
                        <Bar dataKey="avg" fill="var(--hop-blue)" radius={[4, 4, 0, 0]} />
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

      {/* Student Design View overlay */}
      {viewingStudent && (
        <StudentDesignView
          sessionId={viewingStudent.session_id}
          studentName={viewingStudent.name}
          className={viewingStudent.class_name}
          onClose={() => setViewingStudent(null)}
        />
      )}
    </div>
  );
}
