const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const core = require("../core.js");

const stored = { routedItems: [], projects: [] };
const listeners = { installed: null, message: null, clicked: null };
const menus = [];
let idCount = 0;
const chrome = {
  runtime: {
    onInstalled: { addListener: (fn) => { listeners.installed = fn; } },
    onMessage: { addListener: (fn) => { listeners.message = fn; } }
  },
  contextMenus: {
    create: (entry) => menus.push(entry),
    onClicked: { addListener: (fn) => { listeners.clicked = fn; } }
  },
  tabs: { sendMessage: () => Promise.resolve() },
  storage: { local: {
    get: (_defaults, callback) => callback({ routedItems: [...stored.routedItems], projects: [...stored.projects] }),
    set: (values, callback) => { Object.assign(stored, values); callback?.(); }
  } }
};

const context = vm.createContext({
  chrome,
  URL,
  Date,
  Set,
  Map,
  crypto: { randomUUID: () => `test-id-${++idCount}` },
  importScripts: () => { context.RouterCore = core; }
});
vm.runInContext(fs.readFileSync("background.js", "utf8"), context);

listeners.installed();
assert.equal(menus.length, 1);
assert.equal(menus[0].contexts[0], "selection");
assert.equal(menus[0].documentUrlPatterns.length, 3);

function send(message, url) {
  return new Promise((resolve) => {
    const keepAlive = listeners.message(message, { tab: { url } }, resolve);
    if (keepAlive !== true) resolve(undefined);
  });
}

(async () => {
  const rejected = await send({ type: "save-routed-item", selectedText: "hello", project: "Fridgely" }, "https://example.com/");
  assert.equal(rejected.ok, false);
  assert.equal(stored.routedItems.length, 0);

  const saved = await send({
    type: "save-routed-item",
    selectedText: "  Should opened milk be tracked separately?  ",
    project: " Fridgely ",
    title: " Milk question ",
    note: "Opened containers need their own freshness date."
  }, "https://chatgpt.com/c/test");
  assert.equal(saved.ok, true);
  assert.equal(saved.item.project, "Fridgely");
  assert.equal(saved.item.title, "Milk question");
  assert.equal(saved.item.selectedText, "Should opened milk be tracked separately?");
  assert.equal(saved.item.source, "ChatGPT");
  assert.equal(stored.projects[0].name, "Fridgely");

  const tooLong = await send({ type: "save-routed-item", selectedText: "x".repeat(20050), project: "Test" }, "https://claude.ai/chat/test");
  assert.equal(tooLong.item.selectedText.length, core.MAX_TEXT);
  assert.equal(tooLong.item.source, "Claude");

  const gemini = await send({ type: "save-routed-item", selectedText: "Keep this thought", project: "Yura" }, "https://gemini.google.com/app/test");
  assert.equal(gemini.item.source, "Gemini");

  const migrated = core.normalizeData({ routedItems: [{ project: "Legacy", selectedText: "Old passage", title: "Legacy item" }] });
  assert.equal(migrated.projects[0].name, "Legacy");
  assert.equal(migrated.routedItems[0].projectId, migrated.projects[0].id);
  assert.equal(migrated.routedItems[0].status, "open");

  const handoff = core.buildHandoff(
    { project: "Yura", selectedText: "Keep this thought", note: "Companion project", source: "Claude", sourceUrl: "https://claude.ai/chat/private" },
    { name: "Yura", context: "Local-first voice companion" }
  );
  assert.match(handoff, /Local-first voice companion/);
  assert.match(handoff, /Companion project/);
  assert.doesNotMatch(handoff, /private/);

  const withSource = core.buildHandoff(
    { project: "Yura", selectedText: "Keep this thought", sourceUrl: "https://claude.ai/chat/private" },
    { name: "Yura" }, true
  );
  assert.match(withSource, /https:\/\/claude\.ai\/chat\/private/);
  console.log("background and core tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

