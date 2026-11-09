const HostJumperPathPickerClient = (() => {
  const MESSAGES = Object.freeze({
    GET_STATE: "pathpicker.getState",
    OPEN: "pathpicker.open",
    RECORD_USAGE: "pathpicker.recordUsage",
    OPEN_OPTIONS: "pathpicker.openOptions",
    TOGGLE: "pathpicker.toggle"
  });

  function create(runtime) {
    return {
      getState() {
        return runtime.sendMessage({ type: MESSAGES.GET_STATE });
      },

      open(url, newTab = false, pathId) {
        return runtime.sendMessage({ type: MESSAGES.OPEN, url, newTab, pathId });
      },

      recordUsage(id) {
        return runtime.sendMessage({ type: MESSAGES.RECORD_USAGE, id });
      },

      openOptions() {
        return runtime.sendMessage({ type: MESSAGES.OPEN_OPTIONS });
      }
    };
  }

  return {
    MESSAGES,
    create
  };
})();
