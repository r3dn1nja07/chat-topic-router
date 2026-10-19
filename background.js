importScripts("core.js");

const { STORAGE_KEY, PROJECTS_KEY, MAX_ITEMS, MAX_TEXT, cleanText, normalizeData, normalizeProject } = RouterCore;

const PLATFORM_HOSTS = new Set(["chatgpt.com", "claude.ai", "gemini.google.com"]);

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "route-selected-passage",
    title: "Route selected text to a project.",
    contexts: ["selection"],
    documentUrlPatterns: [
      "https://chatgpt.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*"
    ]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "route-selected-passage" || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, {
    type: "open-router",
    selectedText: info.selectionText || ""
  }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "save-routed-item") return;

  const host = safeHost(sender.tab?.url);
  if (!host || !PLATFORM_HOSTS.has(host)) {
    sendResponse({ ok: false, error: "This page is not a supported AI chat." });
    return;
  }

  const text = cleanText(message.selectedText, MAX_TEXT);
  const projectName = cleanText(message.project, 60);
  const title = cleanText(message.title, 120);
  const note = cleanText(message.note, 2000);
  if (!text) {
    sendResponse({ ok: false, error: "Select some text to route first." });
    return;
  }
  if (!projectName) {
    sendResponse({ ok: false, error: "Enter a destination project." });
    return;
  }

  chrome.storage.local.get({ [STORAGE_KEY]: [], [PROJECTS_KEY]: [] }, (result) => {
    const data = normalizeData(result);
    let project = data[PROJECTS_KEY].find((entry) => entry.name.toLocaleLowerCase() === projectName.toLocaleLowerCase());
    if (!project && data[PROJECTS_KEY].length < RouterCore.MAX_PROJECTS) {
      project = normalizeProject({ name: projectName });
      data[PROJECTS_KEY].push(project);
    }
    if (!project) {
      sendResponse({ ok: false, error: "Project limit reached. Delete a project before adding another." });
      return;
    }
    const item = {
      id: crypto.randomUUID(),
      projectId: project.id,
      project: project.name,
      title: title || text.split(/\s+/).slice(0, 8).join(" "),
      selectedText: text,
      note,
      source: host === "gemini.google.com" ? "Gemini" : host === "claude.ai" ? "Claude" : "ChatGPT",
      sourceUrl: sender.tab?.url || "",
      status: "open",
      savedAt: new Date().toISOString()
    };
    const next = normalizeData({
      [STORAGE_KEY]: [item, ...data[STORAGE_KEY]].slice(0, MAX_ITEMS),
      [PROJECTS_KEY]: data[PROJECTS_KEY]
    });
    chrome.storage.local.set(next, () => sendResponse({ ok: true, item }));
  });
  return true;
});

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

