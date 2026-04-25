(() => {
  if (window.__lumaContentBooted) {
    return;
  }

  window.__lumaContentBooted = true;

  const MAX_TEXT_LENGTH = 20000;
  const MAX_HEADINGS = 20;
  const MAX_SECTION_LABELS = 30;
  const MAX_AUTHORS = 12;
  const NOISE_SELECTORS = [
    "script",
    "style",
    "noscript",
    "nav",
    "header",
    "footer",
    "aside",
    "form",
    "button",
    "[role='navigation']",
    "[aria-hidden='true']",
    ".sidebar",
    ".related",
    ".advertisement",
    ".ad",
    ".promo",
    ".newsletter",
    ".cookie",
    ".share",
    ".social"
  ];
  const ABSTRACT_SELECTORS = [
    "[data-test='abstract']",
    ".abstract",
    "#abstract",
    "[class*='abstract']",
    "section[aria-labelledby*='abstract']",
    "section[id*='abstract']"
  ];
  const STRUCTURED_BODY_SELECTORS = [
    "article [itemprop='articleBody']",
    "[itemprop='articleBody']",
    "article .article-content",
    "article .article-body",
    "article .content-body",
    "article .main-content",
    "[data-test='article-body']",
    "[data-testid='article-body']",
    ".article__body",
    ".c-article-body"
  ];
  const MAIN_SELECTORS = ["article", "main", "[role='main']", ".article", ".content"];
  const SECTION_LABEL_SELECTORS = [
    "section[id]",
    "section[aria-label]",
    "[data-section-title]",
    "[data-test-section]",
    "h2",
    "h3"
  ];

  let lastPayloadFingerprint = "";
  let sendTimeoutId = null;

  function metaContent(selector) {
    return document.querySelector(selector)?.getAttribute("content")?.trim() || "";
  }

  function boundedText(text, maxLength = MAX_TEXT_LENGTH) {
    const normalized = (text || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return normalized.slice(0, maxLength).trim();
  }

  function uniqueList(items, maxItems = 50) {
    const seen = new Set();
    const output = [];

    for (const rawItem of items || []) {
      const item = `${rawItem || ""}`.trim();
      if (!item) {
        continue;
      }

      const key = item.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      output.push(item);

      if (output.length >= maxItems) {
        break;
      }
    }

    return output;
  }

  function normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      const blockedParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"];

      blockedParams.forEach((key) => {
        parsed.searchParams.delete(key);
      });

      return parsed.toString();
    } catch {
      return url;
    }
  }

  function getLikelyRoot() {
    for (const selector of STRUCTURED_BODY_SELECTORS) {
      const candidate = document.querySelector(selector);
      if (candidate?.innerText?.trim()) {
        return candidate;
      }
    }

    for (const selector of MAIN_SELECTORS) {
      const candidate = document.querySelector(selector);
      if (candidate?.innerText?.trim()) {
        return candidate;
      }
    }

    return document.body;
  }

  function cloneWithoutNoise(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll(NOISE_SELECTORS.join(",")).forEach((element) => {
      element.remove();
    });

    return clone;
  }

  function extractVisibleArticleBody(root) {
    if (!root) {
      return "";
    }

    const cleanedRoot = cloneWithoutNoise(root);
    const structuredCandidates = STRUCTURED_BODY_SELECTORS
      .map((selector) => cleanedRoot.querySelector(selector))
      .filter((node) => node?.innerText?.trim())
      .map((node) => node.innerText.trim());

    if (structuredCandidates.length > 0) {
      const longestCandidate = structuredCandidates.reduce((best, current) =>
        current.length > best.length ? current : best
      );
      return boundedText(longestCandidate);
    }

    return boundedText(cleanedRoot.innerText || "");
  }

  function extractAbstract(root) {
    for (const selector of ABSTRACT_SELECTORS) {
      const element = root?.querySelector(selector) || document.querySelector(selector);
      if (element?.innerText?.trim()) {
        return boundedText(element.innerText, 3000);
      }
    }

    return metaContent("meta[name='description']") || metaContent("meta[property='og:description']");
  }

  function extractAuthors() {
    const metaAuthors = Array.from(document.querySelectorAll("meta[name='citation_author']"))
      .map((node) => node.getAttribute("content")?.trim())
      .filter(Boolean);

    if (metaAuthors.length > 0) {
      return metaAuthors;
    }

    const authorText = metaContent("meta[name='author']");
    if (!authorText) {
      return [];
    }

    return authorText
      .split(/,|;|\band\b/gi)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_AUTHORS);
  }

  function extractHeadings(root) {
    const values = Array.from(root?.querySelectorAll("h1, h2, h3") || []).map((node) =>
      node.textContent?.trim()
    );
    return uniqueList(values, MAX_HEADINGS);
  }

  function extractSectionLabels(root) {
    const values = Array.from(root?.querySelectorAll(SECTION_LABEL_SELECTORS.join(",")) || []).map((node) => {
      const ariaLabel = node.getAttribute?.("aria-label");
      const dataSection = node.getAttribute?.("data-section-title");
      const sectionId = node.getAttribute?.("id");
      return (
        ariaLabel ||
        dataSection ||
        node.textContent?.trim() ||
        (sectionId ? sectionId.replace(/[-_]+/g, " ").trim() : "")
      );
    });

    return uniqueList(values, MAX_SECTION_LABELS);
  }

  function inferPageType() {
    return (
      metaContent("meta[property='og:type']") ||
      (document.querySelector("article") ? "article" : "webpage")
    );
  }

  function buildPageContextPayload() {
    const root = getLikelyRoot();
    const rawText = extractVisibleArticleBody(root);
    const headings = extractHeadings(root);
    const sectionLabels = extractSectionLabels(root);
    const authors = uniqueList(extractAuthors(), MAX_AUTHORS);
    const abstractText = extractAbstract(root) || "";
    const payload = {
      url: window.location.href,
      normalizedUrl: normalizeUrl(window.location.href),
      title:
        metaContent("meta[name='citation_title']") ||
        metaContent("meta[property='og:title']") ||
        document.title ||
        "",
      sourceHost: window.location.hostname,
      pageType: inferPageType(),
      rawText,
      abstractText,
      authors,
      journal:
        metaContent("meta[name='citation_journal_title']") ||
        metaContent("meta[property='og:site_name']") ||
        "",
      publishedAtLabel:
        metaContent("meta[name='citation_publication_date']") ||
        metaContent("meta[name='dc.Date']") ||
        metaContent("meta[property='article:published_time']") ||
        "",
      pmid: metaContent("meta[name='citation_pmid']") || "",
      doi: metaContent("meta[name='citation_doi']") || "",
      headings,
      sectionLabels,
      extractionPayload: {
        extractedAt: new Date().toISOString(),
        bodyLength: rawText.length,
        usedRootSelector: root?.tagName || "BODY",
        structuredBodySelectors: STRUCTURED_BODY_SELECTORS,
        sectionLabelSelectors: SECTION_LABEL_SELECTORS,
        abstractLength: abstractText.length,
        headingCount: headings.length,
        sectionLabelCount: sectionLabels.length
      }
    };

    return payload;
  }

  function persistAndBroadcastContext() {
    const payload = buildPageContextPayload();
    const fingerprint = [
      payload.normalizedUrl,
      payload.title,
      payload.rawText.slice(0, 300),
      payload.abstractText.slice(0, 120)
    ].join("|");

    if (!payload.rawText || fingerprint === lastPayloadFingerprint) {
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
