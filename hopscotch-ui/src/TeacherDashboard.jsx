// src/TeacherDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { API } from "./api";

const STEP_LABELS = [
  "Worldview", "Topic", "Literature", "Methodology", "Question",
  "Data", "Analysis", "Trustworthiness", "Ethics",
];

export default function TeacherDashboard() {
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

  return (
    <div className="td">
      {/* ── Header ── */}
      <header className="td-header">
        <div className="td-header__left">
          <img
            src={theme === "dark" ? "/Hopscotch4-all-logo-White-alpha.png" : "/Hopscotch-4-all-logo.png"}
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
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? "\u2600" : "\u263E"}
          </button>
          <button className="td-header__signout" onClick={logout}>Sign Out</button>
        </div>
      </header>

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
                      minLength={6}
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
                              <span className="td-kv__value">{cls.password || "N/A"}</span>
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
            {loadingSessions && <p className="td-muted">Loading student sessions...</p>}
            {sessionsError && <div className="td-alert td-alert--error">{sessionsError}</div>}

            {!loadingSessions && sessions.length === 0 && !sessionsError && (
              <div className="td-empty">
                <p>No student sessions found yet. Students need to log in and start working first.</p>
              </div>
            )}

            {!loadingSessions && sessions.length > 0 && (
              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Username</th>
                      <th>Worldview</th>
                      <th>Path</th>
                      <th>Step</th>
                      <th>Progress</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => {
                      const completed = s.completed_steps || [];
                      return (
                        <tr key={s.session_id || i}>
                          <td className="td-table__name">{s.user?.name || "\u2014"}</td>
                          <td className="td-table__mono">{s.user?.username || s.user?.email || "\u2014"}</td>
                          <td>{s.worldview_label || "\u2014"}</td>
                          <td className="td-table__cap">{s.resolved_path || "\u2014"}</td>
                          <td>
                            {s.active_step ? (
                              <span className="td-step-badge">
                                Step {s.active_step}: {STEP_LABELS[s.active_step - 1] || ""}
                              </span>
                            ) : "\u2014"}
                          </td>
                          <td>
                            <div className="td-dots">
                              {STEP_LABELS.map((_, si) => (
                                <span
                                  key={si}
                                  className={`td-dots__dot${completed.includes(si + 1) ? " td-dots__dot--done" : ""}`}
                                  title={`Step ${si + 1}: ${STEP_LABELS[si]}`}
                                />
                              ))}
                              <span className="td-dots__count">{completed.length}/9</span>
                            </div>
                          </td>
                          <td className="td-table__muted">
                            {s.created_at ? new Date(s.created_at).toLocaleDateString() : "\u2014"}
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
  );
}
