// src/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { API } from "./api";

const ROTATING_WORDS = [
  "Simplified.",
  "Structured.",
  "Step by Step.",
  "Guided.",
];

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showForm, setShowForm] = useState(false);
  // "login" | "register" | "forgot" | "reset" | "classroom"
  const [view, setView] = useState("login");
  // Account type: determines both role and education_level
  const [accountType, setAccountType] = useState("hs_student");
  const ACCOUNT_TYPES = {
    hs_student:  { role: "student", education_level: "high_school",  label: "High School Student" },
    hs_teacher:  { role: "teacher", education_level: "high_school",  label: "High School Teacher" },
    he_student:  { role: "student", education_level: "higher_ed",    label: "Higher Ed Student" },
    he_faculty:  { role: "teacher", education_level: "higher_ed",    label: "Higher Ed Faculty" },
  };
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  // Detect password reset token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset_token");
    if (token) {
      setResetToken(token);
      setView("reset");
      setShowForm(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function switchView(v) {
    setView(v);
    setError("");
    setSuccessMsg("");
  }

  function openForm(v) {
    setView(v);
    setError("");
    setSuccessMsg("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (view === "reset") {
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (newPassword.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
    }

    setLoading(true);
    try {
      if (view === "register") {
        const { role, education_level } = ACCOUNT_TYPES[accountType];
        const data = await API.register({ email, password, name, role, education_level });
        login(data);
      } else if (view === "login") {
        const data = await API.login({ email, password });
        login(data);
      } else if (view === "classroom") {
        const data = await API.classroomLogin({ username, password });
        login(data);
      } else if (view === "forgot") {
        await API.forgotPassword({ email });
        setSuccessMsg("If an account with that email exists, a reset link has been sent. Check your inbox.");
      } else if (view === "reset") {
        await API.resetPassword({ token: resetToken, new_password: newPassword });
        setSuccessMsg("Password updated successfully! You can now log in.");
        setTimeout(() => {
          switchView("login");
          setNewPassword("");
          setConfirmPassword("");
        }, 3000);
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Reusable eye toggle ----------
  const eyeBtn = (
    <button
      type="button"
      className="login-field__eye"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? "Hide password" : "Show password"}
      tabIndex={-1}
    >
      {showPassword ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );

  // ---------- Hopscotch grid SVG ----------
  const hopGrid = (w, h) => (
    <svg className="hop-grid-loader hop-grid-hero" viewBox="0 0 128 46" width={w} height={h} xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" fill="none" style={{background:'transparent'}} aria-label="Hopscotch grid">
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
  );

  // ---------- Header (always visible) ----------
  const header = (
    <header className="login-header">
      <div className="login-header__left">
        <img
          src={theme === "dark" ? "/Hopscotch4-all-logo-White-alpha.png" : "/Hopscotch-4-all-logo-alpha.png"}
          alt="Hopscotch"
          className="login-header-logo"
        />
      </div>
      <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
        {theme === "dark" ? "\u2600" : "\u263E"}
      </button>
    </header>
  );

  // ---------- Hero landing ----------
  if (!showForm) {
    return (
      <div className="login-page">
        {header}

        <main className="login-hero">
          <div className="login-hero__hopscotch">
            {hopGrid(220, 80)}
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
            <button className="btn login-btn-filled" onClick={() => openForm("login")}>
              Log In
            </button>
            <button className="btn login-btn-outline" onClick={() => openForm("register")}>
              Create Account
            </button>
            <div className="login-hero__divider">
              <span>or</span>
            </div>
            <button className="login-btn-school" onClick={() => openForm("classroom")}>
              I'm a School/Middle/High School student
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ---------- Form title / subtitle ----------
  const titles = {
    login:     { title: "Login",             subtitle: "Enter your credentials and get started with us" },
    register:  { title: "Create Account",    subtitle: "Sign up to get started with Hopscotch" },
    classroom: { title: "School Student Login", subtitle: "Enter the username and password your teacher gave you" },
    forgot:    { title: "Forgot Password",   subtitle: "Enter your email and we'll send you a reset link" },
    reset:     { title: "Set New Password",  subtitle: "Enter your new password below" },
  };

  const { title, subtitle } = titles[view] || titles.login;

  // ---------- Auth form — split screen ----------
  return (
    <div className="login-split">
      {/* Left side: form */}
      <div className="login-split__left">
        <button className="login-split__back" onClick={() => setShowForm(false)}>
          &larr; Back
        </button>

        <div className="login-split__form-area">
          <h1 className="login-split__title">{title}</h1>
          <p className="login-split__subtitle">{subtitle}</p>

          <form className="login-split__form" onSubmit={handleSubmit}>
            {/* Account type selector — register only */}
            {view === "register" && (
              <div className="login-account-type">
                <label className="login-field__label">I am a...</label>
                <div className="login-account-type__grid">
                  {Object.entries(ACCOUNT_TYPES).map(([key, { label }]) => (
                    <button
                      key={key}
                      type="button"
                      className={`login-account-type__btn${accountType === key ? " login-account-type__btn--active" : ""}`}
                      onClick={() => setAccountType(key)}
                    >
                      <span className="login-account-type__label">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name — register only */}
            {view === "register" && (
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

            {/* Username — classroom only */}
            {view === "classroom" && (
              <div className="login-field">
                <label className="login-field__label">Username</label>
                <input
                  type="text"
                  placeholder="e.g. period3research_01"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="login-field__input"
                />
              </div>
            )}

            {/* Email — login, register, forgot */}
            {(view === "login" || view === "register" || view === "forgot") && (
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
            )}

            {/* Password — login, register, classroom */}
            {(view === "login" || view === "register" || view === "classroom") && (
              <div className="login-field">
                <label className="login-field__label">Password</label>
                <div className="login-field__password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="login-field__input"
                  />
                  {eyeBtn}
                </div>
              </div>
            )}

            {/* New password + confirm — reset only */}
            {view === "reset" && (
              <>
                <div className="login-field">
                  <label className="login-field__label">New Password</label>
                  <div className="login-field__password-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      className="login-field__input"
                    />
                    {eyeBtn}
                  </div>
                </div>
                <div className="login-field">
                  <label className="login-field__label">Confirm Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="login-field__input"
                  />
                </div>
              </>
            )}

            {successMsg && <div className="badge badge--success" style={{ marginTop: 8 }}>{successMsg}</div>}
            {error && <div className="badge badge--error" style={{ marginTop: 8 }}>{error}</div>}

            <button
              type="submit"
              className="login-split__submit"
              disabled={loading}
            >
              {loading ? "Please wait..."
                : view === "register" ? "Create Account"
                : view === "classroom" ? "Login"
                : view === "forgot" ? "Send Reset Link"
                : view === "reset" ? "Update Password"
                : "Login"}
            </button>
          </form>

          <div className="login-split__toggle">
            {view === "login" && (
              <>
                <button className="link-btn" onClick={() => switchView("forgot")}>
                  Forgot Password?
                </button>
                <p style={{ marginTop: "0.75rem" }}>
                  Don't have an account?{" "}
                  <button className="link-btn" onClick={() => switchView("register")}>
                    Create Account
                  </button>
                </p>
                <p style={{ marginTop: "0.5rem" }}>
                  <button className="link-btn" onClick={() => switchView("classroom")}>
                    School student? Log in here
                  </button>
                </p>
              </>
            )}
            {view === "register" && (
              <p>
                Already have an account?{" "}
                <button className="link-btn" onClick={() => switchView("login")}>
                  Login
                </button>
              </p>
            )}
            {view === "classroom" && (
              <p>
                Have an email account?{" "}
                <button className="link-btn" onClick={() => switchView("login")}>
                  Login here
                </button>
              </p>
            )}
            {view === "forgot" && (
              <p>
                Remember your password?{" "}
                <button className="link-btn" onClick={() => switchView("login")}>
                  Back to Login
                </button>
              </p>
            )}
            {view === "reset" && (
              <p>
                <button className="link-btn" onClick={() => switchView("login")}>
                  Back to Login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right side: branded panel */}
      <div className="login-split__right">
        <div className="login-split__center">
          <div className="login-split__hopscotch">
            {hopGrid(180, 65)}
          </div>
          <img src="/Hopscotch4-all-logo-White-alpha.png" alt="Hopscotch" className="login-split__logo" />
        </div>
        <div className="login-split__affiliations">
          <img src="/IRML LOGO COLOR white.png" alt="IRML Lab" className="login-split__affiliation" />
          <img src="/MB_Horz_3Clr_whiteLtrs.png" alt="Kennesaw State University" className="login-split__affiliation login-split__affiliation--ksu" />
        </div>
      </div>
    </div>
  );
}
