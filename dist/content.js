(() => {
  if (window.__lumaContentBooted) {
    return;
  }

  window.__lumaContentBooted = true;

  let lastPayloadFingerprint = "";
  let sendTimeoutId = null;

  function extractPageText() {
    const article = document.querySelector("article");
    if (article?.innerText?.trim()) {
      return article.innerText.trim();
    }

    return (document.body?.innerText || "").trim();
  }

  function buildPageContextPayload() {
    return {
      url: window.location.href,
      title: document.title || "",
      text: extractPageText()
    };
  }

  function persistAndBroadcastContext() {
    const payload = buildPageContextPayload();
    const fingerprint = `${payload.url}|${payload.title}|${payload.text.slice(0, 300)}`;

    if (fingerprint === lastPayloadFingerprint) {
      return;
    }

    lastPayloadFingerprint = fingerprint;

    chrome.storage.local.set({ lumaLastPage: payload }).catch(() => {
      // Ignore storage failures on restricted pages.
    });

    chrome.runtime.sendMessage({ type: "PAGE_CONTEXT", payload }).catch(() => {
      // Ignore send failures when runtime is unavailable.
    });
  }

  function scheduleContextRefresh(delayMs = 150) {
    if (sendTimeoutId) {
      window.clearTimeout(sendTimeoutId);
    }

    sendTimeoutId = window.setTimeout(() => {
      persistAndBroadcastContext();
      sendTimeoutId = null;
    }, delayMs);
  }

  function installNavigationHooks() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function pushStateWithContext(...args) {
      const result = originalPushState.apply(this, args);
      scheduleContextRefresh();
      return result;
    };

    history.replaceState = function replaceStateWithContext(...args) {
      const result = originalReplaceState.apply(this, args);
      scheduleContextRefresh();
      return result;
    };

    window.addEventListener("popstate", () => scheduleContextRefresh());
    window.addEventListener("hashchange", () => scheduleContextRefresh());
  }

  const contentObserver = new MutationObserver(() => {
    scheduleContextRefresh(300);
  });

  contentObserver.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  installNavigationHooks();
  scheduleContextRefresh(0);
})();
