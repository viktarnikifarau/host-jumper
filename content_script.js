(() => {
  if (window.__hostJumperInit) {
    return;
  }
  window.__hostJumperInit = true;

  let host = null;
  let picker = null;
  const pathPickerClient = HostJumperPathPickerClient.create(browser.runtime);
  const bookmarkClient = HostJumperBookmarkClient.create(browser.runtime);

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === HostJumperPathPickerClient.MESSAGES.TOGGLE) {
      toggle(() => openPathPicker(message.items || []));
      return;
    }

    if (message?.type === HostJumperBookmarkClient.MESSAGES.TOGGLE) {
      toggle(openBookmarkPicker);
    }
  });

  function toggle(open) {
    if (host) {
      closePicker();
      return;
    }
    open();
  }

  function createHost() {
    const element = document.createElement("div");
    element.setAttribute("data-host-jumper", "true");
    const shadow = element.attachShadow({ mode: "closed" });
    document.documentElement.append(element);
    return { element, shadow };
  }

  function openPathPicker(items) {
    host = createHost();
    picker = HostJumperPicker.mount(host.shadow, {
      variant: "pathpicker",
      items,
      onSelect(item, { newTab } = {}) {
        closePicker();
        if (newTab) {
          pathPickerClient.open(item.url, true, item.id);
          return;
        }
        pathPickerClient.recordUsage(item.id);
        window.location.assign(item.url);
      },
      onClose: closePicker,
      onConfigure() {
        closePicker();
        pathPickerClient.openOptions();
      }
    });
  }

  function openBookmarkPicker() {
    host = createHost();
    picker = HostJumperPicker.mount(host.shadow, {
      variant: "bookmarks",
      dataSource: bookmarkClient,
      onSelect(item, { newTab } = {}) {
        closePicker();
        bookmarkClient.open(item.url, newTab);
      },
      onClose: closePicker
    });
  }

  function closePicker() {
    picker?.close();
    picker = null;
    host?.element.remove();
    host = null;
  }
})();
