import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { ORSet as ORSetEsm } from '../../dist/index.js'

const require = createRequire(import.meta.url)
const { ORSet: ORSetCjs } = require('../../dist/index.cjs')

function sortedSnapshotIds(set) {
  return set
    .snapshot()
    .items.map((item) => item.__uuidv7)
    .sort()
}

test('esm and cjs builds interoperate via snapshots', () => {
  const esm = new ORSetEsm()
  const cjs = new ORSetCjs()

  esm.append({ role: 'admin' })
  cjs.merge(esm.snapshot())

  assert.equal(cjs.size, 1)
  assert.equal(cjs.values()[0].role, 'admin')
  assert.equal(typeof cjs.values()[0].__uuidv7, 'string')
})

test('public root export exposes ORSet but not ORSetError runtime value', async () => {
  const mod = await import('../../dist/index.js')

  assert.equal(typeof mod.ORSet, 'function')
  assert.equal('ORSetError' in mod, false)
})

test('replicas converge after append, remove, and merge roundtrip', () => {
  const a = new ORSetEsm()
  const b = new ORSetCjs()

  a.append({ name: 'alice' })
  a.append({ name: 'bob' })
  b.merge(a.snapshot())

  const alice = a.values().find((item) => item.name === 'alice')
  a.remove(alice)
  b.merge(a.snapshot())
  a.merge(b.snapshot())

  assert.equal(a.size, b.size)
  assert.deepEqual(sortedSnapshotIds(a), sortedSnapshotIds(b))
  assert.deepEqual(a.snapshot().tombs.sort(), b.snapshot().tombs.sort())
})
