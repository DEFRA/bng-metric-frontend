/**
 * The display value an individual tree's details pages add to an area
 * habitat's: its size class (Small to Very large), from which its size in
 * hectares comes. Each tree point stands for one tree, so the pages do not
 * show a number of trees.
 *
 * @param {unknown} treeSize
 * @returns {{ treeSizeDisplay: string }}
 */
export function treeDetailsFields(treeSize) {
  return {
    treeSizeDisplay:
      typeof treeSize === 'string' && treeSize.trim() !== ''
        ? treeSize.trim()
        : ''
  }
}
