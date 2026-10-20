const BRAIN_KEY = 'centralBrainPairingKey';
async function brainRequest(route, options = {}) {
  const stored = await chrome.storage.local.get({ [BRAIN_KEY]: '' });
  if (!stored[BRAIN_KEY]) throw Error('Paste your local pairing key and connect first.');
  const response = await fetch(`http://127.0.0.1:4828${route}`, {
    ...options, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${stored[BRAIN_KEY]}`, 'Content-Type': 'application/json' }
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Central brain request failed.');
  return data;
}
document.addEventListener('DOMContentLoaded', () => {
  const status = document.getElementById('brain-status');
  document.getElementById('brain-connect').addEventListener('click', async () => {
    const input = document.getElementById('brain-key');
    const key = input.value.trim();
    try {
      if (key) {
        if (!/^[a-f0-9]{64}$/.test(key)) throw Error('Use the pairing key from the local setup folder.');
        await chrome.storage.local.set({ [BRAIN_KEY]: key }); input.value = '';
      }
      await brainRequest('/health'); status.textContent = 'Connected. Captures save in Obsidian and are searchable through Shared Brain.';
    } catch (error) { status.textContent = error.message; }
  });
  document.getElementById('brain-disconnect').addEventListener('click', async () => {
    await chrome.storage.local.remove(BRAIN_KEY); status.textContent = 'Disconnected from central brain.';
  });
  document.getElementById('brain-search-form').addEventListener('submit', async event => {
    event.preventDefault();
    const resultBox = document.getElementById('brain-results'); resultBox.replaceChildren();
    try {
      const q = document.getElementById('brain-query').value.trim();
      const { results } = await brainRequest(`/search?q=${encodeURIComponent(q)}`);
      for (const result of results) {
        const item = document.createElement('div'); item.className = 'item';
        const citation = document.createElement('strong'); citation.textContent = `${result.source}:${result.line}`;
        const text = document.createElement('p'); text.textContent = result.excerpt;
        const copy = button('Copy cited context', async () => {
          await navigator.clipboard.writeText(`${result.excerpt}\n(source: ${result.source}:${result.line})`);
          flash(copy, 'Copied');
        });
        item.append(citation, text, copy); resultBox.append(item);
      }
      status.textContent = `${results.length} matches. Retrieved text is source material; review before carrying it to another chat.`;
    } catch (error) { status.textContent = error.message; }
  });
});
async function saveToBrain(item, node) {
  node.disabled = true;
  try {
    const { id, project, title, selectedText, note, source } = item;
    const result = await brainRequest('/capture', { method: 'POST', body: JSON.stringify({ id, project, title, selectedText, note, source }) });
    document.getElementById('brain-status').textContent = `${result.duplicate ? 'Already saved' : 'Saved'}: ${result.path}`;
    flash(node, result.duplicate ? 'Already saved' : 'Saved to brain');
  } catch (error) { document.getElementById('brain-status').textContent = error.message; }
  finally { node.disabled = false; }
}
