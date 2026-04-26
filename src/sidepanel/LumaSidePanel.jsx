import { useEffect, useState } from "react";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 120000);
const initialProfile = {
  email: "",
  fullName: "",
  ageRange: "",
  weight: "",
  sexAssignedAtBirth: "",
  gender: "",
  familyMedicalHistory: "",
  substanceUse: [],
  substanceUseOther: "",
  dietaryRestrictions: [],
  dietaryRestrictionsOther: "",
  conditions: "",
  medications: "",
  goals: ""
};

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set(value, resolve);
  });
}

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Request timed out while waiting for analysis. The model may be slow or still loading."
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string" ? payload : payload?.error || "Request failed";
    throw new Error(message);
  }

  return payload;
}

function truncateText(text, maxLength = 140) {
  if (!text) {
    return "—";
  }

  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

function SignupStep({
  form,
  password,
  onPasswordChange,
  onChange,
  onSubmit,
  onSwitchToSignIn,
  isSubmitting,
  error
}) {
  return (
    <section className="flow-card">
      <div className="flow-eyebrow">Create account</div>
      <h2 className="flow-title">Start your WebMedica profile</h2>
      <p className="flow-copy">
        Sign up with your email so WebMedica can save your health context and tailor
        article insights over time.
      </p>

      <form className="flow-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Full name</span>
          <input
            name="fullName"
            type="text"
            value={form.fullName}
            onChange={onChange}
            placeholder="Avery Kim"
            required
          />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder="avery@example.com"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            value={password}
            onChange={onPasswordChange}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>

        {error ? <p className="analysis-error">{error}</p> : null}

        <button className="primary-button" type="submit">
          {isSubmitting ? "Creating account..." : "Continue to verification"}
        </button>
        <button className="primary-button" type="button" onClick={onSwitchToSignIn}>
          Already have an account? Sign in
        </button>
      </form>
    </section>
  );
}

function VerificationStep({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  onLogin,
  onBackToSignup,
  isSubmitting,
  error,
  verificationUrl
}) {
  return (
    <section className="flow-card">
      <div className="flow-eyebrow">Verification</div>
      <h2 className="flow-title">Verify your email</h2>
      <p className="flow-copy">
        We sent a verification link to your email. After confirming it, come back
        here and sign in to continue onboarding.
      </p>

      <div className="verification-note">
        <strong>Prepared for:</strong> {email}
      </div>

      {verificationUrl ? (
        <div className="verification-note">
          <strong>Dev mode verification link:</strong>{" "}
          <a href={verificationUrl} target="_blank" rel="noreferrer">
            Open verification link
          </a>
        </div>
      ) : null}

      <form className="flow-form" onSubmit={onLogin}>
        <label className="field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={onEmailChange}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            value={password}
            onChange={onPasswordChange}
            placeholder="Enter your password"
            required
          />
        </label>

        {error ? <p className="analysis-error">{error}</p> : null}

        <button className="primary-button" type="submit">
          {isSubmitting ? "Signing in..." : "I've verified, sign in"}
        </button>
        <button className="primary-button" type="button" onClick={onBackToSignup}>
          Use a different email
        </button>
      </form>
    </section>
  );
}

function SurveyStep({ form, onChange, onSubmit }) {
  return (
    <section className="flow-card">
      <div className="flow-eyebrow">Intro survey</div>
      <h2 className="flow-title">Tell WebMedica a bit about you</h2>
      <p className="flow-copy">
        This basic health profile helps future article summaries reflect your
        context more accurately.
      </p>

      <form className="flow-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Age range</span>
          <select name="ageRange" value={form.ageRange} onChange={onChange} required>
            <option value="">Select age range</option>
            <option value="Under 18">Under 18</option>
            <option value="18-24">18-24</option>
            <option value="25-34">25-34</option>
            <option value="35-44">35-44</option>
            <option value="45-54">45-54</option>
            <option value="55+">55+</option>
          </select>
        </label>

        <label className="field">
          <span>Weight</span>
          <input
            name="weight"
            type="text"
            value={form.weight}
            onChange={onChange}
            placeholder="e.g. 140 lb"
            required
          />
        </label>

        <label className="field">
          <span>Sex assigned at birth</span>
          <select
            name="sexAssignedAtBirth"
            value={form.sexAssignedAtBirth}
            onChange={onChange}
            required
          >
            <option value="">Select option</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Intersex">Intersex</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </label>

        <label className="field">
          <span>Gender</span>
          <input
            name="gender"
            type="text"
            value={form.gender}
            onChange={onChange}
            placeholder="Woman, non-binary, etc."
            required
          />
        </label>

        <label className="field">
          <span>Family medical history</span>
          <textarea
            name="familyMedicalHistory"
            value={form.familyMedicalHistory}
            onChange={onChange}
            rows="3"
            placeholder="Any relevant family history..."
          />
        </label>

        <label className="field">
          <span>Substance use</span>
          <select
            name="substanceUse"
            value={form.substanceUse}
            onChange={onChange}
            multiple
            aria-label="Substance use (multi-select)"
            required
          >
            <option value="Alcohol">Alcohol</option>
            <option value="Nicotine">Nicotine</option>
            <option value="Cannabis">Cannabis</option>
            <option value="Caffeine">Caffeine</option>
            <option value="None">None</option>
            <option value="Other">Other</option>
          </select>
        </label>

        {form.substanceUse.includes("Other") ? (
          <label className="field">
            <span>Other substance use</span>
            <input
              name="substanceUseOther"
              type="text"
              value={form.substanceUseOther}
              onChange={onChange}
              placeholder="Please specify"
            />
          </label>
        ) : null}

        <label className="field">
          <span>Dietary restrictions</span>
          <select
            name="dietaryRestrictions"
            value={form.dietaryRestrictions}
            onChange={onChange}
            multiple
            aria-label="Dietary restrictions (multi-select)"
            required
          >
            <option value="Vegetarian">Vegetarian</option>
            <option value="Vegan">Vegan</option>
            <option value="Gluten-free">Gluten-free</option>
            <option value="Dairy-free">Dairy-free</option>
            <option value="Nut allergy">Nut allergy</option>
            <option value="No restrictions">No restrictions</option>
            <option value="Other">Other</option>
          </select>
        </label>

        {form.dietaryRestrictions.includes("Other") ? (
          <label className="field">
            <span>Other dietary restrictions</span>
            <input
              name="dietaryRestrictionsOther"
              type="text"
              value={form.dietaryRestrictionsOther}
              onChange={onChange}
              placeholder="Please specify"
            />
          </label>
        ) : null}

        <label className="field">
          <span>Relevant conditions</span>
          <textarea
            name="conditions"
            value={form.conditions}
            onChange={onChange}
            rows="3"
            placeholder="PCOS, endometriosis, migraines..."
          />
        </label>

        <label className="field">
          <span>Current medications or supplements</span>
          <textarea
            name="medications"
            value={form.medications}
            onChange={onChange}
            rows="3"
            placeholder="Metformin, iron, vitamin D..."
          />
        </label>

        <label className="field">
          <span>Main goals</span>
          <textarea
            name="goals"
            value={form.goals}
            onChange={onChange}
            rows="3"
            placeholder="Understand symptoms, compare studies, find lifestyle changes..."
          />
        </label>

        <button className="primary-button" type="submit">
          Save profile
        </button>
      </form>
    </section>
  );
}

function ReadyState({
  pageContext,
  profile,
  isEnabled,
  onToggle,
  onLogout,
  onAnalyze,
  isAnalyzing,
  analysis,
  analysisError
}) {
  const [activeTab, setActiveTab] = useState("analysis");
  const pageTitle = pageContext?.title || "—";
  const articleSnippet = truncateText(pageContext?.text, 140);

  return (
    <>
      <header className="panel-header">
        <div className="brand-row">
          <div className="brand">WebMedica</div>
          <div className="header-controls">
            <button
              className={`toggle ${isEnabled ? "is-on" : ""}`}
              type="button"
              aria-pressed={isEnabled}
              onClick={onToggle}
            >
              <span className="toggle-thumb"></span>
            </button>
            <button className="logout-button" type="button" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>

        <div className="status">
          <span>{isEnabled ? "Analyzing page for you" : "WebMedica is paused"}</span>
          {isEnabled ? (
            <span className="status-dots" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
          ) : null}
        </div>
      </header>

      <main className="panel-content">
        <div className="panel-tabs" role="tablist" aria-label="WebMedica panel tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "analysis"}
            className={`panel-tab ${activeTab === "analysis" ? "is-active" : ""}`}
            onClick={() => setActiveTab("analysis")}
          >
            Analysis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "profile"}
            className={`panel-tab ${activeTab === "profile" ? "is-active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
        </div>

        {activeTab === "analysis" ? (
          <>
            <div className="page-context">
              <div className="context-label">Current page and article</div>
              <div className="context-title">{pageTitle}</div>
              <div className="context-url">{pageContext?.url || "—"}</div>
              <div className="context-snippet">{articleSnippet}</div>
              <div className="context-url">
                {pageContext ? "Ready to analyze." : "Waiting for page context..."}
              </div>
              <button
                className="primary-button analyze-button"
                type="button"
                onClick={onAnalyze}
                disabled={isAnalyzing || !pageContext}
              >
                {isAnalyzing ? "Analyzing with AI..." : "Analyze this study"}
              </button>
              {analysisError ? <p className="analysis-error">{analysisError}</p> : null}
            </div>

            <article className="insight-card">
              <div className="context-label">Resulting analysis</div>
              {analysis ? (
                <>
                  <p className="insight-copy">{analysis.summary}</p>

                  <div className="analysis-section">
                    <h3>What this means for women</h3>
                    <ul>
                      {(analysis.womenSections || []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="analysis-section">
                    <h3>Bias notes</h3>
                    <ul>
                      {(analysis.biasNotes || []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="analysis-section">
                    <h3>Follow-up questions</h3>
                    <ul>
                      {(analysis.followUpQuestions || []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="analysis-empty">
                  Run analysis to see a women-focused summary and follow-up questions.
                </p>
              )}
            </article>
          </>
        ) : (
          <article className="profile-summary profile-tab-card">
            <div className="context-label">Saved profile</div>
            <div className="summary-grid">
              <div>
                <span className="summary-key">Email</span>
                <span className="summary-value">{profile.email || "Not set"}</span>
              </div>
              <div>
                <span className="summary-key">Full name</span>
                <span className="summary-value">{profile.fullName || "Not set"}</span>
              </div>
              <div>
                <span className="summary-key">Age range</span>
                <span className="summary-value">{profile.ageRange || "Not set"}</span>
              </div>
              <div>
                <span className="summary-key">Weight</span>
                <span className="summary-value">{profile.weight || "Not set"}</span>
              </div>
              <div>
                <span className="summary-key">Sex assigned at birth</span>
                <span className="summary-value">
                  {profile.sexAssignedAtBirth || "Not set"}
                </span>
              </div>
              <div>
                <span className="summary-key">Gender</span>
                <span className="summary-value">{profile.gender || "Not set"}</span>
              </div>
              <div>
                <span className="summary-key">Family medical history</span>
                <span className="summary-value">
                  {profile.familyMedicalHistory || "Not set"}
                </span>
              </div>
              <div>
                <span className="summary-key">Substance use</span>
                <span className="summary-value">
                  {profile.substanceUse?.length
                    ? profile.substanceUse.join(", ")
                    : "Not set"}
                </span>
              </div>
              <div>
                <span className="summary-key">Dietary restrictions</span>
                <span className="summary-value">
                  {profile.dietaryRestrictions?.length
                    ? profile.dietaryRestrictions.join(", ")
                    : "Not set"}
                </span>
              </div>
              <div>
                <span className="summary-key">Conditions</span>
                <span className="summary-value">{profile.conditions || "Not set"}</span>
              </div>
              <div>
                <span className="summary-key">Medications</span>
                <span className="summary-value">{profile.medications || "Not set"}</span>
              </div>
              <div>
                <span className="summary-key">Goals</span>
                <span className="summary-value">{profile.goals || "Not set"}</span>
              </div>
            </div>
          </article>
        )}
      </main>

      <footer className="panel-footer">
        <div className="footer-label">Ask WebMedica</div>
        <form className="ask-form">
          <label className="sr-only" htmlFor="follow-up">
            Ask a follow-up question
          </label>
          <input
            id="follow-up"
            type="text"
            placeholder="Ask a follow-up question..."
          />
          <button type="submit" aria-label="Send question">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.7 3.3 3.9 10.5c-.8.3-.8 1.5 0 1.8l6.4 2.3 2.3 6.4c.3.8 1.5.8 1.8 0L21.6 4.2c.3-.7-.3-1.3-.9-.9Z" />
            </svg>
          </button>
        </form>
        <p className="footer-copy">
          Get personalized insights, find similar studies, or explore related
          topics
        </p>
      </footer>
    </>
  );
}

export function LumaSidePanel() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [pageContext, setPageContext] = useState(null);
  const [profile, setProfile] = useState(initialProfile);
  const [userProfile, setUserProfile] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [auth, setAuth] = useState({
    hasAccount: false,
    emailVerified: false,
    surveyCompleted: false
  });

  useEffect(() => {
    let isMounted = true;

    async function loadState() {
      const result = await storageGet([
        "lumaEnabled",
        "lumaLastPage",
        "lumaAuth",
        "lumaProfile",
        "lumaToken"
      ]);

      if (!isMounted) {
        return;
      }

      if (typeof result.lumaEnabled === "boolean") {
        setIsEnabled(result.lumaEnabled);
      }

      if (result.lumaLastPage?.text) {
        setPageContext(result.lumaLastPage);
      }

      if (result.lumaAuth) {
        setAuth(result.lumaAuth);
      }

      if (result.lumaProfile) {
        const hydratedProfile = { ...initialProfile, ...result.lumaProfile };
        setProfile(hydratedProfile);
      }

      if (result.lumaToken) {
        try {
          const me = await apiRequest("/profile/me", {
            token: result.lumaToken
          });
          const hydratedProfile = {
            ...initialProfile,
            email: me.user.email,
            fullName: me.user.fullName,
            ...(me.medicalProfile || {})
          };
          setAuthToken(result.lumaToken);
          setProfile(hydratedProfile);
          if (me.medicalProfile) {
            setUserProfile(hydratedProfile);
          } else {
            setUserProfile(null);
          }
          setAuth({
            hasAccount: true,
            emailVerified: me.user.emailVerified,
            surveyCompleted: Boolean(me.medicalProfile)
          });
        } catch (_error) {
          setUserProfile(null);
          await storageSet({ lumaToken: "" });
        }
      }
    }

    loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleRuntimeMessage(message) {
      if (message?.type === "PAGE_CONTEXT" && message.payload) {
        setPageContext(message.payload);
      }
    }

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, []);

  const handleToggle = async () => {
    const nextValue = !isEnabled;
    setIsEnabled(nextValue);
    await storageSet({ lumaEnabled: nextValue });
  };

  const handleFieldChange = (event) => {
    const { name, value, multiple, options } = event.target;
    const nextValue = multiple
      ? Array.from(options)
          .filter((option) => option.selected)
          .map((option) => option.value)
      : value;

    setProfile((current) => ({ ...current, [name]: nextValue }));
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setAuthError("");
    setVerificationUrl("");
    setIsAuthSubmitting(true);
    try {
      const payload = await apiRequest("/auth/signup", {
        method: "POST",
        body: {
          email: profile.email,
          fullName: profile.fullName,
          password
        }
      });

      if (payload?.verificationPreviewUrl) {
        setVerificationUrl(payload.verificationPreviewUrl);
      }

      const nextAuth = {
        hasAccount: true,
        emailVerified: false,
        surveyCompleted: false
      };
      setAuth(nextAuth);
      await storageSet({
        lumaAuth: nextAuth,
        lumaProfile: profile
      });
    } catch (error) {
      const message = error.message || "Could not create account.";
      if (message.toLowerCase().includes("email already in use")) {
        const nextAuth = {
          hasAccount: true,
          emailVerified: false,
          surveyCompleted: false
        };
        setAuth(nextAuth);
        await storageSet({
          lumaAuth: nextAuth,
          lumaProfile: profile
        });
        setAuthError("Account already exists. Sign in with your password below.");
      } else {
        setAuthError(message);
      }
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLoginAfterVerification = async (event) => {
    event.preventDefault();
    setAuthError("");
    setIsAuthSubmitting(true);
    try {
      const payload = await apiRequest("/auth/login", {
        method: "POST",
        body: {
          email: profile.email,
          password
        }
      });

      const token = payload.token;
      const nextAuth = {
        hasAccount: true,
        emailVerified: true,
        surveyCompleted: Boolean(payload.user.medicalProfile)
      };
      const hydratedProfile = {
        ...initialProfile,
        email: payload.user.email,
        fullName: payload.user.fullName,
        ...(payload.user.medicalProfile || {})
      };

      setAuthToken(token);
      setAuth(nextAuth);
      setProfile(hydratedProfile);
      if (payload.user.medicalProfile) {
        setUserProfile(hydratedProfile);
      }
      await storageSet({
        lumaToken: token,
        lumaAuth: nextAuth,
        lumaProfile: hydratedProfile
      });
    } catch (error) {
      setAuthError(error.message || "Could not sign in.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleBackToSignup = async () => {
    const nextAuth = {
      hasAccount: false,
      emailVerified: false,
      surveyCompleted: false
    };
    setAuthError("");
    setVerificationUrl("");
    setAuth(nextAuth);
    await storageSet({ lumaAuth: nextAuth });
  };

  const handleSwitchToSignIn = async () => {
    const nextAuth = {
      hasAccount: true,
      emailVerified: false,
      surveyCompleted: false
    };
    setAuthError("");
    setVerificationUrl("");
    setAuth(nextAuth);
    await storageSet({
      lumaAuth: nextAuth,
      lumaProfile: profile
    });
  };

  const handleSurveySubmit = async (event) => {
    event.preventDefault();

    if (!authToken) {
      setAuthError("Please sign in again to save onboarding.");
      return;
    }

    setAuthError("");
    setIsAuthSubmitting(true);
    try {
      const payload = await apiRequest("/profile/onboarding", {
        method: "POST",
        token: authToken,
        body: {
          ageRange: profile.ageRange,
          weight: profile.weight,
          sexAssignedAtBirth: profile.sexAssignedAtBirth,
          gender: profile.gender,
          familyMedicalHistory: profile.familyMedicalHistory || null,
          substanceUse: profile.substanceUse,
          substanceUseOther: profile.substanceUseOther || null,
          dietaryRestrictions: profile.dietaryRestrictions,
          dietaryRestrictionsOther: profile.dietaryRestrictionsOther || null,
          conditions: profile.conditions || null,
          medications: profile.medications || null,
          goals: profile.goals || null
        }
      });

      const nextAuth = {
        ...auth,
        surveyCompleted: true
      };
      const hydratedProfile = {
        ...initialProfile,
        email: profile.email,
        fullName: profile.fullName,
        ...payload.medicalProfile
      };
      setAuth(nextAuth);
      setProfile(hydratedProfile);
      setUserProfile(hydratedProfile);
      await storageSet({
        lumaAuth: nextAuth,
        lumaProfile: hydratedProfile
      });
    } catch (error) {
      setAuthError(error.message || "Could not save onboarding.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!pageContext || !userProfile) {
      setAnalysisError("Page context and user profile are required before analysis.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");

    try {
      const payload = await apiRequest("/summarize-article", {
        method: "POST",
        body: {
          articleText: pageContext.text,
          url: pageContext.url,
          title: pageContext.title,
          userProfile
        }
      });
      setAnalysis(payload);
    } catch (error) {
      setAnalysisError(error.message || "Could not analyze this study right now.");
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogout = async () => {
    const clearedAuth = {
      hasAccount: false,
      emailVerified: false,
      surveyCompleted: false
    };
    setAuthToken("");
    setUserProfile(null);
    setPassword("");
    setVerificationUrl("");
    setAuthError("");
    setAnalysis(null);
    setAnalysisError("");
    setAuth(clearedAuth);
    await storageSet({
      lumaToken: "",
      lumaAuth: clearedAuth,
      lumaProfile: ""
    });
  };

  const onboardingComplete = auth.emailVerified && auth.surveyCompleted;

  return (
    <div className="panel-shell">
      {onboardingComplete ? (
        <ReadyState
          isEnabled={isEnabled}
          onToggle={handleToggle}
          onLogout={handleLogout}
          pageContext={pageContext}
          profile={profile}
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          analysis={analysis}
          analysisError={analysisError}
        />
      ) : (
        <main className="panel-auth">
          <div className="auth-header">
            <div className="brand">WebMedica</div>
            <p className="auth-subtitle">
              Personalized health context starts with a verified account and a
              lightweight intro survey.
            </p>
          </div>

          {!auth.hasAccount ? (
            <SignupStep
              form={profile}
              password={password}
              onPasswordChange={handlePasswordChange}
              onChange={handleFieldChange}
              onSubmit={handleSignup}
              onSwitchToSignIn={handleSwitchToSignIn}
              isSubmitting={isAuthSubmitting}
              error={authError}
            />
          ) : null}

          {auth.hasAccount && !auth.emailVerified ? (
            <VerificationStep
              email={profile.email}
              onEmailChange={handleFieldChange}
              password={password}
              onPasswordChange={handlePasswordChange}
              onLogin={handleLoginAfterVerification}
              onBackToSignup={handleBackToSignup}
              isSubmitting={isAuthSubmitting}
              error={authError}
              verificationUrl={verificationUrl}
            />
          ) : null}

          {auth.hasAccount && auth.emailVerified && !auth.surveyCompleted ? (
            <SurveyStep
              form={profile}
              onChange={handleFieldChange}
              onSubmit={handleSurveySubmit}
            />
          ) : null}
        </main>
      )}
    </div>
  );
}
