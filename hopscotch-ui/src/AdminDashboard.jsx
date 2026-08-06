// src/AdminDashboard.jsx - Superuser admin dashboard
import React, { useEffect, useState, useCallback, useRef } from "react";
import { API } from "./api";
import { notify } from "./Toast";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import UserLocationMap from "./UserLocationMap";
import StudentDesignView from "./StudentDesignView";
import ProfileMenu from "./ProfileMenu";
import SettingsModal from "./SettingsModal";
import { useLang } from "./i18n.jsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area, ComposedChart,
} from "recharts";

function fmtBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const ROLE_COLORS = {
  admin: "#7C3AED",
  teacher: "#2B5EA7",
  student: "#16A34A",
  classroom_student: "#0D9488",
};

const roleLabels = (t) => ({
  admin: t("ad.role.admin"),
  teacher: t("td.roleTeacher"),
  student: t("td.thStudent"),
  classroom_student: t("ad.role.classroom"),
});

const stepLabels = (t) => [
  t("strip.1"), t("strip.2"), t("strip.3"), t("strip.4"), t("strip.5"),
  t("strip.6"), t("strip.7"), t("strip.8"), t("strip.9"),
];

const STEP_COLORS = [
  "#2B5EA7", "#E8618C", "#D94040", "#1A8A7D", "#B0A47A",
  "#00AEEF", "#F0B429", "#F5922A", "#7B8794",
];

const GEO_PALETTE = [
  "#2B5EA7", "#1A8A7D", "#E8618C", "#F0B429", "#7C3AED",
  "#00AEEF", "#F5922A", "#D94040", "#16A34A", "#B0A47A",
];

