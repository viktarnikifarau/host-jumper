document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("root");
  const bookmarkMode = new URLSearchParams(window.location.search).get("mode") === "bookmarks";

  if (bookmarkMode) {
    mountBookmarkPicker(root);
    return;
  }

  const state = await browser.runtime.sendMessage({ type: "GET_PICKER_STATE" });
  HostJumperPicker.mount(root, {
    items: state.items || [],
    canNavigate: state.canNavigate,
    embedded: true,
    onSelect(item, { newTab } = {}) {
      browser.runtime.sendMessage({ type: "NAVIGATE", url: item.url, newTab, pathId: item.id });
    },
    onClose() {
      window.close();
    },
    onConfigure() {
      browser.runtime.sendMessage({ type: "OPEN_OPTIONS" });
      window.close();
    }
  });
});

function mountBookmarkPicker(root) {
  document.title = "Host Jumper — Bookmarks";
  HostJumperPicker.mount(root, {
    items: [],
    canNavigate: true,
    embedded: true,
    ariaLabel: "Bookmark search",
    searchPlaceholder: "Search bookmarks by folder, title, or URL",
    emptyMessage: "Type to search bookmark folders, titles, and URLs.",
    noResultsMessage: "No matching bookmarks.",
    searchErrorMessage: "Bookmark search is unavailable.",
    showConfigure: false,
    async onSearch(query) {
      const results = await browser.runtime.sendMessage({ type: "SEARCH_BOOKMARKS", query });
      return (results || []).map((result) => ({ ...result, label: result.title || result.url }));
    },
    onSelect(item, { newTab } = {}) {
      browser.runtime.sendMessage({ type: "NAVIGATE_BOOKMARK", url: item.url, newTab });
    },
    onClose() {
      window.close();
    }
  });
}
