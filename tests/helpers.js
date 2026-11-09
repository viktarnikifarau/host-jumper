const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScripts(names, globals = {}) {
  const context = vm.createContext({ console, ...globals });
  for (const name of names) {
    const source = fs.readFileSync(path.join(__dirname, "..", name), "utf8");
    vm.runInContext(source, context, { filename: name });
  }
  return vm.runInContext(`({
    HostJumperBookmarkSearch: typeof HostJumperBookmarkSearch === "undefined" ? undefined : HostJumperBookmarkSearch
  })`, context);
}

function folder(id, title, children = []) {
  return { id, title, type: "folder", children };
}

function bookmark(id, title, url) {
  return { id, title, url, type: "bookmark" };
}

function treeWith(children) {
  return [folder("root", "", children)];
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  loadScripts,
  folder,
  bookmark,
  treeWith,
  plain
};
