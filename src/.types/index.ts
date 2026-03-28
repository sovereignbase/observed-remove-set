export type ORSetEntry<T> = { __uuidv7: string } & T
export type ORSetState<T> = {
  items: Set<ORSetEntry<T>>
  tombs: Set<string>
}
export type ORSetSnapshot<T> = {
  items: Array<ORSetEntry<T>>
  tombs: Array<string>
}
