const FastPagesPicker = (() => {
  const STYLE = `
    :host, .fp-root {
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

    .fp-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(9, 10, 15, 0.52);
    }

    .fp-dialog {
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

    .fp-root.is-embedded,
    .fp-root.is-embedded .fp-overlay {
      position: static;
      inset: auto;
      width: 100%;
      height: 100%;
      padding: 0;
      background: #1c1d24;
    }

    .fp-root.is-embedded .fp-dialog {
      width: 100%;
      max-height: none;
      height: 100%;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }

    .fp-search {
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

    .fp-search::placeholder {
      color: #8b8d97;
    }

    .fp-body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .fp-list {
      flex: 1;
      margin: 0;
      padding: 8px;
      overflow: auto;
      list-style: none;
    }

    .fp-item {
      width: 100%;
      padding: 10px 12px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .fp-item[aria-selected="true"] {
      background: #2e5bff;
    }

    .fp-item-label {
      display: block;
      font-size: 14px;
      font-weight: 650;
    }

    .fp-item-url {
      display: block;
      margin-top: 2px;
      color: #b9bbc6;
      font-size: 12px;
      word-break: break-all;
    }

    .fp-item[aria-selected="true"] .fp-item-url {
      color: rgba(255, 255, 255, 0.86);
    }

    .fp-item.is-missing .fp-item-url {
      color: #ffb4a2;
    }

    .fp-empty, .fp-error {
      padding: 28px 18px;
      color: #b9bbc6;
      font-size: 14px;
      line-height: 1.45;
      text-align: center;
    }

    .fp-footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      color: #8b8d97;
      font-size: 11px;
    }

    .fp-link {
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

    root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = `fp-root${embedded ? " is-embedded" : ""}`;

    const style = document.createElement("style");
    style.textContent = STYLE;

    wrap.innerHTML = `
      <div class="fp-overlay">
        <div class="fp-dialog" role="dialog" aria-modal="true" aria-label="Host Jumper">
          <input class="fp-search" type="search" placeholder="Search paths" autocomplete="off" spellcheck="false">
          <div class="fp-body"></div>
          <div class="fp-footer">
            <span>Enter to open · Esc to close</span>
            <button class="fp-link" type="button">Configure paths</button>
          </div>
        </div>
      </div>
    `;

    root.append(style, wrap);

    const overlay = wrap.querySelector(".fp-overlay");
    const search = wrap.querySelector(".fp-search");
    const body = wrap.querySelector(".fp-body");
    const configure = wrap.querySelector(".fp-link");

    function close() {
      teardown();
      options.onClose?.();
    }

    function teardown() {
      window.removeEventListener("keydown", onKeyDown, true);
      root.innerHTML = "";
    }

    function selectCurrent() {
      const item = filtered[selectedIndex];
      if (!item) {
        return;
      }
      options.onSelect?.(item);
    }

    function clampSelection() {
      if (!filtered.length) {
        selectedIndex = 0;
        return;
      }
      selectedIndex = (selectedIndex + filtered.length) % filtered.length;
    }

    function updateSelection() {
      const buttons = body.querySelectorAll(".fp-item");
      buttons.forEach((button, index) => {
        button.setAttribute("aria-selected", String(index === selectedIndex));
      });
      buttons[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }

    function render() {
      if (!options.canNavigate && options.embedded) {
        body.innerHTML = `<div class="fp-error">Open a regular web page first, then use Host Jumper.</div>`;
        return;
      }

      if (!items.length) {
        body.innerHTML = `<div class="fp-empty">No paths configured yet. Add a few in the options page.</div>`;
        return;
      }

      if (!filtered.length) {
        body.innerHTML = `<div class="fp-empty">No matching paths.</div>`;
        return;
      }

      clampSelection();
      const list = document.createElement("div");
      list.className = "fp-list";
      list.setAttribute("role", "listbox");

      filtered.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `fp-item${item.missing?.length ? " is-missing" : ""}`;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", String(index === selectedIndex));
        button.innerHTML = `
          <span class="fp-item-label"></span>
          <span class="fp-item-url"></span>
        `;
        button.querySelector(".fp-item-label").textContent = item.label;
        button.querySelector(".fp-item-url").textContent = item.missing?.length
          ? `${item.url}  ·  missing {${item.missing.join(", ")}}`
          : item.url;
        button.addEventListener("mouseenter", () => {
          selectedIndex = index;
          updateSelection();
        });
        button.addEventListener("click", () => {
          selectedIndex = index;
          selectCurrent();
        });
        list.append(button);
      });

      body.innerHTML = "";
      body.append(list);
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
        selectCurrent();
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

  return { mount };
})();
