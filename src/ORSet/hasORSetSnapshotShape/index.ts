/** Returns whether a value has the top-level shape of an OR-Set snapshot. */
export function hasORSetSnapshotShape<T>(ingress: T): boolean {
  if (ingress && typeof ingress === 'object') {
    const { values, tombstones } = ingress as Record<string, any>
    return (
      values && Array.isArray(values) && tombstones && Array.isArray(tombstones)
    )
  }
  return false
}
