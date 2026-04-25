import { useEffect, useState } from "react";

const languageModes = [
  { id: "plain", label: "Plain language" },
  { id: "clinical", label: "Clinical language" },
  { id: "doctorPrep", label: "Doctor prep" }
];
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

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function extractDemographicChips(analysis, profile) {
  const sourceText = [
    analysis?.summary || "",
    ...ensureArray(analysis?.womenSections),
    ...ensureArray(analysis?.biasNotes)
  ]
    .join(" ")
    .toLowerCase();

  const chips = [];

  const ageRangeMatch = sourceText.match(/(\d{1,2})\s*[-to]{1,3}\s*(\d{1,2})/);
  if (ageRangeMatch) {
    chips.push(`Ages ${ageRangeMatch[1]}-${ageRangeMatch[2]}`);
  } else if (profile?.ageRange) {
    chips.push(`User age range: ${profile.ageRange}`);
  }

  if (/\bpcos\b/.test(sourceText)) chips.push("PCOS focus");
  if (/\bpregnan|postpartum|menopause|menopausal\b/.test(sourceText)) {
    chips.push("Hormonal/life-stage focus");
  }
  if (/\bwomen|female|sex differences?\b/.test(sourceText)) {
    chips.push("Women-specific evidence");
  } else {
    chips.push("General population study");
  }

  const sampleMatch = sourceText.match(/\bn\s*=\s*(\d{2,6})\b/);
  if (sampleMatch) chips.push(`Sample size: ${sampleMatch[1]}`);

  return chips.slice(0, 5);
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

function ProfileModal({ form, onChange, onSave, onClose }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit profile">
      <div className="modal-card">
        <div className="modal-header">
          <h2>Your profile</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close profile modal">
            ×
          </button>
        </div>

        <form className="flow-form modal-form" onSubmit={onSave}>
          <label className="field">
            <span>Full name</span>
            <input name="fullName" type="text" value={form.fullName} onChange={onChange} />
          </label>

          <label className="field">
            <span>Email</span>
            <input name="email" type="email" value={form.email} onChange={onChange} />
          </label>

          <label className="field">
            <span>Age range</span>
            <select name="ageRange" value={form.ageRange} onChange={onChange}>
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
            <span>Sex assigned at birth</span>
            <select name="sexAssignedAtBirth" value={form.sexAssignedAtBirth} onChange={onChange}>
              <option value="">Select option</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Intersex">Intersex</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </label>

          <label className="field">
            <span>Gender</span>
            <input name="gender" type="text" value={form.gender} onChange={onChange} />
          </label>

          <label className="field">
            <span>Relevant conditions</span>
            <textarea name="conditions" value={form.conditions} onChange={onChange} rows="3" />
          </label>

          <label className="field">
            <span>Current medications or supplements</span>
            <textarea name="medications" value={form.medications} onChange={onChange} rows="3" />
          </label>

          <label className="field">
            <span>Main goals</span>
            <textarea name="goals" value={form.goals} onChange={onChange} rows="3" />
          </label>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              Save profile
            </button>
          </div>
        </form>
      </div>
    </div>
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
  languageMode,
  onLanguageModeChange,
  onOpenProfile
}) {
  const pageTitle = pageContext?.title || "—";
  const articleSnippet = truncateText(pageContext?.text, 140);

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
            <button
              className="profile-button"
              type="button"
              aria-label="Edit profile"
              onClick={onOpenProfile}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 12.4a5.2 5.2 0 1 0 0-10.4 5.2 5.2 0 0 0 0 10.4Zm0 2.2c-5.1 0-9.2 3-9.2 6.7 0 .4.3.7.7.7h17c.4 0 .7-.3.7-.7 0-3.7-4.1-6.7-9.2-6.7Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="status">
          <span>{isEnabled ? "Analyzing page for you" : "Luma is paused"}</span>
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
          <div className="context-label">Current article</div>
          <div className="context-title">{articleSnippet}</div>
          <div className="context-url">
            {pageContext ? "Ready to analyze." : "Waiting for page context..."}
          </div>
          <div className="context-label mode-label">Accessibility mode</div>
          <div className="mode-toggle-row">
            {languageModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`mode-chip ${languageMode === mode.id ? "is-active" : ""}`}
                onClick={() => onLanguageModeChange(mode.id)}
                aria-pressed={languageMode === mode.id}
              >
                {mode.label}
              </button>
            ))}
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

        {analysis ? (
          <article className="insight-card">
            <div className="context-label">Target demographic</div>
            <div className="analysis-chip-grid">
              {extractDemographicChips(analysis, profile).map((chip, index) => (
                <p className="analysis-chip analysis-chip-strong" key={`demographic-${index}-${chip}`}>
                  {chip}
                </p>
              ))}
            </div>

            <div className="analysis-section">
              <h3>
                <strong>Quick summary</strong>
              </h3>
              <p className="analysis-summary">{analysis.summary}</p>
            </div>

            <div className="analysis-section">
              <h3>
                <strong>What this means for women</strong>
              </h3>
              <div className="analysis-chip-grid">
                {ensureArray(analysis.womenSections).length > 0 ? (
                  ensureArray(analysis.womenSections).map((item, index) => (
                    <p className="analysis-chip" key={`women-${index}-${item}`}>
                      {item}
                    </p>
                  ))
                ) : (
                  <p className="analysis-empty">
                    No women-specific takeaways were detected yet.
                  </p>
                )}
              </div>
            </div>

            <div className="analysis-section">
              <h3>
                <strong>Bias notes</strong>
              </h3>
              <div className="analysis-chip-grid">
                {ensureArray(analysis.biasNotes).length > 0 ? (
                  ensureArray(analysis.biasNotes).map((item, index) => (
                    <p className="analysis-chip analysis-chip-warn" key={`bias-${index}-${item}`}>
                      {item}
                    </p>
                  ))
                ) : (
                  <p className="analysis-empty">
                    No clear bias signal found in this article summary.
                  </p>
                )}
              </div>
            </div>

            <div className="analysis-section">
              <h3>
                <strong>Follow-up questions</strong>
              </h3>
              <ul className="question-list">
                {ensureArray(analysis.followUpQuestions).length > 0 ? (
                  ensureArray(analysis.followUpQuestions).map((item, index) => (
                    <li key={`question-${index}-${item}`}>{item}</li>
                  ))
                ) : (
                  <li>
                    Ask your doctor: "How does this study apply to my health
                    profile?"
                  </li>
                )}
              </ul>
            </div>
          </article>
        ) : (
          <article className="insight-card">
            <div className="context-label">Analysis preview</div>
            <p className="analysis-empty">
              Run analysis to see target demographic chips and women-specific takeaways.
            </p>
          </article>
        )}
      </main>

      <footer className="panel-footer">
        <div className="footer-label">Ask Luma</div>
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
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [languageMode, setLanguageMode] = useState("plain");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [draftProfile, setDraftProfile] = useState(initialProfile);
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
        "userProfile",
        "lumaLanguageMode"
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

      const storedProfile = result.userProfile || result.lumaProfile;
      if (storedProfile) {
        const hydratedProfile = { ...initialProfile, ...storedProfile };
        setProfile(hydratedProfile);
        setUserProfile(hydratedProfile);
      }

      if (result.lumaLanguageMode && typeof result.lumaLanguageMode === "string") {
        setLanguageMode(result.lumaLanguageMode);
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

    try {
      const response = await fetch(
        "http://localhost:4000/summarize-article",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            articleText: pageContext.text.slice(0, 8000),
            url: pageContext.url,
            title: pageContext.title,
            userProfile,
            languageMode
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Backend request failed: ${response.status}`);
      }

      const payload = await response.json();
      setAnalysis(payload);
    } catch (error) {
      setAnalysisError(error.message || "Could not analyze this study right now.");
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLanguageModeChange = async (modeId) => {
    setLanguageMode(modeId);
    await storageSet({ lumaLanguageMode: modeId });
  };

  const handleOpenProfileModal = () => {
    setDraftProfile(profile);
    setIsProfileModalOpen(true);
  };

  const handleDraftProfileChange = (event) => {
    const { name, value } = event.target;
    setDraftProfile((current) => ({ ...current, [name]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setProfile(draftProfile);
    setUserProfile(draftProfile);
    await storageSet({
      lumaProfile: draftProfile,
      userProfile: draftProfile
    });
    try {
      await fetch("http://localhost:4000/profile/send-update-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: draftProfile.email,
          fullName: draftProfile.fullName
        })
      });
    } catch (error) {
      // Profile saving should not fail if email delivery is unavailable.
      console.warn("Profile saved but email notification failed.", error);
    }
    setIsProfileModalOpen(false);
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
          languageMode={languageMode}
          onLanguageModeChange={handleLanguageModeChange}
          onOpenProfile={handleOpenProfileModal}
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
      {onboardingComplete && isProfileModalOpen ? (
        <ProfileModal
          form={draftProfile}
          onChange={handleDraftProfileChange}
          onSave={handleSaveProfile}
          onClose={() => setIsProfileModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
