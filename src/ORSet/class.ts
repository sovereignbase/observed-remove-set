import { v7 as uuidv7 } from 'uuid'
import type {
  ORSetAppendInput,
  ORSetDelta,
  ORSetEventListenerFor,
  ORSetMergeResult,
  ORSetSnapshot,
  ORSetState,
  ORSetValue,
} from '../.types/index.js'
import { ORSetError } from '../.errors/class.js'
import { isUuidV7 } from './isUuidV7/index.js'
import { hasORSetSnapshotShape } from './hasORSetSnapshotShape/index.js'

/**
 * Represents a UUIDv7-optimized observed-remove set.
 *
 * @typeParam T - The payload shape stored in the set.
 */
export class ORSet<T extends object> {
  private readonly eventTarget = new EventTarget()
  private readonly state: ORSetState<T>
  private _size: number

  /**
   * Creates a new OR-Set, optionally hydrating it from a snapshot.
   *
   * @param snapshot - A snapshot to hydrate from.
   * @throws {ORSetError} Thrown if the snapshot shape is malformed.
   */
  constructor(snapshot?: ORSetSnapshot<T>) {
    this._size = 0
    this.state = { values: {}, tombstones: new Set([]) }
    if (snapshot !== undefined) {
      if (!hasORSetSnapshotShape(snapshot)) {
        throw new ORSetError('BAD_SNAPSHOT', 'Malformed snapshot.')
      }
      for (const tombstone of snapshot.tombstones) {
        if (!isUuidV7(tombstone)) continue
        this.state.tombstones.add(tombstone)
      }
      for (const value of snapshot.values) {
        const v7 = value.__uuidv7
        if (!isUuidV7(v7)) continue
        if (
          !this.state.tombstones.has(v7) &&
          !Object.hasOwn(this.state.values, v7)
        ) {
          this.state.values[v7] = Object.freeze(value)
          this._size++
        }
      }
    }
  }

  /** Returns the number of live values currently visible in the set. */
  get size(): number {
    return this._size
  }

  /**
   * Returns whether a live value exists for the provided identifier.
   *
   * @param value - A stored value or its UUIDv7 identifier.
   */
  has(value: ORSetValue<T> | string): boolean {
    const v7 = typeof value === 'string' ? value : value.__uuidv7
    return Object.hasOwn(this.state.values, v7)
  }

  /**
   * Appends a value to the set.
   *
   * If a valid caller-supplied UUIDv7 identifier is provided and is still
   * available, that identifier is preserved. Otherwise a fresh UUIDv7 is
   * generated.
   *
   * @param value - The value to append.
   */
  append(value: ORSetAppendInput<T>): void {
    const v7 = value.__uuidv7 as string | undefined
    if (isUuidV7(v7) && Object.hasOwn(this.state.values, v7)) return

    const frozenValue = Object.freeze(
      isUuidV7(v7) && !this.state.tombstones.has(v7)
        ? (value as unknown as ORSetValue<T>)
        : ({ ...value, __uuidv7: uuidv7() } as ORSetValue<T>)
    )
    const nextV7 = frozenValue.__uuidv7
    this.state.values[nextV7] = frozenValue
    this._size++
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetDelta<T>>('delta', {
        detail: {
          tombstones: [],
          values: [frozenValue],
        },
      })
    )
  }

  /** Removes every live value from the set and tombstones their identifiers. */
  clear(): void {
    if (this._size === 0) return
    const egressTombstones = []
    for (const v7 of Object.keys(this.state.values)) {
      this.state.tombstones.add(v7)
      delete this.state.values[v7]
      egressTombstones.push(v7)
    }
    this._size = 0
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetDelta<T>>('delta', {
        detail: {
          tombstones: egressTombstones,
          values: [],
        },
      })
    )
  }

  /**
   * Removes a live value from the set.
   *
   * @param value - A stored value or its UUIDv7 identifier.
   */
  remove(value: ORSetValue<T> | string): void {
    const v7 = typeof value === 'string' ? value : value.__uuidv7
    const hadItem = Object.hasOwn(this.state.values, v7)
    if (!hadItem) return
    this.state.tombstones.add(v7)
    delete this.state.values[v7]
    this._size--
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetDelta<T>>('delta', {
        detail: {
          tombstones: [v7],
          values: [],
        },
      })
    )
  }

  /** Returns the current live values in enumeration order. */
  values(): Array<Readonly<ORSetValue<T>>> {
    return Object.values(this.state.values)
  }

  /** Returns the live tombstone set. */
  tombstones(): Set<string> {
    return this.state.tombstones
  }

  /**
   * Merges an ingress snapshot into the local replica.
   *
   * @param ingress - The snapshot to merge.
   * @throws {ORSetError} Thrown if the snapshot shape is malformed.
   */
  merge(ingress: ORSetSnapshot<T>): void {
    const additions: Array<Readonly<ORSetValue<T>>> = []
    const removals: Array<string> = []
    if (!hasORSetSnapshotShape(ingress)) {
      throw new ORSetError('BAD_SNAPSHOT', 'Malformed snapshot.')
    }

    for (const tombstone of ingress.tombstones) {
      if (this.state.tombstones.has(tombstone)) continue
      if (!isUuidV7(tombstone)) continue
      const hadItem = Object.hasOwn(this.state.values, tombstone)
      this.state.tombstones.add(tombstone)
      delete this.state.values[tombstone]
      if (hadItem) this._size--
      removals.push(tombstone)
    }
    for (const value of ingress.values) {
      const v7 = value.__uuidv7
      if (!isUuidV7(v7)) continue
      if (
        !this.state.tombstones.has(v7) &&
        !Object.hasOwn(this.state.values, v7)
      ) {
        this.state.values[v7] = Object.freeze(value)
        this._size++
        additions.push(value)
      }
    }
    if (additions.length === 0 && removals.length === 0) return
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetMergeResult<T>>('merge', {
        detail: {
          additions,
          removals,
        },
      })
    )
  }

  /** Dispatches a snapshot event containing the current replica state. */
  snapshot(): void {
    this.eventTarget.dispatchEvent(
      new CustomEvent<ORSetSnapshot<T>>('snapshot', {
        detail: {
          values: Object.values(this.state.values),
          tombstones: Array.from(this.state.tombstones.values()),
        },
      })
    )
  }

  /**
   * Registers an event listener.
   *
   * @param type - The event type to listen for.
   * @param listener - The listener to register.
   * @param options - Listener registration options.
   */
  addEventListener<K extends string>(
    type: K,
    listener: ORSetEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  /**
   * Removes an event listener.
   *
   * @param type - The event type to stop listening for.
   * @param listener - The listener to remove.
   * @param options - Listener removal options.
   */
  removeEventListener<K extends string>(
    type: K,
    listener: ORSetEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }
}
