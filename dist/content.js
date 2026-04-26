(() => {
  if (window.__lumaContentBooted) {
    return;
  }

  window.__lumaContentBooted = true;

  let lastPayloadFingerprint = "";
  let sendTimeoutId = null;

  function hasValidExtensionContext() {
    try {
      return typeof chrome !== "undefined" && Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

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
    if (!hasValidExtensionContext()) {
      return;
    }

    const payload = buildPageContextPayload();
    const fingerprint = `${payload.url}|${payload.title}|${payload.text.slice(0, 300)}`;

    if (fingerprint === lastPayloadFingerprint) {
      return;
    }

    lastPayloadFingerprint = fingerprint;

    const extensionApi = chrome;

    try {
      if (!extensionApi?.storage?.local) {
        return;
      }
      extensionApi.storage.local.set({ lumaLastPage: payload });
    } catch {
      // Ignore storage failures on restricted pages.
    }

    try {
      if (!extensionApi?.runtime?.sendMessage) {
        return;
      }

      extensionApi.runtime.sendMessage({
        type: "PAGE_CONTEXT",
        payload
      }, () => {
        try {
          void extensionApi.runtime.lastError;
        } catch {
          // Ignore invalidated contexts after extension reload.
        }
      });
    } catch {
      // Ignore send failures when runtime is unavailable.
    }
  }

  function scheduleContextRefresh(delayMs = 150) {
    if (sendTimeoutId) {
      window.clearTimeout(sendTimeoutId);
    }

    sendTimeoutId = window.setTimeout(() => {
      try {
        persistAndBroadcastContext();
      } finally {
        sendTimeoutId = null;
      }
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
