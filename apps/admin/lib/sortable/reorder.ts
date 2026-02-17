/**
 * Splice-and-insert reorder: remove item at fromIndex, insert at toIndex.
 * Returns a new array. Does NOT mutate the original.
 * Returns the original array reference if indices are equal or out of bounds.
 */
export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;
  const result = [...items];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}
