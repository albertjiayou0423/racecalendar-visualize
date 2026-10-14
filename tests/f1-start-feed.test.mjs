import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
const require = createRequire(import.meta.url)
const ts = require('typescript')
function loadFeed(fail = false) {
  let fetches = 0
  let terminated = 0
  class Socket extends EventEmitter {
    constructor() { super(); queueMicrotask(() => this.emit(fail ? 'error' : 'open')) }
    send(value) {
      const message = JSON.parse(value.slice(0, -1))
      queueMicrotask(() => this.emit('message', Buffer.from(JSON.stringify(message.protocol ? {} : { type: 3, invocationId: '1', result: { valid: true } }) + '\x1e')))
    }
    terminate() { terminated++ }
  }
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(new URL('../lib/f1-start-feed.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, require: name => name === 'ws' ? Socket : name === './f1-start-state' ? { parseF1StartState: () => ({ phase: 'formation', observedAt: new Date().toISOString() }) } : require(name),
    fetch: async () => { fetches++; return { ok: true, headers: { getSetCookie: () => [] }, json: async () => ({ connectionToken: 'test-only' }) } },
    Date, AbortSignal, setTimeout, clearTimeout, queueMicrotask, Buffer,
  })
  return { read: exports.readF1StartFeed, counts: () => ({ fetches, terminated }) }
}
test('concurrent calls share one bounded upstream connection and reuse the snapshot', async () => {
  const feed = loadFeed()
  const result = await Promise.all([feed.read(1), feed.read(1)])
  assert.equal(result[0].phase, 'formation')
  await feed.read(1)
  assert.equal(feed.counts().fetches, 2)
  assert.equal(feed.counts().terminated, 1)
})
test('socket failure degrades to unknown and releases the connection', async () => {
  const feed = loadFeed(true)
  assert.equal((await feed.read(2)).phase, 'unknown')
  assert.equal(feed.counts().terminated, 1)
})
