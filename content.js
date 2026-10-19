(() => {
  const HOST_ID = "chat-topic-router-host";
  let host;
  let shadow;
  let selectedText = "";
  let lastPoint = { x: 20, y: 20 };

  function ensureUi() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "position:fixed;z-index:2147483647;inset:0;pointer-events:none;";
    shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing:border-box; font-family:system-ui,-apple-system,Segoe UI,sans-serif; }
      #route { position:fixed; pointer-events:auto; border:0; border-radius:999px; padding:8px 12px;
        color:#fff; background:#176b57; box-shadow:0 4px 18px #0004; font-size:13px; font-weight:650; cursor:pointer; }
      #veil { position:fixed; inset:0; display:none; align-items:center; justify-content:center; pointer-events:auto;
        background:#0b1512a8; padding:18px; }
      #card { width:min(440px,100%); max-height:90vh; overflow:auto; border-radius:16px; padding:20px;
        color:#17211e; background:#fbfdfb; box-shadow:0 16px 60px #0005; }
      h2 { margin:0 0 6px; font-size:19px; } p { margin:0 0 15px; color:#52615b; font-size:13px; line-height:1.45; }
      label { display:block; margin:12px 0 5px; font-size:12px; font-weight:700; }
      input, textarea { width:100%; border:1px solid #cbd7d1; border-radius:8px; padding:9px 10px; font:inherit; font-size:13px; background:white; color:#17211e; }
      textarea { min-height:64px; resize:vertical; }
      #preview { max-height:120px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; padding:10px;
        border-radius:8px; color:#31413b; background:#eff5f1; font-size:12px; }
      .actions { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
      .actions button { border:0; border-radius:8px; padding:9px 13px; font-weight:650; cursor:pointer; }
      #cancel { background:#e8eeeb; color:#26342e; } #save { background:#176b57; color:white; }
      #status { min-height:18px; margin-top:7px; color:#a33030; font-size:12px; }
      .privacy { margin-top:13px; color:#697870; font-size:11px; }
    `;
    shadow.append(style);
    shadow.innerHTML += `
      <button id="route" type="button" hidden>Route selection.</button>
      <div id="veil" role="dialog" aria-modal="true" aria-label="Route selected text">
        <section id="card">
          <h2>Route this passage</h2>
          <p>Save this selected text to a project inbox. Your original chat stays as it is.</p>
          <label for="project">Project</label><input id="project" maxlength="60" value="Unsorted" placeholder="e.g. Fridgely">
          <label for="title">Short title</label><input id="title" maxlength="120" placeholder="What is this about?">
          <label>Selected text</label><div id="preview"></div>
          <label for="note">Relevant context to carry over (optional)</label><textarea id="note" maxlength="2000" placeholder="Add only context needed in the destination chat."></textarea>
          <div id="status" aria-live="polite"></div>
          <div class="actions"><button id="cancel" type="button">Cancel</button><button id="save" type="button">Save to project</button></div>
          <div class="privacy">Stored in this browser only. No AI API or cloud account is used.</div>
        </section>
      </div>`;
    document.documentElement.append(host);

    const route = shadow.getElementById("route");
    route.addEventListener("mousedown", (event) => event.preventDefault());
    route.addEventListener("click", openDialog);
    shadow.getElementById("cancel").addEventListener("click", closeDialog);
    shadow.getElementById("veil").addEventListener("click", (event) => {
      if (event.target.id === "veil") closeDialog();
    });
    shadow.getElementById("save").addEventListener("click", saveItem);
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDialog();
    });
  }

  function onSelection(event) {
    const text = window.getSelection()?.toString().trim() || "";
    if (!text || text.length < 2 || host?.contains(event.target)) return;
    selectedText = text.slice(0, 10000);
    lastPoint = { x: event.clientX, y: event.clientY };
    ensureUi();
    const button = shadow.getElementById("route");
    button.hidden = false;
    button.style.left = `${Math.max(8, Math.min(lastPoint.x + 10, innerWidth - 165))}px`;
    button.style.top = `${Math.max(8, Math.min(lastPoint.y + 10, innerHeight - 45))}px`;
  }

  function openDialog() {
    if (!selectedText) return;
    const veil = shadow.getElementById("veil");
    veil.style.display = "flex";
    shadow.getElementById("preview").textContent = selectedText;
    shadow.getElementById("title").value = selectedText.split(/\s+/).slice(0, 8).join(" ").slice(0, 120);
    shadow.getElementById("status").textContent = "";
    shadow.getElementById("project").focus();
  }

  function closeDialog() {
    if (!shadow) return;
    shadow.getElementById("veil").style.display = "none";
    shadow.getElementById("route").hidden = true;
  }

  function saveItem() {
    const button = shadow.getElementById("save");
    button.disabled = true;
    chrome.runtime.sendMessage({
      type: "save-routed-item",
      project: shadow.getElementById("project").value,
      title: shadow.getElementById("title").value,
      note: shadow.getElementById("note").value,
      selectedText
    }, (response) => {
      button.disabled = false;
      if (chrome.runtime.lastError || !response?.ok) {
        shadow.getElementById("status").textContent = response?.error || "Could not save this handoff.";
        return;
      }
      closeDialog();
      selectedText = "";
      shadow.getElementById("note").value = "";
    });
  }

  document.addEventListener("mouseup", onSelection, true);
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "open-router") return;
    selectedText = String(message.selectedText || "").trim().slice(0, 10000);
    if (!selectedText) return;
    ensureUi();
    openDialog();
  });
})();

