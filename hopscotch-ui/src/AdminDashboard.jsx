// src/AdminDashboard.jsx — Superuser admin dashboard
import React, { useEffect, useState, useCallback } from "react";
import { API } from "./api";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import UserLocationMap from "./UserLocationMap";
import StudentDesignView from "./StudentDesignView";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const ROLE_COLORS = {
  admin: "#7C3AED",
  teacher: "#2B5EA7",
  student: "#16A34A",
  classroom_student: "#0D9488",
};

const ROLE_LABELS = {
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  classroom_student: "Classroom",
};

const STEP_LABELS = [
  "Worldview", "Topic", "Literature", "Methodology", "Question",
  "Data", "Analysis", "Trustworthiness", "Ethics",
];

const STEP_COLORS = [
  "#2B5EA7", "#E8618C", "#D94040", "#1A8A7D", "#B0A47A",
  "#00AEEF", "#F0B429", "#F5922A", "#7B8794",
];

const GEO_PALETTE = [
  "#2B5EA7", "#1A8A7D", "#E8618C", "#F0B429", "#7C3AED",
  "#00AEEF", "#F5922A", "#D94040", "#16A34A", "#B0A47A",
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

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const tipStyle = {
    backgroundColor: dark ? "#252A34" : "#fff",
    border: `1px solid ${dark ? "#2D3340" : "#e5e7eb"}`,
    borderRadius: 8,
    color: dark ? "#E8ECF1" : "#1a1a2e",
  };
  const tipLabelStyle = { color: dark ? "#B0BAC5" : "#6b7280" };
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Overview tab
  const [signups, setSignups] = useState([]);
  const [stepCompletion, setStepCompletion] = useState([]);

  // Users tab
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const PAGE_SIZE = 20;

  // User detail drill-down
  const [userDetail, setUserDetail] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  // Modals
  const [editingUser, setEditingUser] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [resetPwUser, setResetPwUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [modalError, setModalError] = useState("");

  // Classes tab
  const [classes, setClasses] = useState([]);
  const [classTotal, setClassTotal] = useState(0);
  const [classPage, setClassPage] = useState(0);
  const [classSearch, setClassSearch] = useState("");
  const [deleteClass, setDeleteClass] = useState(null);

  // Sessions tab
  const [sessions, setSessions] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(0);
  const [viewingSession, setViewingSession] = useState(null); // { sessionId, name }

  // Map tab
  const [mapLocations, setMapLocations] = useState([]);
  const [geoCountries, setGeoCountries] = useState([]);
  const [geoRegions, setGeoRegions] = useState([]);

  // Activity tab
  const [loginActivity, setLoginActivity] = useState([]);
  const [auditLog, setAuditLog] = useState([]);

  // Health tab
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Load stats on mount
  useEffect(() => {
    setLoading(true);
    API.adminGetStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load tab-specific data
  useEffect(() => {
    if (tab === "overview") {
      API.adminGetSignups(30).then((d) => setSignups(d.signups || [])).catch(console.error);
      API.adminGetStepCompletion().then((d) => setStepCompletion(d.steps || [])).catch(console.error);
    } else if (tab === "users") {
      loadUsers();
    } else if (tab === "classes") {
      loadClasses();
    } else if (tab === "sessions") {
      loadSessions();
    } else if (tab === "map") {
      API.adminGetLoginMap().then((d) => setMapLocations(d.locations || [])).catch(console.error);
      API.adminGetGeoCountries().then((d) => setGeoCountries(d.countries || [])).catch(console.error);
      API.adminGetGeoRegions().then((d) => setGeoRegions(d.regions || [])).catch(console.error);
    } else if (tab === "activity") {
      API.adminGetLoginActivity(200).then((d) => setLoginActivity(d.logins || [])).catch(console.error);
      API.adminGetAuditLog(200).then((d) => setAuditLog(d.log || [])).catch(console.error);
    } else if (tab === "health") {
      setHealthLoading(true);
      API.adminGetHealth().then(setHealth).catch(console.error).finally(() => setHealthLoading(false));
    }
  }, [tab]);

  const loadUsers = useCallback(() => {
    API.adminGetUsers({
      skip: userPage * PAGE_SIZE,
      limit: PAGE_SIZE,
      role: userRoleFilter,
      search: userSearch,
    }).then((d) => {
      setUsers(d.users || []);
      setUserTotal(d.total || 0);
    }).catch(console.error);
  }, [userPage, userRoleFilter, userSearch]);

  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [loadUsers, tab]);

  const loadClasses = useCallback(() => {
    API.adminGetClasses({
      skip: classPage * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: classSearch,
    }).then((d) => {
      setClasses(d.classes || []);
      setClassTotal(d.total || 0);
    }).catch(console.error);
  }, [classPage, classSearch]);

  useEffect(() => {
    if (tab === "classes") loadClasses();
  }, [loadClasses, tab]);

  const loadSessions = useCallback(() => {
    API.adminGetSessions({
      skip: sessionPage * PAGE_SIZE,
      limit: PAGE_SIZE,
    }).then((d) => {
      setSessions(d.sessions || []);
      setSessionTotal(d.total || 0);
    }).catch(console.error);
  }, [sessionPage]);

  useEffect(() => {
    if (tab === "sessions") loadSessions();
  }, [loadSessions, tab]);

  // User detail drill-down
  function openUserDetail(userId) {
    setUserDetailLoading(true);
    setUserDetail(null);
    API.adminGetUserDetail(userId)
      .then(setUserDetail)
      .catch(console.error)
      .finally(() => setUserDetailLoading(false));
  }

  // Role pie data from stats
  const rolePieData = stats
    ? Object.entries(stats.role_counts || {}).map(([role, count]) => ({
        name: ROLE_LABELS[role] || role,
        value: count,
        color: ROLE_COLORS[role] || "#999",
      }))
    : [];

  // Step completion bar data
  const stepBarData = stepCompletion.map((s) => ({
    name: STEP_LABELS[s.step - 1] || `S${s.step}`,
    count: s.count,
    fill: STEP_COLORS[s.step - 1] || "#999",
  }));

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "classes", label: "Classes" },
    { id: "sessions", label: "Sessions" },
    { id: "map", label: "Map" },
    { id: "activity", label: "Activity" },
    { id: "health", label: "Health" },
  ];

  // If viewing a student design (session viewer), show that overlay
  if (viewingSession) {
    return (
      <StudentDesignView
        sessionId={viewingSession.sessionId}
        studentName={viewingSession.name}
        onClose={() => setViewingSession(null)}
      />
    );
  }

  // If viewing user detail, show drill-down
  if (userDetail || userDetailLoading) {
    return (
      <div className="ad-dashboard">
        <header className="ad-header">
          <div className="ad-header__left">
            <button className="ad-back-btn" onClick={() => { setUserDetail(null); setUserDetailLoading(false); }}>&larr; Back to Users</button>
          </div>
          <div className="ad-header__right">
            <button className="hop-header__signout" onClick={logout}>Sign Out</button>
          </div>
        </header>
        <div className="ad-body">
          {userDetailLoading && <div className="ad-loading">Loading user details...</div>}
          {userDetail && <UserDetailView detail={userDetail} onViewSession={(sid, name) => setViewingSession({ sessionId: sid, name })} />}
        </div>
      </div>
    );
  }

  return (
    <div className="ad-dashboard">
      {/* Header */}
      <header className="ad-header">
        <div className="ad-header__left">
          <img
            src={theme === "dark" ? "/Hopscotch4-all-logo-White-alpha.png" : "/Hopscotch-4-all-logo-alpha.png"}
            alt="Hopscotch 4 All"
            className="hop-logo"
          />
          <span className="ad-header__badge">Admin</span>
        </div>
        <div className="ad-header__right">
          {user && (
            <div className="hop-user">
              <span className="hop-user__avatar">{user.name?.charAt(0).toUpperCase()}</span>
              <span className="hop-user__name">{user.name}</span>
            </div>
          )}
          <button className="theme-toggle" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? "\u2600" : "\u263E"}
          </button>
          <span className="hop-header__divider" />
          <button className="hop-header__signout" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <div className="ad-body">
        {/* Stat cards */}
        {stats && (
          <div className="ad-stats">
            <StatCard label="Total Users" value={stats.total_users} color="#2B5EA7" />
            <StatCard label="Sessions" value={stats.total_sessions} color="#E8618C" />
            <StatCard label="Classes" value={stats.total_classes} color="#1A8A7D" />
            <StatCard label="Active (7d)" value={stats.active_users_7d} color="#F0B429" />
            <StatCard label="Active (30d)" value={stats.active_users_30d} color="#F5922A" />
          </div>
        )}

        {/* Tabs */}
        <nav className="ad-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`ad-tab${tab === t.id ? " ad-tab--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="ad-tab-content">
          {loading && <div className="ad-loading">Loading...</div>}

          {/* ===== OVERVIEW ===== */}
          {tab === "overview" && !loading && (
            <div className="ad-overview">
              <div className="ad-chart-row">
                <div className="ad-chart-card">
                  <h4>Signups (Last 30 Days)</h4>
                  {signups.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={signups}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border, #e5e7eb)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} />
                        <Line type="monotone" dataKey="count" stroke="#2B5EA7" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="ad-empty">No signup data in the last 30 days.</p>
                  )}
                </div>

                <div className="ad-chart-card">
                  <h4>Users by Role</h4>
                  {rolePieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={rolePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {rolePieData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="ad-empty">No user data.</p>
                  )}
                </div>
              </div>

              <div className="ad-chart-card ad-chart-card--wide">
                <h4>Step Completion (All Students)</h4>
                {stepBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stepBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border, #e5e7eb)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {stepBarData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="ad-empty">No step completion data yet.</p>
                )}
              </div>
            </div>
          )}

          {/* ===== USERS ===== */}
          {tab === "users" && (
            <div className="ad-users">
              <div className="ad-users__toolbar">
                <input
                  type="text"
                  className="ad-users__search"
                  placeholder="Search by name, email, or username..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
                />
                <select
                  className="ad-users__filter"
                  value={userRoleFilter}
                  onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(0); }}
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                  <option value="classroom_student">Classroom</option>
                </select>
                <button className="td-btn td-btn--outline td-btn--sm" onClick={() => API.adminExportCSV("users")}>
                  Export CSV
                </button>
                <button className="td-btn td-btn--primary td-btn--sm" onClick={() => { setCreatingUser(true); setModalError(""); }}>
                  + Create User
                </button>
              </div>

              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Education</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>IP</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id}>
                        <td>
                          <div className="td-table__student" style={{ cursor: "pointer" }} onClick={() => openUserDetail(u._id)}>
                            <span className="td-table__student-avatar" style={{ background: ROLE_COLORS[u.role] || "#999" }}>
                              {(u.name || "?").charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <div className="td-table__name ad-clickable">{u.name || "\u2014"}</div>
                              <div className="td-table__mono">{u.email || u.username || ""}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="ad-role-badge" style={{ background: ROLE_COLORS[u.role] || "#999" }}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </td>
                        <td className="td-table__muted">{u.education_level === "higher_ed" ? "Higher Ed" : "High School"}</td>
                        <td>
                          <span className={`ad-status-dot ${u.is_active === false ? "ad-status-dot--inactive" : "ad-status-dot--active"}`} />
                          {u.is_active === false ? "Inactive" : "Active"}
                        </td>
                        <td className="td-table__muted">{timeAgo(u.last_login_at)}</td>
                        <td className="td-table__mono" style={{ fontSize: "0.75rem" }}>{u.last_login_ip || "\u2014"}</td>
                        <td className="td-table__muted">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</td>
                        <td>
                          <div className="ad-actions">
                            <button className="ad-action-btn" title="Edit" onClick={() => { setEditingUser({ ...u }); setModalError(""); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="ad-action-btn" title="Reset Password" onClick={() => { setResetPwUser(u); setModalError(""); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </button>
                            <button
                              className="ad-action-btn"
                              title={u.is_active === false ? "Reactivate" : "Deactivate"}
                              onClick={() => handleToggleActive(u)}
                            >
                              {u.is_active === false ? "\u25B6" : "\u23F8"}
                            </button>
                            <button className="ad-action-btn ad-action-btn--danger" title="Delete" onClick={() => setDeleteUser(u)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={8} className="ad-empty" style={{ textAlign: "center", padding: 24 }}>No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ad-pagination">
                <button disabled={userPage === 0} onClick={() => setUserPage((p) => p - 1)}>Previous</button>
                <span>Page {userPage + 1} of {Math.max(1, Math.ceil(userTotal / PAGE_SIZE))} ({userTotal} users)</span>
                <button disabled={(userPage + 1) * PAGE_SIZE >= userTotal} onClick={() => setUserPage((p) => p + 1)}>Next</button>
              </div>

              {creatingUser && (
                <CreateUserModal
                  error={modalError}
                  onClose={() => setCreatingUser(false)}
                  onSave={async (data) => {
                    setModalError("");
                    try {
                      await API.adminCreateUser(data);
                      setCreatingUser(false);
                      loadUsers();
                    } catch (e) { setModalError(e.message); }
                  }}
                />
              )}
              {editingUser && (
                <EditUserModal
                  user={editingUser}
                  error={modalError}
                  onClose={() => setEditingUser(null)}
                  onSave={async (fields) => {
                    setModalError("");
                    try {
                      await API.adminUpdateUser(editingUser._id, fields);
                      setEditingUser(null);
                      loadUsers();
                    } catch (e) { setModalError(e.message); }
                  }}
                />
              )}
              {resetPwUser && (
                <ResetPasswordModal
                  user={resetPwUser}
                  error={modalError}
                  onClose={() => setResetPwUser(null)}
                  onSave={async (pw) => {
                    setModalError("");
                    try {
                      await API.adminResetPassword(resetPwUser._id, pw);
                      setResetPwUser(null);
                    } catch (e) { setModalError(e.message); }
                  }}
                />
              )}
              {deleteUser && (
                <DeleteConfirmModal
                  user={deleteUser}
                  onClose={() => setDeleteUser(null)}
                  onConfirm={async () => {
                    try {
                      await API.adminDeleteUser(deleteUser._id);
                      setDeleteUser(null);
                      loadUsers();
                    } catch (e) { alert(e.message); }
                  }}
                />
              )}
            </div>
          )}

          {/* ===== CLASSES ===== */}
          {tab === "classes" && (
            <div className="ad-users">
              <div className="ad-users__toolbar">
                <input
                  type="text"
                  className="ad-users__search"
                  placeholder="Search by class name or code..."
                  value={classSearch}
                  onChange={(e) => { setClassSearch(e.target.value); setClassPage(0); }}
                />
              </div>

              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <th>Class Name</th>
                      <th>Code</th>
                      <th>Teacher</th>
                      <th>Students</th>
                      <th>Password</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => (
                      <tr key={c._id}>
                        <td><strong>{c.class_name}</strong></td>
                        <td className="td-table__mono">{c.class_code}</td>
                        <td>
                          <div>{c.teacher_name}</div>
                          <div className="td-table__mono" style={{ fontSize: "0.75rem" }}>{c.teacher_email}</div>
                        </td>
                        <td>{c.actual_students} / {c.student_count}</td>
                        <td className="td-table__mono" style={{ fontSize: "0.75rem" }}>{c.password || "\u2014"}</td>
                        <td className="td-table__muted">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</td>
                        <td>
                          <div className="ad-actions">
                            <button className="ad-action-btn ad-action-btn--danger" title="Delete class and students" onClick={() => setDeleteClass(c)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {classes.length === 0 && (
                      <tr><td colSpan={7} className="ad-empty" style={{ textAlign: "center", padding: 24 }}>No classes found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ad-pagination">
                <button disabled={classPage === 0} onClick={() => setClassPage((p) => p - 1)}>Previous</button>
                <span>Page {classPage + 1} of {Math.max(1, Math.ceil(classTotal / PAGE_SIZE))} ({classTotal} classes)</span>
                <button disabled={(classPage + 1) * PAGE_SIZE >= classTotal} onClick={() => setClassPage((p) => p + 1)}>Next</button>
              </div>

              {deleteClass && (
                <div className="ad-modal-backdrop" onClick={() => setDeleteClass(null)}>
                  <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>Delete Class</h3>
                    <p>Are you sure you want to delete class <strong>{deleteClass.class_name}</strong> ({deleteClass.class_code})?</p>
                    <p style={{ color: "#DC2626", fontSize: "0.85rem" }}>This will also delete all {deleteClass.actual_students} student account(s) in this class.</p>
                    <div className="ad-modal__actions">
                      <button className="td-btn td-btn--outline td-btn--sm" onClick={() => setDeleteClass(null)}>Cancel</button>
                      <button className="td-btn td-btn--sm" style={{ background: "#DC2626", color: "#fff" }} onClick={async () => {
                        try {
                          await API.adminDeleteClass(deleteClass._id);
                          setDeleteClass(null);
                          loadClasses();
                        } catch (e) { alert(e.message); }
                      }}>Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== SESSIONS ===== */}
          {tab === "sessions" && (
            <div className="ad-users">
              <div className="ad-users__toolbar">
                <span style={{ color: "var(--hop-muted)", fontSize: "0.85rem" }}>
                  Browse all student sessions. Click "View" to see their research design.
                </span>
                <button className="td-btn td-btn--outline td-btn--sm" onClick={() => API.adminExportCSV("sessions")}>
                  Export CSV
                </button>
              </div>

              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Step</th>
                      <th>Worldview</th>
                      <th>Path</th>
                      <th>Methodology</th>
                      <th>Created</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.session_id}>
                        <td>
                          <div className="td-table__student">
                            <div>
                              <div className="td-table__name">{s.user_name || "\u2014"}</div>
                              <div className="td-table__mono">{s.user_email || ""}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="ad-role-badge" style={{ background: STEP_COLORS[(s.active_step || 1) - 1] || "#999" }}>
                            Step {s.active_step || 1}
                          </span>
                        </td>
                        <td className="td-table__muted">{s.worldview_label || "\u2014"}</td>
                        <td className="td-table__muted">{s.resolved_path || "\u2014"}</td>
                        <td className="td-table__muted">{s.chosen_methodology || "\u2014"}</td>
                        <td className="td-table__muted">{timeAgo(s.created_at)}</td>
                        <td className="td-table__muted">{timeAgo(s.updated_at)}</td>
                        <td>
                          <button
                            className="td-btn td-btn--outline td-btn--sm"
                            onClick={() => setViewingSession({ sessionId: s.session_id, name: s.user_name })}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr><td colSpan={8} className="ad-empty" style={{ textAlign: "center", padding: 24 }}>No sessions found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ad-pagination">
                <button disabled={sessionPage === 0} onClick={() => setSessionPage((p) => p - 1)}>Previous</button>
                <span>Page {sessionPage + 1} of {Math.max(1, Math.ceil(sessionTotal / PAGE_SIZE))} ({sessionTotal} sessions)</span>
                <button disabled={(sessionPage + 1) * PAGE_SIZE >= sessionTotal} onClick={() => setSessionPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}

          {/* ===== MAP & GEO ANALYTICS ===== */}
          {tab === "map" && (
            <div className="ad-geo">
              {/* Heatmap */}
              <div className="ad-chart-card ad-chart-card--wide">
                <h4>User Login Locations</h4>
                <UserLocationMap locations={mapLocations} />
              </div>

              {/* Country donut + Country bar */}
              <div className="ad-chart-row" style={{ marginTop: 20 }}>
                <div className="ad-chart-card">
                  <h4>Users by Country</h4>
                  {geoCountries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={geoCountries.slice(0, 8).map((c) => ({ name: c.country, value: c.unique_users }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          label={({ name, value }) => `${name} (${value})`}
                        >
                          {geoCountries.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={GEO_PALETTE[i % GEO_PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="ad-empty">No country data yet.</p>
                  )}
                </div>

                <div className="ad-chart-card">
                  <h4>Logins by Country</h4>
                  {geoCountries.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        layout="vertical"
                        data={geoCountries.slice(0, 10)}
                        margin={{ left: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border, #e5e7eb)" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="country" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} />
                        <Bar dataKey="logins" name="Logins" fill="#2B5EA7" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="unique_users" name="Users" fill="#1A8A7D" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="ad-empty">No country data yet.</p>
                  )}
                </div>
              </div>

              {/* Region/city bar chart */}
              <div className="ad-chart-card ad-chart-card--wide" style={{ marginTop: 20 }}>
                <h4>Top Cities / Regions</h4>
                {geoRegions.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(200, geoRegions.slice(0, 15).length * 32)}>
                    <BarChart
                      layout="vertical"
                      data={geoRegions.slice(0, 15).map((r) => ({
                        ...r,
                        label: `${r.city}${r.region ? `, ${r.region}` : ""}${r.country ? ` (${r.country})` : ""}`,
                      }))}
                      margin={{ left: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border, #e5e7eb)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} />
                      <Bar dataKey="logins" name="Logins" fill="#E8618C" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="unique_users" name="Users" fill="#F0B429" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="ad-empty">No region data yet.</p>
                )}
              </div>
            </div>
          )}

          {/* ===== ACTIVITY ===== */}
          {tab === "activity" && (
            <div className="ad-activity">
              <div className="ad-chart-card">
                <div className="ad-chart-card__header">
                  <h4>Login History</h4>
                  <button className="td-btn td-btn--outline td-btn--sm" onClick={() => API.adminExportCSV("logins")}>
                    Export CSV
                  </button>
                </div>
                <div className="td-table-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
                  <table className="td-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>IP</th>
                        <th>Location</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginActivity.map((l, i) => (
                        <tr key={i}>
                          <td className="td-table__mono">{l.email}</td>
                          <td className="td-table__mono" style={{ fontSize: "0.75rem" }}>{l.ip}</td>
                          <td className="td-table__muted">{[l.city, l.region, l.country].filter(Boolean).join(", ") || "\u2014"}</td>
                          <td className="td-table__muted">{timeAgo(l.login_at)}</td>
                          <td>
                            <span className={l.success ? "ad-role-badge" : "ad-role-badge ad-role-badge--fail"} style={l.success ? { background: "#16A34A" } : {}}>
                              {l.success ? "OK" : "FAIL"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {loginActivity.length === 0 && (
                        <tr><td colSpan={5} className="ad-empty" style={{ textAlign: "center", padding: 24 }}>No login activity yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="ad-chart-card" style={{ marginTop: 24 }}>
                <h4>Admin Audit Log</h4>
                <div className="td-table-wrap" style={{ maxHeight: 400, overflowY: "auto" }}>
                  <table className="td-table">
                    <thead>
                      <tr>
                        <th>Admin</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Details</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map((a, i) => (
                        <tr key={i}>
                          <td className="td-table__mono">{a.admin_email}</td>
                          <td>
                            <span className="ad-role-badge" style={{ background: "#7C3AED" }}>{a.action}</span>
                          </td>
                          <td className="td-table__mono">{a.target_email}</td>
                          <td className="td-table__muted" style={{ fontSize: "0.75rem" }}>
                            {a.details ? JSON.stringify(a.details) : ""}
                          </td>
                          <td className="td-table__muted">{timeAgo(a.timestamp)}</td>
                        </tr>
                      ))}
                      {auditLog.length === 0 && (
                        <tr><td colSpan={5} className="ad-empty" style={{ textAlign: "center", padding: 24 }}>No admin actions yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== HEALTH ===== */}
          {tab === "health" && (
            <div className="ad-health">
              {healthLoading && <div className="ad-loading">Checking system health...</div>}
              {health && (
                <div className="ad-health__grid">
                  <HealthCard
                    title="Server"
                    status={health.server === "ok" ? "ok" : "error"}
                    items={[
                      { label: "Status", value: health.server },
                      { label: "Uptime", value: formatUptime(health.uptime_seconds) },
                    ]}
                  />
                  <HealthCard
                    title="MongoDB"
                    status={health.mongodb === "ok" ? "ok" : "error"}
                    items={[{ label: "Connection", value: health.mongodb }]}
                  />
                  <HealthCard
                    title="Ollama LLM"
                    status={health.ollama === "ok" ? "ok" : "error"}
                    items={[
                      { label: "Connection", value: health.ollama },
                      { label: "Models", value: (health.ollama_models || []).join(", ") || "None" },
                    ]}
                  />
                  <HealthCard
                    title="RAG System"
                    status={health.rag_available && health.rag_index_loaded ? "ok" : "warn"}
                    items={[
                      { label: "Available", value: health.rag_available ? "Yes" : "No" },
                      { label: "Index Loaded", value: health.rag_index_loaded ? "Yes" : "No" },
                    ]}
                  />
                  <HealthCard
                    title="Disk Space"
                    status={health.disk_free_gb > 5 ? "ok" : health.disk_free_gb > 1 ? "warn" : "error"}
                    items={[
                      { label: "Total", value: `${health.disk_total_gb} GB` },
                      { label: "Free", value: `${health.disk_free_gb} GB` },
                    ]}
                  />
                </div>
              )}
              {health && (
                <button className="td-btn td-btn--outline td-btn--sm" style={{ marginTop: 16 }} onClick={() => {
                  setHealthLoading(true);
                  API.adminGetHealth().then(setHealth).catch(console.error).finally(() => setHealthLoading(false));
                }}>
                  Refresh
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  async function handleToggleActive(u) {
    const newActive = u.is_active === false ? true : false;
    try {
      await API.adminUpdateUser(u._id, { is_active: newActive });
      loadUsers();
    } catch (e) {
      alert(e.message);
    }
  }
}


/* ===== Sub-components ===== */

function StatCard({ label, value, color }) {
  return (
    <div className="ad-stat-card" style={{ borderTopColor: color }}>
      <div className="ad-stat-card__value">{value ?? "\u2014"}</div>
      <div className="ad-stat-card__label">{label}</div>
    </div>
  );
}


function HealthCard({ title, status, items }) {
  const colors = { ok: "#16A34A", warn: "#F0B429", error: "#DC2626" };
  const labels = { ok: "Healthy", warn: "Warning", error: "Error" };
  return (
    <div className="ad-health-card">
      <div className="ad-health-card__header">
        <h4>{title}</h4>
        <span className="ad-health-card__badge" style={{ background: colors[status] || "#999" }}>
          {labels[status] || status}
        </span>
      </div>
      <div className="ad-health-card__body">
        {items.map((item, i) => (
          <div key={i} className="ad-health-card__row">
            <span className="ad-health-card__label">{item.label}</span>
            <span className="ad-health-card__value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function UserDetailView({ detail, onViewSession }) {
  const { user, sessions, logins } = detail;
  return (
    <div className="ad-user-detail">
      {/* Profile header */}
      <div className="ad-user-detail__header">
        <span className="ad-user-detail__avatar" style={{ background: ROLE_COLORS[user.role] || "#999" }}>
          {(user.name || "?").charAt(0).toUpperCase()}
        </span>
        <div>
          <h2>{user.name || "\u2014"}</h2>
          <p className="td-table__mono">{user.email || user.username || ""}</p>
          <div className="ad-user-detail__meta">
            <span className="ad-role-badge" style={{ background: ROLE_COLORS[user.role] || "#999" }}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
            <span>{user.education_level === "higher_ed" ? "Higher Ed" : "High School"}</span>
            <span className={`ad-status-dot ${user.is_active === false ? "ad-status-dot--inactive" : "ad-status-dot--active"}`} />
            <span>{user.is_active === false ? "Inactive" : "Active"}</span>
            <span>Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className="ad-chart-card" style={{ marginTop: 20 }}>
        <h4>Sessions ({sessions.length})</h4>
        {sessions.length > 0 ? (
          <div className="td-table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="td-table">
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>Step</th>
                  <th>Worldview</th>
                  <th>Path</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td className="td-table__mono" style={{ fontSize: "0.75rem" }}>{s.session_id?.slice(0, 8)}...</td>
                    <td>
                      <span className="ad-role-badge" style={{ background: STEP_COLORS[(s.active_step || 1) - 1] || "#999" }}>
                        Step {s.active_step || 1}
                      </span>
                    </td>
                    <td className="td-table__muted">{s.worldview_label || "\u2014"}</td>
                    <td className="td-table__muted">{s.resolved_path || "\u2014"}</td>
                    <td className="td-table__muted">{timeAgo(s.created_at)}</td>
                    <td className="td-table__muted">{timeAgo(s.updated_at)}</td>
                    <td>
                      <button className="td-btn td-btn--outline td-btn--sm" onClick={() => onViewSession(s.session_id, user.name || user.username)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ad-empty">No sessions for this user.</p>
        )}
      </div>

      {/* Login history */}
      <div className="ad-chart-card" style={{ marginTop: 20 }}>
        <h4>Login History ({logins.length})</h4>
        {logins.length > 0 ? (
          <div className="td-table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="td-table">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Location</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logins.map((l, i) => (
                  <tr key={i}>
                    <td className="td-table__mono" style={{ fontSize: "0.75rem" }}>{l.ip}</td>
                    <td className="td-table__muted">{[l.city, l.region, l.country].filter(Boolean).join(", ") || "\u2014"}</td>
                    <td className="td-table__muted">{timeAgo(l.login_at)}</td>
                    <td>
                      <span className={l.success ? "ad-role-badge" : "ad-role-badge ad-role-badge--fail"} style={l.success ? { background: "#16A34A" } : {}}>
                        {l.success ? "OK" : "FAIL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ad-empty">No login history for this user.</p>
        )}
      </div>
    </div>
  );
}


function CreateUserModal({ onClose, onSave, error }) {
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "student", education_level: "high_school" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create User</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <label>Email<input value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></label>
        <label>Name<input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>Role
          <select value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>Education Level
          <select value={form.education_level} onChange={(e) => set("education_level", e.target.value)}>
            <option value="high_school">High School</option>
            <option value="higher_ed">Higher Ed</option>
          </select>
        </label>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>Cancel</button>
          <button className="td-btn td-btn--primary td-btn--sm" onClick={() => onSave(form)}>Create</button>
        </div>
      </div>
    </div>
  );
}


function EditUserModal({ user: u, onClose, onSave, error }) {
  const [form, setForm] = useState({
    name: u.name || "",
    role: u.role || "student",
    education_level: u.education_level || "high_school",
    is_active: u.is_active !== false,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit User: {u.email || u.username}</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <label>Name<input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>Role
          <select value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
            <option value="classroom_student">Classroom Student</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>Education Level
          <select value={form.education_level} onChange={(e) => set("education_level", e.target.value)}>
            <option value="high_school">High School</option>
            <option value="higher_ed">Higher Ed</option>
          </select>
        </label>
        <label className="ad-modal__checkbox">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          Active
        </label>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>Cancel</button>
          <button className="td-btn td-btn--primary td-btn--sm" onClick={() => onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  );
}


function ResetPasswordModal({ user: u, onClose, onSave, error }) {
  const [pw, setPw] = useState("");
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Reset Password: {u.email || u.username}</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <label>New Password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>Cancel</button>
          <button className="td-btn td-btn--primary td-btn--sm" onClick={() => onSave(pw)} disabled={pw.length < 6}>Reset</button>
        </div>
      </div>
    </div>
  );
}


function DeleteConfirmModal({ user: u, onClose, onConfirm }) {
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Delete User</h3>
        <p>Are you sure you want to permanently delete <strong>{u.email || u.username || u.name}</strong>?</p>
        <p style={{ color: "#DC2626", fontSize: "0.85rem" }}>This action cannot be undone.</p>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>Cancel</button>
          <button className="td-btn td-btn--sm" style={{ background: "#DC2626", color: "#fff" }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}
