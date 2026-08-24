(() => {
  if (window.__fastPagesInit) {
    return;
  }
  window.__fastPagesInit = true;

  let host = null;
  let picker = null;

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== "TOGGLE_PICKER") {
      return;
    }

    if (host) {
      closePicker();
      return;
    }

    openPicker(message.items || []);
  });

  function openPicker(items) {
    host = document.createElement("div");
    host.setAttribute("data-fast-pages", "true");
    const shadow = host.attachShadow({ mode: "closed" });
    document.documentElement.append(host);

    picker = FastPagesPicker.mount(shadow, {
      items,
      onSelect(item) {
        closePicker();
        window.location.assign(item.url);
      },
      onClose: closePicker,
      onConfigure() {
        closePicker();
        browser.runtime.sendMessage({ type: "OPEN_OPTIONS" });
      }
    });
  }

  function closePicker() {
    picker?.close();
    picker = null;
    host?.remove();
    host = null;
  }
})();
