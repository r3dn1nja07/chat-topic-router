const { STORAGE_KEY, PROJECTS_KEY, normalizeData, buildHandoff, normalizeProject } = RouterCore;
const OBSIDIAN_SETTINGS_KEY = "obsidianSettings";
let items = [];
let projects = [];
let obsidianSettings = { vault: "", folder: "" };
let editingProjectId = "";

document.addEventListener("DOMContentLoaded", async () => {
  for (const [id, event, handler] of [
    ["filter", "change", render], ["status-filter", "change", render], ["search", "input", render],
    ["manage", "click", toggleProjects], ["backup", "click", exportBackup], ["restore", "click", () => document.getElementById("restore-file").click()],
    ["obsidian-toggle", "click", toggleObsidian], ["obsidian-form", "submit", saveObsidianSettings],
    ["restore-file", "change", importBackup], ["export", "click", exportVisible],
    ["project-form", "submit", saveProject], ["cancel-edit", "click", resetProjectForm],
    ["copy-selected", "click", copySelected], ["mark-selected", "click", markSelected], ["delete-selected", "click", deleteSelected]
  ]) document.getElementById(id).addEventListener(event, handler);
  await loadData();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes[STORAGE_KEY] || changes[PROJECTS_KEY] || changes[OBSIDIAN_SETTINGS_KEY])) loadData();
  });
});

async function loadData() {
  const raw = await chrome.storage.local.get({ [STORAGE_KEY]: [], [PROJECTS_KEY]: [], [OBSIDIAN_SETTINGS_KEY]: { vault: "", folder: "" } });
  const normalized = normalizeData(raw);
  items = normalized[STORAGE_KEY];
  projects = normalized[PROJECTS_KEY];
  obsidianSettings = normalizeObsidianSettings(raw[OBSIDIAN_SETTINGS_KEY]);
  document.getElementById("obsidian-vault").value = obsidianSettings.vault;
  document.getElementById("obsidian-folder").value = obsidianSettings.folder;
  if (JSON.stringify(raw[PROJECTS_KEY] || []) !== JSON.stringify(projects) || JSON.stringify(raw[STORAGE_KEY] || []) !== JSON.stringify(items)) {
    await chrome.storage.local.set(normalized);
  }
  populateProjects();
  render();
  renderProjectManager();
}

function populateProjects() {
  const select = document.getElementById("filter");
  const current = select.value;
  select.replaceChildren(new Option("All projects", ""), ...projects.slice().sort(byName).map((project) => new Option(project.name, project.id)));
  if (projects.some((project) => project.id === current)) select.value = current;
}

function visibleItems() {
  const projectId = document.getElementById("filter").value;
  const status = document.getElementById("status-filter").value;
  const query = document.getElementById("search").value.trim().toLocaleLowerCase();
  return items.filter((item) => (!projectId || item.projectId === projectId) && (status === "all" || item.status === status) &&
    (!query || [item.title, item.selectedText, item.note, item.project].some((value) => value?.toLocaleLowerCase().includes(query))));
}

function render() {
  const target = document.getElementById("list");
  const visible = visibleItems();
  target.replaceChildren();
  const count = items.filter((item) => item.status === "open").length;
  document.getElementById("count").textContent = `${count} open · ${items.length} total`;
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = items.length ? "No passages match these filters." : "Nothing routed yet. Select the question you want to keep, then choose “Route selection.” on a supported AI chat page.";
    target.append(empty);
  } else for (const item of visible) target.append(buildCard(item));
  updateBulkBar();
}

