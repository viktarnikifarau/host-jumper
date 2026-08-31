const HostJumperPicker = (() => {
  const STYLE = `
    :host, .hd-root {
      all: initial;
      display: block;
      width: 100%;
      height: 100%;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #f5f5f7;
    }

    * {
      box-sizing: border-box;
    }

    .hd-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(9, 10, 15, 0.52);
    }

    .hd-dialog {
      width: min(480px, 100%);
      max-height: min(420px, 100%);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #1c1d24;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }

    .hd-root.is-embedded,
    .hd-root.is-embedded .hd-overlay {
      position: static;
      inset: auto;
      width: 100%;
      height: 100%;
      padding: 0;
      background: #1c1d24;
    }

    .hd-root.is-embedded .hd-dialog {
      width: 100%;
      max-height: none;
      height: 100%;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }

    .hd-search {
      width: 100%;
      padding: 16px 18px 14px;
      border: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: transparent;
      color: #f5f5f7;
      font: inherit;
      font-size: 16px;
      outline: none;
    }

    .hd-search::placeholder {
      color: #8b8d97;
    }

    .hd-body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .hd-list {
      flex: 1;
      margin: 0;
      padding: 8px;
      overflow: auto;
      list-style: none;
    }

    .hd-item {
      display: block;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      padding: 10px 12px;
      overflow: hidden;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .hd-item[aria-selected="true"] {
      background: #2e5bff;
    }

    .hd-item-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
      min-width: 0;
    }

    .hd-item-label,
    .hd-item-url {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .hd-item-label {
      flex: 1;
      min-width: 0;
      font-size: 14px;
      font-weight: 650;
    }

    .hd-item-uses {
      flex: 0 0 auto;
      color: #8b8d97;
      font-size: 11px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .hd-item[aria-selected="true"] .hd-item-uses {
      color: rgba(255, 255, 255, 0.78);
    }

    .hd-item-url {
      margin-top: 2px;
      color: #b9bbc6;
      font-size: 12px;
    }

    .hd-item[aria-selected="true"] .hd-item-url {
      color: rgba(255, 255, 255, 0.86);
    }

    .hd-item.is-missing .hd-item-url {
      color: #ffb4a2;
    }

    .hd-empty, .hd-error {
      padding: 28px 18px;
      color: #b9bbc6;
      font-size: 14px;
      line-height: 1.45;
      text-align: center;
    }

    .hd-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      color: #8b8d97;
      font-size: 11px;
    }

    .hd-link {
      padding: 0;
      border: 0;
      background: none;
      color: #9db4ff;
      font: inherit;
      cursor: pointer;
    }
  `;

  function mount(root, options) {
    const items = options.items || [];
    const embedded = Boolean(options.embedded);
    let filtered = items.slice();
    let selectedIndex = 0;

    const wrap = document.createElement("div");
    wrap.className = embedded ? "hd-root is-embedded" : "hd-root";

    const style = document.createElement("style");
    style.textContent = STYLE;

    const overlay = document.createElement("div");
    overlay.className = "hd-overlay";

    const dialog = document.createElement("div");
    dialog.className = "hd-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Host Jumper");

    const search = document.createElement("input");
    search.className = "hd-search";
    search.type = "search";
    search.placeholder = "Search paths";
    search.autocomplete = "off";
    search.spellcheck = false;

    const body = document.createElement("div");
    body.className = "hd-body";

    const footer = document.createElement("div");
    footer.className = "hd-footer";

    const hint = document.createElement("span");
    hint.textContent = isMacPlatform()
      ? "Enter same tab · ⌘Enter new tab · Esc"
      : "Enter same tab · Ctrl+Enter new tab · Esc";

    const configure = document.createElement("button");
    configure.className = "hd-link";
    configure.type = "button";
    configure.textContent = "Configure paths";

    footer.append(hint, configure);
    dialog.append(search, body, footer);
    overlay.append(dialog);
    wrap.append(overlay);
    root.replaceChildren(style, wrap);

    function close() {
      teardown();
      options.onClose?.();
    }

    function teardown() {
      window.removeEventListener("keydown", onKeyDown, true);
      root.replaceChildren();
    }

    function selectCurrent(event) {
      const item = filtered[selectedIndex];
      if (!item) {
        return;
      }
      options.onSelect?.(item, { newTab: Boolean(event && isNewTabModifier(event)) });
    }

    function clampSelection() {
      if (!filtered.length) {
        selectedIndex = 0;
        return;
      }
      selectedIndex = (selectedIndex + filtered.length) % filtered.length;
    }

    function updateSelection() {
      const buttons = body.querySelectorAll(".hd-item");
      buttons.forEach((button, index) => {
        button.setAttribute("aria-selected", String(index === selectedIndex));
      });
      buttons[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }

    function render() {
      if (!options.canNavigate && options.embedded) {
        body.replaceChildren(statusMessage("hd-error", "Open a regular web page first, then use Host Jumper."));
        return;
      }

      if (!items.length) {
        body.replaceChildren(statusMessage("hd-empty", "No paths configured yet. Add a few in the options page."));
        return;
      }

      if (!filtered.length) {
        body.replaceChildren(statusMessage("hd-empty", "No matching paths."));
        return;
      }

      clampSelection();
      const list = document.createElement("div");
      list.className = "hd-list";
      list.setAttribute("role", "listbox");

      filtered.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = item.missing?.length ? "hd-item is-missing" : "hd-item";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(index === selectedIndex));

        const urlText = item.missing?.length
          ? `${item.url}  ·  missing {${item.missing.join(", ")}}`
          : item.url;

        const headEl = document.createElement("span");
        headEl.className = "hd-item-head";

        const labelEl = document.createElement("span");
        labelEl.className = "hd-item-label";
        labelEl.textContent = item.label;
        headEl.append(labelEl);

        const uses = Number(item.uses) || 0;
        if (uses > 0) {
          const usesEl = document.createElement("span");
          usesEl.className = "hd-item-uses";
          usesEl.textContent = uses === 1 ? "1 use" : `${uses} uses`;
          headEl.append(usesEl);
        }

        const urlEl = document.createElement("span");
        urlEl.className = "hd-item-url";
        urlEl.textContent = urlText;

        button.title = urlText;
        button.append(headEl, urlEl);
        button.addEventListener("mouseenter", () => {
          selectedIndex = index;
          updateSelection();
        });
        button.addEventListener("click", (event) => {
          selectedIndex = index;
          selectCurrent(event);
        });
        list.append(button);
      });

      body.replaceChildren(list);
      updateSelection();
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        selectedIndex += 1;
        clampSelection();
        updateSelection();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        selectedIndex -= 1;
        clampSelection();
        updateSelection();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        selectCurrent(event);
      }
    }

    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      filtered = items.filter((item) => {
        return [item.label, item.path, item.url].some((value) => String(value).toLowerCase().includes(query));
      });
      selectedIndex = 0;
      render();
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay && !embedded) {
        close();
      }
    });

    configure.addEventListener("click", () => {
      options.onConfigure?.();
    });

    window.addEventListener("keydown", onKeyDown, true);
    render();
    search.focus();

    return { close: teardown, focus: () => search.focus() };
  }

  function statusMessage(className, text) {
    const message = document.createElement("div");
    message.className = className;
    message.textContent = text;
    return message;
  }

  function isMacPlatform() {
    return /Mac|iPhone|iPad/.test(navigator.platform);
  }

  function isNewTabModifier(event) {
    return isMacPlatform() ? event.metaKey : event.ctrlKey;
  }

  return { mount };
})();
