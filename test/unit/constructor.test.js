import assert from 'node:assert/strict'
import test from 'node:test'
import { ORSet } from '../../dist/index.js'
import { assertBadSnapshotError, createValidUuid } from '../shared/orset.mjs'

test('constructor starts empty without snapshot', () => {
  const set = new ORSet()

  assert.equal(set.size, 0)
  assert.deepEqual(set.values(), [])
  assert.deepEqual(set.snapshot(), { items: [], tombs: [] })
})

test('constructor rejects explicit null snapshot', () => {
  assert.throws(() => new ORSet(null), assertBadSnapshotError)
})

test('constructor rejects explicit false snapshot', () => {
  assert.throws(() => new ORSet(false), assertBadSnapshotError)
})

test('constructor rejects snapshot missing items array', () => {
  assert.throws(() => new ORSet({ tombs: [] }), assertBadSnapshotError)
})

test('constructor rejects snapshot missing tombs array', () => {
  assert.throws(() => new ORSet({ items: [] }), assertBadSnapshotError)
})

test('constructor filters invalid tombs, tombed items, duplicate live ids, and invalid items', () => {
  const liveId = createValidUuid('live')
  const removedId = createValidUuid('removed')

  const set = new ORSet({
    items: [
      { __uuidv7: liveId, name: 'first' },
      { __uuidv7: liveId, name: 'second' },
      { __uuidv7: removedId, name: 'removed' },
      { __uuidv7: 'bad', name: 'invalid' },
    ],
    tombs: ['bad', removedId],
  })

  assert.equal(set.size, 1)
  assert.deepEqual(
    set.values().map((item) => item.name),
    ['first']
  )
  assert.deepEqual(set.snapshot().tombs, [removedId])
})

test('constructor freezes accepted snapshot entries', () => {
  const liveId = createValidUuid('live')

  const set = new ORSet({
    items: [{ __uuidv7: liveId, name: 'live' }],
    tombs: [],
  })

  assert.equal(Object.isFrozen(set.values()[0]), true)
})

test('has returns true only for live uuids', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [live] = set.values()

  assert.equal(set.has(live), true)
  assert.equal(
    set.has({ __uuidv7: createValidUuid('missing'), name: 'missing' }),
    false
  )
})

test('snapshot returns detached arrays', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const snapshot = set.snapshot()

  snapshot.items.push({ __uuidv7: createValidUuid('other'), name: 'other' })
  snapshot.tombs.push(createValidUuid('ghost'))

  assert.equal(set.snapshot().items.length, 1)
  assert.equal(set.snapshot().tombs.length, 0)
})