function buildCard(item) {
  const card = document.createElement("article");
  card.className = `item ${item.status === "done" ? "is-done" : ""}`;
  const head = document.createElement("div");
  head.className = "item-head";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "item-check";
  checkbox.setAttribute("aria-label", `Select ${item.title}`);
  checkbox.dataset.itemId = item.id;
  checkbox.addEventListener("change", updateBulkBar);
  const project = document.createElement("span");
  project.className = "project";
  project.textContent = item.project || "Unsorted";
  const status = document.createElement("span");
  status.className = "status-chip";
  status.textContent = item.status === "done" ? "Done" : "Open";
  head.append(checkbox, project, status);
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${item.source || "AI chat"} · ${formatDate(item.savedAt)}`;
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = item.title || "Routed passage";
  const excerpt = document.createElement("div");
  excerpt.className = "excerpt";
  excerpt.textContent = item.selectedText || "";
  const actions = document.createElement("div");
  actions.className = "item-actions";
  const copy = button("Copy handoff", () => copyHandoff(item, copy));
  const toObsidian = button("Add to Obsidian", () => addToObsidian(item, toObsidian));
  const toggle = button(item.status === "done" ? "Reopen" : "Mark done", () => updateItem(item.id, { status: item.status === "done" ? "open" : "done" }));
  const move = document.createElement("select");
  move.setAttribute("aria-label", `Move ${item.title} to project`);
  move.append(new Option("Move to…", ""), ...projects.map((project) => new Option(project.name, project.id)));
  move.value = item.projectId;
  move.addEventListener("change", () => { if (move.value) { const destination = projects.find((project) => project.id === move.value); updateItem(item.id, { projectId: destination.id, project: destination.name }); } });
  const remove = button("Delete", () => deleteItems([item.id]));
  actions.append(copy, toObsidian, toggle, move, remove);
  card.append(head, meta, title, excerpt);
  if (item.note) {
    const note = document.createElement("div");
    note.className = "note";
    note.textContent = `Carry-over note: ${item.note}`;
    card.append(note);
  }
  card.append(actions);
  return card;
}

function button(label, handler) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", handler);
  return node;
}

async function copyHandoff(item, buttonNode) {
  const project = projects.find((entry) => entry.id === item.projectId);
  try {
    await navigator.clipboard.writeText(buildHandoff(item, project));
    flash(buttonNode, "Copied");
  } catch { buttonNode.textContent = "Copy blocked"; }
}

function normalizeObsidianSettings(value) {
  return {
    vault: RouterCore.cleanText(value?.vault, 120),
    folder: RouterCore.cleanText(value?.folder, 240)
  };
}

function toggleObsidian() {
  const panel = document.getElementById("obsidian-panel");
  panel.hidden = !panel.hidden;
  document.getElementById("obsidian-toggle").textContent = panel.hidden ? "Obsidian" : "Hide Obsidian setup";
  if (!panel.hidden) document.getElementById("obsidian-vault").focus();
}

async function saveObsidianSettings(event) {
  event.preventDefault();
  const vault = RouterCore.cleanText(document.getElementById("obsidian-vault").value, 120);
  const folder = RouterCore.cleanText(document.getElementById("obsidian-folder").value, 240);
  if (!vault) return;
  obsidianSettings = normalizeObsidianSettings({ vault, folder });
  await chrome.storage.local.set({ [OBSIDIAN_SETTINGS_KEY]: obsidianSettings });
  document.getElementById("obsidian-status").textContent = "Saved. Routed passages will append to a note for their project; the browser inbox keeps its own copy.";
}

function addToObsidian(item, buttonNode) {
  if (!obsidianSettings.vault) {
    const panel = document.getElementById("obsidian-panel");
    panel.hidden = false;
    document.getElementById("obsidian-toggle").textContent = "Hide Obsidian setup";
    document.getElementById("obsidian-status").textContent = "Enter your vault name and save the setup before sending a passage.";
    document.getElementById("obsidian-vault").focus();
    return;
  }
  const project = projects.find((entry) => entry.id === item.projectId);
  const uri = RouterCore.buildObsidianUri(item, project, obsidianSettings);
  if (!uri) {
    document.getElementById("obsidian-status").textContent = "This passage is too long to open safely as an Obsidian link. Use Export view to save it as Markdown instead.";
    flash(buttonNode, "Passage too long");
    return;
  }
  const link = document.createElement("a");
  link.href = uri;
  link.target = "_blank";
  link.rel = "noopener";
  link.click();
  flash(buttonNode, "Opening Obsidian");
}

function flash(node, text) {
  const previous = node.textContent;
  node.textContent = text;
  setTimeout(() => { if (node.isConnected) node.textContent = previous; }, 1200);
}

function selectedIds() { return [...document.querySelectorAll(".item-check:checked")].map((input) => input.dataset.itemId); }
function updateBulkBar() {
  const ids = selectedIds();
  const bar = document.getElementById("bulk-bar");
  bar.hidden = ids.length === 0;
  document.getElementById("selected-count").textContent = `${ids.length} selected`;
  document.getElementById("mark-selected").textContent = ids.length && ids.every((id) => items.find((item) => item.id === id)?.status === "done") ? "Reopen selected" : "Mark done";
}

async function copySelected() {
  const chosen = items.filter((item) => selectedIds().includes(item.id));
  if (!chosen.length) return;
  const text = chosen.map((item) => buildHandoff(item, projects.find((project) => project.id === item.projectId))).join("\n\n---\n\n");
  try { await navigator.clipboard.writeText(text); flash(document.getElementById("copy-selected"), "Copied"); } catch { document.getElementById("copy-selected").textContent = "Copy blocked"; }
}

function markSelected() {
  const ids = selectedIds();
  const reopen = ids.length && ids.every((id) => items.find((item) => item.id === id)?.status === "done");
  items = items.map((item) => ids.includes(item.id) ? { ...item, status: reopen ? "open" : "done" } : item);
  persist();
}
function deleteSelected() { deleteItems(selectedIds()); }
function deleteItems(ids) {
  if (!ids.length || !confirm(`Delete ${ids.length} saved ${ids.length === 1 ? "passage" : "passages"}?`)) return;
  items = items.filter((item) => !ids.includes(item.id));
  persist();
}
function updateItem(id, patch) { items = items.map((item) => item.id === id ? { ...item, ...patch } : item); persist(); }

async function persist() {
  const normalized = normalizeData({ [STORAGE_KEY]: items, [PROJECTS_KEY]: projects });
  items = normalized[STORAGE_KEY]; projects = normalized[PROJECTS_KEY];
  await chrome.storage.local.set(normalized);
  populateProjects(); render(); renderProjectManager();
}

function toggleProjects() {
  const panel = document.getElementById("project-panel");
  panel.hidden = !panel.hidden;
  document.getElementById("manage").textContent = panel.hidden ? "Projects" : "Hide projects";
  if (!panel.hidden) document.getElementById("project-name").focus();
}

function renderProjectManager() {
  const target = document.getElementById("project-list");
  target.replaceChildren();
  for (const project of projects.slice().sort(byName)) {
    const row = document.createElement("div"); row.className = "project-row";
    const info = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = project.name;
    const detail = document.createElement("small"); detail.textContent = `${items.filter((item) => item.projectId === project.id).length} passages${project.context ? " · has shared context" : ""}`;
    info.append(name, detail);
    const edit = button("Edit", () => editProject(project));
    const remove = button("Delete", () => removeProject(project)); remove.className = "quiet-danger";
    row.append(info, edit, remove); target.append(row);
  }
}

function editProject(project) {
  editingProjectId = project.id;
  document.getElementById("project-form-title").textContent = "Edit project context";
  document.getElementById("project-name").value = project.name;
  document.getElementById("project-context").value = project.context;
  document.getElementById("project-obsidian-note").value = project.obsidianNote || "";
  document.getElementById("cancel-edit").hidden = false;
  document.getElementById("project-name").focus();
}

function resetProjectForm() {
  editingProjectId = "";
  document.getElementById("project-form-title").textContent = "New project";
  document.getElementById("project-form").reset();
  document.getElementById("cancel-edit").hidden = true;
}

async function saveProject(event) {
  event.preventDefault();
  const name = RouterCore.cleanText(document.getElementById("project-name").value, 60);
  const context = RouterCore.cleanText(document.getElementById("project-context").value, 1500);
  const noteInput = document.getElementById("project-obsidian-note");
  const obsidianNote = normalizeProject({ obsidianNote: noteInput.value }).obsidianNote;
  if (noteInput.value.trim() && !obsidianNote) {
    alert("Enter a vault-relative note path, such as projects/Project A, without brackets, headings, or parent-directory segments.");
    return;
  }
  if (!name) return;
  const conflict = projects.find((project) => project.name.toLocaleLowerCase() === name.toLocaleLowerCase() && project.id !== editingProjectId);
  if (conflict) { alert("A project with that name already exists."); return; }
  if (editingProjectId) {
    const old = projects.find((project) => project.id === editingProjectId);
    projects = projects.map((project) => project.id === editingProjectId ? { ...project, name, context, obsidianNote } : project);
    items = items.map((item) => item.projectId === editingProjectId ? { ...item, project: name } : item);
    void old;
  } else {
    if (projects.length >= RouterCore.MAX_PROJECTS) { alert("Project limit reached."); return; }
    projects.push(normalizeProject({ name, context, obsidianNote }));
  }
  resetProjectForm(); await persist();
}

function removeProject(project) {
  const affected = items.filter((item) => item.projectId === project.id);
  if (!confirm(`Delete “${project.name}”? ${affected.length ? `${affected.length} passages will move to Unsorted.` : ""}`)) return;
  projects = projects.filter((entry) => entry.id !== project.id);
  let unsorted = projects.find((entry) => entry.name.toLocaleLowerCase() === "unsorted");
  if (affected.length && !unsorted) { unsorted = normalizeProject({ name: "Unsorted" }); projects.push(unsorted); }
  if (affected.length) items = items.map((item) => item.projectId === project.id ? { ...item, projectId: unsorted.id, project: unsorted.name } : item);
  void persist();
}

function exportBackup() {
  download(`chat-topic-router-backup-${dateStamp()}.json`, JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), projects, items }, null, 2), "application/json");
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items) || !Array.isArray(parsed.projects)) throw new Error("This file is not a Chat Topic Router backup.");
    if (!confirm("Replace this browser's saved projects and passages with the selected backup?")) return;
    const restored = normalizeData({ [STORAGE_KEY]: parsed.items, [PROJECTS_KEY]: parsed.projects });
    items = restored[STORAGE_KEY]; projects = restored[PROJECTS_KEY];
    await chrome.storage.local.set(restored);
    populateProjects(); render(); renderProjectManager();
    alert(`Restored ${items.length} passages across ${projects.length} projects.`);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not read this backup file.");
  }
}

function exportVisible() {
  const visible = visibleItems();
  if (!visible.length) return;
  const markdown = visible.map((item) => `## ${item.title}\n\n**Project:** ${item.project}  \n**Source:** ${item.source} · ${formatDate(item.savedAt)} · ${item.status}\n\n${buildHandoff(item, projects.find((project) => project.id === item.projectId))}`).join("\n\n---\n\n");
  download(`chat-topic-router-handoffs-${dateStamp()}.md`, `# Chat Topic Router handoffs\n\n${markdown}\n`, "text/markdown");
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dateStamp() { return new Date().toISOString().slice(0, 10); }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "saved" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function byName(a, b) { return a.name.localeCompare(b.name); }
