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

  async register({ email, password, name, role = "student" }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role }),
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
};
