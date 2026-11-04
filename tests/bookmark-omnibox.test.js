const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts, plain } = require("./helpers.js");

const {
  HostJumperBookmarkOmnibox,
  HostJumperBookmarkSearch
} = loadScripts(["bookmark_search.js", "bookmark_omnibox.js"]);

function event() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    }
  };
}

function createHarness(results) {
  const omnibox = {
    onInputChanged: event(),
    onInputEntered: event(),
    onInputStarted: event(),
    onInputCancelled: event(),
    defaults: [],
    setDefaultSuggestion(suggestion) {
      this.defaults.push(suggestion);
    }
  };
  const tabs = {
    updates: [],
    created: [],
    async update(properties) {
      this.updates.push(properties);
    },
    async create(properties) {
      this.created.push(properties);
    }
  };
  const scheduled = new Map();
  let nextTimer = 1;
  const controller = HostJumperBookmarkOmnibox.createController({
    index: {
      async search() {
        return results;
      }
    },
    omnibox,
    tabs,
    setTimer(callback) {
      const id = nextTimer;
      nextTimer += 1;
      scheduled.set(id, callback);
      return id;
    },
    clearTimer(id) {
      scheduled.delete(id);
    },
    reportError(error) {
      throw error;
    }
  });
  controller.attach();

  return { omnibox, tabs, scheduled, controller };
}

test("debounces input and emits escaped suggestions with bookmark URLs", async () => {
  const harness = createHarness([{
    id: "server",
    title: "A&B <Server>",
    url: "https://example.test/?a=1&b=2",
    path: ["CI", "CI-1"],
    displayPath: "CI > CI-1 > A&B <Server>"
  }]);
  const { omnibox, scheduled, controller } = harness;
  assert.equal(omnibox.onInputChanged.listeners.length, 1);
  assert.equal(omnibox.onInputEntered.listeners.length, 1);

  let suggestions;
  controller.onInputChanged("ci-1", (value) => {
    suggestions = value;
  });
  controller.onInputChanged("ci-1 server", (value) => {
    suggestions = value;
  });
  assert.equal(scheduled.size, 1, "the second input should cancel the first timer");

  await [...scheduled.values()][0]();
  await Promise.resolve();
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].content, "https://example.test/?a=1&b=2");
  assert.equal(
    suggestions[0].description,
    "CI &gt; CI-1 &gt; A&amp;B &lt;Server&gt; — https://example.test/?a=1&amp;b=2"
  );
});

test("opens suggestions using the requested tab disposition and rejects raw input", async () => {
  const url = "https://server1.ci.example.test/";
  const { tabs, scheduled, controller } = createHarness([{
    id: "server",
    title: "Server 1",
    url,
    path: ["CI", "CI-1"],
    displayPath: "CI > CI-1 > Server 1"
  }]);

  await controller.onInputEntered("ci-1 server 1", "currentTab");
  assert.equal(tabs.updates.length, 0);

  controller.onInputChanged("ci-1 server 1", () => {});
  await [...scheduled.values()][0]();
  await Promise.resolve();
  await controller.onInputEntered(url, "currentTab");
  await controller.onInputEntered(url, "newForegroundTab");
  await controller.onInputEntered(url, "newBackgroundTab");

  assert.deepEqual(plain(tabs.updates), [{ url }]);
  assert.deepEqual(plain(tabs.created), [
    { url, active: true },
    { url, active: false }
  ]);
});

test("empty and cancelled input clear pending work and suggestions", () => {
  const { scheduled, controller } = createHarness([]);
  let suggestions = null;
  controller.onInputChanged("server", () => {});
  assert.equal(scheduled.size, 1);
  controller.onInputChanged("   ", (value) => {
    suggestions = value;
  });
  assert.equal(scheduled.size, 0);
  assert.equal(suggestions.length, 0);

  controller.onInputChanged("server", () => {});
  assert.equal(scheduled.size, 1);
  controller.onInputCancelled();
  assert.equal(scheduled.size, 0);
});

test("omnibox adapter uses the shared result limit", () => {
  assert.equal(HostJumperBookmarkSearch.DEFAULT_LIMIT, 8);
  assert.equal(typeof HostJumperBookmarkOmnibox.toSuggestion, "function");
});
