import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { ORSet as ORSetEsm } from '../../dist/index.js'
import { sortStrings } from '../shared/orset.mjs'

const require = createRequire(import.meta.url)
const { ORSet: ORSetCjs } = require('../../dist/index.cjs')

test('replicas converge after interleaved append remove and merge operations', () => {
  const a = new ORSetEsm()
  const b = new ORSetCjs()

  a.append({ name: 'alice' })
  a.append({ name: 'bob' })
  b.merge(a.snapshot())
  b.append({ name: 'carol' })
  a.merge(b.snapshot())

  const alice = a.values().find((item) => item.name === 'alice')
  const carol = b.values().find((item) => item.name === 'carol')
  a.remove(alice)
  b.remove(carol)
  b.merge(a.snapshot())
  a.merge(b.snapshot())

  assert.equal(a.size, b.size)
  assert.deepEqual(
    sortStrings(a.snapshot().items.map((item) => item.__uuidv7)),
    sortStrings(b.snapshot().items.map((item) => item.__uuidv7))
  )
  assert.deepEqual(
    sortStrings(a.snapshot().tombs),
    sortStrings(b.snapshot().tombs)
  )
})

test('cjs build consumes tomb only snapshots from esm replica', () => {
  const esm = new ORSetEsm()
  const cjs = new ORSetCjs()

  esm.append({ name: 'alice' })
  const [alice] = esm.values()
  esm.remove(alice)
  cjs.merge(esm.snapshot())

  assert.equal(cjs.size, 0)
  assert.deepEqual(cjs.snapshot().items, [])
  assert.deepEqual(cjs.snapshot().tombs, [alice.__uuidv7])
})
