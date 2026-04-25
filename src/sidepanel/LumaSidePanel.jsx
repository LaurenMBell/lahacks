import { useEffect, useState } from "react";

const LUMA_API_BASE_URL =
  (import.meta.env.VITE_LUMA_API_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const fallbackTags = ["Study population", "Women's health", "Evidence strength"];
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

function truncateText(text, maxLength = 160) {
  if (!text) {
    return "—";
  }

  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

async function apiFetch(path, options = {}) {
  let response;

  try {
    response = await fetch(`${LUMA_API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(
      `Could not reach Luma backend at ${LUMA_API_BASE_URL}. Check VITE_LUMA_API_BASE_URL and backend availability.`
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.details || payload?.error || `Request failed with ${response.status}`);
  }

  return payload;
}

function SignupStep({ form, onChange, onSubmit }) {
  return (
    <section className="flow-card">
      <div className="flow-eyebrow">Create account</div>
      <h2 className="flow-title">Start your Luma profile</h2>
      <p className="flow-copy">
        Sign up with your email so Luma can save your health context and tailor
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

        <button className="primary-button" type="submit">
          Continue to verification
        </button>
      </form>
    </section>
  );
}

function VerificationStep({ email, onVerify }) {
  return (
    <section className="flow-card">
      <div className="flow-eyebrow">Verification</div>
      <h2 className="flow-title">Verify your email</h2>
      <p className="flow-copy">
        A real verification email cannot be sent from this extension alone.
        Email delivery and secure token validation require hosted infrastructure
        or an auth provider.
      </p>

      <div className="verification-note">
        <strong>Prepared for:</strong> {email}
      </div>

      <p className="flow-copy flow-copy-small">
        For now, this demo step lets us keep building the rest of the onboarding
        flow and store the verified state locally.
      </p>

      <button className="primary-button" type="button" onClick={onVerify}>
        Mark email as verified for local demo
      </button>
    </section>
  );
}

function SurveyStep({ form, onChange, onSubmit }) {
  return (
    <section className="flow-card">
      <div className="flow-eyebrow">Intro survey</div>
      <h2 className="flow-title">Tell Luma a bit about you</h2>
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
  onAnalyze,
  isAnalyzing,
  analysis,
  analysisError,
  followUpQuestion,
  onFollowUpChange,
  onFollowUpSubmit,
  isSubmittingFollowUp,
  followUpResponses,
  articleSessionId,
  analysisStatus
}) {
  const statusLabel = analysisStatus || "pending";

  const pageTitle = pageContext?.title || "—";
  const articleSnippet = truncateText(pageContext?.abstractText || pageContext?.rawText, 180);
  const tags = analysis?.tags?.length
    ? analysis.tags.map((tag) => tag.value || tag.label)
    : fallbackTags;

  return (
    <>
      <header className="panel-header">
        <div className="brand-row">
          <div className="brand">Luma</div>
          <div className="header-controls">
            <button
              className={`toggle ${isEnabled ? "is-on" : ""}`}
              type="button"
              aria-pressed={isEnabled}
              onClick={onToggle}
            >
              <span className="toggle-thumb"></span>
            </button>
          </div>
        </div>

        <div className="status">
          <span>
            {isEnabled
              ? `Article status: ${statusLabel}`
              : "Luma is paused"}
          </span>
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
        <div className="page-context">
          <div className="context-label">Current page</div>
          <div className="context-title">{pageTitle}</div>
          <div className="context-url">{pageContext?.url || "—"}</div>
        </div>

        <div className="page-context">
          <div className="context-label">Extracted article snapshot</div>
          <div className="context-title">{articleSnippet}</div>
          <div className="context-url">
            {pageContext?.journal || "Journal unknown"}{" "}
            {pageContext?.publishedAtLabel ? `· ${pageContext.publishedAtLabel}` : ""}
          </div>
          <div className="context-url">
            {pageContext?.authors?.length ? truncateText(pageContext.authors.join(", "), 120) : "Authors unavailable"}
          </div>
          <button
            className="primary-button analyze-button"
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing || !pageContext}
          >
            {isAnalyzing ? "Analyzing with Gemma..." : "Analyze this article"}
          </button>
          {analysisError ? <p className="analysis-error">{analysisError}</p> : null}
        </div>

        <div className="profile-summary">
          <div className="context-label">Saved profile</div>
          <div className="summary-grid">
            <div>
              <span className="summary-key">Email</span>
              <span className="summary-value">{profile.email}</span>
            </div>
            <div>
              <span className="summary-key">Age range</span>
              <span className="summary-value">{profile.ageRange || "Not set"}</span>
            </div>
            <div>
              <span className="summary-key">Sex at birth</span>
              <span className="summary-value">
                {profile.sexAssignedAtBirth || "Not set"}
              </span>
            </div>
          </div>
        </div>

        {analysis ? (
          <article className="insight-card">
            <div className="context-label">
              Gemma analysis {articleSessionId ? `· ${articleSessionId.slice(0, 8)}` : ""}
            </div>
            <p className="insight-copy">{analysis.summary}</p>

            <div className="tag-row">
              {tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>

            <div className="analysis-section">
              <h3>Notes for this user</h3>
              <ul>
                {(analysis.user_specific_notes || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="analysis-section">
              <h3>Direct citations</h3>
              <ul>
                {(analysis.citations || []).map((item) => (
                  <li key={`${item.label}-${item.quote}`}>
                    <strong>{item.label}:</strong> {item.quote}
                  </li>
                ))}
              </ul>
            </div>

            <div className="analysis-section">
              <h3>Follow-up questions</h3>
              <ul>
                {(analysis.follow_up_suggestions || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="analysis-section">
              <h3>Warnings</h3>
              <ul>
                {(analysis.warnings || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        ) : (
          <article className="insight-card">
            <div className="relevance-pill">Awaiting analysis</div>
            <p className="insight-copy">
              Luma has the article snapshot and your profile. Run Gemma analysis
              to generate citations, tags, and user-specific notes.
            </p>
            <div className="tag-row">
              {fallbackTags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </article>
        )}

        {followUpResponses.length ? (
          <article className="insight-card">
            <div className="context-label">Follow-up responses</div>
            {followUpResponses.map((item) => (
              <div className="analysis-section" key={item.id}>
                <h3>{item.question}</h3>
                <p className="insight-copy">{item.answer}</p>
              </div>
            ))}
          </article>
        ) : null}
      </main>

      <footer className="panel-footer">
        <div className="footer-label">Ask Luma</div>
        <form className="ask-form" onSubmit={onFollowUpSubmit}>
          <label className="sr-only" htmlFor="follow-up">
            Ask a follow-up question
          </label>
          <input
            id="follow-up"
            type="text"
            placeholder="Ask a follow-up question..."
            value={followUpQuestion}
            onChange={onFollowUpChange}
            disabled={!articleSessionId || isSubmittingFollowUp}
          />
          <button
            type="submit"
            aria-label="Send question"
            disabled={!articleSessionId || isSubmittingFollowUp || !followUpQuestion.trim()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.7 3.3 3.9 10.5c-.8.3-.8 1.5 0 1.8l6.4 2.3 2.3 6.4c.3.8 1.5.8 1.8 0L21.6 4.2c.3-.7-.3-1.3-.9-.9Z" />
            </svg>
          </button>
        </form>
        <p className="footer-copy">
          {articleSessionId
            ? "Ask article-specific questions after Gemma finishes its first pass."
            : "Analyze an article first to unlock follow-up questions."}
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
  const [articleSessionId, setArticleSessionId] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState("pending");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpResponses, setFollowUpResponses] = useState([]);
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
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
        "lumaProfile"
      ]);

      if (!isMounted) {
        return;
      }

      if (typeof result.lumaEnabled === "boolean") {
        setIsEnabled(result.lumaEnabled);
      }

      if (result.lumaLastPage?.rawText) {
        setPageContext(result.lumaLastPage);
      }

      if (result.lumaAuth) {
        setAuth(result.lumaAuth);
      }

      if (result.lumaProfile) {
        const hydratedProfile = { ...initialProfile, ...result.lumaProfile };
        setProfile(hydratedProfile);
        setUserProfile(hydratedProfile);
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
        setPageContext((current) => {
          if (current?.normalizedUrl !== message.payload.normalizedUrl) {
            setArticleSessionId("");
            setAnalysis(null);
            setAnalysisStatus("pending");
            setFollowUpResponses([]);
          }

          return message.payload;
        });
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

  const handleSignup = async (event) => {
    event.preventDefault();
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
  };

  const handleVerify = async () => {
    const nextAuth = {
      ...auth,
      emailVerified: true
    };

    setAuth(nextAuth);
    await storageSet({ lumaAuth: nextAuth });
  };

  const handleSurveySubmit = async (event) => {
    event.preventDefault();

    const nextAuth = {
      ...auth,
      surveyCompleted: true
    };

    setAuth(nextAuth);
    await storageSet({
      lumaAuth: nextAuth,
      lumaProfile: profile
    });
    setUserProfile(profile);
  };

  const handleAnalyze = async () => {
    if (!pageContext || !userProfile) {
      setAnalysisError("Page context and user profile are required before analysis.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisStatus("pending");

    try {
      const sessionPayload = await apiFetch("/articles/session", {
        method: "POST",
        body: JSON.stringify({
          ...pageContext,
          userProfile
        })
      });

      const nextArticleSessionId = sessionPayload.articleSession.id;
      setArticleSessionId(nextArticleSessionId);
      setAnalysisStatus(sessionPayload.articleSession.status || "pending");
      setAnalysisStatus("analyzing");

      const analysisPayload = await apiFetch("/analysis/run", {
        method: "POST",
        body: JSON.stringify({
          articleSessionId: nextArticleSessionId,
          userProfile
        })
      });

      setAnalysis(analysisPayload.analysis);
      setAnalysisStatus(analysisPayload.status || "complete");
      setFollowUpResponses([]);
    } catch (error) {
      setAnalysisError(error.message || "Could not analyze this article right now.");
      setAnalysis(null);
      setAnalysisStatus("failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFollowUpSubmit = async (event) => {
    event.preventDefault();

    if (!articleSessionId || !followUpQuestion.trim()) {
      return;
    }

    setIsSubmittingFollowUp(true);
    setAnalysisError("");

    try {
      const payload = await apiFetch(`/analysis/${articleSessionId}/follow-up`, {
        method: "POST",
        body: JSON.stringify({
          question: followUpQuestion.trim(),
          userProfile
        })
      });

      setFollowUpResponses((current) => [...current, payload]);
      setFollowUpQuestion("");
    } catch (error) {
      setAnalysisError(error.message || "Could not answer the follow-up question.");
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const onboardingComplete = Boolean(userProfile);

  return (
    <div className="panel-shell">
      {onboardingComplete ? (
        <ReadyState
          isEnabled={isEnabled}
          onToggle={handleToggle}
          pageContext={pageContext}
          profile={profile}
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          analysis={analysis}
          analysisError={analysisError}
          followUpQuestion={followUpQuestion}
          onFollowUpChange={(event) => setFollowUpQuestion(event.target.value)}
          onFollowUpSubmit={handleFollowUpSubmit}
          isSubmittingFollowUp={isSubmittingFollowUp}
          followUpResponses={followUpResponses}
          articleSessionId={articleSessionId}
          analysisStatus={analysisStatus}
        />
      ) : (
        <main className="panel-auth">
          <div className="auth-header">
            <div className="brand">Luma</div>
            <p className="auth-subtitle">
              Personalized health context starts with a verified account and a
              lightweight intro survey.
            </p>
          </div>

          {!auth.hasAccount ? (
            <SignupStep
              form={profile}
              onChange={handleFieldChange}
              onSubmit={handleSignup}
            />
          ) : null}

          {auth.hasAccount && !auth.emailVerified ? (
            <VerificationStep email={profile.email} onVerify={handleVerify} />
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
