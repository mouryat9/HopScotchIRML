// src/api.js
// For local development:
// const API_BASE = "http://127.0.0.1:8000";

// For production (permanent Cloudflare tunnel):
const API_BASE = "https://api.hopscotchai.us";

function authHeaders() {
  const stored = localStorage.getItem("hopscotch_user");
  if (!stored) return {};
  try {
    const { token } = JSON.parse(stored);
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {}
  return {};
}

export const API = {
  // ---------- Auth ----------

  async register({ email, password, name, role = "student", education_level = "high_school" }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role, education_level }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Registration failed: ${res.status}`);
    }
    return res.json();
  },

  async login({ email, password }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Login failed: ${res.status}`);
    }
    return res.json();
  },

  async forgotPassword({ email }) {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Request failed: ${res.status}`);
    }
    return res.json();
  },

  async resetPassword({ token, new_password }) {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Reset failed: ${res.status}`);
    }
    return res.json();
  },

  async classroomLogin({ username, password }) {
    const res = await fetch(`${API_BASE}/auth/classroom-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Login failed: ${res.status}`);
    }
    return res.json();
  },

  // ---------- Teacher / Class Management ----------

  async createClass({ class_name, student_count, password }) {
    const res = await fetch(`${API_BASE}/teacher/create-class`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ class_name, student_count, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Failed to create class: ${res.status}`);
    }
    return res.json();
  },

  async getTeacherClasses() {
    const res = await fetch(`${API_BASE}/teacher/classes`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load classes: ${res.status}`);
    return res.json();
  },

  async getStudentSessions() {
    const res = await fetch(`${API_BASE}/teacher/student-sessions`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load student sessions: ${res.status}`);
    return res.json();
  },

  async getStudentSession(sessionId) {
    const res = await fetch(`${API_BASE}/teacher/student-session/${sessionId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load student session: ${res.status}`);
    return res.json();
  },

  async getStudentStepConfig(sessionId, step) {
    const params = new URLSearchParams({ session_id: sessionId, step: String(step) });
    const res = await fetch(`${API_BASE}/teacher/student-step-config?${params}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load student step config: ${res.status}`);
    return res.json();
  },

  async postTeacherFeedback(sessionId, step, text) {
    const res = await fetch(`${API_BASE}/teacher/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ session_id: sessionId, step, text }),
    });
    if (!res.ok) throw new Error(`Failed to post feedback: ${res.status}`);
    return res.json();
  },

  async getTeacherFeedback(sessionId) {
    const res = await fetch(`${API_BASE}/teacher/feedback/${sessionId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load feedback: ${res.status}`);
    return res.json();
  },

  async getStudentFeedback() {
    const res = await fetch(`${API_BASE}/student/feedback`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load feedback: ${res.status}`);
    return res.json();
  },

  async markFeedbackRead() {
    const res = await fetch(`${API_BASE}/student/feedback/mark-read`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to mark feedback read: ${res.status}`);
    return res.json();
  },

  // ---------- Sessions + Chat ----------

  async createSession() {
    const res = await fetch(`${API_BASE}/session`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!res.ok) {
      throw new Error(`createSession failed: ${res.status}`);
    }
    return res.json();
  },

  async resumeSession() {
    const res = await fetch(`${API_BASE}/session/resume`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`resumeSession failed: ${res.status}`);
    return res.json();
  },

  async listSessions() {
    const res = await fetch(`${API_BASE}/session/list`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`listSessions failed: ${res.status}`);
    return res.json();
  },

  async updateActiveStep(session_id, active_step) {
    const res = await fetch(`${API_BASE}/session/update_step`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ session_id, active_step }),
    });
    if (!res.ok) throw new Error(`updateActiveStep failed: ${res.status}`);
    return res.json();
  },

  async history(session_id) {
    const params = new URLSearchParams({ session_id });
    const res = await fetch(`${API_BASE}/chat/history?` + params.toString(), {
      headers: authHeaders(),
    });
    if (!res.ok) {
      throw new Error(`history failed: ${res.status}`);
    }
    return res.json();
  },

  async chatSend(session_id, message, active_step = null) {
    const body = { session_id, message };
    if (active_step !== null) body.active_step = active_step;
    const res = await fetch(`${API_BASE}/chat/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`chatSend failed: ${res.status} ${text}`);
    }
    return res.json();
  },

  async setWorldview(session_id, worldview_id) {
    const res = await fetch(`${API_BASE}/worldview/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ session_id, worldview_id }),
    });
    if (!res.ok) throw new Error("Failed to set worldview");
    return res.json();
  },

  async saveStepData({ session_id, step, data }) {
    const res = await fetch(`${API_BASE}/step/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ session_id, step, data }),
    });
    if (!res.ok) throw new Error("Failed to save step data");
    return res.json();
  },

  async getStepData(session_id, step) {
    const params = new URLSearchParams({
      session_id,
      step: String(step),
    });
    const res = await fetch(`${API_BASE}/step/get?` + params.toString(), {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load step data");
    return res.json();
  },

  async getStepConfig(session_id, step) {
    const params = new URLSearchParams({
      session_id,
      step: String(step),
    });
    const res = await fetch(`${API_BASE}/step/config?` + params.toString(), {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load step config");
    return res.json();
  },

  async chatSendStream(session_id, message, active_step = null, signal = null) {
    const body = { session_id, message };
    if (active_step !== null) body.active_step = active_step;
    const opts = {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    };
    if (signal) opts.signal = signal;
    const res = await fetch(`${API_BASE}/chat/send_stream`, opts);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`chatSendStream failed: ${res.status} ${text}`);
    }
    return res;
  },

  async setMethodology(session_id, methodology) {
    const res = await fetch(`${API_BASE}/step/set_methodology`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ session_id, methodology }),
    });
    if (!res.ok) throw new Error("Failed to set methodology");
    return res.json();
  },

  async downloadResearchDesign(session_id) {
    const res = await fetch(`${API_BASE}/session/${session_id}/export/pdf`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to download research design");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Research_Design.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  async getConceptualFrameworkData(session_id) {
    const res = await fetch(`${API_BASE}/session/${session_id}/export/conceptual-framework/data`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load conceptual framework data");
    return res.json();
  },

  async downloadConceptualFramework(session_id) {
    const res = await fetch(`${API_BASE}/session/${session_id}/export/conceptual-framework`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to download conceptual framework");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Conceptual_Framework.pptx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // ---------- Admin ----------

  async adminGetStats() {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load admin stats: ${res.status}`);
    return res.json();
  },

  async adminGetSignups(days = 30) {
    const res = await fetch(`${API_BASE}/admin/signups?days=${days}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load signups: ${res.status}`);
    return res.json();
  },

  async adminGetStepCompletion() {
    const res = await fetch(`${API_BASE}/admin/step-completion`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load step completion: ${res.status}`);
    return res.json();
  },

  async adminGetLoginActivity(limit = 100, skip = 0) {
    const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    const res = await fetch(`${API_BASE}/admin/login-activity?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load login activity: ${res.status}`);
    return res.json();
  },

  async adminGetLoginMap() {
    const res = await fetch(`${API_BASE}/admin/login-map`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load login map: ${res.status}`);
    return res.json();
  },

  async adminGetGeoCountries() {
    const res = await fetch(`${API_BASE}/admin/geo/countries`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load geo countries: ${res.status}`);
    return res.json();
  },

  async adminGetGeoRegions() {
    const res = await fetch(`${API_BASE}/admin/geo/regions`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load geo regions: ${res.status}`);
    return res.json();
  },

  async adminGetUsers({ skip = 0, limit = 50, role = "", search = "" } = {}) {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (role) params.set("role", role);
    if (search) params.set("search", search);
    const res = await fetch(`${API_BASE}/admin/users?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);
    return res.json();
  },

  async adminGetUser(userId) {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load user: ${res.status}`);
    return res.json();
  },

  async adminCreateUser({ email, password, name, role, education_level }) {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ email, password, name, role, education_level }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Failed to create user: ${res.status}`);
    }
    return res.json();
  },

  async adminUpdateUser(userId, fields) {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Failed to update user: ${res.status}`);
    }
    return res.json();
  },

  async adminResetPassword(userId, newPassword) {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ new_password: newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Failed to reset password: ${res.status}`);
    }
    return res.json();
  },

  async adminDeleteUser(userId) {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Failed to delete user: ${res.status}`);
    }
    return res.json();
  },

  async adminGetAuditLog(limit = 100, skip = 0) {
    const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    const res = await fetch(`${API_BASE}/admin/audit-log?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load audit log: ${res.status}`);
    return res.json();
  },

  // ---------- Admin: Classes ----------

  async adminGetClasses({ skip = 0, limit = 50, search = "" } = {}) {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (search) params.set("search", search);
    const res = await fetch(`${API_BASE}/admin/classes?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load classes: ${res.status}`);
    return res.json();
  },

  async adminDeleteClass(classId) {
    const res = await fetch(`${API_BASE}/admin/classes/${classId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || `Failed to delete class: ${res.status}`);
    }
    return res.json();
  },

  // ---------- Admin: Sessions ----------

  async adminGetSessions({ skip = 0, limit = 50, user_id = "" } = {}) {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (user_id) params.set("user_id", user_id);
    const res = await fetch(`${API_BASE}/admin/sessions?${params}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load sessions: ${res.status}`);
    return res.json();
  },

  async adminGetSession(sessionId) {
    const res = await fetch(`${API_BASE}/admin/sessions/${sessionId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load session: ${res.status}`);
    return res.json();
  },

  // ---------- Admin: Health ----------

  async adminGetHealth() {
    const res = await fetch(`${API_BASE}/admin/health`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load health: ${res.status}`);
    return res.json();
  },

  // ---------- Admin: CSV Export ----------

  async adminExportCSV(type) {
    const res = await fetch(`${API_BASE}/admin/export/${type}.csv`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to export ${type}: ${res.status}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hopscotch_${type}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // ---------- Admin: User Detail ----------

  async adminGetUserDetail(userId) {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/detail`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to load user detail: ${res.status}`);
    return res.json();
  },

  // ---------- Admin: Student Step Config (reuse teacher endpoint) ----------

  async adminGetStudentStepConfig(sessionId, step) {
    const params = new URLSearchParams({ session_id: sessionId, step: String(step) });
    const res = await fetch(`${API_BASE}/teacher/student-step-config?${params}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load student step config: ${res.status}`);
    return res.json();
  },
};
