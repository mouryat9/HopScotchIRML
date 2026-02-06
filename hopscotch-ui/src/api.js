// src/api.js
const API_BASE = "http://127.0.0.1:8000";

// For Cloudflare tunnel (production):
// const API_BASE = "https://your-tunnel-url.trycloudflare.com";

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

  async register({ email, password, name, role }) {
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

  // ---------- Teacher ----------

  async getStudentSessions() {
    const res = await fetch(`${API_BASE}/teacher/students`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load student sessions");
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

  async chatSendStream(session_id, message, active_step = null) {
    const body = { session_id, message };
    if (active_step !== null) body.active_step = active_step;
    const res = await fetch(`${API_BASE}/chat/send_stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
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
};
