/** A tree point with no Count stands for one tree, as the Metric reads it. */
const DEFAULT_TREE_COUNT = 1

/**
 * The display values an individual tree's details pages add to an area
 * habitat's: its size class (Small to Very large) and the number of trees
 * the point stands for. Its size in hectares is the tree helper's area for
 * that size class times that number.
 *
 * @param {unknown} treeSize
 * @param {unknown} count the feature's Count; blank is one tree
 * @returns {{ treeSizeDisplay: string, treeCountDisplay: string }}
 */
export function treeDetailsFields(treeSize, count) {
  const trees =
    typeof count === 'number' && Number.isSafeInteger(count) && count > 0
      ? count
      : DEFAULT_TREE_COUNT
  return {
    treeSizeDisplay:
      typeof treeSize === 'string' && treeSize.trim() !== ''
        ? treeSize.trim()
        : '',
    treeCountDisplay: `${trees}`
  }
}
