import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal IndexedDB mock whose FIRST open() fails transiently, then succeeds.
// This guards the db.js contract that a failed open is retryable rather than
// permanently cached as a rejected promise.
const store = new Map();
let openCount = 0;
function makeDatabase() {
  return {
    objectStoreNames: { contains: name => store.has(name) },
    createObjectStore: name => { store.set(name, new Map()); },
    transaction(name) {
      const t = { oncomplete: null, onerror: null, onabort: null };
      t.objectStore = () => ({
        get(key) { return request(() => store.get(name).get(key)); },
        put(value) { return request(() => { store.get(name).set(value.id, value); return value.id; }); }
      });
      function request(op) {
        const r = { onsuccess: null, onerror: null, result: undefined, error: null };
        queueMicrotask(() => {
          try { r.result = op(); r.onsuccess?.(); queueMicrotask(() => t.oncomplete?.()); }
          catch (error) { r.error = error; r.onerror?.(); t.onerror?.(); }
        });
        return r;
      }
      return t;
    }
  };
}
globalThis.indexedDB = {
  open() {
    openCount++;
    const r = { result: makeDatabase(), onupgradeneeded: null, onsuccess: null, onerror: null };
    if (openCount === 1) queueMicrotask(() => { r.error = new Error('Transient open failure'); r.onerror?.(); });
    else queueMicrotask(() => { r.onupgradeneeded?.(); r.onsuccess?.(); });
    return r;
  }
};

const db = await import('../src/db.js');

test('db retries after a transient IndexedDB open failure', async () => {
  // First attempt hits the transient failure and rejects...
  await assert.rejects(db.dbPut('chats', { id: 'a', text: 'first' }), /Transient open failure/);
  // ...but the rejected promise is cleared, so the next call retries and succeeds.
  const id = await db.dbPut('chats', { id: 'a', text: 'first' });
  assert.equal(id, 'a');
  assert.deepEqual(await db.dbGet('chats', 'a'), { id: 'a', text: 'first' });
});

test('db rejects unknown tables', async () => {
  await assert.rejects(db.dbAll('not-a-table'), /Invalid table/);
});
