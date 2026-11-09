const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  loadScripts,
  folder,
  bookmark,
  treeWith,
  plain
} = require("./helpers.js");

function event() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    }
  };
}

function createBrowser() {
  const session = {};
  const api = {
    action: { onClicked: event() },
    commands: { onCommand: event() },
    bookmarks: {
      onCreated: event(),
      onChanged: event(),
      onRemoved: event(),
      onMoved: event(),
      async getTree() {
        return treeWith([
          folder("ci", "CI", [
            folder("ci-1", "CI-1", [
              bookmark("server", "Server 1", "https://server1.ci.example.test/")
            ])
          ])
        ]);
      }
    },
    windows: {
      onRemoved: event(),
      created: [],
      removed: [],
      async getCurrent() {
        return { left: 100, top: 100, width: 1200, height: 900 };
      },
      async create(properties) {
        this.created.push(properties);
        return { id: 42 };
      },
      async update() {},
      async remove(id) {
        this.removed.push(id);
      }
    },
    runtime: {
      onMessage: event(),
      getURL(url) {
        return url;
      },
      async openOptionsPage() {}
    },
    tabs: {
      updates: [],
      created: [],
      async query() {
        return [{ id: 17, windowId: 7, url: "https://current.example.test/" }];
      },
      async get(id) {
        return { id, windowId: 7, url: "https://current.example.test/" };
      },
      async update(id, properties) {
        this.updates.push({ id, ...properties });
      },
      async create(properties) {
        this.created.push(properties);
      },
      async sendMessage() {}
    },
    scripting: { async executeScript() {} },
    storage: {
      session: {
        async get(key) {
          return { [key]: session[key] };
        },
        async set(values) {
          Object.assign(session, values);
        },
        async remove(key) {
          delete session[key];
        }
      }
    }
  };
  return { api, session };
}

test("manifest registers the bookmark shortcut without omnibox integration", () => {
  const root = path.join(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const command = manifest.commands["open-bookmark-search"];

  assert.equal(command.suggested_key.default, "Alt+Shift+B");
  assert.equal(command.suggested_key.mac, "MacCtrl+Shift+B");
  assert.equal(Object.hasOwn(manifest, "omnibox"), false);
  assert.ok(manifest.permissions.includes("bookmarks"));
  assert.equal(manifest.background.scripts.some((script) => script.includes("omnibox")), false);
  assert.equal(fs.existsSync(path.join(root, "bookmark_omnibox.js")), false);
});

test("shortcut opens bookmark popup, searches, navigates, and closes it", async () => {
  const { api, session } = createBrowser();
  loadScripts(["shared.js", "bookmark_search.js", "background_script.js"], { browser: api });

  await api.commands.onCommand.listeners[0]("open-bookmark-search");
  assert.equal(api.windows.created.length, 1);
  assert.equal(api.windows.created[0].url, "popup/index.html?mode=bookmarks");
  assert.equal(session.bookmarkSourceTabId, 17);
  assert.equal(session.bookmarkWindowId, 42);

  const onMessage = api.runtime.onMessage.listeners[0];
  const results = await onMessage({ type: "SEARCH_BOOKMARKS", query: "ci-1 server 1" }, {});
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Server 1");
  assert.equal(results[0].displayPath, "CI > CI-1 > Server 1");
  assert.equal(results[0].url, "https://server1.ci.example.test/");

  await onMessage({ type: "NAVIGATE_BOOKMARK", url: results[0].url, newTab: false }, {});
  assert.deepEqual(plain(api.tabs.updates), [{
    id: 17,
    url: "https://server1.ci.example.test/",
    active: true
  }]);
  assert.deepEqual(api.windows.removed, [42]);
  assert.equal(session.bookmarkWindowId, undefined);
});

test("bookmark popup can open a new tab next to its source tab", async () => {
  const { api } = createBrowser();
  loadScripts(["shared.js", "bookmark_search.js", "background_script.js"], { browser: api });
  await api.commands.onCommand.listeners[0]("open-bookmark-search");

  const onMessage = api.runtime.onMessage.listeners[0];
  const url = "https://server1.ci.example.test/";
  await onMessage({ type: "NAVIGATE_BOOKMARK", url, newTab: true }, {});

  assert.deepEqual(plain(api.tabs.created), [{
    url,
    active: true,
    openerTabId: 17,
    windowId: 7
  }]);
});
