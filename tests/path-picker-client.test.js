const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScripts, plain } = require("./helpers.js");

const { HostJumperPathPickerClient } = loadScripts(["path_picker_client.js"]);

test("path picker client centralizes state, navigation, usage, and options messages", async () => {
  const messages = [];
  const state = {
    items: [{ id: "cart", label: "Cart", url: "https://example.test/cart" }],
    canNavigate: true
  };
  const runtime = {
    async sendMessage(message) {
      messages.push(message);
      return message.type === HostJumperPathPickerClient.MESSAGES.GET_STATE ? state : undefined;
    }
  };
  const client = HostJumperPathPickerClient.create(runtime);

  assert.equal(await client.getState(), state);
  await client.open("https://example.test/cart", false, "cart");
  await client.open("https://example.test/cart", true, "cart");
  await client.recordUsage("cart");
  await client.openOptions();

  assert.deepEqual(plain(messages), [
    { type: "pathpicker.getState" },
    { type: "pathpicker.open", url: "https://example.test/cart", newTab: false, pathId: "cart" },
    { type: "pathpicker.open", url: "https://example.test/cart", newTab: true, pathId: "cart" },
    { type: "pathpicker.recordUsage", id: "cart" },
    { type: "pathpicker.openOptions" }
  ]);
  assert.equal(HostJumperPathPickerClient.MESSAGES.TOGGLE, "pathpicker.toggle");
});
