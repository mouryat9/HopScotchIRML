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
          <div className="login-hero__hopscotch">
            <svg className="hop-grid-loader hop-grid-hero" viewBox="0 0 128 46" width="220" height="80" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" fill="none" style={{background:'transparent'}} aria-label="Hopscotch grid">
              {/* col 1 — pair (Steps 1,2) */}
              <rect className="hop-sq sq-1" x="0"  y="0"  width="18" height="22" rx="6" fill="#2B5EA7"/>
              <rect className="hop-sq sq-2" x="0"  y="24" width="18" height="22" rx="6" fill="#E8618C"/>
              {/* col 2 — single (Step 3) */}
              <rect className="hop-sq sq-3" x="22" y="12" width="18" height="22" rx="6" fill="#D94040"/>
              {/* col 3 — pair (Steps 4,5) */}
              <rect className="hop-sq sq-4" x="44" y="0"  width="18" height="22" rx="6" fill="#1A8A7D"/>
              <rect className="hop-sq sq-5" x="44" y="24" width="18" height="22" rx="6" fill="#B0A47A"/>
              {/* col 4 — single (Step 6) */}
              <rect className="hop-sq sq-6" x="66" y="12" width="18" height="22" rx="6" fill="#00AEEF"/>
              {/* col 5 — pair (Steps 7,8) */}
              <rect className="hop-sq sq-7" x="88" y="0"  width="18" height="22" rx="6" fill="#F0B429"/>
              <rect className="hop-sq sq-8" x="88" y="24" width="18" height="22" rx="6" fill="#F5922A"/>
              {/* col 6 — single half-circle (Step 9) */}
              <path className="hop-sq sq-9" d="M110,7 A16,16 0 0,1 110,39 Z" fill="#7B8794"/>
            </svg>
          </div>

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
        <div className="login-split__hopscotch">
          <svg className="hop-grid-loader hop-grid-hero" viewBox="0 0 128 46" width="180" height="65" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" fill="none" style={{background:'transparent'}} aria-label="Hopscotch grid">
            <rect className="hop-sq sq-1" x="0"  y="0"  width="18" height="22" rx="6" fill="#2B5EA7"/>
            <rect className="hop-sq sq-2" x="0"  y="24" width="18" height="22" rx="6" fill="#E8618C"/>
            <rect className="hop-sq sq-3" x="22" y="12" width="18" height="22" rx="6" fill="#D94040"/>
            <rect className="hop-sq sq-4" x="44" y="0"  width="18" height="22" rx="6" fill="#1A8A7D"/>
            <rect className="hop-sq sq-5" x="44" y="24" width="18" height="22" rx="6" fill="#B0A47A"/>
            <rect className="hop-sq sq-6" x="66" y="12" width="18" height="22" rx="6" fill="#00AEEF"/>
            <rect className="hop-sq sq-7" x="88" y="0"  width="18" height="22" rx="6" fill="#F0B429"/>
            <rect className="hop-sq sq-8" x="88" y="24" width="18" height="22" rx="6" fill="#F5922A"/>
            <path className="hop-sq sq-9" d="M110,7 A16,16 0 0,1 110,39 Z" fill="#7B8794"/>
          </svg>
        </div>
        <img src="/hopscotch-logo.png" alt="Hopscotch" className="login-split__logo" />
      </div>
    </div>
  );
}
