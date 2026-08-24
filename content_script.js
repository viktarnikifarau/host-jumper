(() => {
  if (window.__hostJumperInit) {
    return;
  }
  window.__hostJumperInit = true;

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
    host.setAttribute("data-host-jumper", "true");
    const shadow = host.attachShadow({ mode: "closed" });
    document.documentElement.append(host);

    picker = HostJumperPicker.mount(shadow, {
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
