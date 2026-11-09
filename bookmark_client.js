const HostJumperBookmarkClient = (() => {
  const MESSAGES = Object.freeze({
    SEARCH: "bookmarks.search",
    OPEN: "bookmarks.open"
  });

  function create(runtime) {
    return {
      async search(query) {
        const results = await runtime.sendMessage({ type: MESSAGES.SEARCH, query });
        return (Array.isArray(results) ? results : []).map((result) => ({
          ...result,
          label: result.title || result.url
        }));
      },

      open(url, newTab = false) {
        return runtime.sendMessage({ type: MESSAGES.OPEN, url, newTab });
      }
    };
  }

  return {
    MESSAGES,
    create
  };
})();
