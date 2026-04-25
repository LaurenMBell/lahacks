import { useEffect, useState } from "react";

const tags = ["Study: women only", "Ages 18-40", "N=200"];

export function LumaSidePanel() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [page, setPage] = useState({
    title: "Current article",
    url: "Waiting for page context..."
  });

  useEffect(() => {
    chrome.storage.local.get(["lumaEnabled", "lumaLastPage"], (result) => {
      if (typeof result.lumaEnabled === "boolean") {
        setIsEnabled(result.lumaEnabled);
      }

      if (result.lumaLastPage) {
        setPage(result.lumaLastPage);
      }
    });
  }, []);

  const handleToggle = () => {
    const nextValue = !isEnabled;
    setIsEnabled(nextValue);
    chrome.storage.local.set({ lumaEnabled: nextValue });
  };

  return (
    <div className="panel-shell">
      <header className="panel-header">
        <div className="brand-row">
          <div className="brand">Luma</div>
          <div className="header-controls">
            <button
              className={`toggle ${isEnabled ? "is-on" : ""}`}
              type="button"
              aria-pressed={isEnabled}
              onClick={handleToggle}
            >
              <span className="toggle-thumb"></span>
            </button>
            <button
              className="collapse-button"
              type="button"
              aria-label="Collapse panel"
            >
              <span></span>
              <span></span>
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
          <div className="context-title">{page.title || "Current article"}</div>
          <div className="context-url">{page.url}</div>
        </div>

        <article className="insight-card">
          <div className="relevance-pill">High relevance · PCOS</div>
          <p className="insight-copy">
            This study focuses on insulin resistance in women with PCOS ages
            18-35 directly relevant to your profile.
          </p>
          <div className="tag-row">
            {tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </article>
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
    </div>
  );
}
