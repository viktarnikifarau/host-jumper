const form = document.getElementById("add-form");
const labelInput = document.getElementById("label-input");
const pathInput = document.getElementById("path-input");
const listEl = document.getElementById("path-list");
const emptyState = document.getElementById("empty-state");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const importPrompt = document.getElementById("import-prompt");
const importCount = document.getElementById("import-count");
const importReplaceBtn = document.getElementById("import-replace");
const importMergeBtn = document.getElementById("import-merge");
const importCancelBtn = document.getElementById("import-cancel");
const shareStatus = document.getElementById("share-status");

let pendingImport = null;

document.addEventListener("DOMContentLoaded", render);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const path = HostJumper.normalizePath(pathInput.value);
  if (path === "/") {
    pathInput.focus();
    return;
  }

  const paths = await HostJumper.getPaths();
  paths.push({
    id: HostJumper.createId(),
    label: labelInput.value.trim(),
    path,
    uses: 0
  });
  await HostJumper.savePaths(paths);
  labelInput.value = "";
  pathInput.value = "";
  labelInput.focus();
  render();
});

async function render() {
  const paths = await HostJumper.getPaths();
  listEl.innerHTML = "";
  emptyState.classList.toggle("is-hidden", paths.length > 0);

  paths.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <input class="label-field" type="text" maxlength="80">
      <input class="path-field" type="text">
      <span class="uses-field"></span>
      <div class="row-actions">
        <button type="button" class="up" title="Move up">Up</button>
        <button type="button" class="down" title="Move down">Down</button>
        <button type="button" class="danger" title="Delete">Delete</button>
      </div>
    `;

    const labelField = row.querySelector(".label-field");
    const pathField = row.querySelector(".path-field");
    const usesField = row.querySelector(".uses-field");
    labelField.value = item.label || "";
    pathField.value = item.path;
    labelField.placeholder = "Label";
    pathField.placeholder = "/path?id={id}";
    usesField.textContent = HostJumper.formatUses(item.uses);
    usesField.title = "Times this path has been opened on this browser";

    labelField.addEventListener("change", () => updateItem(item.id, {
      label: labelField.value.trim(),
      path: HostJumper.normalizePath(pathField.value)
    }));
    pathField.addEventListener("change", () => {
      pathField.value = HostJumper.normalizePath(pathField.value);
      updateItem(item.id, {
        label: labelField.value.trim(),
        path: pathField.value
      });
    });
    row.querySelector(".up").addEventListener("click", () => moveItem(index, -1));
    row.querySelector(".down").addEventListener("click", () => moveItem(index, 1));
    row.querySelector(".danger").addEventListener("click", () => deleteItem(item.id));
    listEl.append(row);
  });
}

async function updateItem(id, changes) {
  const paths = await HostJumper.getPaths();
  const next = paths.map((item) => item.id === id ? { ...item, ...changes } : item);
  await HostJumper.savePaths(next);
}

async function deleteItem(id) {
  const paths = await HostJumper.getPaths();
  await HostJumper.savePaths(paths.filter((item) => item.id !== id));
  render();
}

exportBtn.addEventListener("click", async () => {
  const paths = await HostJumper.getPaths();
  const config = HostJumper.serializeConfig(paths);
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "host-jumper.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showShareStatus(`Exported ${config.paths.length} path${config.paths.length === 1 ? "" : "s"}.`);
});

importBtn.addEventListener("click", () => {
  importFile.value = "";
  importFile.click();
});

importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  if (!file) {
    return;
  }

  try {
    const imported = HostJumper.parseConfig(await file.text());
    const current = await HostJumper.getPaths();
    if (!current.length) {
      await HostJumper.savePaths(imported);
      hideImportPrompt();
      showShareStatus(`Imported ${imported.length} path${imported.length === 1 ? "" : "s"}.`);
      render();
      return;
    }

    pendingImport = imported;
    importCount.textContent = String(imported.length);
    importPrompt.hidden = false;
    showShareStatus("");
  } catch (error) {
    hideImportPrompt();
    showShareStatus(error.message || "Could not import that file.", true);
  }
});

importReplaceBtn.addEventListener("click", async () => {
  if (!pendingImport) {
    return;
  }
  await HostJumper.savePaths(pendingImport);
  showShareStatus(`Replaced configuration with ${pendingImport.length} path${pendingImport.length === 1 ? "" : "s"}.`);
  hideImportPrompt();
  render();
});

importMergeBtn.addEventListener("click", async () => {
  if (!pendingImport) {
    return;
  }
  const current = await HostJumper.getPaths();
  const merged = HostJumper.mergePaths(current, pendingImport);
  const added = merged.length - current.length;
  await HostJumper.savePaths(merged);
  showShareStatus(added ? `Merged ${added} new path${added === 1 ? "" : "s"}.` : "No new paths to merge.");
  hideImportPrompt();
  render();
});

importCancelBtn.addEventListener("click", () => {
  hideImportPrompt();
  showShareStatus("Import cancelled.");
});

function hideImportPrompt() {
  pendingImport = null;
  importPrompt.hidden = true;
  importFile.value = "";
}

function showShareStatus(message, isError = false) {
  shareStatus.hidden = !message;
  shareStatus.textContent = message;
  shareStatus.classList.toggle("share-status-error", Boolean(isError));
}

async function moveItem(index, delta) {
  const paths = await HostJumper.getPaths();
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= paths.length) {
    return;
  }
  const copy = paths.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  await HostJumper.savePaths(copy);
  render();
}
