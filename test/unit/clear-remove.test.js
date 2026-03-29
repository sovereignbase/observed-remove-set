import assert from 'node:assert/strict'
import test from 'node:test'
import { ORSet } from '../../dist/index.js'
import {
  captureEvents,
  createValidUuid,
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
  assert.deepEqual(sortStrings(set.snapshot().tombs), sortStrings(liveIds))
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 1)
  assert.deepEqual(sortStrings(events.delta[0].tombs), sortStrings(liveIds))
  assert.deepEqual(events.delta[0].items, [])
})

test('remove invalid uuid is silent', () => {
  const set = new ORSet()
  const { events } = captureEvents(set)

  set.remove({ __uuidv7: 'bad', name: 'ghost' })

  assert.equal(set.size, 0)
  assert.equal(events.delta.length, 0)
  assert.equal(events.snapshot.length, 0)
})

test('remove live item decrements size and emits delta plus snapshot', () => {
  const set = new ORSet()
  set.append({ name: 'alice' })
  const [live] = set.values()
  const { events } = captureEvents(set)

  set.remove(live)

  assert.equal(set.size, 0)
  assert.equal(set.has(live), false)
  assert.deepEqual(set.snapshot().tombs, [live.__uuidv7])
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 1)
  assert.deepEqual(events.delta[0].tombs, [live.__uuidv7])
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
  assert.equal(events.snapshot.length, 1)
})

test('remove unknown valid uuid records a causal tomb and emits once', () => {
  const set = new ORSet()
  const ghostId = createValidUuid('ghost')
  const { events } = captureEvents(set)

  set.remove({ __uuidv7: ghostId, name: 'ghost' })

  assert.equal(set.size, 0)
  assert.deepEqual(set.values(), [])
  assert.deepEqual(set.snapshot().tombs, [ghostId])
  assert.equal(events.delta.length, 1)
  assert.equal(events.snapshot.length, 1)
  assert.deepEqual(events.delta[0].tombs, [ghostId])
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
