import assert from 'node:assert/strict'
import test from 'node:test'
import { v7 as uuidv7 } from 'uuid'
import { ORSet } from '../../dist/index.js'

function listen(set) {
  const events = {
    delta: [],
    snapshot: [],
    merge: [],
  }

  set.addEventListener('delta', (event) => {
    events.delta.push(event.detail)
  })
  set.addEventListener('snapshot', (event) => {
    events.snapshot.push(event.detail)
  })
  set.addEventListener('merge', (event) => {
    events.merge.push(event.detail)
  })

  return events
}

test('empty constructor starts empty', () => {
  const set = new ORSet()

  assert.equal(set.size, 0)
  assert.deepEqual(set.values(), [])
  assert.deepEqual(set.snapshot(), { items: [], tombs: [] })
})

test('constructor throws ORSetError for malformed snapshot shape', () => {
  assert.throws(
    () => new ORSet(42),
    (error) =>
      error &&
      error.name === 'ORSetError' &&
      error.code === 'BAD_SNAPSHOT' &&
      /Malformed snapshot\./.test(error.message)
  )
})

test('constructor keeps live valid entries and filters invalid or tombed ones', () => {
  const liveId = uuidv7()
  const removedId = uuidv7()

  const set = new ORSet({
    items: [
      { __uuidv7: liveId, name: 'live' },
      { __uuidv7: removedId, name: 'removed' },
      { __uuidv7: 'bad', name: 'invalid' },
    ],
    tombs: ['bad', removedId],
  })

  assert.equal(set.size, 1)
  assert.equal(set.values()[0].__uuidv7, liveId)
  assert.deepEqual(set.snapshot().tombs, [removedId])
})

test('append assigns uuid, freezes stored entry, and emits delta + snapshot', () => {
  const set = new ORSet()
  const events = listen(set)
  const entry = { name: 'alice' }

  set.append(entry)

  const [stored] = set.values()

  assert.equal(set.size, 1)
  assert.equal(typeof stored.__uuidv7, 'string')
  assert.equal(stored.name, 'alice')
  assert.equal(Object.isFrozen(stored), true)
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 1)
  assert.equal(events.delta[0].items[0].__uuidv7, stored.__uuidv7)
})

test('append with existing live uuid is a no-op and emits nothing', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [stored] = set.values()
  const events = listen(set)

  set.append(stored)

  assert.equal(set.size, 1)
  assert.equal(events.delta.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('append regenerates tombstoned uuid instead of reusing it', () => {
  const set = new ORSet()

  set.append({ name: 'alice' })
  const [removed] = set.values()
  set.remove(removed)

  const events = listen(set)
  set.append({ __uuidv7: removed.__uuidv7, name: 'bob' })

  const [added] = set.values()

  assert.equal(set.size, 1)
  assert.notEqual(added.__uuidv7, removed.__uuidv7)
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 1)
})

test('clear is a no-op for an empty set', () => {
  const set = new ORSet()
  const events = listen(set)

  set.clear()

  assert.equal(set.size, 0)
  assert.equal(events.delta.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('remove invalid uuid is a no-op', () => {
  const set = new ORSet()
  const events = listen(set)

  set.remove({ __uuidv7: 'bad', name: 'x' })

  assert.equal(set.size, 0)
  assert.equal(events.delta.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('remove existing item emits once; repeated remove is a no-op', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [stored] = set.values()
  const events = listen(set)

  set.remove(stored)
  set.remove(stored)

  assert.equal(set.size, 0)
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 1)
  assert.deepEqual(events.delta[0].tombs, [stored.__uuidv7])
})

test('merge applies valid changes, skips invalid uuids, and emits once', () => {
  const removedId = uuidv7()
  const target = new ORSet({
    items: [{ __uuidv7: removedId, name: 'old' }],
    tombs: [],
  })
  const source = new ORSet()
  source.append({ name: 'new' })
  const [live] = source.values()
  const events = listen(target)

  target.merge({
    items: [live, { __uuidv7: 'bad', name: 'invalid' }],
    tombs: [removedId, 'bad'],
  })

  assert.equal(target.size, 1)
  assert.equal(target.has(live), true)
  assert.equal(events.merge.length, 1)
  assert.equal(events.snapshot.length, 1)
  assert.deepEqual(events.merge[0].removals, [removedId])
  assert.equal(events.merge[0].additions[0].__uuidv7, live.__uuidv7)
})

test('merge is silent on no-op snapshots', () => {
  const set = new ORSet()
  const events = listen(set)

  set.merge({
    items: [{ __uuidv7: 'bad', name: 'invalid' }],
    tombs: ['bad'],
  })

  assert.equal(set.size, 0)
  assert.equal(events.merge.length, 0)
  assert.equal(events.snapshot.length, 0)
})
