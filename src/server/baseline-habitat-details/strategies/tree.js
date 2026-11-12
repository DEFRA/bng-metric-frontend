import { treeDetailsFields } from '../../common/helpers/tree-details.js'
import { areaStrategy } from './area.js'
import { buildSelectItems } from './select-items.js'

/** The broad habitat of every individual tree, which an edit cannot change. */
export const INDIVIDUAL_TREES_BROAD_HABITAT = 'Individual trees'

/**
 * The habitat type dropdown for a tree: the Individual trees types the
 * reference data holds, Urban tree and Rural tree, and nothing else, so a tree
 * cannot be made another habitat (BMD-1172). A tree with a type has no blank
 * choice, as the backend refuses a save that clears it; one imported without
 * a type keeps it, so it can still be saved, Incomplete, with a comment.
 *
 * @param {Array<{ name: string, broad: string }>} habitatTypes
 * @param {string | null | undefined} savedType
 */
function treeTypeItems(habitatTypes, savedType) {
  const treeTypes = habitatTypes
    .filter((t) => t.broad === INDIVIDUAL_TREES_BROAD_HABITAT)
    .map((t) => t.name)
  const items = buildSelectItems(treeTypes, savedType, 'Choose habitat type')
  return savedType ? items.filter((item) => item.value !== '') : items
}

/**
 * An individual tree is an area habitat on the details page, with its size
 * class and the number of trees the point stands for besides: the values the
 * surveyor entered, from which its size in hectares comes. Its broad habitat
 * is always Individual trees, shown and sent with the form but not editable,
 * and its habitat type is Urban tree or Rural tree.
 *
 * @type {import('./area.js').Strategy}
 */
export const treeStrategy = {
  ...areaStrategy,
  buildViewModel(tree, reference, ctx) {
    return {
      ...areaStrategy.buildViewModel(tree, reference, ctx),
      ...treeDetailsFields(tree.treeSize, tree.count),
      showTreeRows: true,
      showBroadHabitatRow: false,
      fixedBroadHabitat: INDIVIDUAL_TREES_BROAD_HABITAT,
      habitatTypeOptions: treeTypeItems(reference.habitatTypes, tree.type)
    }
  }
}
