import assert from 'node:assert/strict'
import test from 'node:test'
import { ORSet } from '../../dist/index.js'
import {
  assertBadSnapshotError,
  captureEvents,
  createValidUuid,
  sortStrings,
} from '../shared/orset.mjs'

test('merge rejects malformed snapshots', () => {
  const set = new ORSet()

  assert.throws(() => set.merge(null), assertBadSnapshotError)
})

test('merge imports live additions and emits merge plus snapshot', () => {
  const source = new ORSet()
  source.append({ name: 'alice' })
  const [live] = source.values()
  const target = new ORSet()
  const { events } = captureEvents(target)

  target.merge(source.snapshot())

  assert.equal(target.size, 1)
  assert.equal(target.values()[0].__uuidv7, live.__uuidv7)
  assert.equal(events.merge.length, 1)
  assert.equal(events.snapshot.length, 1)
  assert.deepEqual(events.merge[0].removals, [])
  assert.deepEqual(events.merge[0].additions, [live])
})

test('merge removes live items from tombs and decrements size', () => {
  const removableId = createValidUuid('removable')
  const target = new ORSet({
    items: [{ __uuidv7: removableId, name: 'removable' }],
    tombs: [],
  })
  const { events } = captureEvents(target)

  target.merge({ items: [], tombs: [removableId] })

  assert.equal(target.size, 0)
  assert.deepEqual(target.snapshot().tombs, [removableId])
  assert.equal(events.merge.length, 1)
  assert.deepEqual(events.merge[0].removals, [removableId])
  assert.deepEqual(events.merge[0].additions, [])
})

test('merge records causal tombs without a local live item', () => {
  const target = new ORSet()
  const ghostId = createValidUuid('ghost')
  const { events } = captureEvents(target)

  target.merge({ items: [], tombs: [ghostId] })

  assert.equal(target.size, 0)
  assert.deepEqual(target.snapshot().tombs, [ghostId])
  assert.equal(events.merge.length, 1)
  assert.deepEqual(events.merge[0].removals, [ghostId])
})

test('merge skips invalid tombs and invalid items', () => {
  const target = new ORSet()
  const { events } = captureEvents(target)

  target.merge({
    items: [{ __uuidv7: 'bad', name: 'invalid' }],
    tombs: ['bad'],
  })

  assert.equal(target.size, 0)
  assert.equal(events.merge.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('merge ignores live duplicates already present locally', () => {
  const target = new ORSet()
  target.append({ name: 'alice' })
  const [live] = target.values()
  const { events } = captureEvents(target)

  target.merge({ items: [live], tombs: [] })

  assert.equal(target.size, 1)
  assert.equal(events.merge.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('merge never resurrects tombstoned uuid from ingress items', () => {
  const tombedId = createValidUuid('tombed')
  const target = new ORSet({ items: [], tombs: [tombedId] })
  const { events } = captureEvents(target)

  target.merge({
    items: [{ __uuidv7: tombedId, name: 'zombie' }],
    tombs: [],
  })

  assert.equal(target.size, 0)
  assert.equal(events.merge.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('merge applies tombs before a conflicting ingress item with the same uuid', () => {
  const conflictId = createValidUuid('conflict')
  const target = new ORSet({
    items: [{ __uuidv7: conflictId, name: 'live' }],
    tombs: [],
  })
  const { events } = captureEvents(target)

  target.merge({
    items: [{ __uuidv7: conflictId, name: 'resurrected' }],
    tombs: [conflictId],
  })

  assert.equal(target.size, 0)
  assert.equal(events.merge.length, 1)
  assert.deepEqual(events.merge[0].removals, [conflictId])
  assert.deepEqual(events.merge[0].additions, [])
})

test('merge can add and remove in the same operation', () => {
  const removedId = createValidUuid('removed')
  const source = new ORSet()
  source.append({ name: 'added' })
  const [added] = source.values()
  const target = new ORSet({
    items: [{ __uuidv7: removedId, name: 'removed' }],
    tombs: [],
  })
  const { events } = captureEvents(target)

  target.merge({
    items: [added],
    tombs: [removedId],
  })

  assert.equal(target.size, 1)
  assert.equal(target.values()[0].__uuidv7, added.__uuidv7)
  assert.equal(events.merge.length, 1)
  assert.deepEqual(events.merge[0].removals, [removedId])
  assert.deepEqual(
    events.merge[0].additions.map((item) => item.__uuidv7),
    [added.__uuidv7]
  )
})

test('merge stays silent on no-op snapshots', () => {
  const target = new ORSet()
  const knownTomb = createValidUuid('known-tomb')
  target.merge({ items: [], tombs: [knownTomb] })
  const { events } = captureEvents(target)

  target.merge({
    items: [{ __uuidv7: 'bad', name: 'invalid' }],
    tombs: ['bad', knownTomb],
  })

  assert.equal(events.merge.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('replicas converge after append remove and merge roundtrip', () => {
  const a = new ORSet()
  const b = new ORSet()

  a.append({ name: 'alice' })
  a.append({ name: 'bob' })
  b.merge(a.snapshot())

  const alice = a.values().find((item) => item.name === 'alice')
  a.remove(alice)
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
