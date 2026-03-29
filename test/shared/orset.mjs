import assert from 'node:assert/strict'
import { ORSet } from '../../dist/index.js'

export function captureEvents(set) {
  const events = {
    delta: [],
    snapshot: [],
    merge: [],
  }

  const listeners = {
    delta(event) {
      events.delta.push(event.detail)
    },
    snapshot(event) {
      events.snapshot.push(event.detail)
    },
    merge(event) {
      events.merge.push(event.detail)
    },
  }

  set.addEventListener('delta', listeners.delta)
  set.addEventListener('snapshot', listeners.snapshot)
  set.addEventListener('merge', listeners.merge)

  return { events, listeners }
}

export function assertBadSnapshotError(error) {
  assert.ok(error)
  assert.equal(error.name, 'ORSetError')
  assert.equal(error.code, 'BAD_SNAPSHOT')
  assert.match(error.message, /\{@sovereignbase\/observed-remove-set\}/)
  return true
}

export function createValidUuid(seed = 'seed') {
  const set = new ORSet()
  set.append({ name: seed })
  return set.values()[0].__uuidv7
}

export function sortStrings(values) {
  return [...values].sort()
}

export function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot))
}

export function getORSetErrorConstructor() {
  try {
    new ORSet(null)
  } catch (error) {
    return error.constructor
  }

  throw new Error('Expected ORSet constructor to throw ORSetError')
}
