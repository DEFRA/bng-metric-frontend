/** A tree point with no Count stands for one tree, as the Metric reads it. */
const DEFAULT_TREE_COUNT = 1

/**
 * The display values an individual tree's details pages add to an area
 * habitat's: its size class (Small to Very large) and, for a legacy tree, the
 * number of trees the point stands for. Its size in hectares is the tree
 * helper's area for that size class times that number.
 *
 * A BNG Service template tree has no Count: each of its points is one tree,
 * so its pages show no number of trees (BMD-1172). A legacy tree can still
 * stand for several, and its row explains an area that is a multiple of its
 * size class's.
 *
 * @param {unknown} treeSize
 * @param {unknown} count the feature's Count; blank is one tree
 * @param {boolean} serviceTemplate whether the tree's document was uploaded in
 *   the BNG Service template (isServiceTemplateDocument)
 * @returns {{ treeSizeDisplay: string, treeCountDisplay: string, showTreeCountRow: boolean }}
 */
export function treeDetailsFields(treeSize, count, serviceTemplate) {
  const trees =
    typeof count === 'number' && Number.isSafeInteger(count) && count > 0
      ? count
      : DEFAULT_TREE_COUNT
  return {
    treeSizeDisplay:
      typeof treeSize === 'string' && treeSize.trim() !== ''
        ? treeSize.trim()
        : '',
    treeCountDisplay: `${trees}`,
    showTreeCountRow: !serviceTemplate
  }
}

/** The Metric's size classes for an individual tree (guide, Table 15). */
export const TREE_SIZES = Object.freeze([
  'Small',
  'Medium',
  'Large',
  'Very large'
])

/**
 * The Tree size dropdown for a BNG Service template tree whose size class can
 * be edited (BMD-1172): the Metric's size classes, with the saved one chosen
 * whatever its case. A tree saved without a recognisable size class has a
 * blank choice first, which the save leaves out, so the stored size stays.
 *
 * @param {unknown} savedSize
 * @returns {Array<{ value: string, text: string, selected?: boolean }>}
 */
export function treeSizeItems(savedSize) {
  const saved = typeof savedSize === 'string' ? savedSize.trim() : ''
  const chosen = TREE_SIZES.find(
    (size) => size.toLowerCase() === saved.toLowerCase()
  )
  const items = TREE_SIZES.map((size) => ({
    value: size,
    text: size,
    ...(size === chosen ? { selected: true } : {})
  }))
  return chosen ? items : [{ value: '', text: 'Choose tree size' }, ...items]
}
