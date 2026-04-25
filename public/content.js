(() => {
  if (window.__lumaContentBooted) {
    return;
  }

  window.__lumaContentBooted = true;

  const pageContext = {
    title: document.title,
    url: window.location.href
  };

  chrome.storage.local.set({ lumaLastPage: pageContext }).catch(() => {
    // Ignore storage failures on restricted pages.
  });
})();
