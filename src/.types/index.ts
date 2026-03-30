/** Represents a live value tagged with its UUIDv7 identifier. */
export type ORSetValue<T extends object> = Omit<T, '__uuidv7'> & {
  __uuidv7: string
}

/** Represents the accepted input shape for {@link ORSet.append}. */
export type ORSetAppendInput<T extends object> = Omit<
  ORSetValue<T>,
  '__uuidv7'
> &
  Partial<Pick<ORSetValue<T>, '__uuidv7'>>

/** Represents the internal replica state. */
export type ORSetState<T extends object> = {
  values: Record<string, Readonly<ORSetValue<T>>>
  tombstones: Set<string>
}

/** Represents a full transportable OR-Set snapshot. */
export type ORSetSnapshot<T extends object> = {
  values: Array<Readonly<ORSetValue<T>>>
  tombstones: Array<string>
}

/** Represents the payload emitted by local delta events. */
export type ORSetDelta<T extends object> = {
  values: Array<Readonly<ORSetValue<T>>>
  tombstones: Array<string>
}

/** Represents the payload emitted by merge events. */
export type ORSetMergeResult<T extends object> = {
  removals: Array<string>
  additions: Array<Readonly<ORSetValue<T>>>
}

/** Maps OR-Set event types to their corresponding detail payloads. */
export type ORSetEventMap<T extends object> = {
  snapshot: ORSetSnapshot<T>
  delta: ORSetDelta<T>
  merge: ORSetMergeResult<T>
}

/** Represents a typed OR-Set event listener. */
export type ORSetEventListener<
  T extends object,
  K extends keyof ORSetEventMap<T>,
> =
  | ((event: CustomEvent<ORSetEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<ORSetEventMap<T>[K]>): void }

/** Represents the listener shape accepted by OR-Set event methods. */
export type ORSetEventListenerFor<
  T extends object,
  K extends string,
> = K extends keyof ORSetEventMap<T>
  ? ORSetEventListener<T, K>
  : EventListenerOrEventListenerObject
