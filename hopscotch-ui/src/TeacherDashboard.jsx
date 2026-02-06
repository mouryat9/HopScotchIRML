// src/TeacherDashboard.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { API } from "./api";

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await API.getStudentSessions();
        setSessions(data.sessions || []);
      } catch (e) {
        setError("Failed to load student data.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="teacher-dashboard">
      <header className="teacher-header">
        <div className="teacher-header__left">
          <img src="/hopscotch-logo.png" alt="Hopscotch" className="teacher-logo" />
          <h1>Teacher Dashboard</h1>
        </div>
        <div className="teacher-header__right">
          <span className="teacher-user">{user?.name}</span>
          <button className="btn btn--outline" onClick={logout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="teacher-main">
        {loading && <p>Loading student sessions...</p>}
        {error && <div className="badge badge--error">{error}</div>}

        {!loading && sessions.length === 0 && (
          <p className="teacher-empty">No student sessions found yet.</p>
        )}

        {!loading && sessions.length > 0 && (
          <div className="teacher-table-wrap">
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Worldview</th>
                  <th>Path</th>
                  <th>Methodology</th>
                  <th>Survey</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.session_id || i}>
                    <td>{s.user?.name || "—"}</td>
                    <td>{s.user?.email || "—"}</td>
                    <td>{s.worldview_label || "—"}</td>
                    <td>{s.resolved_path || "—"}</td>
                    <td>{s.chosen_methodology || "—"}</td>
                    <td>{s.survey_done ? "Done" : "In progress"}</td>
                    <td>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
