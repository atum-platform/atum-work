/**
 * The Work picker rail: Atum's own models first, then the plans this Mac is signed in to, then the
 * plans it is not (each with its Connect state). The order within a group is the one T3 gave.
 */
export function atumPickerRailOrder<T extends { readonly instanceId: string }>(
  entries: ReadonlyArray<T>,
  isConnected: (entry: T) => boolean,
): T[] {
  const rank = (entry: T) =>
    entry.instanceId.startsWith("atum-") ? 0 : isConnected(entry) ? 1 : 2;
  return entries
    .map((entry, index) => ({ entry, index, rank: rank(entry) }))
    .toSorted((left, right) => left.rank - right.rank || left.index - right.index)
    .map(({ entry }) => entry);
}
