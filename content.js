(() => {
  const HOST_ID = "chat-topic-router-host";
  const ROUTE_BUTTON_TIMEOUT = 6000;
  let host;
  let shadow;
  let selectedText = "";
  let routeButtonTimer;

  function ensureUi() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "position:fixed;z-index:2147483647;inset:0;pointer-events:none;";
    shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      #route { position:fixed; pointer-events:auto; border:0; border-radius:999px; padding:8px 12px;
        color:#fff; background:#176b57; box-shadow:0 4px 18px #0004; font:650 13px system-ui,-apple-system,Segoe UI,sans-serif; cursor:pointer; }
      #route-status { position:fixed; right:12px; bottom:12px; max-width:min(420px,calc(100vw - 24px)); padding:10px 13px;
        border-radius:9px; color:#fff; background:#26342e; box-shadow:0 4px 18px #0004; font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif; }
    `;
    shadow.append(style);
    const button = document.createElement("button");
    button.id = "route";
    button.type = "button";
    button.textContent = "Route selection";
    button.hidden = true;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", openRouteForm);
    shadow.append(button);
    const status = document.createElement("div");
    status.id = "route-status";
    status.hidden = true;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    shadow.append(status);
    document.documentElement.append(host);
  }

  function onSelection(event) {
    if (host?.contains(event.target)) return;
    const text = window.getSelection()?.toString().trim() || "";
    if (!text || text.length < 2) {
      hideRouteButton(true);
      return;
    }
    selectedText = text.slice(0, 10000);
    ensureUi();
    const button = shadow.getElementById("route");
    button.hidden = false;
    button.style.left = `${Math.max(8, Math.min(event.clientX + 10, innerWidth - 165))}px`;
    button.style.top = `${Math.max(8, Math.min(event.clientY + 10, innerHeight - 45))}px`;
    clearTimeout(routeButtonTimer);
    routeButtonTimer = setTimeout(() => hideRouteButton(true), ROUTE_BUTTON_TIMEOUT);
  }

  function openRouteForm() {
    const passage = selectedText;
    hideRouteButton(false);
    if (!passage) return;
    try {
      chrome.runtime.sendMessage({ type: "open-route-form", selectedText: passage }, (response) => {
        const error = chrome.runtime.lastError?.message || response?.error;
        if (error || !response?.ok) {
          showRouteError(error || "The Router background service did not respond.", passage);
        } else {
          selectedText = "";
          shadow.getElementById("route-status").hidden = true;
        }
      });
    } catch (error) {
      showRouteError(error?.message || "Router connection unavailable.", passage);
    }
  }

  function showRouteError(message, passage) {
    selectedText = passage;
    shadow.getElementById("route").hidden = false;
    const status = shadow.getElementById("route-status");
    status.textContent = /context invalidated|receiving end does not exist|connection/i.test(message)
      ? "Router was reloaded. Refresh this AI chat tab (Ctrl+R), then select the passage again."
      : `Router: ${message} Refresh this AI chat tab (Ctrl+R) and try again.`;
    status.hidden = false;
    clearTimeout(routeButtonTimer);
    routeButtonTimer = setTimeout(() => {
      status.hidden = true;
      hideRouteButton(true);
    }, 15000);
  }

  function hideRouteButton(clearSelection) {
    clearTimeout(routeButtonTimer);
    routeButtonTimer = null;
    if (shadow) shadow.getElementById("route").hidden = true;
    if (clearSelection) selectedText = "";
  }

  document.addEventListener("mouseup", onSelection, true);
})();
