import { v7 as uuidv7, version as uuidVersion } from 'uuid'
import type {
  ORSetEntry,
  ORSetMergeResult,
  ORSetSnapshot,
  ORSetState,
} from '../.types/index.js'
import { validateORSetSnapshot } from './validateORSetSnapshot/index.js'

export class ORSet<T> {
  private readonly eventTarget = new EventTarget()
  private state: ORSetState<T>
  public size: number
  /***/
  constructor(snapshot?: ORSetSnapshot<T>) {
    this.size = 0
    this.state = { items: {}, tombs: new Set([]) }
    if (snapshot) {
      if (validateORSetSnapshot(snapshot)) {
        this.state.tombs = new Set(snapshot.tombs)
        for (const item of snapshot.items) {
          const v7 = item.__uuidv7
          if (!this.state.tombs.has(v7)) {
            this.state.items[v7] = Object.freeze(item)
            this.size++
          }
        }
      }
    }
  }
  /***/
  has(value: ORSetEntry<T>): boolean {
    return Object.hasOwn(this.state.items, value.__uuidv7)
  }
  /***/
  append(entry: ORSetEntry<T>): void {
    const v7 = uuidv7()
    entry.__uuidv7 = v7
    this.state.items[v7] = entry
    this.eventTarget.dispatchEvent(
      new CustomEvent('delta', {
        detail: {
          tombs: [],
          items: [entry],
        },
      })
    )
  }
  /***/
  clear(): void {
    const egressTombs = []
    for (const v7 of Object.keys(this.state.items)) {
      this.state.tombs.add(v7)
      delete this.state.items[v7]
      egressTombs.push(v7)
    }
    this.eventTarget.dispatchEvent(
      new CustomEvent('delta', {
        detail: {
          tombs: egressTombs,
          items: [],
        },
      })
    )
  }
  /***/
  remove(entry: ORSetEntry<T>): void {
    const v7 = entry.__uuidv7
    this.state.tombs.add(v7)
    delete this.state.items[v7]
    this.eventTarget.dispatchEvent(
      new CustomEvent('delta', {
        detail: {
          tombs: [v7],
          items: [],
        },
      })
    )
  }
  /***/
  values(): Array<Readonly<ORSetEntry<T>>> {
    return Object.values(this.state.items)
  }
  /***/
  merge(ingress: ORSetSnapshot<T>) {
    const additions: Array<Readonly<ORSetEntry<T>>> = []
    const removals: Array<string> = []
    const valid = validateORSetSnapshot(ingress)
    if (!valid) return

    for (const tomb of ingress.tombs) {
      if (this.state.tombs.has(tomb)) continue
      if (typeof tomb !== 'string' || uuidVersion(tomb) !== 7) continue
      this.state.tombs.add(tomb)
      delete this.state.items[tomb]
      removals.push(tomb)
    }
    for (const entry of ingress.items) {
      const v7 = entry.__uuidv7
      if (!this.state.tombs.has(v7) && !Object.hasOwn(this.state.items, v7)) {
        this.state.items[v7] = entry
        additions.push(entry)
      }
    }
    this.eventTarget.dispatchEvent(
      new CustomEvent('merge', {
        detail: {
          additions,
          removals,
        },
      })
    )
  }
  /***/
  snapshot(): ORSetSnapshot<T> {
    return {
      items: Object.values(this.state.items),
      tombs: Array.from(this.state.tombs.values()),
    }
  }
  /***/
  addEventListener(
    type: 'snapshot' | 'delta' | 'merge',
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ) {
    this.eventTarget.addEventListener(type, listener, options)
  }
  /***/
  removeEventListener(
    type: 'snapshot' | 'delta' | 'merge',
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ) {
    this.eventTarget.removeEventListener(type, listener, options)
  }
}

new ORSet().addEventListener('delta', (ev) => {})
