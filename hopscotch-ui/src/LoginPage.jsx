// src/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import { useLang } from "./i18n.jsx";
import LangSwitcher from "./LangSwitcher";
import { API } from "./api";

const ROTATING_KEYS = ["login.rotating1", "login.rotating2", "login.rotating3", "login.rotating4"];

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLang();
  const [showForm, setShowForm] = useState(false);
  // "login" | "register" | "forgot" | "reset" | "classroom"
  const [view, setView] = useState("login");
  // Account type: determines both role and education_level
  const [accountType, setAccountType] = useState("hs_student");
  const ACCOUNT_TYPES = {
    hs_student:  { role: "student", education_level: "high_school",  label: t("login.type.hsStudent"), icon: "🎒", desc: t("login.type.hsStudentDesc") },
    hs_teacher:  { role: "teacher", education_level: "high_school",  label: t("login.type.hsTeacher"), icon: "🍎", desc: t("login.type.teacherDesc") },
    he_student:  { role: "student", education_level: "higher_ed",    label: t("login.type.heStudent"), icon: "🎓", desc: t("login.type.heStudentDesc") },
    he_faculty:  { role: "teacher", education_level: "higher_ed",    label: t("login.type.heFaculty"), icon: "🏛️", desc: t("login.type.teacherDesc") },
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
        setWordIdx((i) => (i + 1) % ROTATING_KEYS.length);
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
        setError(t("login.errNoMatch"));
        return;
      }
      if (newPassword.length < 6) {
        setError(t("login.errTooShort"));
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
        setSuccessMsg(t("login.forgotSent"));
      } else if (view === "reset") {
        await API.resetPassword({ token: resetToken, new_password: newPassword });
        setSuccessMsg(t("login.resetDone"));
        setTimeout(() => {
          switchView("login");
          setNewPassword("");
          setConfirmPassword("");
        }, 3000);
      }
    } catch (err) {
      setError(err.message || t("login.errGeneric"));
    } finally {
      setLoading(false);
    }
  }

  // ---------- Field icons ----------
  const fieldIcon = {
    user: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    ),
    mail: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    ),
    lock: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    ),
    school: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
    ),
  };

  // ---------- Reusable eye toggle ----------
  const eyeBtn = (
    <button
      type="button"
      className="login-field__eye"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
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

  // ---------- Language dropdown (shared by hero header and split form) ----------
  const langSwitch = <LangSwitcher />;

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
      {langSwitch}
      <button className="theme-toggle" onClick={toggleTheme} aria-label={t("login.toggleTheme")} title={theme === "dark" ? t("login.lightMode") : t("login.darkMode")}>
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

          <h1 className="login-hero__gradient">{t("login.heroTitle")}</h1>
          <h2 className={`login-hero__rotating ${animating ? "fade-out" : "fade-in"}`}>
            {t(ROTATING_KEYS[wordIdx])}
          </h2>
          <p className="login-hero__desc">
            {t("login.heroDesc")}
          </p>

          <div className="login-hero__actions">
            <button className="btn login-btn-filled" onClick={() => openForm("login")}>
              {t("login.logIn")}
            </button>
            <button className="btn login-btn-outline" onClick={() => openForm("register")}>
              {t("login.createAccount")}
            </button>
            <div className="login-hero__divider">
              <span>{t("login.or")}</span>
            </div>
            <button className="login-btn-school" onClick={() => openForm("classroom")}>
              {t("login.schoolBtn")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ---------- Form title / subtitle ----------
  const titles = {
    login:     { title: t("login.title.login"),     subtitle: t("login.subtitle.login") },
    register:  { title: t("login.title.register"),  subtitle: t("login.subtitle.register") },
    classroom: { title: t("login.title.classroom"), subtitle: t("login.subtitle.classroom") },
    forgot:    { title: t("login.title.forgot"),    subtitle: t("login.subtitle.forgot") },
    reset:     { title: t("login.title.reset"),     subtitle: t("login.subtitle.reset") },
  };

  const { title, subtitle } = titles[view] || titles.login;

  // ---------- Auth form - split screen ----------
  return (
    <div className="login-split">
      {/* Left side: form */}
      <div className="login-split__left">
        <div className="login-split__topbar">
          <button className="login-split__back" onClick={() => setShowForm(false)}>
            {t("login.back")}
          </button>
          {langSwitch}
        </div>

        <div className="login-split__form-area">
          <h1 className="login-split__title">{title}</h1>
          <p className="login-split__subtitle">{subtitle}</p>

          <form className="login-split__form" onSubmit={handleSubmit}>
            {/* Account type selector - register only */}
            {view === "register" && (
              <div className="login-account-type">
                <label className="login-field__label">{t("login.iAmA")}</label>
                <div className="login-account-type__grid">
                  {Object.entries(ACCOUNT_TYPES).map(([key, { label, icon, desc }]) => (
                    <button
                      key={key}
                      type="button"
                      className={`login-account-type__btn${accountType === key ? " login-account-type__btn--active" : ""}`}
                      onClick={() => setAccountType(key)}
                      aria-pressed={accountType === key}
                    >
                      <span className="login-account-type__icon" aria-hidden="true">{icon}</span>
                      <span className="login-account-type__text">
                        <span className="login-account-type__label">{label}</span>
                        <span className="login-account-type__desc">{desc}</span>
                      </span>
                      <span className="login-account-type__check" aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Classroom hint - friendly explainer */}
            {view === "classroom" && (
              <div className="login-hint">
                <span className="login-hint__emoji" aria-hidden="true">🏫</span>
                <span>
                  {t("login.hint1")}<strong>{t("login.hintBold")}</strong>{t("login.hint2")}
                  <code>period3research_01</code>.
                </span>
              </div>
            )}

            {/* Name - register only */}
            {view === "register" && (
              <div className="login-field">
                <label className="login-field__label">{t("login.fullName")}</label>
                <div className="login-field__box">
                  <span className="login-field__icon">{fieldIcon.user}</span>
                  <input
                    type="text"
                    placeholder={t("login.namePh")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="login-field__input"
                  />
                </div>
              </div>
            )}

            {/* Username - classroom only */}
            {view === "classroom" && (
              <div className="login-field">
                <label className="login-field__label">{t("login.username")}</label>
                <div className="login-field__box">
                  <span className="login-field__icon">{fieldIcon.school}</span>
                  <input
                    type="text"
                    placeholder={t("login.usernamePh")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="login-field__input"
                  />
                </div>
              </div>
            )}

            {/* Email - login, register, forgot */}
            {(view === "login" || view === "register" || view === "forgot") && (
              <div className="login-field">
                <label className="login-field__label">{t("login.email")}</label>
                <div className="login-field__box">
                  <span className="login-field__icon">{fieldIcon.mail}</span>
                  <input
                    type="email"
                    placeholder={t("login.emailPh")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="login-field__input"
                  />
                </div>
              </div>
            )}

            {/* Password - login, register, classroom */}
            {(view === "login" || view === "register" || view === "classroom") && (
              <div className="login-field">
                <label className="login-field__label">{t("login.password")}</label>
                <div className="login-field__box login-field__password-wrap">
                  <span className="login-field__icon">{fieldIcon.lock}</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
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

            {/* New password + confirm - reset only */}
            {view === "reset" && (
              <>
                <div className="login-field">
                  <label className="login-field__label">{t("login.newPassword")}</label>
                  <div className="login-field__box login-field__password-wrap">
                    <span className="login-field__icon">{fieldIcon.lock}</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("login.newPasswordPh")}
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
                  <label className="login-field__label">{t("login.confirmPassword")}</label>
                  <div className="login-field__box">
                    <span className="login-field__icon">{fieldIcon.lock}</span>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("login.confirmPasswordPh")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="login-field__input"
                    />
                  </div>
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
              {loading ? t("login.pleaseWait")
                : view === "register" ? t("login.submitRegister")
                : view === "classroom" ? t("login.submitLogin")
                : view === "forgot" ? t("login.submitForgot")
                : view === "reset" ? t("login.submitReset")
                : t("login.submitLogin")}
            </button>
          </form>

          <div className="login-split__toggle">
            {view === "login" && (
              <>
                <div className="login-links-row">
                  <span>
                    {t("login.noAccount")}{" "}
                    <button className="link-btn" onClick={() => switchView("register")}>
                      {t("login.createAccount")}
                    </button>
                  </span>
                  <button className="link-btn link-btn--muted" onClick={() => switchView("forgot")}>
                    {t("login.forgotLink")}
                  </button>
                </div>
                <div className="login-or"><span>{t("login.or")}</span></div>
                <button type="button" className="login-callout" onClick={() => switchView("classroom")}>
                  <span className="login-callout__emoji" aria-hidden="true">🏫</span>
                  <span className="login-callout__text">
                    <span className="login-callout__title">{t("login.calloutTitle")}</span>
                    <span className="login-callout__desc">{t("login.calloutDesc")}</span>
                  </span>
                  <span className="login-callout__arrow" aria-hidden="true">&rarr;</span>
                </button>
              </>
            )}
            {view === "register" && (
              <p>
                {t("login.haveAccount")}{" "}
                <button className="link-btn" onClick={() => switchView("login")}>
                  {t("login.submitLogin")}
                </button>
              </p>
            )}
            {view === "classroom" && (
              <p>
                {t("login.haveEmail")}{" "}
                <button className="link-btn" onClick={() => switchView("login")}>
                  {t("login.loginHere")}
                </button>
              </p>
            )}
            {view === "forgot" && (
              <p>
                {t("login.rememberPassword")}{" "}
                <button className="link-btn" onClick={() => switchView("login")}>
                  {t("login.backToLogin")}
                </button>
              </p>
            )}
            {view === "reset" && (
              <p>
                <button className="link-btn" onClick={() => switchView("login")}>
                  {t("login.backToLogin")}
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
