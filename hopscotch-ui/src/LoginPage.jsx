// src/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { API } from "./api";

const ROTATING_WORDS = [
  "Simplified.",
  "Structured.",
  "Step by Step.",
  "Guided.",
];

export default function LoginPage() {
  const { login } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [wordIdx, setWordIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Rotate the hero word every 2.5s
  useEffect(() => {
    const id = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setWordIdx((i) => (i + 1) % ROTATING_WORDS.length);
        setAnimating(false);
      }, 400); // fade-out duration
    }, 2500);
    return () => clearInterval(id);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let data;
      if (isRegister) {
        data = await API.register({ email, password, name });
      } else {
        data = await API.login({ email, password });
      }
      login(data);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Header (always visible) ----------
  const header = (
    <header className="login-header">
      <div className="login-header__left">
        <img src="/hopscotch-logo.png" alt="Hopscotch" className="login-header-logo" />
      </div>
    </header>
  );

  // ---------- Hero landing ----------
  if (!showForm) {
    return (
      <div className="login-page">
        {header}

        <main className="login-hero">
          <h1 className="login-hero__gradient">Research Made</h1>
          <h2 className={`login-hero__rotating ${animating ? "fade-out" : "fade-in"}`}>
            {ROTATING_WORDS[wordIdx]}
          </h2>
          <p className="login-hero__desc">
            Hopscotch is a structured, AI-powered 9-step research methods
            learning platform that helps students discover their worldview and
            build a research design from the ground up.
          </p>

          <div className="login-hero__actions">
            <button className="btn login-btn-filled" onClick={() => setShowForm(true)}>
              Get Started
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ---------- Auth form — split screen ----------
  return (
    <div className="login-split">
      {/* Left side: form */}
      <div className="login-split__left">
        <button className="login-split__back" onClick={() => setShowForm(false)}>
          &larr; Back
        </button>

        <div className="login-split__form-area">
          <h1 className="login-split__title">
            {isRegister ? "Create Account" : "Login"}
          </h1>
          <p className="login-split__subtitle">
            Enter your credentials and get started with us
          </p>

          <form className="login-split__form" onSubmit={handleSubmit}>
            {isRegister && (
              <div className="login-field">
                <label className="login-field__label">Full Name</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="login-field__input"
                />
              </div>
            )}
            <div className="login-field">
              <label className="login-field__label">Email ID</label>
              <input
                type="email"
                placeholder="Email ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="login-field__input"
              />
            </div>
            <div className="login-field">
              <label className="login-field__label">Password</label>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="login-field__input"
              />
            </div>

            {error && <div className="badge badge--error" style={{ marginTop: 8 }}>{error}</div>}

            <button
              type="submit"
              className="login-split__submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isRegister
                ? "Create Account"
                : "Login"}
            </button>
          </form>

          <p className="login-split__toggle">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              className="link-btn"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
            >
              {isRegister ? "Login" : "Create Account"}
            </button>
          </p>
        </div>
      </div>

      {/* Right side: branded panel */}
      <div className="login-split__right">
        <img src="/hopscotch-logo.png" alt="Hopscotch" className="login-split__logo" />
      </div>
    </div>
  );
}
