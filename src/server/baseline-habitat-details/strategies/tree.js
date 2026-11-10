import { treeDetailsFields } from '../../common/helpers/tree-details.js'
import { areaStrategy } from './area.js'

/**
 * An individual tree is an area habitat on the details page, with its size
 * class and the number of trees the point stands for besides: the values the
 * surveyor entered, from which its size in hectares comes.
 *
 * @type {import('./area.js').Strategy}
 */
export const treeStrategy = {
  ...areaStrategy,
  buildViewModel(tree, reference, ctx) {
    return {
      ...areaStrategy.buildViewModel(tree, reference, ctx),
      ...treeDetailsFields(tree.treeSize, tree.count),
      showTreeRows: true
    }
  }
}
