// Dependency-free UI-controller smoke test with a fake DOM/worker. This does NOT
// replace an actual headless browser test; it catches app-level wiring errors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreAllMoves } from '../src/search.js';
import { runGeneration } from '../src/learning.js';

class Element {
  constructor() {
    this.children = []; this.events = {}; this.value = ''; this.textContent = '';
    this.disabled = false; this.className = ''; this.attributes = {};
  }
  addEventListener(type, fn) { this.events[type] = fn; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  click() { this.events.click?.({ target: this }); }
}
class MockDocument {
  constructor() {
    this.ids = new Map();
    for (const [id, value] of Object.entries({ 'human-color': '1', 'analysis-depth': '3', 'computer-depth': '3', 'review-slider': '0' })) {
      this.getElementById(id).value = value;
    }
  }
  getElementById(id) { if (!this.ids.has(id)) this.ids.set(id, new Element()); return this.ids.get(id); }
  createElement() { return new Element(); }
}
class MockWorker {
  postMessage({type, id, board, player, depth, weights, options}) {
    queueMicrotask(() => {
      try {
        const content = type === 'train'
          ? { type:'trained', id, outcome: runGeneration(weights, { ...options, depth: 1, openingPairs: 1 }) }
          : { type:'analyzed', id, analysis: scoreAllMoves(Int8Array.from(board), player, depth, weights) };
        this.onmessage?.({data:content});
      } catch(error) { this.onmessage?.({data:{type:'error',id,message:String(error)}}); }
    });
  }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('UI controller: initial analysis, a complete turn, undo, replay, training', async () => {
  const document = new MockDocument();
  globalThis.document = document;
  globalThis.window = { confirm: () => true };
  globalThis.Worker = MockWorker;
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  await import('../src/app.js');
  const get = id => document.getElementById(id);
  await tick();
  assert.equal(get('turn-title').textContent, 'Black to move');
  assert.equal(get('board').children.length, 64);
  assert.equal(get('move-rows').children.length, 4);
  const first = get('board').children.find(b => b.attributes['aria-label'] === 'D3: legal move');
  assert.ok(first && !first.disabled);
  first.click();
  await tick();
  await tick();
  assert.equal(get('history').children.length, 2, 'computer should have replied');
  assert.equal(get('turn-title').textContent, 'Black to move');
  get('review-slider').events.input({ target: { value: '0' } });
  await tick();
  assert.match(get('status').textContent, /earlier position/);
  get('review-slider').events.input({ target: { value: '2' } });
  await tick();
  assert.equal(get('turn-title').textContent, 'Black to move');
  get('undo').click();
  await tick();
  assert.equal(get('history').children.length, 0);
  assert.equal(get('board').children.length, 64);
  get('train').click();
  await tick();
  assert.match(get('training-status').textContent, /challenger/i);
  assert.equal(get('train').disabled, false);
});
