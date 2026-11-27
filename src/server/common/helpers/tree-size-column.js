import { TREE_SIZES } from './tree-details.js'
import { textCell } from './habitat-grid.js'

const TREE_SIZE_HEADER = 'Tree size'
const INDIVIDUAL_TREES_BROAD_HABITAT = 'Individual trees'

/**
 * A feature's size class (Small to Very large), or '' for an area habitat.
 * A baseline tree holds it flat; a post-intervention tree on its proposed
 * side, which a Retained or Enhanced tree copies from its baseline tree, so
 * the proposed side is read first and the flat field is the fallback.
 *
 * @param {object} feature
 * @returns {string}
 */
function treeSizeOf(feature) {
  const size = feature?.proposed?.treeSize ?? feature?.treeSize
  return typeof size === 'string' ? size.trim() : ''
}

function isTree(feature) {
  return (
    treeSizeOf(feature) !== '' ||
    (feature?.proposed?.broadType ?? feature?.broadType) ===
      INDIVIDUAL_TREES_BROAD_HABITAT
  )
}

// The sortable table would otherwise order the size classes alphabetically.
function sizeRank(size) {
  const rank = TREE_SIZES.findIndex(
    (candidate) => candidate.toLowerCase() === size.toLowerCase()
  )
  return rank === -1 ? null : rank
}

function treeSizeCell(feature) {
  const size = treeSizeOf(feature)
  const cell = textCell(size)
  const rank = size ? sizeRank(size) : null
  if (rank !== null) {
    cell.attributes = { 'data-sort-value': rank }
  }
  return cell
}

/**
 * The Tree size column of the area habitat grids: an individual tree's size
 * class, the one value a tree has that other area habitats do not, and from
 * which its size in hectares comes (BMD-1172). Shown only on a table with a
 * tree in it, so a project without trees keeps its grid as it was; an area
 * habitat's row on a table with trees leaves the cell blank.
 */
const TREE_SIZE_COLUMN = {
  text: TREE_SIZE_HEADER,
  showWhen: (features) => features.some(isTree),
  cell: treeSizeCell
}

export { TREE_SIZE_COLUMN, TREE_SIZE_HEADER }
