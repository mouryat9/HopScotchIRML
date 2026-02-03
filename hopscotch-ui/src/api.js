// src/api.js
// const API_BASE = "http://127.0.0.1:8000";

const API_BASE = "https://continues-organisations-leading-measurements.trycloudflare.com";


export const API = {
  // Create a new session
  async createSession() {
    const res = await fetch(`${API_BASE}/session`, { method: "POST" });
    if (!res.ok) {
      throw new Error(`createSession failed: ${res.status}`);
    }
    return res.json(); // { session_id }
  },

  // Get chat history for a session
  async history(session_id) {
    const params = new URLSearchParams({ session_id });
    const res = await fetch(`${API_BASE}/chat/history?` + params.toString());
    if (!res.ok) {
      throw new Error(`history failed: ${res.status}`);
    }
    return res.json(); // { session_id, history }
  },

  // Non-streaming chat endpoint (matches /chat/send)
  async chatSend(session_id, message) {
    const res = await fetch(`${API_BASE}/chat/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, message }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`chatSend failed: ${res.status} ${text}`);
    }
    return res.json(); // { session_id, history }
  },

  async setWorldview(session_id, worldview_id) {
    const res = await fetch(`${API_BASE}/worldview/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, worldview_id }),
    });
    if (!res.ok) throw new Error("Failed to set worldview");
    return res.json();
  },


  // Save step-specific data
  async saveStepData({ session_id, step, data }) {
    const res = await fetch(`${API_BASE}/step/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id, step, data }),
    });
    if (!res.ok) throw new Error("Failed to save step data");
    return res.json(); // { session_id, step, data }
  },

  // Load step-specific data
  async getStepData(session_id, step) {
    const params = new URLSearchParams({
      session_id,
      step: String(step),
    });
    const res = await fetch(`${API_BASE}/step/get?` + params.toString());
    if (!res.ok) throw new Error("Failed to load step data");
    return res.json(); // { session_id, step, data }
  },
};
