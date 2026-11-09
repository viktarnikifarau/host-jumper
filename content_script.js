(() => {
  if (window.__hostJumperInit) {
    return;
  }
  window.__hostJumperInit = true;

  let host = null;
  let picker = null;
  const pathPickerClient = HostJumperPathPickerClient.create(browser.runtime);

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type !== HostJumperPathPickerClient.MESSAGES.TOGGLE) {
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

  function closePicker() {
    picker?.close();
    picker = null;
    host?.remove();
    host = null;
  }
})();
