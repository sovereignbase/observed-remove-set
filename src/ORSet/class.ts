import { v7 as uuidv7 } from 'uuid'
import { ORSetError } from '../.errors/class.js'
import type { ORSetEntry, ORSetSnapshot, ORSetState } from '../.types/index.js'
import { validateORSetSnapshot } from './validateORSetSnapshot/index.js'

export class ORSet<T> {
  private eventListeners: {
    snapshot: Set<(snapshot: ORSetSnapshot<T>) => void>
    delete: Set<(delta: ORSetSnapshot<T>) => void>
    add: Set<(delta: ORSetSnapshot<T>) => void>
  } = {
    snapshot: new Set(),
    delete: new Set(),
    add: new Set(),
  }
  private state: ORSetState<T>
  public size: number
  /***/
  constructor(snapshot?: ORSetSnapshot<T>) {
    this.state = { items: new Set([]), tombs: new Set([]) }
    if (snapshot) {
      if (validateORSetSnapshot(snapshot)) {
        this.state.tombs = new Set(snapshot.tombs)
        this.state.items = new Set(
          snapshot.items.filter((item) => !this.state.tombs.has(item.__uuidv7))
        )
      }
    }
    this.size = this.state.items.size
  }
  /***/
  add(value: ORSetEntry<T>): void {
    value.__uuidv7 = uuidv7()
    this.state.items.add(value)
    for (const listener of this.eventListeners.add) {
      listener({
        tombs: [],
        items: [value],
      })
    }
  }
  /***/
  has(value: ORSetEntry<T>): boolean {
    return this.state.items.has(value)
  }
  /***/
  clear(): void {
    for (const entry of this.state.items.values()) {
      this.state.tombs.add(entry.__uuidv7)
      this.state.items.delete(entry)
    }
  }
  /***/
  delete(value: ORSetEntry<T>): void {
    this.state.tombs.add(value.__uuidv7)
    this.state.items.delete(value)
    for (const listener of this.eventListeners.delete) {
      listener({
        tombs: [value.__uuidv7],
        items: [],
      })
    }
  }
  /***/
  values() {
    return this.state.items.values()
  }
  /***/
  merge(state: ORSetSnapshot<T>) {
    const valid = validateORSetSnapshot(state)
    if (!valid) return

    for (const tomb of state.tombs) {
      if (typeof tomb !== 'string') continue
      this.state.tombs.add(tomb)
    }

    const seen = new Set<string>()
    const items = new Set<ORSetEntry<T>>()

    for (const entry of this.state.items) {
      if (!this.state.tombs.has(entry.__uuidv7) && !seen.has(entry.__uuidv7)) {
        seen.add(entry.__uuidv7)
        items.add(entry)
      }
    }

    for (const entry of state.items) {
      if (!this.state.tombs.has(entry.__uuidv7) && !seen.has(entry.__uuidv7)) {
        seen.add(entry.__uuidv7)
        items.add(entry)
      }
    }

    this.state.items = items
    this.size = items.size
  }
  /***/
  addEventListener() {}
  /***/
  removeEventListener() {}
  /***/
  private remove() {}
  /***/
  private append() {}
  /***/
}