// Audit log: human-readable action labels (i18n: ad.audit.<action>, with a
// prettified fallback for unknown actions) + verb-based colors
function auditLabel(action, t) {
  const key = `ad.audit.${action}`;
  const s = t(key);
  if (s !== key) return s;
  return (action || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function auditColor(action = "") {
  if (/^(create|add|upload)/.test(action)) return "#16A34A";
  if (/^(delete|cleanup)/.test(action)) return "#DC2626";
  if (/^(update|reset|rebuild)/.test(action)) return "#2B5EA7";
  return "#7C3AED";
}

function auditDetailChips(details) {
  if (!details || typeof details !== "object") return [];
  return Object.entries(details).map(([k, v]) => {
    const val = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
    return `${k.replace(/_/g, " ")}: ${val}`;
  });
}

function timeAgo(dateStr, t, lang) {
  if (!dateStr) return "";
  const ts = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.mAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("time.hAgo", { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t("time.dAgo", { n: days });
  return new Date(dateStr).toLocaleDateString(lang === "es" ? "es-ES" : "en-US");
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
  const { lang, t } = useLang();
  const dateLocale = lang === "es" ? "es-ES" : "en-US";
  const ROLE_LABELS = roleLabels(t);
  const STEP_LABELS = stepLabels(t);
  const dark = theme === "dark";
  const tipStyle = {
    backgroundColor: dark ? "#252A34" : "#fff",
    border: `1px solid ${dark ? "#2D3340" : "#e5e7eb"}`,
    borderRadius: 8,
    color: dark ? "#E8ECF1" : "#1a1a2e",
  };
  const tipLabelStyle = { color: dark ? "#B0BAC5" : "#6b7280" };
  const [tab, setTab] = useState("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Overview tab
  const [signups, setSignups] = useState([]);
  const [signupDays, setSignupDays] = useState(30);
  const [stepCompletion, setStepCompletion] = useState([]);

  // Users tab
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [userSearchInput, setUserSearchInput] = useState("");
  const [userSearch, setUserSearch] = useState(""); // debounced value that hits the API
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [userSort, setUserSort] = useState({ by: "created_at", dir: "desc" });
  const PAGE_SIZE = 20;

  // Debounce the search box so we don't query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setUserSearch(userSearchInput);
      setUserPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [userSearchInput]);

  // User detail drill-down
  const [userDetail, setUserDetail] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  // Modals
  const [editingUser, setEditingUser] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [resetPwUser, setResetPwUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [modalError, setModalError] = useState("");

  // Classes tab - loads the full list once; search/filter/sort are client-side
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classSearchInput, setClassSearchInput] = useState("");
  const [classTeacherFilter, setClassTeacherFilter] = useState("");
  const [classSort, setClassSort] = useState({ by: "created_at", dir: "desc" });
  const [deleteClass, setDeleteClass] = useState(null);
  const [teacherOptions, setTeacherOptions] = useState([]); // for reassign / create selects

  // Class drill-down + CRUD modals
  const [classDetail, setClassDetail] = useState(null);
  const [classDetailLoading, setClassDetailLoading] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [addStudentsClass, setAddStudentsClass] = useState(null);
  const [creatingClass, setCreatingClass] = useState(false);
  const [classModalError, setClassModalError] = useState("");
  const [classResetPw, setClassResetPw] = useState(null); // classroom student obj

  // Sessions tab
  const [sessions, setSessions] = useState([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(0);
  const [sessionStats, setSessionStats] = useState(null); // { total, empty, orphaned }
  const [sessionSearchInput, setSessionSearchInput] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [sessionStep, setSessionStep] = useState(0);
  const [sessionSort, setSessionSort] = useState({ by: "updated_at", dir: "desc" });
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [viewingSession, setViewingSession] = useState(null); // { sessionId, name }

  useEffect(() => {
    const t = setTimeout(() => {
      setSessionSearch(sessionSearchInput);
      setSessionPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [sessionSearchInput]);

  // Map tab
  const [mapLocations, setMapLocations] = useState([]);
  const [geoCountries, setGeoCountries] = useState([]);
  const [geoRegions, setGeoRegions] = useState([]);
  const [geoDays, setGeoDays] = useState(0); // 0 = all time
  const [loginTs, setLoginTs] = useState([]); // logins per day
  const [geoCountryFilter, setGeoCountryFilter] = useState(""); // chart<->map cross-filter
  const [geoFocus, setGeoFocus] = useState(null); // [[lat,lng], ...] -> map flies there

  // Activity tab
  const ACT_PAGE = 25;
  const [loginActivity, setLoginActivity] = useState([]);
  const [loginTotal, setLoginTotal] = useState(0);
  const [loginPage, setLoginPage] = useState(0);
  const [loginSearchInput, setLoginSearchInput] = useState("");
  const [loginSearch, setLoginSearch] = useState("");
  const [loginStatus, setLoginStatus] = useState(""); // "" | "ok" | "fail"
  const [auditLog, setAuditLog] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditAction, setAuditAction] = useState("");
  const [auditActions, setAuditActions] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoginSearch(loginSearchInput);
      setLoginPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [loginSearchInput]);

  useEffect(() => {
    if (tab !== "activity") return;
    API.adminGetLoginActivity({ limit: ACT_PAGE, skip: loginPage * ACT_PAGE, search: loginSearch, status: loginStatus })
      .then((d) => { setLoginActivity(d.logins || []); setLoginTotal(d.total || 0); })
      .catch(console.error);
  }, [tab, loginPage, loginSearch, loginStatus]);

  useEffect(() => {
    if (tab !== "activity") return;
    API.adminGetAuditLog({ limit: ACT_PAGE, skip: auditPage * ACT_PAGE, action: auditAction })
      .then((d) => { setAuditLog(d.log || []); setAuditTotal(d.total || 0); setAuditActions(d.actions || []); })
      .catch(console.error);
  }, [tab, auditPage, auditAction]);

  // Health tab
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthAuto, setHealthAuto] = useState(false);
  const [healthCheckedAt, setHealthCheckedAt] = useState(null);
  const [llmTest, setLlmTest] = useState(null);
  const [llmTesting, setLlmTesting] = useState(false);

  const reloadHealth = useCallback((silent = false) => {
    if (!silent) setHealthLoading(true);
    API.adminGetHealth()
      .then((h) => { setHealth(h); setHealthCheckedAt(new Date()); })
      .catch(console.error)
      .finally(() => setHealthLoading(false));
  }, []);

  // Auto-refresh health every 30s while enabled and the tab is open
  useEffect(() => {
    if (tab !== "health" || !healthAuto) return;
    const id = setInterval(() => reloadHealth(true), 30000);
    return () => clearInterval(id);
  }, [tab, healthAuto, reloadHealth]);

  async function runLlmTest() {
    setLlmTesting(true);
    setLlmTest(null);
    try { setLlmTest(await API.adminTestLLM()); }
    catch (e) { setLlmTest({ ok: false, error: e.message }); }
    finally { setLlmTesting(false); }
  }

  // Glossary tab
  const [glossaryTerms, setGlossaryTerms] = useState([]);
  const [glossaryLoading, setGlossaryLoading] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState("");
  const [glossaryStep, setGlossaryStep] = useState(0); // 0 = all steps
  const [glossaryEditor, setGlossaryEditor] = useState(null); // term obj (edit) or blank (new)
  const [glossaryModalError, setGlossaryModalError] = useState("");

  // Resources (knowledge base) tab
  const [resources, setResources] = useState([]);
  const [resourceIndex, setResourceIndex] = useState(null);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [rebuildingIndex, setRebuildingIndex] = useState(false);
  const [resourceMsg, setResourceMsg] = useState("");
  const resourceFileRef = useRef(null);

  // Step resources (student panel: video + interactive per step/level)
  const [stepRes, setStepRes] = useState(null); // {lang: {level: {step: {video_url, interactive_url}}}}
  const [stepResLevel, setStepResLevel] = useState("high_school");
  const [stepResLang, setStepResLang] = useState("en");
  const [stepResLoading, setStepResLoading] = useState(false);
  const [stepResSaving, setStepResSaving] = useState("");
  const [stepResSaved, setStepResSaved] = useState("");

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
      API.adminGetStepCompletion().then((d) => setStepCompletion(d.steps || [])).catch(console.error);
    } else if (tab === "users") {
      loadUsers();
    } else if (tab === "classes") {
      loadClasses();
    } else if (tab === "sessions") {
      loadSessions();
    } else if (tab === "health") {
      reloadHealth();
    } else if (tab === "glossary") {
      loadGlossary();
    } else if (tab === "resources") {
      loadResources();
    } else if (tab === "stepres") {
      loadStepRes();
    }
  }, [tab]);

  // Signups reload when the range toggle changes
  useEffect(() => {
    if (tab !== "overview") return;
    API.adminGetSignups(signupDays).then((d) => setSignups(d.signups || [])).catch(console.error);
  }, [tab, signupDays]);

  // Geo data reloads when the map range toggle changes
  useEffect(() => {
    if (tab !== "map") return;
    setGeoCountryFilter("");
    setGeoFocus(null);
    API.adminGetLoginMap(geoDays).then((d) => setMapLocations(d.locations || [])).catch(console.error);
    API.adminGetGeoCountries(geoDays).then((d) => setGeoCountries(d.countries || [])).catch(console.error);
    API.adminGetGeoRegions(geoDays).then((d) => setGeoRegions(d.regions || [])).catch(console.error);
    API.adminGetLoginTimeseries(geoDays).then((d) => setLoginTs(d.series || [])).catch(console.error);
  }, [tab, geoDays]);

  // Chart -> map sync: focus a country (toggle) or fly to a single city
  function focusCountry(country) {
    if (!country || country === geoCountryFilter) {
      setGeoCountryFilter("");
      setGeoFocus(mapLocations.map((l) => [l.lat, l.lng]));
      return;
    }
    setGeoCountryFilter(country);
    const pts = mapLocations.filter((l) => l.country === country).map((l) => [l.lat, l.lng]);
    if (pts.length) setGeoFocus(pts);
  }
  function focusCity(r) {
    const loc = mapLocations.find((l) => l.city === r.city && (!r.country || l.country === r.country));
    if (loc) setGeoFocus([[loc.lat, loc.lng]]);
  }

  const loadGlossary = useCallback(() => {
    setGlossaryLoading(true);
    API.adminGlossaryList()
      .then((d) => setGlossaryTerms(d.terms || []))
      .catch(console.error)
      .finally(() => setGlossaryLoading(false));
  }, []);

  async function handleTranslateMissing() {
    try {
      const r = await API.adminGlossaryTranslateMissing();
      notify.success(
        r.queued
          ? t(r.queued === 1 ? "ad.glossary.queuedOne" : "ad.glossary.queued", { n: r.queued })
          : t("ad.glossary.allTranslated"),
        { title: t("ad.glossary.translateTitle") }
      );
    } catch (e) { notify.error(e.message, { title: t("ad.actionFailed") }); }
  }

  async function handleDeleteTerm(term) {
    if (!window.confirm(t("ad.glossary.deleteConfirm", { term: term.term }))) return;
    try {
      await API.adminGlossaryDelete(term.id);
      loadGlossary();
    } catch (e) { notify.error(e.message, { title: t("ad.actionFailed") }); }
  }

  const loadResources = useCallback(() => {
    setResourcesLoading(true);
    API.adminResourcesList()
      .then((d) => { setResources(d.files || []); setResourceIndex(d.index || null); })
      .catch(console.error)
      .finally(() => setResourcesLoading(false));
  }, []);

  async function handleUploadResource(e) {
    const file = e.target.files?.[0];
    if (resourceFileRef.current) resourceFileRef.current.value = ""; // allow re-selecting same file
    if (!file) return;
    setResourceMsg("");
    setUploadingResource(true);
    try {
      await API.adminResourcesUpload(file);
      setResourceMsg(t("ad.res.uploaded", { name: file.name }));
      loadResources();
    } catch (err) { setResourceMsg(err.message); }
    finally { setUploadingResource(false); }
  }

  async function handleDeleteResource(name) {
    if (!window.confirm(t("ad.res.deleteConfirm", { name }))) return;
    setResourceMsg("");
    try {
      await API.adminResourcesDelete(name);
      loadResources();
    } catch (err) { setResourceMsg(err.message); }
  }

  async function handleViewResource(name) {
    try { await API.adminResourceOpen(name, { download: false }); }
    catch (err) { setResourceMsg(err.message); }
  }
  async function handleDownloadResource(name) {
    try { await API.adminResourceOpen(name, { download: true }); }
    catch (err) { setResourceMsg(err.message); }
  }

  const loadStepRes = useCallback(() => {
    setStepResLoading(true);
    API.adminStepResourcesList()
      .then((d) => setStepRes(d.resources || {
        en: { high_school: {}, higher_ed: {} },
        es: { high_school: {}, higher_ed: {} },
      }))
      .catch(console.error)
      .finally(() => setStepResLoading(false));
  }, []);

  function setStepField(lang, level, step, field, value) {
    setStepRes((r) => ({
      ...r,
      [lang]: {
        ...r[lang],
        [level]: { ...r[lang]?.[level], [step]: { ...(r[lang]?.[level]?.[step] || {}), [field]: value } },
      },
    }));
  }

  async function saveStepRes(lang, level, step) {
    const e = stepRes[lang]?.[level]?.[step] || {};
    const key = `${lang}:${level}:${step}`;
    setStepResSaving(key);
    try {
      await API.adminStepResourceUpdate({
        step: Number(step), level, lang,
        video_url: e.video_url || "", interactive_url: e.interactive_url || "",
      });
      setStepResSaved(key);
      setTimeout(() => setStepResSaved((k) => (k === key ? "" : k)), 1800);
    } catch (err) { notify.error(err.message, { title: t("ad.actionFailed") }); }
    finally { setStepResSaving(""); }
  }

  async function handleRebuildIndex() {
    setResourceMsg("");
    setRebuildingIndex(true);
    try {
      const r = await API.adminResourcesRebuild();
      setResourceMsg(t(r.sources === 1 ? "ad.res.rebuiltOne" : "ad.res.rebuilt", { sources: r.sources, chunks: r.chunks }));
      loadResources();
    } catch (err) { setResourceMsg(err.message); }
    finally { setRebuildingIndex(false); }
  }

  const loadUsers = useCallback(() => {
    API.adminGetUsers({
      skip: userPage * PAGE_SIZE,
      limit: PAGE_SIZE,
      role: userRoleFilter,
      search: userSearch,
      sortBy: userSort.by,
      sortDir: userSort.dir,
    }).then((d) => {
      setUsers(d.users || []);
      setUserTotal(d.total || 0);
    }).catch(console.error);
  }, [userPage, userRoleFilter, userSearch, userSort]);

  function toggleUserSort(col) {
    setUserPage(0);
    setUserSort((s) => s.by === col
      ? { by: col, dir: s.dir === "asc" ? "desc" : "asc" }
      : { by: col, dir: col === "name" ? "asc" : "desc" });
  }

  useEffect(() => {
    if (tab === "users") loadUsers();
  }, [loadUsers, tab]);

  const loadClasses = useCallback(() => {
    setClassesLoading(true);
    API.adminGetClasses({ skip: 0, limit: 500 })
      .then((d) => setClasses(d.classes || []))
      .catch(console.error)
      .finally(() => setClassesLoading(false));
    // Teacher list for the reassign / create-class selects
    API.adminGetUsers({ role: "teacher", limit: 500, sortBy: "name", sortDir: "asc" })
      .then((d) => setTeacherOptions(d.users || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (tab === "classes") loadClasses();
  }, [loadClasses, tab]);

  function openClassDetail(classId) {
    setClassDetailLoading(true);
    setClassDetail(null);
    API.adminGetClassDetail(classId)
      .then(setClassDetail)
      .catch((e) => { notify.error(e.message, { title: t("ad.class.loadFailed") }); setClassDetailLoading(false); })
      .finally(() => setClassDetailLoading(false));
  }

  function toggleClassSort(col) {
    setClassSort((s) => s.by === col
      ? { by: col, dir: s.dir === "asc" ? "desc" : "asc" }
      : { by: col, dir: ["class_name", "teacher_name"].includes(col) ? "asc" : "desc" });
  }

  async function saveClassEdits(classId, fields) {
    setClassModalError("");
    try {
      await API.adminUpdateClass(classId, fields);
      setEditingClass(null);
      loadClasses();
      if (classDetail && classDetail._id === classId) openClassDetail(classId);
      notify.success(t("ad.class.updated"));
    } catch (e) { setClassModalError(e.message); }
  }

  async function handleRemoveStudent(student) {
    if (!window.confirm(t("ad.class.removeStudentConfirm", { username: student.username }))) return;
    try {
      await API.adminDeleteUser(student._id);
      if (classDetail) openClassDetail(classDetail._id);
      loadClasses();
    } catch (e) { notify.error(e.message, { title: t("ad.actionFailed") }); }
  }

  const loadSessions = useCallback(() => {
    API.adminGetSessions({
      skip: sessionPage * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: sessionSearch,
      step: sessionStep,
      status: sessionStatus,
      sortBy: sessionSort.by,
      sortDir: sessionSort.dir,
    }).then((d) => {
      setSessions(d.sessions || []);
      setSessionTotal(d.total || 0);
      setSessionStats(d.stats || null);
    }).catch(console.error);
  }, [sessionPage, sessionSearch, sessionStep, sessionStatus, sessionSort]);

  useEffect(() => {
    if (tab === "sessions") loadSessions();
  }, [loadSessions, tab]);

  function toggleSessionSort(col) {
    setSessionPage(0);
    setSessionSort((s) => s.by === col
      ? { by: col, dir: s.dir === "asc" ? "desc" : "asc" }
      : { by: col, dir: "desc" });
  }

  async function handleDeleteSession(s) {
    const who = s.user_name || s.user_email || t("ad.sessions.unknownUser");
    if (!window.confirm(t("ad.sessions.deleteConfirm", { who }))) return;
    try {
      await API.adminDeleteSession(s.session_id);
      loadSessions();
    } catch (e) { notify.error(e.message, { title: t("ad.actionFailed") }); }
  }

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

  // Signups: zero-fill every day in the selected range so gaps read as quiet
  // days instead of the line skipping them
  const signupSeries = (() => {
    const byDate = Object.fromEntries(signups.map((s) => [s.date, s.count]));
    const out = [];
    for (let i = signupDays - 1; i >= 0; i--) {
      const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ date: key, count: byDate[key] || 0 });
    }
    return out;
  })();
  const signupTotal = signupSeries.reduce((s, d) => s + d.count, 0);

  // Step completion: zero-fill steps 1-9
  const stepCounts = Array.from({ length: 9 }, (_, i) =>
    stepCompletion.find((s) => s.step === i + 1)?.count || 0);
  const stepBarData = stepCounts.map((count, i) => ({
    name: STEP_LABELS[i],
    stepNum: i + 1,
    count,
    fill: STEP_COLORS[i],
  }));
  const stepMax = Math.max(...stepCounts, 1);
  // Biggest funnel drop between consecutive steps -> where students stall
  const dropOff = (() => {
    let best = null;
    for (let i = 1; i < 9; i++) {
      const d = stepCounts[i - 1] - stepCounts[i];
      if (d > 1 && (!best || d > best.lost)) best = { after: i, lost: d };
    }
    return best;
  })();

  // Classes: client-side search, teacher filter, and sort
  const shownClasses = (() => {
    const q = classSearchInput.trim().toLowerCase();
    let list = classes.filter((c) =>
      (!classTeacherFilter || c.teacher_id === classTeacherFilter) &&
      (!q || [c.class_name, c.class_code, c.teacher_name, c.teacher_email]
        .some((v) => (v || "").toLowerCase().includes(q))));
    const dir = classSort.dir === "asc" ? 1 : -1;
    const key = classSort.by;
    list = [...list].sort((a, b) => {
      let va = a[key], vb = b[key];
      if (key === "students") { va = a.actual_students || 0; vb = b.actual_students || 0; }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;         // nulls (e.g. no activity) always last
      if (vb == null) return -1;
      if (typeof va === "string") return va.localeCompare(vb, undefined, { sensitivity: "base" }) * dir;
      return (va - vb) * dir;
    });
    return list;
  })();
  const classTeachers = [...new Map(classes.map((c) => [c.teacher_id, { id: c.teacher_id, name: c.teacher_name, email: c.teacher_email }])).values()]
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // Map tab: zero-filled login series + cross-filtered locations/cities
  const loginSeries = (() => {
    if (!loginTs.length) return [];
    const byDate = Object.fromEntries(loginTs.map((d) => [d.date, d]));
    const start = geoDays
      ? new Date(Date.now() - (geoDays - 1) * 86400000)
      : new Date(loginTs[0].date + "T00:00:00Z");
    const today = new Date();
    const out = [];
    for (let d = new Date(start); d <= today; d = new Date(d.getTime() + 86400000)) {
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, success: byDate[key]?.success || 0, failed: byDate[key]?.failed || 0 });
    }
    return out;
  })();
  const failedTotal = loginSeries.reduce((s, d) => s + d.failed, 0);
  const countryFiltered = geoCountryFilter
    ? mapLocations.filter((l) => l.country === geoCountryFilter)
    : mapLocations;
  const shownMapLocations = countryFiltered.length ? countryFiltered : mapLocations;
  const shownRegions = geoCountryFilter
    ? geoRegions.filter((r) => r.country === geoCountryFilter)
    : geoRegions;

  const ic = (paths) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: paths }} />
  );
  const TABS = [
    { id: "overview", label: t("ad.tab.overview"), sub: t("ad.tab.overviewSub"),
      icon: ic('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>') },
    { id: "users", label: t("ad.tab.users"), sub: t("ad.tab.usersSub"),
      icon: ic('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>') },
    { id: "classes", label: t("ad.tab.classes"), sub: t("ad.tab.classesSub"),
      icon: ic('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>') },
    { id: "sessions", label: t("ad.tab.sessions"), sub: t("ad.tab.sessionsSub"),
      icon: ic('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>') },
    { id: "map", label: t("ad.tab.map"), sub: t("ad.tab.mapSub"),
      icon: ic('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>') },
    { id: "activity", label: t("ad.tab.activity"), sub: t("ad.tab.activitySub"),
      icon: ic('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>') },
    { id: "glossary", label: t("ad.tab.glossary"), sub: t("ad.tab.glossarySub"),
      icon: ic('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>') },
    { id: "resources", label: t("ad.tab.resources"), sub: t("ad.tab.resourcesSub"),
      icon: ic('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>') },
    { id: "stepres", label: t("ad.tab.stepres"), sub: t("ad.tab.stepresSub"),
      icon: ic('<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>') },
    { id: "health", label: t("ad.tab.health"), sub: t("ad.tab.healthSub"),
      icon: ic('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>') },
  ];
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];

  // Class CRUD modals - rendered from both the table view and the drill-down
  function renderClassModals() {
    return (
      <>
        {editingClass && (
          <EditClassModal
            cls={editingClass}
            teachers={teacherOptions}
            error={classModalError}
            onClose={() => setEditingClass(null)}
            onSave={(fields) => saveClassEdits(editingClass._id, fields)}
          />
        )}
        {addStudentsClass && (
          <AddStudentsModal
            cls={addStudentsClass}
            error={classModalError}
            onClose={() => setAddStudentsClass(null)}
            onSave={async (count) => {
              setClassModalError("");
              try {
                const r = await API.adminAddClassStudents(addStudentsClass._id, count);
                setAddStudentsClass(null);
                loadClasses();
                if (classDetail && classDetail._id === addStudentsClass._id) openClassDetail(addStudentsClass._id);
                notify.success(t(r.students.length === 1 ? "ad.class.addedStudentsOne" : "ad.class.addedStudents", { n: r.students.length }));
              } catch (e) { setClassModalError(e.message); }
            }}
          />
        )}
        {creatingClass && (
          <CreateClassModal
            teachers={teacherOptions}
            error={classModalError}
            onClose={() => setCreatingClass(false)}
            onSave={async (fields) => {
              setClassModalError("");
              try {
                const r = await API.adminCreateClass(fields);
                setCreatingClass(false);
                loadClasses();
                notify.success(t("ad.class.created", { code: r.class_code }));
              } catch (e) { setClassModalError(e.message); }
            }}
          />
        )}
        {classResetPw && (
          <ResetPasswordModal
            user={classResetPw}
            error={classModalError}
            onClose={() => setClassResetPw(null)}
            onSave={async (pw) => {
              setClassModalError("");
              try {
                await API.adminResetPassword(classResetPw._id, pw);
                setClassResetPw(null);
                notify.success(t("ad.class.pwReset"));
              } catch (e) { setClassModalError(e.message); }
            }}
          />
        )}
      </>
    );
  }

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
            <button className="ad-back-btn" onClick={() => { setUserDetail(null); setUserDetailLoading(false); }}>{t("ad.backToUsers")}</button>
          </div>
          <div className="ad-header__right">
            <ProfileMenu
              user={user}
              onSignOut={logout}
              onOpenSettings={() => setSettingsOpen(true)}
              roleLabel={t("ad.roleAdministrator")}
            />
          </div>
        </header>
        <div className="ad-body">
          {userDetailLoading && <div className="ad-loading">{t("ad.loadingUserDetails")}</div>}
          {userDetail && <UserDetailView detail={userDetail} onViewSession={(sid, name) => setViewingSession({ sessionId: sid, name })} />}
        </div>
      </div>
    );
  }

  // If viewing class detail, show drill-down
  if (classDetail || classDetailLoading) {
    return (
      <div className="ad-dashboard">
        <header className="ad-header">
          <div className="ad-header__left">
            <button className="ad-back-btn" onClick={() => { setClassDetail(null); setClassDetailLoading(false); }}>{t("ad.backToClasses")}</button>
          </div>
          <div className="ad-header__right">
            <ProfileMenu
              user={user}
              onSignOut={logout}
              onOpenSettings={() => setSettingsOpen(true)}
              roleLabel={t("ad.roleAdministrator")}
            />
          </div>
        </header>
        <div className="ad-body">
          {classDetailLoading && <div className="ad-loading">{t("ad.loadingClass")}</div>}
          {classDetail && (
            <ClassDetailView
              detail={classDetail}
              onViewSession={(sid, name) => setViewingSession({ sessionId: sid, name })}
              onEdit={() => { setEditingClass(classDetail); setClassModalError(""); }}
              onAddStudents={() => { setAddStudentsClass(classDetail); setClassModalError(""); }}
              onResetPw={(s) => { setClassResetPw(s); setClassModalError(""); }}
              onRemoveStudent={handleRemoveStudent}
            />
          )}
          {renderClassModals()}
        </div>
      </div>
    );
  }

  return (
    <div className="ad-dashboard ad-wrap">
      {/* Header */}
      <header className="ad-header">
        <div className="ad-header__left">
          <img
            src={theme === "dark" ? "/Hopscotch4-all-logo-White-alpha.png" : "/Hopscotch-4-all-logo-alpha.png"}
            alt="Hopscotch 4 All"
            className="hop-logo"
          />
          <span className="ad-header__badge">{t("ad.role.admin")}</span>
        </div>
        <div className="ad-header__right">
          <ProfileMenu
            user={user}
            onSignOut={logout}
            onOpenSettings={() => setSettingsOpen(true)}
            roleLabel={t("ad.roleAdministrator")}
          />
        </div>
      </header>

      <div className="td td--shell">
        {/* Sidebar nav (shared shell styles with the teacher dashboard) */}
        <aside className="td-sidebar">
          <nav className="td-sidebar__nav">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`td-sidebar__item${tab === t.id ? " td-sidebar__item--active" : ""}`}
                onClick={() => setTab(t.id)}
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
            <h1 className="td-main__title">{activeTab.label}</h1>
            <p className="td-main__sub">{activeTab.sub}</p>
          </div>
        </header>

        {/* Stat tiles - each clicks through to its tab */}
        {tab === "overview" && stats && (
          <div className="ad-stats">
            <StatTile
              label={t("ad.tile.totalUsers")} value={stats.total_users} color="#2B5EA7"
              hint={t("ad.tile.totalUsersHint", { teachers: stats.role_counts?.teacher || 0, students: (stats.role_counts?.student || 0) + (stats.role_counts?.classroom_student || 0) })}
              onClick={() => setTab("users")}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
            />
            <StatTile
              label={t("ad.tile.sessions")} value={stats.total_sessions} color="#E8618C"
              hint={t("ad.tile.sessionsHint")}
              onClick={() => setTab("sessions")}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
            />
            <StatTile
              label={t("ad.tile.classes")} value={stats.total_classes} color="#1A8A7D"
              hint={t("ad.tile.classesHint")}
              onClick={() => setTab("classes")}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>}
            />
            <StatTile
              label={t("ad.tile.active7")} value={stats.active_users_7d} color="#F0B429"
              hint={t("ad.tile.active7Hint")}
              onClick={() => setTab("activity")}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
            />
            <StatTile
              label={t("ad.tile.active30")} value={stats.active_users_30d} color="#F5922A"
              hint={t("ad.tile.active30Hint")}
              onClick={() => setTab("activity")}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            />
          </div>
        )}

        {/* Tab content */}
        <div className="ad-tab-content">
          {loading && <div className="ad-loading">{t("ad.loading")}</div>}

          {/* ===== OVERVIEW ===== */}
          {tab === "overview" && !loading && (
            <div className="ad-overview">
              <div className="ad-chart-row">
                <div className="ad-chart-card">
                  <div className="ad-chart-card__header">
                    <h4 className="ad-chart-card__title">
                      <span className="ad-chart-card__ic" style={{ color: "#2B5EA7", background: "rgba(43,94,167,0.10)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                      </span>
                      {t("ad.chart.newSignups")}
                      <span className="ad-chart-count">{signupTotal}</span>
                    </h4>
                    <div className="ad-seg ad-seg--sm">
                      {[[7, t("ad.seg.7d")], [30, t("ad.seg.30d")], [90, t("ad.seg.90d")]].map(([d, label]) => (
                        <button
                          key={d}
                          className={`ad-seg__btn${signupDays === d ? " ad-seg__btn--active" : ""}`}
                          onClick={() => setSignupDays(d)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="ad-chart-card__desc">{t("ad.chart.newSignupsDesc", { n: signupDays })}</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={signupSeries} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <defs>
                        <linearGradient id="adSignupGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2B5EA7" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#2B5EA7" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border, #e5e7eb)" />
                      <XAxis
                        dataKey="date" tick={{ fontSize: 10 }} minTickGap={24}
                        tickFormatter={(d) => d.slice(5).replace("-", "/")}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }}
                        formatter={(v) => [t(v === 1 ? "ad.chart.signupOne" : "ad.chart.signups", { n: v })]}
                      />
                      <Area type="monotone" dataKey="count" stroke="#2B5EA7" strokeWidth={2} fill="url(#adSignupGrad)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="ad-chart-card">
                  <h4 className="ad-chart-card__title">
                    <span className="ad-chart-card__ic" style={{ color: "#7C3AED", background: "rgba(124,58,237,0.10)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
                    </span>
                    {t("ad.chart.usersByRole")}
                  </h4>
                  <p className="ad-chart-card__desc">{t("ad.chart.usersByRoleDesc", { n: stats?.total_users ?? 0 })}</p>
                  {rolePieData.length > 0 ? (
                    <div className="ad-donut">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={rolePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2}>
                            {rolePieData.map((d, i) => (
                              <Cell key={i} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }}
                            formatter={(v, name) => [t(v === 1 ? "ad.chart.userOne" : "ad.chart.users", { n: v }), name]}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="ad-donut__center">
                        <span className="ad-donut__num">{stats?.total_users ?? 0}</span>
                        <span className="ad-donut__cap">{t("ad.chart.usersCap")}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="ad-empty">{t("ad.empty.userData")}</p>
                  )}
                </div>
              </div>

              <div className="ad-chart-row" style={{ marginTop: 20 }}>
                <div className="ad-chart-card">
                  <h4 className="ad-chart-card__title">
                    <span className="ad-chart-card__ic" style={{ color: "#1A8A7D", background: "rgba(26,138,125,0.10)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    </span>
                    {t("ad.chart.stepCompletion")}
                  </h4>
                  <p className="ad-chart-card__desc">{t("ad.chart.stepCompletionDesc")}</p>
                  {dropOff && (
                    <div className="td-bottleneck" style={{ cursor: "default" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                      {t(dropOff.lost === 1 ? "ad.chart.dropOffOne" : "ad.chart.dropOff", { n: dropOff.after, label: STEP_LABELS[dropOff.after - 1], lost: dropOff.lost })}
                    </div>
                  )}
                  {stepMax > 1 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stepBarData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border, #e5e7eb)" />
                        <XAxis dataKey="stepNum" tick={{ fontSize: 11 }} tickFormatter={(n) => `S${n}`} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }}
                          formatter={(v, _, props) => [t(v === 1 ? "ad.chart.studentOne" : "ad.chart.students", { n: v }), props.payload.name]}
                          labelFormatter={(n) => t("chat.step", { n })}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {stepBarData.map((d, i) => (
                            <Cell key={i} fill={d.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="ad-empty">{t("ad.empty.stepCompletion")}</p>
                  )}
                </div>

                {/* All-students hopscotch court: opacity = share of the busiest step */}
                <div className="ad-chart-card">
                  <h4 className="ad-chart-card__title">
                    <span className="ad-chart-card__ic" style={{ color: "#E8618C", background: "rgba(232,97,140,0.10)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
                    </span>
                    {t("ad.chart.court")}
                  </h4>
                  <p className="ad-chart-card__desc">{t("ad.chart.courtDesc")}</p>
                  <div className="td-court">
                    <svg viewBox="-2 -8 132 62" className="td-court__svg" aria-label={t("ad.chart.courtAria")}>
                      {[
                        { x: 0, y: 0 }, { x: 0, y: 24 }, { x: 22, y: 12 }, { x: 44, y: 0 },
                        { x: 44, y: 24 }, { x: 66, y: 12 }, { x: 88, y: 0 }, { x: 88, y: 24 },
                      ].map((p, i) => {
                        const count = stepCounts[i];
                        const pct = count / stepMax;
                        return (
                          <g key={i} className="td-court__sq" style={{ cursor: "default" }}>
                            <rect x={p.x} y={p.y} width="18" height="22" rx="6"
                              fill={STEP_COLORS[i]} fillOpacity={0.14 + 0.86 * pct}
                              stroke={STEP_COLORS[i]} strokeWidth="1.2" strokeOpacity="0.75">
                              <title>{t(count === 1 ? "ad.chart.courtSqOne" : "ad.chart.courtSq", { n: i + 1, label: STEP_LABELS[i], count })}</title>
                            </rect>
                            <text x={p.x + 9} y={p.y + 11} textAnchor="middle" dominantBaseline="central" fontSize="6.5" fontWeight="700"
                              fill={pct > 0.55 ? "#fff" : "var(--hop-ink-secondary)"} pointerEvents="none">
                              {count}
                            </text>
                          </g>
                        );
                      })}
                      {(() => {
                        const count = stepCounts[8];
                        const pct = count / stepMax;
                        return (
                          <g className="td-court__sq" style={{ cursor: "default" }}>
                            <path d="M110,7 A16,16 0 0,1 110,39 Z"
                              fill={STEP_COLORS[8]} fillOpacity={0.14 + 0.86 * pct}
                              stroke={STEP_COLORS[8]} strokeWidth="1.2" strokeOpacity="0.75">
                              <title>{t(count === 1 ? "ad.chart.courtSqOne" : "ad.chart.courtSq", { n: 9, label: STEP_LABELS[8], count })}</title>
                            </path>
                            <text x="116.8" y="23" textAnchor="middle" dominantBaseline="central" fontSize="6.5" fontWeight="700"
                              fill={pct > 0.55 ? "#fff" : "var(--hop-ink-secondary)"} pointerEvents="none">
                              {count}
                            </text>
                          </g>
                        );
                      })()}
                    </svg>
                    <div className="td-court__legend">
                      {STEP_LABELS.map((l, i) => (
                        <span key={i} className="td-court__leg" style={{ "--leg": STEP_COLORS[i] }}>
                          <span className="td-court__leg-dot" />{t("td.stepAbbr", { n: i + 1 })} {l}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== USERS ===== */}
          {tab === "users" && (
            <div className="ad-users">
              <div className="ad-users__toolbar">
                <div className="ad-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    placeholder={t("ad.users.searchPh")}
                    value={userSearchInput}
                    onChange={(e) => setUserSearchInput(e.target.value)}
                  />
                  {userSearchInput && (
                    <button className="ad-search__clear" title={t("td.clearSearch")} onClick={() => setUserSearchInput("")}>&times;</button>
                  )}
                </div>
                <button className="td-btn td-btn--outline td-btn--sm" onClick={() => API.adminExportCSV("users")}>
                  {t("ad.exportCsv")}
                </button>
                <button className="td-btn td-btn--primary td-btn--sm" onClick={() => { setCreatingUser(true); setModalError(""); }}>
                  {t("ad.users.create")}
                </button>
              </div>

              {/* Role filter chips with live counts */}
              <div className="ad-rolechips">
                {[["", t("ad.filter.all"), stats?.total_users], ...Object.keys(ROLE_LABELS).map((r) => [r, ROLE_LABELS[r], stats?.role_counts?.[r] || 0])].map(([id, label, count]) => (
                  <button
                    key={id || "all"}
                    className={`ad-rolechip${userRoleFilter === id ? " ad-rolechip--active" : ""}`}
                    style={{ "--chip": id ? ROLE_COLORS[id] : "var(--hop-navy, #2B4C7E)" }}
                    onClick={() => { setUserRoleFilter(id); setUserPage(0); }}
                  >
                    {id && <span className="ad-rolechip__dot" />}
                    {label}
                    <span className="ad-rolechip__count">{count ?? 0}</span>
                  </button>
                ))}
              </div>

              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <SortTh label={t("ad.th.user")} col="name" sort={userSort} onSort={toggleUserSort} />
                      <th>{t("ad.th.role")}</th>
                      <th>{t("ad.th.education")}</th>
                      <th>{t("ad.th.status")}</th>
                      <SortTh label={t("ad.th.lastLogin")} col="last_login_at" sort={userSort} onSort={toggleUserSort} />
                      <SortTh label={t("ad.th.created")} col="created_at" sort={userSort} onSort={toggleUserSort} />
                      <th>{t("ad.th.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id} className="ad-row--clickable" onClick={() => openUserDetail(u._id)}>
                        <td>
                          <div className="td-table__student">
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
                        <td><span className="ad-edu-chip">{u.education_level === "higher_ed" ? t("ad.edu.higherEd") : t("ad.edu.highSchool")}</span></td>
                        <td>
                          <span className={`ad-pill ${u.is_active === false ? "ad-pill--off" : "ad-pill--ok"}`}>
                            {u.is_active === false ? t("ad.status.inactive") : t("ad.status.active")}
                          </span>
                        </td>
                        <td>
                          <div className="td-table__muted">{timeAgo(u.last_login_at, t, lang) || t("td.never")}</div>
                          {u.last_login_ip && <div className="td-table__mono" style={{ fontSize: "0.7rem" }}>{u.last_login_ip}</div>}
                        </td>
                        <td className="td-table__muted">{u.created_at ? new Date(u.created_at).toLocaleDateString(dateLocale) : ""}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="ad-actions">
                            <button className="ad-action-btn" title={t("ad.action.edit")} onClick={() => { setEditingUser({ ...u }); setModalError(""); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="ad-action-btn" title={t("ad.action.resetPw")} onClick={() => { setResetPwUser(u); setModalError(""); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </button>
                            <button
                              className="ad-action-btn"
                              title={u.is_active === false ? t("ad.action.reactivate") : t("ad.action.deactivate")}
                              onClick={() => handleToggleActive(u)}
                            >
                              {u.is_active === false ? "\u25B6" : "\u23F8"}
                            </button>
                            <button className="ad-action-btn ad-action-btn--danger" title={t("ad.action.delete")} onClick={() => setDeleteUser(u)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={7} className="ad-empty" style={{ textAlign: "center", padding: 32 }}>
                          {userSearch || userRoleFilter ? (
                            <>
                              {t("ad.users.noMatchPrefix")}{userSearch ? <> "<strong>{userSearch}</strong>"</> : ""}{userRoleFilter ? ` ${t("ad.users.inRole", { role: ROLE_LABELS[userRoleFilter] })}` : ""}.{" "}
                              <button className="ad-linkbtn" onClick={() => { setUserSearchInput(""); setUserRoleFilter(""); setUserPage(0); }}>
                                {t("ad.clearFilters")}
                              </button>
                            </>
                          ) : t("ad.users.empty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ad-pagination">
                <button disabled={userPage === 0} onClick={() => setUserPage((p) => p - 1)}>{t("ad.prev")}</button>
                <span>
                  {userTotal === 0 ? t("ad.page.usersZero") : t(userTotal === 1 ? "ad.page.usersOne" : "ad.page.users", { a: userPage * PAGE_SIZE + 1, b: Math.min((userPage + 1) * PAGE_SIZE, userTotal), total: userTotal })}
                </span>
                <button disabled={(userPage + 1) * PAGE_SIZE >= userTotal} onClick={() => setUserPage((p) => p + 1)}>{t("ad.next")}</button>
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
                    } catch (e) { notify.error(e.message, { title: t("ad.actionFailed") }); }
                  }}
                />
              )}
            </div>
          )}

          {/* ===== CLASSES ===== */}
          {tab === "classes" && (
            <div className="ad-users">
              <div className="ad-users__toolbar">
                <div className="ad-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    placeholder={t("ad.classes.searchPh")}
                    value={classSearchInput}
                    onChange={(e) => setClassSearchInput(e.target.value)}
                  />
                  {classSearchInput && (
                    <button className="ad-search__clear" title={t("td.clearSearch")} onClick={() => setClassSearchInput("")}>&times;</button>
                  )}
                </div>
                <select
                  className="ad-users__filter"
                  value={classTeacherFilter}
                  onChange={(e) => setClassTeacherFilter(e.target.value)}
                >
                  <option value="">{t("ad.classes.allTeachers")}</option>
                  {classTeachers.map((tc) => (
                    <option key={tc.id} value={tc.id}>{tc.name || tc.email || t("ad.unknown")}</option>
                  ))}
                </select>
                <span className="ad-glossary__count">
                  {t(classes.length === 1 ? "ad.classes.countOne" : "ad.classes.count", { shown: shownClasses.length, total: classes.length })}
                </span>
                <button className="td-btn td-btn--primary td-btn--sm" onClick={() => { setCreatingClass(true); setClassModalError(""); }}>
                  {t("ad.classes.create")}
                </button>
              </div>

              {classesLoading && <div className="ad-loading">{t("td.loadingClasses")}</div>}

              {!classesLoading && (
              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <SortTh label={t("td.thClass")} col="class_name" sort={classSort} onSort={toggleClassSort} />
                      <SortTh label={t("ad.th.teacher")} col="teacher_name" sort={classSort} onSort={toggleClassSort} />
                      <SortTh label={t("td.students")} col="students" sort={classSort} onSort={toggleClassSort} />
                      <SortTh label={t("td.thProgress")} col="avg_progress" sort={classSort} onSort={toggleClassSort} />
                      <th>{t("ad.th.ai")}</th>
                      <SortTh label={t("td.thLastActivity")} col="last_activity" sort={classSort} onSort={toggleClassSort} />
                      <SortTh label={t("ad.th.created")} col="created_at" sort={classSort} onSort={toggleClassSort} />
                      <th>{t("ad.th.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownClasses.map((c) => (
                      <tr key={c._id} className="ad-row--clickable" onClick={() => openClassDetail(c._id)}>
                        <td>
                          <div className="td-table__name ad-clickable">{c.class_name}</div>
                          <span className="ad-ccard__code">{c.class_code}</span>
                        </td>
                        <td>
                          <div>{c.teacher_name || "\u2014"}</div>
                          <div className="td-table__mono" style={{ fontSize: "0.72rem" }}>{c.teacher_email}</div>
                        </td>
                        <td>
                          <div className="td-table__muted">{c.actual_students} / {c.student_count}</div>
                          <div className="ad-minibar"><div className="ad-minibar__fill" style={{ width: `${c.student_count ? Math.min(100, Math.round((c.actual_students / c.student_count) * 100)) : 0}%` }} /></div>
                        </td>
                        <td>
                          <div className="td-table__muted">{c.avg_progress || 0}%</div>
                          <div className="ad-minibar"><div className="ad-minibar__fill ad-minibar__fill--progress" style={{ width: `${c.avg_progress || 0}%` }} /></div>
                        </td>
                        <td>
                          <span className={`ad-pill ${c.settings?.ai_enabled === false ? "ad-pill--off" : "ad-pill--ok"}`}>
                            {c.settings?.ai_enabled === false ? t("td.off") : t("td.on")}
                          </span>
                        </td>
                        <td className="td-table__muted">{c.last_activity ? timeAgo(c.last_activity, t, lang) : "\u2014"}</td>
                        <td className="td-table__muted">{c.created_at ? new Date(c.created_at).toLocaleDateString(dateLocale) : ""}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="ad-actions">
                            <button className="ad-action-btn" title={t("ad.action.editClass")} onClick={() => { setEditingClass(c); setClassModalError(""); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="ad-action-btn" title={t("ad.action.addStudents")} onClick={() => { setAddStudentsClass(c); setClassModalError(""); }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                            </button>
                            <button className="ad-action-btn ad-action-btn--danger" title={t("ad.action.deleteClass")} onClick={() => setDeleteClass(c)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {shownClasses.length === 0 && (
                      <tr>
                        <td colSpan={8} className="ad-empty" style={{ textAlign: "center", padding: 32 }}>
                          {classSearchInput || classTeacherFilter ? (
                            <>
                              {t("ad.classes.noMatch")}{" "}
                              <button className="ad-linkbtn" onClick={() => { setClassSearchInput(""); setClassTeacherFilter(""); }}>{t("ad.clearFilters")}</button>
                            </>
                          ) : t("ad.classes.empty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}

              {deleteClass && (
                <div className="ad-modal-backdrop" onClick={() => setDeleteClass(null)}>
                  <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>{t("ad.classes.deleteTitle")}</h3>
                    <p>{t("ad.classes.deleteConfirmPre")} <strong>{deleteClass.class_name}</strong> ({deleteClass.class_code})?</p>
                    <p style={{ color: "#DC2626", fontSize: "0.85rem" }}>{t("ad.classes.deleteNote", { n: deleteClass.actual_students })}</p>
                    <div className="ad-modal__actions">
                      <button className="td-btn td-btn--outline td-btn--sm" onClick={() => setDeleteClass(null)}>{t("td.cancel")}</button>
                      <button className="td-btn td-btn--sm" style={{ background: "#DC2626", color: "#fff" }} onClick={async () => {
                        try {
                          await API.adminDeleteClass(deleteClass._id);
                          setDeleteClass(null);
                          loadClasses();
                        } catch (e) { notify.error(e.message, { title: t("ad.actionFailed") }); }
                      }}>{t("ad.action.delete")}</button>
                    </div>
                  </div>
                </div>
              )}
              {renderClassModals()}
            </div>
          )}

          {/* ===== SESSIONS ===== */}
          {tab === "sessions" && (
            <div className="ad-users">
              <div className="ad-users__toolbar">
                <div className="ad-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    placeholder={t("ad.sessions.searchPh")}
                    value={sessionSearchInput}
                    onChange={(e) => setSessionSearchInput(e.target.value)}
                  />
                  {sessionSearchInput && (
                    <button className="ad-search__clear" title={t("td.clearSearch")} onClick={() => setSessionSearchInput("")}>&times;</button>
                  )}
                </div>
                <select
                  className="ad-users__filter"
                  value={sessionStep}
                  onChange={(e) => { setSessionStep(Number(e.target.value)); setSessionPage(0); }}
                >
                  <option value={0}>{t("ad.sessions.allSteps")}</option>
                  {STEP_LABELS.map((l, i) => (
                    <option key={i} value={i + 1}>{t("panel.stepTip", { n: i + 1, label: l })}</option>
                  ))}
                </select>
                <button className="td-btn td-btn--outline td-btn--sm" onClick={() => API.adminExportCSV("sessions")}>
                  {t("ad.exportCsv")}
                </button>
                {sessionStats && (sessionStats.empty > 0 || sessionStats.orphaned > 0) && (
                  <button className="td-btn td-btn--outline td-btn--sm ad-btn--warn" onClick={() => setCleanupOpen(true)}>
                    {t("ad.sessions.cleanup", { n: sessionStats.empty + sessionStats.orphaned })}
                  </button>
                )}
              </div>

              {/* Status filter chips */}
              <div className="ad-rolechips">
                {[["", t("ad.filter.all"), "var(--hop-navy, #2B4C7E)"], ["active7", t("ad.sessions.active7"), "#16A34A"], ["completed", t("ad.sessions.completed"), "#1A8A7D"], ["stale", t("ad.sessions.stale"), "#F5922A"], ["empty", t("ad.sessions.chipEmpty"), "#7B8794"]].map(([id, label, color]) => (
                  <button
                    key={id || "all"}
                    className={`ad-rolechip${sessionStatus === id ? " ad-rolechip--active" : ""}`}
                    style={{ "--chip": color }}
                    onClick={() => { setSessionStatus(id); setSessionPage(0); }}
                  >
                    {id && <span className="ad-rolechip__dot" />}
                    {label}
                  </button>
                ))}
              </div>

              <div className="td-table-wrap">
                <table className="td-table">
                  <thead>
                    <tr>
                      <th>{t("ad.th.user")}</th>
                      <th>{t("td.thProgress")}</th>
                      <SortTh label={t("ad.th.step")} col="active_step" sort={sessionSort} onSort={toggleSessionSort} />
                      <th>{t("td.thWorldview")}</th>
                      <th>{t("td.thPath")}</th>
                      <SortTh label={t("ad.th.created")} col="created_at" sort={sessionSort} onSort={toggleSessionSort} />
                      <SortTh label={t("ad.th.updated")} col="updated_at" sort={sessionSort} onSort={toggleSessionSort} />
                      <th>{t("ad.th.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.session_id}>
                        <td>
                          <div className="td-table__student">
                            <div>
                              <div className="td-table__name">
                                {s.user_name || "\u2014"}
                                {s.orphaned && <span className="ad-pill ad-pill--off" style={{ marginLeft: 6 }}>{t("ad.sessions.deletedUser")}</span>}
                              </div>
                              <div className="td-table__mono">{s.user_email || ""}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="td-table__muted">{t("ad.sessions.stepsOf", { n: s.steps_done || 0 })}</div>
                          <div className="ad-minibar"><div className="ad-minibar__fill ad-minibar__fill--progress" style={{ width: `${Math.round(((s.steps_done || 0) / 9) * 100)}%` }} /></div>
                        </td>
                        <td>
                          <span className="ad-role-badge" style={{ background: STEP_COLORS[(s.active_step || 1) - 1] || "#999" }}>
                            {t("chat.step", { n: s.active_step || 1 })}
                          </span>
                        </td>
                        <td className="td-table__muted">{s.worldview_label || "\u2014"}</td>
                        <td className="td-table__muted">{s.resolved_path || "\u2014"}</td>
                        <td className="td-table__muted">{timeAgo(s.created_at, t, lang)}</td>
                        <td className="td-table__muted">{timeAgo(s.updated_at, t, lang)}</td>
                        <td>
                          <div className="ad-actions">
                            <button
                              className="td-btn td-btn--outline td-btn--sm"
                              onClick={() => setViewingSession({ sessionId: s.session_id, name: s.user_name })}
                            >
                              {t("td.view")}
                            </button>
                            <button className="ad-action-btn ad-action-btn--danger" title={t("ad.action.deleteSession")} onClick={() => handleDeleteSession(s)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="ad-empty" style={{ textAlign: "center", padding: 32 }}>
                          {sessionSearch || sessionStatus || sessionStep ? (
                            <>
                              {t("ad.sessions.noMatch")}{" "}
                              <button className="ad-linkbtn" onClick={() => { setSessionSearchInput(""); setSessionStatus(""); setSessionStep(0); setSessionPage(0); }}>
                                {t("ad.clearFilters")}
                              </button>
                            </>
                          ) : t("ad.sessions.empty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ad-pagination">
                <button disabled={sessionPage === 0} onClick={() => setSessionPage((p) => p - 1)}>{t("ad.prev")}</button>
                <span>
                  {sessionTotal === 0 ? t("ad.page.sessionsZero") : t(sessionTotal === 1 ? "ad.page.sessionsOne" : "ad.page.sessions", { a: sessionPage * PAGE_SIZE + 1, b: Math.min((sessionPage + 1) * PAGE_SIZE, sessionTotal), total: sessionTotal })}
                </span>
                <button disabled={(sessionPage + 1) * PAGE_SIZE >= sessionTotal} onClick={() => setSessionPage((p) => p + 1)}>{t("ad.next")}</button>
              </div>

              {cleanupOpen && sessionStats && (
                <div className="ad-modal-backdrop" onClick={() => setCleanupOpen(false)}>
                  <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>{t("ad.cleanup.title")}</h3>
                    <p style={{ fontSize: "0.9rem" }}>
                      {sessionStats.empty > 0 && <>\u2022 <strong>{sessionStats.empty}</strong> {t(sessionStats.empty === 1 ? "ad.cleanup.emptyOne" : "ad.cleanup.empty")}<br /></>}
                      {sessionStats.orphaned > 0 && <>\u2022 <strong>{sessionStats.orphaned}</strong> {t(sessionStats.orphaned === 1 ? "ad.cleanup.orphanedOne" : "ad.cleanup.orphaned")}</>}
                    </p>
                    <p style={{ color: "#DC2626", fontSize: "0.85rem" }}>{t("ad.cleanup.note")}</p>
                    <div className="ad-modal__actions">
                      <button className="td-btn td-btn--outline td-btn--sm" onClick={() => setCleanupOpen(false)}>{t("td.cancel")}</button>
                      {sessionStats.empty > 0 && (
                        <button className="td-btn td-btn--sm" style={{ background: "#DC2626", color: "#fff" }} onClick={async () => {
                          try {
                            const r = await API.adminCleanupSessions("empty");
                            notify.success(t(r.deleted === 1 ? "ad.cleanup.deletedEmptyOne" : "ad.cleanup.deletedEmpty", { n: r.deleted }));
                            setCleanupOpen(false);
                            loadSessions();
                          } catch (e) { notify.error(e.message, { title: t("ad.cleanup.failed") }); }
                        }}>{t("ad.cleanup.deleteEmpty")}</button>
                      )}
                      {sessionStats.orphaned > 0 && (
                        <button className="td-btn td-btn--sm" style={{ background: "#DC2626", color: "#fff" }} onClick={async () => {
                          try {
                            const r = await API.adminCleanupSessions("orphaned");
                            notify.success(t(r.deleted === 1 ? "ad.cleanup.deletedOrphanedOne" : "ad.cleanup.deletedOrphaned", { n: r.deleted }));
                            setCleanupOpen(false);
                            loadSessions();
                          } catch (e) { notify.error(e.message, { title: t("ad.cleanup.failed") }); }
                        }}>{t("ad.cleanup.deleteOrphaned")}</button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== MAP & GEO ANALYTICS ===== */}
          {tab === "map" && (
            <div className="ad-geo">
              {/* Range toggle + summary tiles */}
              <div className="ad-geo__bar">
                <div className="ad-geo__tiles">
                  <div className="ad-geo__tile">
                    <span className="ad-geo__tile-num">{geoCountries.length}</span>
                    <span className="ad-geo__tile-cap">{t(geoCountries.length === 1 ? "ad.geo.countryOne" : "ad.geo.countries")}</span>
                  </div>
                  <div className="ad-geo__tile">
                    <span className="ad-geo__tile-num">{geoRegions.length}</span>
                    <span className="ad-geo__tile-cap">{t(geoRegions.length === 1 ? "ad.geo.cityOne" : "ad.geo.cities")}</span>
                  </div>
                  <div className="ad-geo__tile">
                    <span className="ad-geo__tile-num">{geoCountries.reduce((s, c) => s + (c.logins || 0), 0)}</span>
                    <span className="ad-geo__tile-cap">{t("ad.geo.logins")}</span>
                  </div>
                  {geoCountries.length > 0 && (() => {
                    const top = [...geoCountries].sort((a, b) => (b.unique_users || 0) - (a.unique_users || 0))[0];
                    return (
                      <div className="ad-geo__tile">
                        <span className="ad-geo__tile-num">{top.country}</span>
                        <span className="ad-geo__tile-cap">{t("ad.geo.topCountry", { n: top.unique_users })}</span>
                      </div>
                    );
                  })()}
                </div>
                <div className="ad-seg ad-seg--sm">
                  {[[0, t("ad.seg.allTime")], [90, t("ad.seg.90d")], [30, t("ad.seg.30d")], [7, t("ad.seg.7d")]].map(([d, label]) => (
                    <button
                      key={d}
                      className={`ad-seg__btn${geoDays === d ? " ad-seg__btn--active" : ""}`}
                      onClick={() => setGeoDays(d)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Login activity over time - the monitoring pulse */}
              <div className="ad-chart-card ad-chart-card--wide" style={{ marginTop: 20 }}>
                <h4 className="ad-chart-card__title">
                  <span className="ad-chart-card__ic" style={{ color: "#16A34A", background: "rgba(22,163,74,0.10)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </span>
                  {t("ad.geo.loginActivity")}
                  {failedTotal > 0 && <span className="ad-chart-count" style={{ color: "#DC2626" }}>{t("ad.geo.failedCount", { n: failedTotal })}</span>}
                </h4>
                <p className="ad-chart-card__desc">{geoDays ? t("ad.geo.loginActivityDescRange", { n: geoDays }) : t("ad.geo.loginActivityDescAll")}</p>
                {loginSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={loginSeries} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                      <defs>
                        <linearGradient id="adLoginGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16A34A" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#16A34A" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border, #e5e7eb)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={28} tickFormatter={(d) => d.slice(5).replace("-", "/")} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="success" name={t("ad.geo.successful")} stroke="#16A34A" strokeWidth={2} fill="url(#adLoginGrad)" dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="failed" name={t("ad.geo.failed")} stroke="#DC2626" strokeWidth={1.6} dot={false} activeDot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="ad-empty">{geoDays ? t("ad.geo.noLoginsRange", { n: geoDays }) : t("ad.geo.noLoginData")}</p>
                )}
              </div>

              {/* Heatmap - stays in sync with chart clicks */}
              <div className="ad-chart-card ad-chart-card--wide" style={{ marginTop: 20 }}>
                <div className="ad-chart-card__header">
                  <h4 className="ad-chart-card__title">
                    <span className="ad-chart-card__ic" style={{ color: "#2B5EA7", background: "rgba(43,94,167,0.10)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </span>
                    {t("ad.geo.heatmap")}
                  </h4>
                  {geoCountryFilter && (
                    <button className="ad-rolechip ad-rolechip--active" style={{ "--chip": "var(--hop-navy, #2B4C7E)" }} onClick={() => focusCountry("")}>
                      {geoCountryFilter} &times;
                    </button>
                  )}
                </div>
                <p className="ad-chart-card__desc">
                  {geoDays ? t("ad.geo.heatmapDescRange", { n: geoDays }) : t("ad.geo.heatmapDescAll")}
                </p>
                <UserLocationMap locations={shownMapLocations} focusBounds={geoFocus} />
              </div>

              {/* Country donut + Country bar */}
              <div className="ad-chart-row" style={{ marginTop: 20 }}>
                <div className="ad-chart-card">
                  <h4 className="ad-chart-card__title">
                    <span className="ad-chart-card__ic" style={{ color: "#1A8A7D", background: "rgba(26,138,125,0.10)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </span>
                    {t("ad.geo.usersByCountry")}
                  </h4>
                  <p className="ad-chart-card__desc">{t("ad.geo.usersByCountryDesc")}</p>
                  {geoCountries.length > 0 ? (() => {
                    // Top 7 + grouped "Other" so the donut stays readable and still totals 100%
                    const sorted = [...geoCountries].sort((a, b) => (b.unique_users || 0) - (a.unique_users || 0));
                    const TOP = 7;
                    const pie = sorted.slice(0, TOP).map((c) => ({ name: c.country, value: c.unique_users }));
                    const rest = sorted.slice(TOP);
                    const otherName = t("ad.geo.otherCountries", { n: rest.length });
                    if (rest.length) pie.push({ name: otherName, value: rest.reduce((s, c) => s + (c.unique_users || 0), 0) });
                    return (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={pie} dataKey="value" nameKey="name" cx="50%" cy="48%" innerRadius={54} outerRadius={92} paddingAngle={2}
                            onClick={(d) => d && d.name !== otherName && focusCountry(d.name)}
                          >
                            {pie.map((d, i) => (
                              <Cell
                                key={i}
                                fill={d.name === otherName ? "#94a3b8" : GEO_PALETTE[i % GEO_PALETTE.length]}
                                cursor={d.name === otherName ? "default" : "pointer"}
                                opacity={geoCountryFilter && d.name !== geoCountryFilter ? 0.35 : 1}
                              />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} formatter={(v) => [t("ad.chart.users", { n: v })]} />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })() : (
                    <p className="ad-empty">{geoDays ? t("ad.geo.noLoginsRange", { n: geoDays }) : t("ad.geo.noCountryData")}</p>
                  )}
                </div>

                <div className="ad-chart-card">
                  <h4 className="ad-chart-card__title">
                    <span className="ad-chart-card__ic" style={{ color: "#7C3AED", background: "rgba(124,58,237,0.10)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    </span>
                    {t("ad.geo.loginsByCountry")}
                    <span className="ad-chart-count">{geoCountries.length}</span>
                  </h4>
                  <p className="ad-chart-card__desc">{t("ad.geo.loginsByCountryDesc")}</p>
                  {geoCountries.length > 0 ? (
                    <div className="td-chart-scroll" style={{ maxHeight: 320, overflowY: geoCountries.length > 8 ? "auto" : "visible" }}>
                      <ResponsiveContainer width="100%" height={Math.max(180, geoCountries.length * 34 + 16)}>
                        <BarChart layout="vertical" data={[...geoCountries].sort((a, b) => (b.logins || 0) - (a.logins || 0))} margin={{ left: 20, right: 16 }} barCategoryGap="20%">
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border, #e5e7eb)" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="country" width={90} interval={0} tick={{ fontSize: 11 }} tickFormatter={(n) => (n && n.length > 14 ? n.slice(0, 13) + "…" : n)} />
                          <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} />
                          <Bar dataKey="logins" name={t("ad.geo.loginsName")} fill="#2B5EA7" radius={[0, 4, 4, 0]} maxBarSize={18} cursor="pointer" onClick={(d) => d && focusCountry(d.payload.country)} />
                          <Bar dataKey="unique_users" name={t("ad.geo.usersName")} fill="#1A8A7D" radius={[0, 4, 4, 0]} maxBarSize={18} cursor="pointer" onClick={(d) => d && focusCountry(d.payload.country)} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="ad-empty">{geoDays ? t("ad.geo.noLoginsRange", { n: geoDays }) : t("ad.geo.noCountryData")}</p>
                  )}
                </div>
              </div>

              {/* Region/city bar chart - all rows, scrollable */}
              <div className="ad-chart-card ad-chart-card--wide" style={{ marginTop: 20 }}>
                <h4 className="ad-chart-card__title">
                  <span className="ad-chart-card__ic" style={{ color: "#E8618C", background: "rgba(232,97,140,0.10)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
                  </span>
                  {t("ad.geo.citiesRegions")}
                  {geoCountryFilter && <span style={{ fontWeight: 500, color: "var(--hop-muted)", fontSize: "0.82rem" }}>{t("ad.geo.inCountry", { country: geoCountryFilter })}</span>}
                  <span className="ad-chart-count">{shownRegions.length}</span>
                </h4>
                <p className="ad-chart-card__desc">{t("ad.geo.citiesDesc")}</p>
                {shownRegions.length > 0 ? (
                  <div className="td-chart-scroll" style={{ maxHeight: 420, overflowY: shownRegions.length > 11 ? "auto" : "visible" }}>
                    <ResponsiveContainer width="100%" height={Math.max(200, shownRegions.length * 32 + 16)}>
                      <BarChart
                        layout="vertical"
                        data={[...shownRegions].sort((a, b) => (b.logins || 0) - (a.logins || 0)).map((r) => ({
                          ...r,
                          label: `${r.city}${r.region ? `, ${r.region}` : ""}${r.country ? ` (${r.country})` : ""}`,
                        }))}
                        margin={{ left: 30, right: 16 }}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--hop-border, #e5e7eb)" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="label" width={190} interval={0} tick={{ fontSize: 10 }} tickFormatter={(n) => (n && n.length > 30 ? n.slice(0, 29) + "…" : n)} />
                        <Tooltip contentStyle={tipStyle} labelStyle={tipLabelStyle} itemStyle={{ color: tipStyle.color }} />
                        <Bar dataKey="logins" name={t("ad.geo.loginsName")} fill="#E8618C" radius={[0, 4, 4, 0]} maxBarSize={16} cursor="pointer" onClick={(d) => d && focusCity(d.payload)} />
                        <Bar dataKey="unique_users" name={t("ad.geo.usersName")} fill="#F0B429" radius={[0, 4, 4, 0]} maxBarSize={16} cursor="pointer" onClick={(d) => d && focusCity(d.payload)} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="ad-empty">{geoDays ? t("ad.geo.noLoginsRange", { n: geoDays }) : t("ad.geo.noRegionData")}</p>
                )}
              </div>
            </div>
          )}

          {/* ===== ACTIVITY ===== */}
          {tab === "activity" && (
            <div className="ad-activity">
              <div className="ad-chart-card">
                <div className="ad-chart-card__header">
                  <h4 className="ad-chart-card__title">
                    <span className="ad-chart-card__ic" style={{ color: "#16A34A", background: "rgba(22,163,74,0.10)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    </span>
                    {t("ad.act.loginHistory")}
                    <span className="ad-chart-count">{loginTotal}</span>
                  </h4>
                  <button className="td-btn td-btn--outline td-btn--sm" onClick={() => API.adminExportCSV("logins")}>
                    {t("ad.exportCsv")}
                  </button>
                </div>
                <div className="ad-users__toolbar" style={{ marginTop: 10 }}>
                  <div className="ad-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="text"
                      placeholder={t("ad.act.searchPh")}
                      value={loginSearchInput}
                      onChange={(e) => setLoginSearchInput(e.target.value)}
                    />
                    {loginSearchInput && (
                      <button className="ad-search__clear" title={t("td.clearSearch")} onClick={() => setLoginSearchInput("")}>&times;</button>
                    )}
                  </div>
                  <div className="ad-rolechips" style={{ margin: 0 }}>
                    {[["", t("ad.filter.all"), "var(--hop-navy, #2B4C7E)"], ["ok", t("ad.act.ok"), "#16A34A"], ["fail", t("ad.act.failed"), "#DC2626"]].map(([id, label, color]) => (
                      <button
                        key={id || "all"}
                        className={`ad-rolechip${loginStatus === id ? " ad-rolechip--active" : ""}`}
                        style={{ "--chip": color }}
                        onClick={() => { setLoginStatus(id); setLoginPage(0); }}
                      >
                        {id && <span className="ad-rolechip__dot" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="td-table-wrap" style={{ maxHeight: 480, overflowY: "auto" }}>
                  <table className="td-table">
                    <thead>
                      <tr>
                        <th>{t("ad.th.user")}</th>
                        <th>{t("ad.th.ip")}</th>
                        <th>{t("ad.th.location")}</th>
                        <th>{t("ad.th.time")}</th>
                        <th>{t("ad.th.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginActivity.map((l, i) => (
                        <tr key={i}>
                          <td className="td-table__mono">{l.email}</td>
                          <td className="td-table__mono" style={{ fontSize: "0.75rem" }}>{l.ip}</td>
                          <td className="td-table__muted">{[l.city, l.region, l.country].filter(Boolean).join(", ") || "\u2014"}</td>
                          <td className="td-table__muted" title={l.login_at ? new Date(l.login_at).toLocaleString(dateLocale) : ""}>{timeAgo(l.login_at, t, lang)}</td>
                          <td>
                            <span className={`ad-pill ${l.success ? "ad-pill--ok" : "ad-pill--fail"}`}>
                              {l.success ? t("ad.pill.ok") : t("ad.pill.fail")}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {loginActivity.length === 0 && (
                        <tr>
                          <td colSpan={5} className="ad-empty" style={{ textAlign: "center", padding: 24 }}>
                            {loginSearch || loginStatus ? (
                              <>
                                {t("ad.act.noMatch")}{" "}
                                <button className="ad-linkbtn" onClick={() => { setLoginSearchInput(""); setLoginStatus(""); setLoginPage(0); }}>{t("ad.clearFilters")}</button>
                              </>
                            ) : t("ad.act.empty")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="ad-pagination">
                  <button disabled={loginPage === 0} onClick={() => setLoginPage((p) => p - 1)}>{t("ad.prev")}</button>
                  <span>
                    {loginTotal === 0 ? t("ad.page.loginsZero") : t(loginTotal === 1 ? "ad.page.loginsOne" : "ad.page.logins", { a: loginPage * ACT_PAGE + 1, b: Math.min((loginPage + 1) * ACT_PAGE, loginTotal), total: loginTotal })}
                  </span>
                  <button disabled={(loginPage + 1) * ACT_PAGE >= loginTotal} onClick={() => setLoginPage((p) => p + 1)}>{t("ad.next")}</button>
                </div>
              </div>

              <div className="ad-chart-card" style={{ marginTop: 24 }}>
                <div className="ad-chart-card__header">
                  <h4 className="ad-chart-card__title">
                    <span className="ad-chart-card__ic" style={{ color: "#7C3AED", background: "rgba(124,58,237,0.10)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </span>
                    {t("ad.act.auditLog")}
                    <span className="ad-chart-count">{auditTotal}</span>
                  </h4>
                  <select
                    className="ad-users__filter"
                    value={auditAction}
                    onChange={(e) => { setAuditAction(e.target.value); setAuditPage(0); }}
                  >
                    <option value="">{t("ad.act.allActions")}</option>
                    {auditActions.map((a) => (
                      <option key={a} value={a}>{auditLabel(a, t)}</option>
                    ))}
                  </select>
                </div>
                <p className="ad-chart-card__desc">{t("ad.act.auditDesc")}</p>
                <div className="td-table-wrap" style={{ maxHeight: 480, overflowY: "auto" }}>
                  <table className="td-table">
                    <thead>
                      <tr>
                        <th>{t("ad.th.admin")}</th>
                        <th>{t("ad.th.action")}</th>
                        <th>{t("ad.th.target")}</th>
                        <th>{t("ad.th.details")}</th>
                        <th>{t("ad.th.time")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map((a, i) => (
                        <tr key={i}>
                          <td className="td-table__mono">{a.admin_email}</td>
                          <td>
                            <span className="ad-role-badge" style={{ background: auditColor(a.action) }}>{auditLabel(a.action, t)}</span>
                          </td>
                          <td className="td-table__mono">{a.target_email || "\u2014"}</td>
                          <td>
                            <div className="ad-audit-chips">
                              {auditDetailChips(a.details).map((c, j) => (
                                <span key={j} className="ad-audit-chip">{c}</span>
                              ))}
                            </div>
                          </td>
                          <td className="td-table__muted" title={a.timestamp ? new Date(a.timestamp).toLocaleString(dateLocale) : ""}>{timeAgo(a.timestamp, t, lang)}</td>
                        </tr>
                      ))}
                      {auditLog.length === 0 && (
                        <tr>
                          <td colSpan={5} className="ad-empty" style={{ textAlign: "center", padding: 24 }}>
                            {auditAction ? (
                              <>
                                {t("ad.act.noActionsOf", { label: auditLabel(auditAction, t) })}{" "}
                                <button className="ad-linkbtn" onClick={() => { setAuditAction(""); setAuditPage(0); }}>{t("ad.act.showAll")}</button>
                              </>
                            ) : t("ad.act.emptyAudit")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="ad-pagination">
                  <button disabled={auditPage === 0} onClick={() => setAuditPage((p) => p - 1)}>{t("ad.prev")}</button>
                  <span>
                    {auditTotal === 0 ? t("ad.page.actionsZero") : t(auditTotal === 1 ? "ad.page.actionsOne" : "ad.page.actions", { a: auditPage * ACT_PAGE + 1, b: Math.min((auditPage + 1) * ACT_PAGE, auditTotal), total: auditTotal })}
                  </span>
                  <button disabled={(auditPage + 1) * ACT_PAGE >= auditTotal} onClick={() => setAuditPage((p) => p + 1)}>{t("ad.next")}</button>
                </div>
              </div>
            </div>
          )}

          {/* ===== GLOSSARY ===== */}
          {tab === "glossary" && (
            <div className="ad-users">
              <div className="ad-users__toolbar">
                <div className="ad-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    placeholder={t("ad.glossary.searchPh")}
                    value={glossarySearch}
                    onChange={(e) => setGlossarySearch(e.target.value)}
                  />
                  {glossarySearch && (
                    <button className="ad-search__clear" title={t("td.clearSearch")} onClick={() => setGlossarySearch("")}>&times;</button>
                  )}
                </div>
                <span className="ad-glossary__count">
                  {t(glossaryTerms.length === 1 ? "ad.glossary.countOne" : "ad.glossary.count", { n: glossaryTerms.length })}
                  {(() => {
                    const missing = glossaryTerms.filter((g) => !g.has_es).length;
                    return missing > 0 ? ` · ${t("ad.glossary.missingEs", { n: missing })}` : "";
                  })()}
                </span>
                {glossaryTerms.some((g) => !g.has_es) && (
                  <button className="td-btn td-btn--ghost td-btn--sm" onClick={handleTranslateMissing}>
                    {t("ad.glossary.translateBtn")}
                  </button>
                )}
                <button
                  className="td-btn td-btn--primary td-btn--sm"
                  onClick={() => { setGlossaryEditor({ term: "", def: "", steps: [] }); setGlossaryModalError(""); }}
                >
                  {t("ad.glossary.add")}
                </button>
              </div>

              {/* Step filter chips */}
              <div className="ad-rolechips">
                <button
                  className={`ad-rolechip${glossaryStep === 0 ? " ad-rolechip--active" : ""}`}
                  style={{ "--chip": "var(--hop-navy, #2B4C7E)" }}
                  onClick={() => setGlossaryStep(0)}
                >
                  {t("ad.sessions.allSteps")}
                </button>
                {STEP_LABELS.map((l, i) => (
                  <button
                    key={i}
                    className={`ad-rolechip${glossaryStep === i + 1 ? " ad-rolechip--active" : ""}`}
                    style={{ "--chip": STEP_COLORS[i] }}
                    onClick={() => setGlossaryStep(glossaryStep === i + 1 ? 0 : i + 1)}
                    title={l}
                  >
                    <span className="ad-rolechip__dot" />
                    {t("td.stepAbbr", { n: i + 1 })}
                  </button>
                ))}
              </div>

              {glossaryLoading && <div className="ad-loading">{t("ad.glossary.loading")}</div>}

              <div className="ad-glossary__list">
                {(() => {
                  const q = glossarySearch.trim().toLowerCase();
                  let shown = q
                    ? glossaryTerms.filter((g) =>
                        g.term.toLowerCase().includes(q) || (g.def || "").toLowerCase().includes(q))
                    : glossaryTerms;
                  if (glossaryStep) shown = shown.filter((g) => (g.steps || []).includes(glossaryStep));
                  if (!glossaryLoading && shown.length === 0) {
                    return (
                      <div className="ad-empty">
                        {q || glossaryStep ? t("ad.glossary.noMatch") : t("ad.glossary.empty")}{" "}
                        {(q || glossaryStep) && (
                          <button className="ad-linkbtn" onClick={() => { setGlossarySearch(""); setGlossaryStep(0); }}>{t("ad.clearFilters")}</button>
                        )}
                      </div>
                    );
                  }
                  return shown.map((g) => (
                    <div className="ad-glossary__row" key={g.id}>
                      <div className="ad-glossary__main">
                        <div className="ad-glossary__term">
                          {g.term}
                          {!g.has_es && <span className="ad-glossary__noes" title={t("ad.glossary.esPendingTitle")}>{t("ad.glossary.esPending")}</span>}
                        </div>
                        <div className="ad-glossary__def">{g.def}</div>
                        {g.steps && g.steps.length > 0 && (
                          <div className="ad-glossary__steps">
                            {g.steps.map((s) => (
                              <span className="ad-glossary__step" key={s}>{t("chat.step", { n: s })}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="ad-glossary__actions">
                        <button className="td-btn td-btn--ghost td-btn--sm" onClick={() => { setGlossaryEditor(g); setGlossaryModalError(""); }}>{t("ad.action.edit")}</button>
                        <button className="td-btn td-btn--ghost td-btn--sm" onClick={() => handleDeleteTerm(g)}>{t("ad.action.delete")}</button>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {glossaryEditor && (
                <GlossaryEditorModal
                  term={glossaryEditor}
                  error={glossaryModalError}
                  onClose={() => setGlossaryEditor(null)}
                  onSave={async (fields) => {
                    setGlossaryModalError("");
                    try {
                      if (glossaryEditor.id) await API.adminGlossaryUpdate(glossaryEditor.id, fields);
                      else await API.adminGlossaryCreate(fields);
                      setGlossaryEditor(null);
                      loadGlossary();
                    } catch (e) { setGlossaryModalError(e.message); }
                  }}
                />
              )}
            </div>
          )}

          {/* ===== RESOURCES (knowledge base) ===== */}
          {tab === "resources" && (
            <div className="ad-res">
              <div className="ad-res__intro">
                <p className="ad-res__lead">
                  {t("ad.res.lead")}
                </p>
                <div className="ad-res__toolbar">
                  <input
                    ref={resourceFileRef}
                    type="file"
                    accept=".pdf,.txt,.md,.markdown"
                    style={{ display: "none" }}
                    onChange={handleUploadResource}
                  />
                  <button
                    className="td-btn td-btn--outline td-btn--sm"
                    disabled={uploadingResource || rebuildingIndex}
                    onClick={() => resourceFileRef.current?.click()}
                  >
                    {uploadingResource ? t("ad.res.uploading") : t("ad.res.upload")}
                  </button>
                  <button
                    className="td-btn td-btn--primary td-btn--sm"
                    disabled={rebuildingIndex || uploadingResource}
                    onClick={handleRebuildIndex}
                  >
                    {rebuildingIndex ? t("ad.res.rebuilding") : t("ad.res.rebuild")}
                  </button>
                </div>
              </div>

              {resourceIndex && (
                <div className={`ad-res__status${resourceIndex.stale ? " ad-res__status--stale" : ""}`}>
                  {!resourceIndex.rag_available ? (
                    <span>{t("ad.res.ragUnavailable")}</span>
                  ) : resourceIndex.stale ? (
                    <span><strong>{t("ad.res.staleBold")}</strong> {t("ad.res.staleText")}</span>
                  ) : (
                    <span><strong>{t("ad.res.upToDateBold")}</strong> {t(resourceIndex.sources === 1 ? "ad.res.indexSummaryOne" : "ad.res.indexSummary", { sources: resourceIndex.sources, chunks: resourceIndex.total_chunks })}</span>
                  )}
                </div>
              )}

              {resourceMsg && <div className="ad-res__msg">{resourceMsg}</div>}
              {rebuildingIndex && <div className="ad-res__msg">{t("ad.res.reembedding")}</div>}

              {resourcesLoading && <div className="ad-loading">{t("ad.res.loadingDocs")}</div>}

              {!resourcesLoading && resources.length > 0 && (
                <h4 className="ad-chart-card__title" style={{ margin: "18px 0 8px" }}>
                  {t("ad.res.documents")}
                  <span className="ad-chart-count">{resources.length}</span>
                </h4>
              )}
              <div className="ad-res__list">
                {!resourcesLoading && resources.length === 0 && (
                  <div className="ad-empty">{t("ad.res.emptyDocs")}</div>
                )}
                {resources.map((f) => (
                  <div className="ad-res__row" key={f.name}>
                    <span className={`ad-res__ext ad-res__ext--${f.ext}`}>{f.ext}</span>
                    <div className="ad-res__main">
                      <div className="ad-res__name" title={f.name}>{f.name}</div>
                      <div className="ad-res__meta">
                        {fmtBytes(f.size)}
                        <span className="ad-res__dot">·</span>
                        {f.indexed
                          ? <span className="ad-res__indexed">{t(f.chunks === 1 ? "ad.res.chunksIndexedOne" : "ad.res.chunksIndexed", { n: f.chunks })}</span>
                          : <span className="ad-res__pending">{t("ad.res.notIndexed")}</span>}
                      </div>
                    </div>
                    <div className="ad-res__actions">
                      <button className="td-btn td-btn--ghost td-btn--sm" onClick={() => handleViewResource(f.name)}>{t("td.view")}</button>
                      <button className="td-btn td-btn--ghost td-btn--sm" onClick={() => handleDownloadResource(f.name)}>{t("ad.res.download")}</button>
                      <button className="td-btn td-btn--ghost td-btn--sm" onClick={() => handleDeleteResource(f.name)}>{t("ad.action.delete")}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== STEP RESOURCES (student panel: video + interactive) ===== */}
          {tab === "stepres" && (
            <div className="ad-stepres">
              <p className="ad-res__lead">
                {t("ad.stepres.lead1")}<strong>{t("ad.stepres.leadVideo")}</strong>{t("ad.stepres.lead2")}<strong>{t("ad.stepres.leadInteractive")}</strong>{t("ad.stepres.lead3")}
              </p>

              <label className="ad-stepres__langpick">
                <span>{t("profile.language")}</span>
                <select
                  className="ad-users__filter"
                  value={stepResLang}
                  onChange={(e) => setStepResLang(e.target.value)}
                >
                  {[["en", "English"], ["es", "Español"]].map(([id, label]) => {
                    const filled = Object.values(stepRes?.[id] || {}).reduce(
                      (n, lvl) => n + Object.values(lvl || {}).filter((e) => e?.video_url || e?.interactive_url).length,
                      0
                    );
                    return (
                      <option key={id} value={id}>
                        {label}{stepRes ? ` ${t("ad.stepres.filled18", { n: filled })}` : ""}
                      </option>
                    );
                  })}
                </select>
              </label>

              <div className="ad-seg ad-stepres__levels">
                {[["high_school", t("ad.stepres.highSchool")], ["higher_ed", t("ad.edu.higherEd")]].map(([id, label]) => {
                  const filled = stepRes
                    ? Object.values(stepRes[stepResLang]?.[id] || {}).filter((e) => e?.video_url || e?.interactive_url).length
                    : 0;
                  return (
                    <button
                      key={id}
                      className={`ad-seg__btn${stepResLevel === id ? " ad-seg__btn--active" : ""}`}
                      onClick={() => setStepResLevel(id)}
                    >
                      {label}
                      {stepRes && <span className="ad-seg__count">{filled}/9</span>}
                    </button>
                  );
                })}
              </div>

              {stepResLoading && <div className="ad-loading">{t("ad.stepres.loading")}</div>}

              {stepRes && (
                <div className="ad-stepres__list">
                  {STEP_LABELS.map((label, i) => {
                    const step = i + 1;
                    const e = stepRes[stepResLang]?.[stepResLevel]?.[step] || {};
                    const en = stepRes.en?.[stepResLevel]?.[step] || {};
                    const isEs = stepResLang === "es";
                    const key = `${stepResLang}:${stepResLevel}:${step}`;
                    return (
                      <div className="ad-stepres__row" key={key}>
                        <div className="ad-stepres__head">
                          <span className="ad-stepres__num">{step}</span>
                          <span className="ad-stepres__label">{label}</span>
                        </div>
                        <div className="ad-stepres__fields">
                          <label className="ad-stepres__field">
                            <span>{t("ad.stepres.videoUrl")}</span>
                            <input
                              value={e.video_url || ""}
                              onChange={(ev) => setStepField(stepResLang, stepResLevel, step, "video_url", ev.target.value)}
                              placeholder={isEs && en.video_url ? t("ad.stepres.blankEnVideo") : t("ad.stepres.videoPh")}
                            />
                          </label>
                          <label className="ad-stepres__field">
                            <span>{t("ad.stepres.interactiveUrl")}</span>
                            <input
                              value={e.interactive_url || ""}
                              onChange={(ev) => setStepField(stepResLang, stepResLevel, step, "interactive_url", ev.target.value)}
                              placeholder={isEs && en.interactive_url ? t("ad.stepres.blankEnInteractive") : t("ad.stepres.interactivePh")}
                            />
                          </label>
                        </div>
                        <div className="ad-stepres__rowactions">
                          {e.video_url && <a className="ad-stepres__open" href={e.video_url} target="_blank" rel="noopener noreferrer">{t("ad.stepres.videoLink")}</a>}
                          {e.interactive_url && <a className="ad-stepres__open" href={e.interactive_url} target="_blank" rel="noopener noreferrer">{t("ad.stepres.interactiveLink")}</a>}
                          <button
                            className="td-btn td-btn--primary td-btn--sm"
                            disabled={stepResSaving === key}
                            onClick={() => saveStepRes(stepResLang, stepResLevel, step)}
                          >
                            {stepResSaving === key ? t("common.saving") : stepResSaved === key ? t("ad.stepres.saved") : t("ad.save")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== HEALTH ===== */}
          {tab === "health" && (
            <div className="ad-health">
              <div className="ad-users__toolbar" style={{ marginBottom: 16 }}>
                {healthCheckedAt && (
                  <span className="td-table__muted" style={{ fontSize: "0.82rem" }}>
                    {t("ad.health.lastChecked", { time: healthCheckedAt.toLocaleTimeString(dateLocale) })}
                  </span>
                )}
                <label className="ad-modal__checkbox" style={{ margin: 0, fontSize: "0.84rem" }}>
                  <input type="checkbox" checked={healthAuto} onChange={(e) => setHealthAuto(e.target.checked)} />
                  {t("ad.health.autoRefresh")}
                </label>
                <button className="td-btn td-btn--outline td-btn--sm" disabled={healthLoading} onClick={() => reloadHealth()}>
                  {healthLoading ? t("ad.health.checking") : t("ad.health.refresh")}
                </button>
              </div>

              {healthLoading && !health && <div className="ad-loading">{t("ad.health.checkingSystem")}</div>}
              {health && (
                <div className="ad-health__grid">
                  <HealthCard
                    title={t("ad.health.server")}
                    status={health.server === "ok" ? "ok" : "error"}
                    items={[
                      { label: t("ad.health.uptime"), value: formatUptime(health.uptime_seconds) },
                      { label: t("ad.health.loadAvg"), value: (health.load_avg || []).join(" / ") || "—" },
                    ]}
                  >
                    {health.cpu_percent != null && (
                      <Meter label="CPU" pct={health.cpu_percent} text={t("ad.health.cpuText", { pct: health.cpu_percent, n: health.cpu_count })} />
                    )}
                    {health.ram_percent != null && (
                      <Meter label="RAM" pct={health.ram_percent} text={`${health.ram_used_gb} / ${health.ram_total_gb} GB`} />
                    )}
                  </HealthCard>
                  <HealthCard
                    title="MongoDB"
                    status={health.mongodb === "ok" ? "ok" : "error"}
                    items={[
                      { label: t("ad.health.connection"), value: health.mongodb },
                      { label: t("ad.health.users"), value: health.db_users ?? "—" },
                      { label: t("ad.tile.sessions"), value: health.db_sessions ?? "—" },
                    ]}
                  />
                  <HealthCard
                    title="LLM"
                    status={health.ollama === "ok" ? "ok" : "error"}
                    items={[
                      { label: t("ad.health.backend"), value: health.llm_backend || "—" },
                      { label: "Ollama", value: health.ollama },
                      { label: "vLLM", value: health.vllm || "—" },
                      { label: t("ad.health.models"), value: (health.ollama_models || []).join(", ") || t("ad.health.none") },
                    ]}
                  >
                    <div className="ad-llmtest">
                      <button className="td-btn td-btn--outline td-btn--sm" disabled={llmTesting} onClick={runLlmTest}>
                        {llmTesting ? t("ad.health.testing") : t("ad.health.testLatency")}
                      </button>
                      {llmTest && (
                        <span className={`ad-llmtest__result${llmTest.ok ? "" : " ad-llmtest__result--fail"}`}>
                          {llmTest.ok
                            ? t("ad.health.roundTrip", { s: llmTest.latency_seconds })
                            : t("ad.health.failedErr", { err: llmTest.error || t("ad.health.noResponse") })}
                        </span>
                      )}
                    </div>
                  </HealthCard>
                  <HealthCard
                    title="GPUs"
                    status={(health.gpus || []).length > 0 ? "ok" : "warn"}
                    items={(health.gpus || []).length === 0
                      ? [{ label: "nvidia-smi", value: t("ad.health.unavailable") }]
                      : []}
                  >
                    {(health.gpus || []).length === 0 && (
                      <p className="ad-health-card__note">
                        {t("ad.health.gpuNote")}
                      </p>
                    )}
                    {(health.gpus || []).map((g, i) => (
                      <Meter
                        key={i}
                        label={`GPU ${i} · ${g.util_percent}% · ${g.temp_c}°C`}
                        pct={Math.round((g.mem_used_mb / g.mem_total_mb) * 100)}
                        text={`${(g.mem_used_mb / 1024).toFixed(1)} / ${(g.mem_total_mb / 1024).toFixed(0)} GB VRAM`}
                      />
                    ))}
                  </HealthCard>
                  <HealthCard
                    title={t("ad.health.ragSystem")}
                    status={health.rag_available && health.rag_index_loaded ? "ok" : "warn"}
                    items={[
                      { label: t("ad.health.available"), value: health.rag_available ? t("ad.yes") : t("ad.no") },
                      { label: t("ad.health.indexLoaded"), value: health.rag_index_loaded ? t("ad.yes") : t("ad.no") },
                    ]}
                  />
                  <HealthCard
                    title={t("ad.health.disk")}
                    status={health.disk_free_gb > 5 ? "ok" : health.disk_free_gb > 1 ? "warn" : "error"}
                    items={[{ label: t("ad.health.free"), value: t("ad.health.gbOf", { free: health.disk_free_gb, total: health.disk_total_gb }) }]}
                  >
                    <Meter
                      label={t("ad.health.used")}
                      pct={Math.round(((health.disk_total_gb - health.disk_free_gb) / health.disk_total_gb) * 100)}
                      text={t("ad.health.gbUsed", { n: (health.disk_total_gb - health.disk_free_gb).toFixed(1) })}
                    />
                  </HealthCard>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} toggleTheme={toggleTheme} />
    </div>
  );

  async function handleToggleActive(u) {
    const newActive = u.is_active === false ? true : false;
    try {
      await API.adminUpdateUser(u._id, { is_active: newActive });
      loadUsers();
    } catch (e) {
      notify.error(e.message, { title: t("ad.actionFailed") });
    }
  }
}


/* ===== Sub-components ===== */

function SortTh({ label, col, sort, onSort }) {
  const { t } = useLang();
  const active = sort.by === col;
  return (
    <th className={`ad-sort-th${active ? " ad-sort-th--active" : ""}`} onClick={() => onSort(col)} title={t("ad.sortBy", { label: label.toLowerCase() })}>
      {label}
      <span className="ad-sort-th__arrow">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
    </th>
  );
}

function ClassDetailView({ detail: c, onViewSession, onEdit, onAddStudents, onResetPw, onRemoveStudent }) {
  const { lang, t } = useLang();
  const dateLocale = lang === "es" ? "es-ES" : "en-US";
  const [showPw, setShowPw] = useState(false);
  return (
    <div className="ad-user-detail">
      {/* Class header */}
      <div className="ad-user-detail__header">
        <span className="ad-user-detail__avatar" style={{ background: "#1A8A7D" }}>
          {(c.class_name || "?").charAt(0).toUpperCase()}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2>{c.class_name}</h2>
          <p className="td-table__mono">{c.class_code}</p>
          <div className="ad-user-detail__meta">
            <span>{t("ad.th.teacher")}: <strong>{c.teacher_name || "—"}</strong>{c.teacher_email ? ` (${c.teacher_email})` : ""}</span>
            <span className={`ad-pill ${c.settings?.ai_enabled === false ? "ad-pill--off" : "ad-pill--ok"}`}>
              AI {c.settings?.ai_enabled === false ? t("td.off") : t("td.on")}
            </span>
            <span className="ad-edu-chip">{t("ad.class.access")}: {c.settings?.access_mode || "full"}</span>
            {c.password && (
              <button className="ad-ccard__pw" title={showPw ? t("login.hidePassword") : t("ad.class.showPw")} onClick={() => setShowPw((s) => !s)}>
                {showPw ? c.password : "••••••"}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showPw
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                </svg>
              </button>
            )}
            <span>{t("ad.class.createdOn", { date: c.created_at ? new Date(c.created_at).toLocaleDateString(dateLocale) : "—" })}</span>
          </div>
        </div>
        <div className="ad-actions" style={{ marginLeft: "auto", flexShrink: 0 }}>
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onAddStudents}>{t("ad.class.addStudentsBtn")}</button>
          <button className="td-btn td-btn--primary td-btn--sm" onClick={onEdit}>{t("ad.class.editBtn")}</button>
        </div>
      </div>

      {/* Students */}
      <div className="ad-chart-card" style={{ marginTop: 20 }}>
        <h4>{t("ad.class.students", { n: c.students.length })}</h4>
        {c.students.length > 0 ? (
          <div className="td-table-wrap" style={{ maxHeight: 480, overflowY: "auto" }}>
            <table className="td-table">
              <thead>
                <tr>
                  <th>{t("login.username")}</th>
                  <th>{t("ad.th.name")}</th>
                  <th>{t("td.thProgress")}</th>
                  <th>{t("ad.class.workingOn")}</th>
                  <th>{t("ad.th.lastLogin")}</th>
                  <th>{t("td.thLastActivity")}</th>
                  <th>{t("ad.th.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {c.students.map((s) => (
                  <tr key={s._id}>
                    <td className="td-table__mono">{s.username}</td>
                    <td>{s.name}</td>
                    <td>
                      <div className="td-table__muted">{t("ad.sessions.stepsOf", { n: s.steps_done })}</div>
                      <div className="ad-minibar"><div className="ad-minibar__fill ad-minibar__fill--progress" style={{ width: `${Math.round((s.steps_done / 9) * 100)}%` }} /></div>
                    </td>
                    <td>
                      {s.active_step ? (
                        <span className="ad-role-badge" style={{ background: STEP_COLORS[(s.active_step || 1) - 1] || "#999" }}>
                          {t("chat.step", { n: s.active_step })}
                        </span>
                      ) : <span className="td-table__muted">{t("ad.class.notStarted")}</span>}
                    </td>
                    <td className="td-table__muted">{timeAgo(s.last_login_at, t, lang) || t("td.never")}</td>
                    <td className="td-table__muted">{s.last_activity ? timeAgo(s.last_activity, t, lang) : "—"}</td>
                    <td>
                      <div className="ad-actions">
                        {s.session_id && (
                          <button className="td-btn td-btn--outline td-btn--sm" onClick={() => onViewSession(s.session_id, s.name || s.username)}>
                            {t("td.view")}
                          </button>
                        )}
                        <button className="ad-action-btn" title={t("ad.action.resetPw")} onClick={() => onResetPw(s)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </button>
                        <button className="ad-action-btn ad-action-btn--danger" title={t("ad.class.removeStudent")} onClick={() => onRemoveStudent(s)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ad-empty">{t("ad.class.noStudents")}</p>
        )}
      </div>
    </div>
  );
}


function EditClassModal({ cls, teachers, error, onClose, onSave }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    class_name: cls.class_name || "",
    password: "",
    teacher_id: cls.teacher_id || "",
    ai_enabled: cls.settings?.ai_enabled !== false,
    access_mode: cls.settings?.access_mode || "full",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("ad.modal.editClassTitle", { code: cls.class_code })}</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <label>{t("ad.modal.className")}<input value={form.class_name} onChange={(e) => set("class_name", e.target.value)} /></label>
        <label>{t("ad.modal.newClassPw")}
          <input
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder={t("ad.modal.keepPwPh")}
          />
        </label>
        {form.password && (
          <p style={{ margin: "-6px 0 10px", fontSize: "0.78rem", color: "#C0842A" }}>
            {t("ad.modal.pwWarn")}
          </p>
        )}
        <label>{t("ad.th.teacher")}
          <select value={form.teacher_id} onChange={(e) => set("teacher_id", e.target.value)}>
            {teachers.map((tc) => (
              <option key={tc._id} value={tc._id}>{tc.name || tc.email}</option>
            ))}
          </select>
        </label>
        <label>{t("ad.modal.aiAccessMode")}
          <select value={form.access_mode} onChange={(e) => set("access_mode", e.target.value)}>
            <option value="full">{t("ad.modal.accessFull")}</option>
            <option value="step">{t("ad.modal.accessStep")}</option>
            <option value="phase">{t("ad.modal.accessPhase")}</option>
          </select>
        </label>
        <label className="ad-modal__checkbox">
          <input type="checkbox" checked={form.ai_enabled} onChange={(e) => set("ai_enabled", e.target.checked)} />
          {t("ad.modal.aiEnabled")}
        </label>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>{t("td.cancel")}</button>
          <button
            className="td-btn td-btn--primary td-btn--sm"
            disabled={!form.class_name.trim()}
            onClick={() => {
              const fields = { ai_enabled: form.ai_enabled, access_mode: form.access_mode };
              if (form.class_name.trim() !== cls.class_name) fields.class_name = form.class_name.trim();
              if (form.password) fields.password = form.password;
              if (form.teacher_id && form.teacher_id !== cls.teacher_id) fields.teacher_id = form.teacher_id;
              onSave(fields);
            }}
          >
            {t("ad.save")}
          </button>
        </div>
      </div>
    </div>
  );
}


function AddStudentsModal({ cls, error, onClose, onSave }) {
  const { t } = useLang();
  const [count, setCount] = useState(5);
  const example = `${cls.class_code}_${String((cls.actual_students || cls.students?.length || 0) + 1).padStart(2, "0")}`;
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("ad.modal.addStudentsTitle", { name: cls.class_name })}</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <p style={{ fontSize: "0.85rem", color: "var(--hop-muted)" }}>
          {t("ad.modal.addStudentsNote", { example })}
        </p>
        <label>{t("ad.modal.howMany")}
          <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>{t("td.cancel")}</button>
          <button
            className="td-btn td-btn--primary td-btn--sm"
            disabled={!(count >= 1 && count <= 100)}
            onClick={() => onSave(count)}
          >
            {t("ad.modal.add")}
          </button>
        </div>
      </div>
    </div>
  );
}


function CreateClassModal({ teachers, error, onClose, onSave }) {
  const { t } = useLang();
  const [form, setForm] = useState({ teacher_id: "", class_name: "", password: "", student_count: 10 });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = form.teacher_id && form.class_name.trim() && form.password.length >= 4 &&
    form.student_count >= 1 && form.student_count <= 100;
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("ad.modal.createClassTitle")}</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <label>{t("ad.modal.onBehalf")}
          <select value={form.teacher_id} onChange={(e) => set("teacher_id", e.target.value)}>
            <option value="">{t("ad.modal.selectTeacher")}</option>
            {teachers.map((tc) => (
              <option key={tc._id} value={tc._id}>{tc.name || tc.email}</option>
            ))}
          </select>
        </label>
        <label>{t("ad.modal.className")}<input value={form.class_name} onChange={(e) => set("class_name", e.target.value)} placeholder={t("ad.modal.classNamePh")} /></label>
        <label>{t("ad.modal.classPw")}<input value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={t("ad.modal.classPwPh")} /></label>
        <label>{t("ad.modal.numStudents")}
          <input type="number" min={1} max={100} value={form.student_count} onChange={(e) => set("student_count", Number(e.target.value))} />
        </label>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>{t("td.cancel")}</button>
          <button className="td-btn td-btn--primary td-btn--sm" disabled={!canSave} onClick={() => onSave({ ...form, class_name: form.class_name.trim() })}>
            {t("ad.modal.create")}
          </button>
        </div>
      </div>
    </div>
  );
}


function StatTile({ label, value, hint, color, icon, onClick }) {
  return (
    <button className="ad-stat-card ad-stat-card--action" style={{ borderTopColor: color }} onClick={onClick}>
      <span className="ad-stat-card__icon" style={{ color, background: `${color}1A` }}>{icon}</span>
      <span className="ad-stat-card__text">
        <span className="ad-stat-card__value">{value ?? "\u2014"}</span>
        <span className="ad-stat-card__label">{label}</span>
        {hint && <span className="ad-stat-card__hint">{hint}</span>}
      </span>
    </button>
  );
}


function HealthCard({ title, status, items = [], children }) {
  const { t } = useLang();
  const colors = { ok: "#16A34A", warn: "#F0B429", error: "#DC2626" };
  const labels = { ok: t("ad.health.ok"), warn: t("ad.health.warn"), error: t("ad.health.error") };
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
        {children}
      </div>
    </div>
  );
}


function Meter({ label, pct, text }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  const color = clamped < 60 ? "#16A34A" : clamped < 85 ? "#F0B429" : "#DC2626";
  return (
    <div className="ad-meter">
      <div className="ad-meter__head">
        <span className="ad-meter__label">{label}</span>
        <span className="ad-meter__text">{text}</span>
      </div>
      <div className="ad-meter__bar">
        <div className="ad-meter__fill" style={{ width: `${clamped}%`, background: color }} />
      </div>
    </div>
  );
}


function UserDetailView({ detail, onViewSession }) {
  const { lang, t } = useLang();
  const dateLocale = lang === "es" ? "es-ES" : "en-US";
  const ROLE_LABELS = roleLabels(t);
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
            <span>{user.education_level === "higher_ed" ? t("ad.edu.higherEd") : t("ad.edu.highSchool")}</span>
            <span className={`ad-status-dot ${user.is_active === false ? "ad-status-dot--inactive" : "ad-status-dot--active"}`} />
            <span>{user.is_active === false ? t("ad.status.inactive") : t("ad.status.active")}</span>
            <span>{t("ad.user.joined", { date: user.created_at ? new Date(user.created_at).toLocaleDateString(dateLocale) : "N/A" })}</span>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className="ad-chart-card" style={{ marginTop: 20 }}>
        <h4>{t("ad.user.sessions", { n: sessions.length })}</h4>
        {sessions.length > 0 ? (
          <div className="td-table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="td-table">
              <thead>
                <tr>
                  <th>{t("ad.th.sessionId")}</th>
                  <th>{t("ad.th.step")}</th>
                  <th>{t("td.thWorldview")}</th>
                  <th>{t("td.thPath")}</th>
                  <th>{t("ad.th.created")}</th>
                  <th>{t("ad.th.updated")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td className="td-table__mono" style={{ fontSize: "0.75rem" }}>{s.session_id?.slice(0, 8)}...</td>
                    <td>
                      <span className="ad-role-badge" style={{ background: STEP_COLORS[(s.active_step || 1) - 1] || "#999" }}>
                        {t("chat.step", { n: s.active_step || 1 })}
                      </span>
                    </td>
                    <td className="td-table__muted">{s.worldview_label || "\u2014"}</td>
                    <td className="td-table__muted">{s.resolved_path || "\u2014"}</td>
                    <td className="td-table__muted">{timeAgo(s.created_at, t, lang)}</td>
                    <td className="td-table__muted">{timeAgo(s.updated_at, t, lang)}</td>
                    <td>
                      <button className="td-btn td-btn--outline td-btn--sm" onClick={() => onViewSession(s.session_id, user.name || user.username)}>
                        {t("td.view")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ad-empty">{t("ad.user.noSessions")}</p>
        )}
      </div>

      {/* Login history */}
      <div className="ad-chart-card" style={{ marginTop: 20 }}>
        <h4>{t("ad.user.loginHistory", { n: logins.length })}</h4>
        {logins.length > 0 ? (
          <div className="td-table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="td-table">
              <thead>
                <tr>
                  <th>{t("ad.th.ip")}</th>
                  <th>{t("ad.th.location")}</th>
                  <th>{t("ad.th.time")}</th>
                  <th>{t("ad.th.status")}</th>
                </tr>
              </thead>
              <tbody>
                {logins.map((l, i) => (
                  <tr key={i}>
                    <td className="td-table__mono" style={{ fontSize: "0.75rem" }}>{l.ip}</td>
                    <td className="td-table__muted">{[l.city, l.region, l.country].filter(Boolean).join(", ") || "\u2014"}</td>
                    <td className="td-table__muted">{timeAgo(l.login_at, t, lang)}</td>
                    <td>
                      <span className={l.success ? "ad-role-badge" : "ad-role-badge ad-role-badge--fail"} style={l.success ? { background: "#16A34A" } : {}}>
                        {l.success ? t("ad.pill.ok") : t("ad.pill.fail")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ad-empty">{t("ad.user.noLogins")}</p>
        )}
      </div>
    </div>
  );
}


function CreateUserModal({ onClose, onSave, error }) {
  const { t } = useLang();
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "student", education_level: "high_school" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("ad.users.createTitle")}</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <label>{t("login.email")}<input value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label>{t("login.password")}<input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></label>
        <label>{t("ad.th.name")}<input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>{t("ad.th.role")}
          <select value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="student">{t("td.thStudent")}</option>
            <option value="teacher">{t("td.roleTeacher")}</option>
            <option value="admin">{t("ad.role.admin")}</option>
          </select>
        </label>
        <label>{t("ad.modal.eduLevel")}
          <select value={form.education_level} onChange={(e) => set("education_level", e.target.value)}>
            <option value="high_school">{t("ad.edu.highSchool")}</option>
            <option value="higher_ed">{t("ad.edu.higherEd")}</option>
          </select>
        </label>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>{t("td.cancel")}</button>
          <button className="td-btn td-btn--primary td-btn--sm" onClick={() => onSave(form)}>{t("ad.modal.create")}</button>
        </div>
      </div>
    </div>
  );
}


function EditUserModal({ user: u, onClose, onSave, error }) {
  const { t } = useLang();
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
        <h3>{t("ad.modal.editUserTitle", { id: u.email || u.username })}</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <label>{t("ad.th.name")}<input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label>{t("ad.th.role")}
          <select value={form.role} onChange={(e) => set("role", e.target.value)}>
            <option value="student">{t("td.thStudent")}</option>
            <option value="teacher">{t("td.roleTeacher")}</option>
            <option value="classroom_student">{t("ad.role.classroomStudent")}</option>
            <option value="admin">{t("ad.role.admin")}</option>
          </select>
        </label>
        <label>{t("ad.modal.eduLevel")}
          <select value={form.education_level} onChange={(e) => set("education_level", e.target.value)}>
            <option value="high_school">{t("ad.edu.highSchool")}</option>
            <option value="higher_ed">{t("ad.edu.higherEd")}</option>
          </select>
        </label>
        <label className="ad-modal__checkbox">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          {t("ad.status.active")}
        </label>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>{t("td.cancel")}</button>
          <button className="td-btn td-btn--primary td-btn--sm" onClick={() => onSave(form)}>{t("ad.save")}</button>
        </div>
      </div>
    </div>
  );
}


function GlossaryEditorModal({ term, onClose, onSave, error }) {
  const { t } = useLang();
  const GLOSSARY_STEP_LABELS = stepLabels(t);
  const [form, setForm] = useState({
    term: term.term || "",
    definition: term.def || "",
    steps: term.steps || [],
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleStep = (n) =>
    setForm((f) => ({
      ...f,
      steps: f.steps.includes(n) ? f.steps.filter((s) => s !== n) : [...f.steps, n].sort((a, b) => a - b),
    }));
  const canSave = form.term.trim() && form.definition.trim();
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal ad-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3>{term.id ? t("ad.glossary.editTerm") : t("ad.glossary.addTerm")}</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <label>{t("ad.glossary.term")}<input value={form.term} onChange={(e) => set("term", e.target.value)} placeholder={t("ad.glossary.termPh")} /></label>
        <label>{t("ad.glossary.definition")}
          <textarea
            className="ad-glossary__textarea"
            rows={4}
            value={form.definition}
            onChange={(e) => set("definition", e.target.value)}
            placeholder={t("ad.glossary.defPh")}
          />
        </label>
        <div className="ad-glossary__stepfield">
          <span className="ad-glossary__stepfield-label">{t("ad.glossary.relatedSteps")}</span>
          <div className="ad-glossary__stepgrid">
            {GLOSSARY_STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const on = form.steps.includes(n);
              return (
                <button
                  type="button"
                  key={n}
                  className={`ad-glossary__stepchip${on ? " ad-glossary__stepchip--on" : ""}`}
                  onClick={() => toggleStep(n)}
                >
                  <span className="ad-glossary__stepnum">{n}</span> {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>{t("td.cancel")}</button>
          <button
            className="td-btn td-btn--primary td-btn--sm"
            disabled={!canSave}
            onClick={() => onSave({ term: form.term.trim(), definition: form.definition.trim(), steps: form.steps })}
          >
            {t("ad.save")}
          </button>
        </div>
      </div>
    </div>
  );
}


function ResetPasswordModal({ user: u, onClose, onSave, error }) {
  const { t } = useLang();
  const [pw, setPw] = useState("");
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("ad.modal.resetPwTitle", { id: u.email || u.username })}</h3>
        {error && <div className="ad-modal__error">{error}</div>}
        <label>{t("login.newPassword")}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>{t("td.cancel")}</button>
          <button className="td-btn td-btn--primary td-btn--sm" onClick={() => onSave(pw)} disabled={pw.length < 6}>{t("ad.modal.reset")}</button>
        </div>
      </div>
    </div>
  );
}


function DeleteConfirmModal({ user: u, onClose, onConfirm }) {
  const { t } = useLang();
  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("ad.modal.deleteUserTitle")}</h3>
        <p>{t("ad.modal.deleteUserPre")} <strong>{u.email || u.username || u.name}</strong>?</p>
        <p style={{ color: "#DC2626", fontSize: "0.85rem" }}>{t("ad.modal.cannotUndo")}</p>
        <div className="ad-modal__actions">
          <button className="td-btn td-btn--outline td-btn--sm" onClick={onClose}>{t("td.cancel")}</button>
          <button className="td-btn td-btn--sm" style={{ background: "#DC2626", color: "#fff" }} onClick={onConfirm}>{t("ad.action.delete")}</button>
        </div>
      </div>
    </div>
  );
}
