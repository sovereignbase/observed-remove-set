import assert from 'node:assert/strict'
import test from 'node:test'
import { ORSet } from '../../dist/index.js'
import {
  captureEvents,
  createValidUuid,
  readSnapshot,
  sortStrings,
} from '../shared/orset.mjs'

test('clear is silent for an empty set', () => {
  const set = new ORSet()
  const { events } = captureEvents(set)

  set.clear()

  assert.equal(set.size, 0)
  assert.equal(events.delta.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('clear tombstones every live uuid and emits once', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  set.append({ name: 'bob' })
  const liveIds = set.values().map((item) => item.__uuidv7)
  const { events } = captureEvents(set)

  set.clear()

  assert.equal(set.size, 0)
  assert.deepEqual(set.values(), [])
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 0)
  assert.deepEqual(
    sortStrings(readSnapshot(set).tombstones),
    sortStrings(liveIds)
  )
  assert.deepEqual(
    sortStrings(events.delta[0].tombstones),
    sortStrings(liveIds)
  )
  assert.deepEqual(events.delta[0].values, [])
})

test('remove invalid uuid is silent', () => {
  const set = new ORSet()
  const { events } = captureEvents(set)

  set.remove({ __uuidv7: 'bad', name: 'ghost' })

  assert.equal(set.size, 0)
  assert.equal(events.delta.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('remove live uuid string decrements size and emits delta', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [live] = set.values()
  const { events } = captureEvents(set)

  set.remove(live.__uuidv7)

  assert.equal(set.size, 0)
  assert.equal(set.has(live), false)
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 0)
  assert.deepEqual(readSnapshot(set).tombstones, [live.__uuidv7])
  assert.deepEqual(events.delta[0].tombstones, [live.__uuidv7])
})

test('repeated remove after tombstone is silent', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [live] = set.values()
  const { events } = captureEvents(set)

  set.remove(live)
  set.remove(live)

  assert.equal(set.size, 0)
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 0)
})

test('remove unknown valid uuid string records a causal tomb and emits once', () => {
  const set = new ORSet()
  const ghostId = createValidUuid('ghost')
  const { events } = captureEvents(set)

  set.remove(ghostId)

  assert.equal(set.size, 0)
  assert.deepEqual(set.values(), [])
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 0)
  assert.deepEqual(readSnapshot(set).tombstones, [ghostId])
  assert.deepEqual(events.delta[0].tombstones, [ghostId])
})

test('has returns false after clear and after remove', () => {
  const clearSet = new ORSet()
  clearSet.append({ name: 'alice' })
  const [clearLive] = clearSet.values()
  clearSet.clear()

  const removeSet = new ORSet()
  removeSet.append({ name: 'bob' })
  const [removeLive] = removeSet.values()
  removeSet.remove(removeLive)

  assert.equal(clearSet.has(clearLive), false)
  assert.equal(removeSet.has(removeLive), false)
})

test('tombstones exposes the live tomb set for external garbage collection', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [removed] = set.values()

  set.remove(removed)

  const tombstones = set.tombstones()

  assert.equal(tombstones instanceof Set, true)
  assert.equal(tombstones.has(removed.__uuidv7), true)

  tombstones.delete(removed.__uuidv7)

  assert.deepEqual(readSnapshot(set).tombstones, [])

  set.append({ __uuidv7: removed.__uuidv7, name: 'alice-again' })

  assert.equal(set.values()[0].__uuidv7, removed.__uuidv7)
})
