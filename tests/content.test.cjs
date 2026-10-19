const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function run(mode) {
  const nodes = new Map();
  const events = {};
  let sent = 0;
  function element() {
    return {
      style: {}, listeners: {}, hidden: false,
      append(child) { if (child.id) nodes.set(child.id, child); },
      attachShadow() { return { append: this.append, getElementById: id => nodes.get(id) }; },
      setAttribute() {}, contains(target) { return target === this; },
      addEventListener(event, fn) { this.listeners[event] = fn; }
    };
  }
  const chrome = { runtime: { sendMessage(_message, reply) {
    sent++;
    if (mode === 'stale') throw new Error('Extension context invalidated.');
    reply({ ok: true });
  } } };
  vm.runInNewContext(fs.readFileSync('content.js', 'utf8'), {
    chrome, document: {
      createElement: element, documentElement: element(),
      addEventListener: (event, fn) => { events[event] = fn; }
    },
    window: { getSelection: () => ({ toString: () => 'Selected test passage' }) },
    innerWidth: 1000, innerHeight: 800,
    setTimeout: () => 1, clearTimeout() {}
  });
  events.mouseup({ target: {}, clientX: 100, clientY: 100 });
  assert.equal(nodes.get('route').hidden, false);
  assert.doesNotThrow(() => nodes.get('route').listeners.click());
  assert.equal(sent, 1);
  return nodes;
}
const stale = run('stale');
assert.equal(stale.get('route-status').hidden, false);
assert.match(stale.get('route-status').textContent, /Refresh this AI chat tab/);
const success = run('success');
assert.equal(success.get('route').hidden, true);
assert.equal(success.get('route-status').hidden, true);
console.log('content routing and stale-context tests passed');
