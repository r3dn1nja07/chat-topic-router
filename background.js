importScripts("core.js");

const { STORAGE_KEY, PROJECTS_KEY, MAX_ITEMS, MAX_TEXT, cleanText, normalizeData, normalizeProject } = RouterCore;

const PLATFORM_HOSTS = new Set(["chatgpt.com", "claude.ai", "gemini.google.com"]);
const DRAFT_PREFIX = "routeDraft:";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "route-selected-passage",
    title: "Route selected text to a project…",
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
  openRouteForm(info.selectionText || "", tab.url);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "open-route-form") {
    const opened = openRouteForm(message.selectedText, sender.tab?.url, sendResponse);
    return opened;
  }
  if (message?.type !== "save-routed-item") return;

  saveRoutedItem(message, sendResponse);
  return true;
});

function openRouteForm(selectedText, sourceUrl, sendResponse = () => {}) {
  const host = safeHost(sourceUrl);
  const text = cleanText(selectedText, MAX_TEXT);
  if (!host || !PLATFORM_HOSTS.has(host)) {
    sendResponse({ ok: false, error: "This page is not a supported AI chat." });
    return false;
  }
  if (!text) {
    sendResponse({ ok: false, error: "Select some text to route first." });
    return false;
  }

  const id = crypto.randomUUID();
  const draftKey = `${DRAFT_PREFIX}${id}`;
  chrome.storage.session.set({ [draftKey]: { selectedText: text, sourceUrl, createdAt: Date.now() } }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: `Could not prepare the routing form: ${chrome.runtime.lastError.message}` });
      return;
    }
    chrome.tabs.create({ url: chrome.runtime.getURL(`route.html?draft=${encodeURIComponent(id)}`) }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        const error = chrome.runtime.lastError?.message || "The browser did not create a Router tab.";
        chrome.storage.session.remove(draftKey);
        sendResponse({ ok: false, error: `Could not open the routing form: ${error}` });
        return;
      }
      sendResponse({ ok: true });
    });
  });
  return true;
}

function saveRoutedItem(message, sendResponse) {
  const draftKey = `${DRAFT_PREFIX}${cleanText(message.draftId, 80)}`;
  chrome.storage.session.get(draftKey, (draftResult) => {
    const draft = draftResult[draftKey];
    const host = safeHost(draft?.sourceUrl);
    const text = cleanText(draft?.selectedText, MAX_TEXT);
    if (!host || !PLATFORM_HOSTS.has(host) || !text || Date.now() - draft.createdAt > 30 * 60 * 1000) {
      chrome.storage.session.remove(draftKey);
      sendResponse({ ok: false, error: "This routing form expired. Select the passage again and reopen it." });
      return;
    }

    const projectName = cleanText(message.project, 60);
    const title = cleanText(message.title, 120);
    const note = cleanText(message.note, 2000);
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
        sourceUrl: draft.sourceUrl,
        status: "open",
        savedAt: new Date().toISOString()
      };
      const next = normalizeData({
        [STORAGE_KEY]: [item, ...data[STORAGE_KEY]].slice(0, MAX_ITEMS),
        [PROJECTS_KEY]: data[PROJECTS_KEY]
      });
      chrome.storage.local.set(next, () => {
        chrome.storage.session.remove(draftKey, () => sendResponse({ ok: true, item }));
      });
    });
  });
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
