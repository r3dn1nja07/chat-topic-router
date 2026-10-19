const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const core = require("../core.js");

const stored = { routedItems: [], projects: [] };
const sessionStored = {};
const listeners = { installed: null, message: null, clicked: null };
const menus = [];
const openedTabs = [];
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
  tabs: {
    create: (entry, callback) => { openedTabs.push(entry); callback?.({ id: openedTabs.length }); }
  },
  storage: { local: {
    get: (_defaults, callback) => callback({ routedItems: [...stored.routedItems], projects: [...stored.projects] }),
    set: (values, callback) => { Object.assign(stored, values); callback?.(); }
  }, session: {
    get: (key, callback) => callback({ [key]: sessionStored[key] }),
    set: (values, callback) => { Object.assign(sessionStored, values); callback?.(); },
    remove: (key, callback) => { delete sessionStored[key]; callback?.(); }
  } }
};
chrome.runtime.getURL = (path) => `chrome-extension://test-extension/${path}`;

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

function send(message, url, tabId = 123) {
  return new Promise((resolve) => {
    const keepAlive = listeners.message(message, { tab: { id: tabId, url }, url }, resolve);
    if (keepAlive !== true) resolve(undefined);
  });
}

(async () => {
  const rejected = await send({ type: "open-route-form", selectedText: "hello" }, "https://example.com/");
  assert.equal(rejected.ok, false);
  assert.equal(stored.routedItems.length, 0);

  const firstDraft = await send({
    type: "open-route-form",
    selectedText: "  Should opened milk be tracked separately?  ",
  }, "https://chatgpt.com/c/test");
  assert.equal(firstDraft.ok, true);
  const firstUrl = new URL(openedTabs.at(-1).url);
  assert.match(firstUrl.href, /^chrome-extension:\/\/test-extension\/route\.html\?draft=/);
  const firstDraftId = firstUrl.searchParams.get("draft");
  assert.ok(sessionStored[`routeDraft:${firstDraftId}`]);

  const saved = await send({
    type: "save-routed-item",
    draftId: firstDraftId,
    project: " Fridgely ",
    title: " Milk question ",
    note: "Opened containers need their own freshness date."
  }, firstUrl.href);
  assert.equal(saved.ok, true);
  assert.equal(saved.item.project, "Fridgely");
  assert.equal(saved.item.title, "Milk question");
  assert.equal(saved.item.selectedText, "Should opened milk be tracked separately?");
  assert.equal(saved.item.source, "ChatGPT");
  assert.equal(stored.projects[0].name, "Fridgely");
  assert.equal(sessionStored[`routeDraft:${firstDraftId}`], undefined);

  const tooLongDraft = await send({ type: "open-route-form", selectedText: "x".repeat(20050) }, "https://claude.ai/chat/test");
  const tooLongDraftId = new URL(openedTabs.at(-1).url).searchParams.get("draft");
  const tooLong = await send({ type: "save-routed-item", draftId: tooLongDraftId, project: "Test" }, openedTabs.at(-1).url);
  assert.equal(tooLong.item.selectedText.length, core.MAX_TEXT);
  assert.equal(tooLong.item.source, "Claude");

  await send({ type: "open-route-form", selectedText: "Keep this thought" }, "https://gemini.google.com/app/test");
  const geminiDraftId = new URL(openedTabs.at(-1).url).searchParams.get("draft");
  const gemini = await send({ type: "save-routed-item", draftId: geminiDraftId, project: "Yura" }, openedTabs.at(-1).url);
  assert.equal(gemini.item.source, "Gemini");

  listeners.clicked({ menuItemId: "route-selected-passage", selectionText: "Passage opened from the context menu." }, { id: 7, url: "https://chatgpt.com/c/context-menu" });
  const contextMenuUrl = new URL(openedTabs.at(-1).url);
  assert.match(contextMenuUrl.pathname, /route\.html$/);
  assert.equal(contextMenuUrl.searchParams.has("draft"), true);
  assert.equal(openedTabs.at(-1).url.includes("Passage opened from"), false);
  assert.equal(sessionStored[`routeDraft:${contextMenuUrl.searchParams.get("draft")}`].selectedText, "Passage opened from the context menu.");

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

  const obsidianLink = new URL(core.buildObsidianUri(
    { title: "Maintenance question", project: "Ford F-150", selectedText: "What oil should I use?", note: "Check the manual.", source: "ChatGPT", sourceUrl: "https://chatgpt.com/c/private", savedAt: "2026-10-19T09:00:00.000Z" },
    { name: "Ford F-150", context: "Vehicle maintenance" },
    { vault: "Keiah's Vault", folder: "Projects/AI Inbox" }
  ));
  assert.equal(obsidianLink.protocol, "obsidian:");
  assert.doesNotMatch(obsidianLink.href, /\+/);
  // Match Obsidian's percent decoding, which does not convert '+' to spaces.
  const rawVault = obsidianLink.search.slice(1).split("&").find(part => part.startsWith("vault=")).slice(6);
  assert.equal(decodeURIComponent(rawVault), "Keiah's Vault");
  const literalPlus = core.buildObsidianUri(
    { selectedText: "C++ & local AI" }, { name: "C++ Notes" }, { vault: "My AI Brain" }
  );
  assert.match(literalPlus, /vault=My%20AI%20Brain/);
  assert.match(literalPlus, /C%2B%2B/);
  assert.equal(obsidianLink.searchParams.get("vault"), "Keiah's Vault");
  assert.equal(obsidianLink.searchParams.get("append"), "true");
  assert.match(obsidianLink.searchParams.get("content"), /What oil should I use\?/);
  assert.match(obsidianLink.searchParams.get("content"), /Check the manual\./);
  assert.doesNotMatch(obsidianLink.searchParams.get("content"), /chatgpt\.com\/c\/private/);
  assert.equal(obsidianLink.searchParams.get("file"), "Projects/AI Inbox/Ford F-150.md");
  const linkedProject = core.normalizeProject({ name: "Project A", obsidianNote: "projects/Project A Main.md" });
  const linkedUri = new URL(core.buildObsidianUri(
    { selectedText: "A useful passage" }, linkedProject, { vault: "My Brain", folder: "inbox" }
  ));
  assert.equal(linkedProject.obsidianNote, "projects/Project A Main");
  assert.equal(linkedUri.searchParams.get("file"), "inbox/Project A Captures.md");
  assert.ok(linkedUri.searchParams.get("content").includes("**Project:** [[projects/Project A Main]]"));
  const restoredProject = core.normalizeData({ projects: JSON.parse(JSON.stringify([linkedProject])) }).projects[0];
  assert.equal(restoredProject.obsidianNote, linkedProject.obsidianNote);
  for (const invalid of ["../Secret", "projects/../../Secret", "projects/Bad]]", "projects/Note#Heading", "projects/Note\nInjected"]) {
    assert.equal(core.normalizeProject({ obsidianNote: invalid }).obsidianNote, "");
  }
  assert.equal(core.normalizeProject({ obsidianNote: "projects\\Project A.md" }).obsidianNote, "projects/Project A");
  const collision = new URL(core.buildObsidianUri(
    { selectedText: "Test" }, { name: "Project A", obsidianNote: "inbox/Project A Captures" },
    { vault: "Brain", folder: "inbox" }
  ));
  assert.equal(collision.searchParams.get("file"), "inbox/Project A Router Captures.md");
  const sanitizedObsidianLink = new URL(core.buildObsidianUri(
    { title: "First line\n## injected heading", selectedText: "Saved passage" },
    { name: "My: Project?" },
    { vault: "Vault" }
  ));
  assert.equal(sanitizedObsidianLink.searchParams.get("file"), "My- Project-.md");
  assert.doesNotMatch(sanitizedObsidianLink.searchParams.get("content"), /^## injected heading$/m);
  assert.equal(core.buildObsidianUri({ selectedText: "hello" }, { name: "Test" }, {}), "");
  assert.equal(core.buildObsidianUri({ selectedText: "x".repeat(8000) }, { name: "Test" }, { vault: "Vault" }), "");
  console.log("background and core tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
