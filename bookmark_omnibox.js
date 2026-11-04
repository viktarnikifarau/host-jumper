const HostJumperBookmarkOmnibox = (() => {
  const DEFAULT_DEBOUNCE_MS = 150;

  function escapeDescription(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function toSuggestion(result) {
    return {
      content: result.url,
      description: escapeDescription(`${result.displayPath} — ${result.url}`)
    };
  }

  function createController({
    index,
    omnibox,
    tabs,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    limit = HostJumperBookmarkSearch.DEFAULT_LIMIT,
    setTimer = globalThis.setTimeout,
    clearTimer = globalThis.clearTimeout,
    reportError = (error) => console.error("Bookmark search failed:", error)
  }) {
    let timer = null;
    let revision = 0;
    let activeUrls = new Set();

    function cancelPending() {
      revision += 1;
      activeUrls.clear();
      if (timer != null) {
        clearTimer(timer);
        timer = null;
      }
    }

    function showHelp() {
      omnibox.setDefaultSuggestion({
        description: "Search bookmarks by folder, title, or URL"
      });
    }

    async function updateSuggestions(text, suggest, currentRevision) {
      try {
        const results = await index.search(text, { limit });
        if (currentRevision !== revision) {
          return;
        }
        activeUrls = new Set(results.map((result) => result.url));
        suggest(results.map(toSuggestion));
      } catch (error) {
        if (currentRevision === revision) {
          reportError(error);
          omnibox.setDefaultSuggestion({ description: "Bookmark search is unavailable" });
        }
      }
    }

    function onInputChanged(text, suggest) {
      cancelPending();
      const currentRevision = revision;
      if (!String(text || "").trim()) {
        showHelp();
        suggest([]);
        return;
      }

      timer = setTimer(() => {
        timer = null;
        return updateSuggestions(text, suggest, currentRevision);
      }, debounceMs);
    }

    async function onInputEntered(content, disposition = "currentTab") {
      if (!activeUrls.has(content)) {
        return;
      }

      if (disposition === "newForegroundTab") {
        await tabs.create({ url: content, active: true });
      } else if (disposition === "newBackgroundTab") {
        await tabs.create({ url: content, active: false });
      } else {
        await tabs.update({ url: content });
      }
    }

    function attach() {
      omnibox.onInputChanged.addListener(onInputChanged);
      omnibox.onInputEntered.addListener(onInputEntered);
      omnibox.onInputStarted?.addListener(showHelp);
      omnibox.onInputCancelled?.addListener(cancelPending);
      showHelp();
    }

    return {
      attach,
      onInputChanged,
      onInputEntered,
      onInputCancelled: cancelPending
    };
  }

  return {
    createController,
    escapeDescription,
    toSuggestion
  };
})();
