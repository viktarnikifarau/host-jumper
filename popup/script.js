document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("root");
  const state = await browser.runtime.sendMessage({ type: "GET_PICKER_STATE" });

  HostJumperPicker.mount(root, {
    items: state.items || [],
    canNavigate: state.canNavigate,
    embedded: true,
    onSelect(item) {
      browser.runtime.sendMessage({ type: "NAVIGATE", url: item.url });
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
