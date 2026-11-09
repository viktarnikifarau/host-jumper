document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("root");
  const bookmarkMode = new URLSearchParams(window.location.search).get("mode") === "bookmarks";

  if (bookmarkMode) {
    mountBookmarkPicker(root, HostJumperBookmarkClient.create(browser.runtime));
    return;
  }

  const pathPickerClient = HostJumperPathPickerClient.create(browser.runtime);
  const state = await pathPickerClient.getState();
  mountPathPicker(root, pathPickerClient, state);
});

function mountPathPicker(root, pathPickerClient, state) {
  HostJumperPicker.mount(root, {
    variant: "pathpicker",
    items: state.items || [],
    canNavigate: state.canNavigate,
    embedded: true,
    onSelect(item, { newTab } = {}) {
      pathPickerClient.open(item.url, newTab, item.id);
    },
    onClose() {
      window.close();
    },
    onConfigure() {
      pathPickerClient.openOptions();
      window.close();
    }
  });
}

function mountBookmarkPicker(root, bookmarkClient) {
  document.title = "Host Jumper — Bookmarks";
  HostJumperPicker.mount(root, {
    variant: "bookmarks",
    embedded: true,
    dataSource: bookmarkClient,
    onSelect(item, { newTab } = {}) {
      bookmarkClient.open(item.url, newTab);
    },
    onClose() {
      window.close();
    }
  });
}
