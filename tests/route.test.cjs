const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup({ saveFails = false, closeFails = false, tabId = 42 } = {}) {
  const elements = new Map();
  const timers = [];
  const removed = [];
  let reply;
  const chrome = {
    runtime: { sendMessage: (_message, callback) => { reply = callback; } },
    storage: { session: {
      get: (key, callback) => callback({ [key]: { selectedText: 'A passage' } }),
      remove: () => {}
    } },
    tabs: {
      getCurrent: callback => callback({ id: tabId }),
      remove: (id, callback) => {
        removed.push(id);
        if (closeFails) chrome.runtime.lastError = { message: 'Cannot close' };
        callback();
        delete chrome.runtime.lastError;
      }
    }
  };
  const document = { getElementById: id => {
    if (!elements.has(id)) elements.set(id, {
      value: 'Test project', classList: { add() {}, remove() {} }, focus() {},
      addEventListener: (_event, handler) => { elements.get(id).submit = handler; }
    });
    return elements.get(id);
  } };
  vm.runInNewContext(fs.readFileSync('route.js', 'utf8'), {
    chrome, document, location: { search: '?draft=test' }, URLSearchParams,
    requestAnimationFrame: callback => callback(),
    setTimeout: (callback, delay) => timers.push({ callback, delay }),
    window: { addEventListener() {} }
  });
  assert.equal(timers.length, 0, 'Opening the form must never schedule a close');
  elements.get('route-form').submit({ preventDefault() {} });
  assert.equal(timers.length, 0, 'Wait for storage confirmation before closing');
  reply(saveFails ? { ok: false, error: 'Save failed' } : { ok: true, item: { project: 'Test project' } });
  return { timers, removed, elements };
}

const success = setup();
assert.equal(success.timers.length, 1);
assert.equal(success.timers[0].delay, 1000);
success.timers[0].callback();
assert.deepEqual(success.removed, [42], 'Close only the form tab');
assert.equal(setup({ saveFails: true }).timers.length, 0);
const failedClose = setup({ closeFails: true });
failedClose.timers[0].callback();
assert.match(failedClose.elements.get('status').textContent, /saved.*manually/);
const noTab = setup({ tabId: null });
noTab.timers[0].callback();
assert.deepEqual(noTab.removed, []);
assert.match(noTab.elements.get('status').textContent, /saved.*manually/);
console.log('route auto-close tests passed');
