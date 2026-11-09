const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts, plain } = require("./helpers.js");

const { HostJumperBookmarkClient } = loadScripts(["bookmark_client.js"]);

test("bookmark client searches through the shared protocol and adapts picker items", async () => {
  const messages = [];
  const runtime = {
    async sendMessage(message) {
      messages.push(message);
      return [{
        id: "server",
        title: "Server 1",
        url: "https://server1.ci.example.test/",
        path: ["CI", "CI-1"],
        displayPath: "CI > CI-1 > Server 1"
      }];
    }
  };
  const client = HostJumperBookmarkClient.create(runtime);

  const results = await client.search("ci-1 server 1");
  assert.deepEqual(plain(messages), [{
    type: HostJumperBookmarkClient.MESSAGES.SEARCH,
    query: "ci-1 server 1"
  }]);
  assert.equal(results[0].label, "Server 1");
  assert.equal(results[0].displayPath, "CI > CI-1 > Server 1");
});

test("bookmark client opens URLs and handles empty search responses", async () => {
  const messages = [];
  const runtime = {
    async sendMessage(message) {
      messages.push(message);
      return message.type === HostJumperBookmarkClient.MESSAGES.SEARCH ? null : undefined;
    }
  };
  const client = HostJumperBookmarkClient.create(runtime);
  const url = "https://server1.ci.example.test/";

  assert.equal((await client.search("missing")).length, 0);
  await client.open(url);
  await client.open(url, true);

  assert.deepEqual(plain(messages.slice(1)), [
    { type: HostJumperBookmarkClient.MESSAGES.OPEN, url, newTab: false },
    { type: HostJumperBookmarkClient.MESSAGES.OPEN, url, newTab: true }
  ]);
});
