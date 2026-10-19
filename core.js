(function attachRouterCore(root) {
  const MAX_ITEMS = 200;
  const MAX_TEXT = 10000;
  const MAX_PROJECTS = 100;
  const STORAGE_KEY = "routedItems";
  const PROJECTS_KEY = "projects";

  function cleanText(value, limit) {
    return typeof value === "string" ? value.trim().slice(0, limit) : "";
  }

  function makeId() {
    return root.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeProject(project) {
    return {
      id: cleanText(project?.id, 80) || makeId(),
      name: cleanText(project?.name, 60),
      context: cleanText(project?.context, 1500),
      obsidianNote: normalizeNotePath(project?.obsidianNote),
      createdAt: cleanText(project?.createdAt, 40) || new Date().toISOString()
    };
  }

  function normalizeData(raw) {
    const projects = [];
    const byName = new Map();
    for (const candidate of Array.isArray(raw?.[PROJECTS_KEY]) ? raw[PROJECTS_KEY] : []) {
      const project = normalizeProject(candidate);
      const key = project.name.toLocaleLowerCase();
      if (!project.name || byName.has(key) || projects.length >= MAX_PROJECTS) continue;
      projects.push(project);
      byName.set(key, project);
    }

    const items = [];
    const seenIds = new Set();
    for (const candidate of Array.isArray(raw?.[STORAGE_KEY]) ? raw[STORAGE_KEY] : []) {
      if (!candidate || typeof candidate !== "object") continue;
      const name = cleanText(candidate.project || "Unsorted", 60) || "Unsorted";
      const key = name.toLocaleLowerCase();
      let project = byName.get(key);
      if (!project && projects.length < MAX_PROJECTS) {
        project = normalizeProject({ name });
        projects.push(project);
        byName.set(key, project);
      }
      if (!project) continue;
      let id = cleanText(candidate.id, 80) || makeId();
      if (seenIds.has(id)) id = makeId();
      seenIds.add(id);
      const selectedText = cleanText(candidate.selectedText, MAX_TEXT);
      if (!selectedText) continue;
      items.push({
        id,
        projectId: project.id,
        project: project.name,
        title: cleanText(candidate.title, 120) || selectedText.split(/\s+/).slice(0, 8).join(" "),
        selectedText,
        note: cleanText(candidate.note, 2000),
        source: cleanText(candidate.source, 40) || "AI chat",
        sourceUrl: cleanText(candidate.sourceUrl, 1000),
        status: candidate.status === "done" ? "done" : "open",
        savedAt: cleanText(candidate.savedAt, 40) || new Date().toISOString()
      });
      if (items.length >= MAX_ITEMS) break;
    }
    return { [STORAGE_KEY]: items, [PROJECTS_KEY]: projects };
  }

  function buildHandoff(item, project, includeSource = false) {
    const lines = [`Continue this topic in my ${project?.name || item.project || "project"} project.`];
    if (project?.context) lines.push("\nProject context:\n" + project.context);
    if (item.note) lines.push("\nRelevant context for this passage:\n" + item.note);
    lines.push("\nRouted passage:\n" + item.selectedText);
    if (includeSource && item.sourceUrl) lines.push("\nSource conversation: " + item.sourceUrl);
    else lines.push(`\nCaptured from ${item.source || "an AI chat"}. The original conversation is unchanged.`);
    lines.push("\nContinue only this topic. Do not assume access to the original conversation.");
    return lines.join("\n");
  }

  function buildObsidianUri(item, project, settings) {
    const vault = cleanText(settings?.vault, 120);
    if (!vault || !item?.selectedText) return "";
    const folder = cleanText(settings?.folder, 240).replace(/\\/g, "/").split("/")
      .map((part) => safePathSegment(part)).filter(Boolean).join("/");
    const projectName = safePathSegment(project?.name || item.project || "Unsorted") || "Unsorted";
    const projectNote = normalizeNotePath(project?.obsidianNote);
    // Keep captures separate from the linked main note to create real backlinks.
    let notePath = [folder, `${projectName}${projectNote ? " Captures" : ""}.md`].filter(Boolean).join("/");
    if (projectNote && notePath.slice(0, -3).toLocaleLowerCase() === projectNote.toLocaleLowerCase()) {
      notePath = [folder, `${projectName} Router Captures.md`].filter(Boolean).join("/");
    }
    const quote = cleanText(item.selectedText, MAX_TEXT).split("\n").map((line) => `> ${line}`).join("\n");
    const parts = [
      `## ${(cleanText(item.title, 120) || "Routed passage").replace(/[\r\n]+/g, " ")}`,
      `**Captured:** ${cleanText(item.savedAt, 40) || new Date().toISOString()} - ${cleanText(item.source, 40) || "AI chat"}`,
      "",
      quote
    ];
    if (projectNote) parts.splice(2, 0, `**Project:** [[${projectNote}]]`);
    if (item.note) parts.push("", `**Carry-over context:** ${cleanText(item.note, 2000)}`);
    parts.push("", "---", "");
    const params = new URLSearchParams({
      vault,
      file: notePath,
      content: parts.join("\n"),
      append: "true"
    });
    // Obsidian URI values use percent-encoded spaces, not form-style pluses.
    const query = params.toString().replace(/\+/g, "%20");
    if (query.length > 7000) return "";
    return `obsidian://new?${query}`;
  }

  function safePathSegment(value) {
    return cleanText(value, 100).replace(/[<>:"/\\|?*]/g, "-").replace(/^\.+|\.+$/g, "").trim();
  }

  function normalizeNotePath(value) {
    const path = cleanText(value, 240).replace(/\\/g, "/").replace(/\.md$/i, "");
    if (!path || /[\[\]|#^\r\n]/.test(path)) return "";
    const segments = path.split("/");
    if (segments.some(part => !part.trim() || part === "." || part === ".." || /[<>:"?*]/.test(part))) return "";
    return path;
  }

  const api = { MAX_ITEMS, MAX_TEXT, MAX_PROJECTS, STORAGE_KEY, PROJECTS_KEY, cleanText, makeId, normalizeData, normalizeProject, buildHandoff, buildObsidianUri };
  root.RouterCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
