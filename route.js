const DRAFT_PREFIX = "routeDraft:";
const draftId = new URLSearchParams(location.search).get("draft") || "";
const draftKey = `${DRAFT_PREFIX}${draftId}`;
const form = document.getElementById("route-form");
const projectInput = document.getElementById("project");
const titleInput = document.getElementById("title");
const selectedText = document.getElementById("selected-text");
const noteInput = document.getElementById("note");
const saveButton = document.getElementById("save");
const status = document.getElementById("status");
let saved = false;

if (!draftId) {
  showError("No passage was provided. Return to the chat, select text, and try again.");
} else {
  chrome.storage.session.get(draftKey, (result) => {
    const draft = result[draftKey];
    if (!draft?.selectedText) {
      showError("This routing form expired. Return to the chat, select the passage again, and reopen it.");
      return;
    }
    selectedText.value = draft.selectedText;
    titleInput.value = draft.selectedText.split(/\s+/).slice(0, 8).join(" ").slice(0, 120);
    requestAnimationFrame(() => projectInput.focus({ preventScroll: true }));
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!draftId || !selectedText.value) return;
  saveButton.disabled = true;
  status.classList.remove("success");
  status.textContent = "Saving passage…";
  chrome.runtime.sendMessage({
    type: "save-routed-item",
    draftId,
    project: projectInput.value,
    title: titleInput.value,
    note: noteInput.value
  }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      saveButton.disabled = false;
      showError(response?.error || "Could not save this passage. Try again.");
      return;
    }
    saved = true;
    status.classList.add("success");
    status.textContent = `Saved to ${response.item.project}. Closing this tab…`;
    saveButton.textContent = "Saved";
    projectInput.disabled = true;
    titleInput.disabled = true;
    selectedText.disabled = true;
    noteInput.disabled = true;
    setTimeout(closeSavedForm, 1000);
  });
});

window.addEventListener("pagehide", () => {
  if (draftId && !saved) chrome.storage.session.remove(draftKey);
});

function showError(message) {
  status.textContent = message;
  saveButton.disabled = true;
}

function closeSavedForm() {
  if (!saved) return;
  const keepOpen = () => {
    status.textContent = "Your passage is saved. You can close this tab manually.";
  };
  try {
    chrome.tabs.getCurrent((tab) => {
      if (chrome.runtime.lastError || !Number.isInteger(tab?.id)) {
        keepOpen();
        return;
      }
      chrome.tabs.remove(tab.id, () => {
        if (chrome.runtime.lastError) keepOpen();
      });
    });
  } catch {
    keepOpen();
  }
}
