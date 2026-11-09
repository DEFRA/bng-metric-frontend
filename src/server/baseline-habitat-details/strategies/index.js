import Boom from '@hapi/boom'

import { areaStrategy } from './area.js'
import { hedgerowStrategy } from './hedgerow.js'
import { treeStrategy } from './tree.js'
import { verticalStrategy } from './vertical.js'
import { watercourseStrategy } from './watercourse.js'

const STRATEGIES = {
  habitat: areaStrategy,
  // Individual trees are an area habitat on the details page too, with their
  // size class and number of trees.
  tree: treeStrategy,
  // A vertical area habitat too, sized in square metres.
  verticalHabitat: verticalStrategy,
  hedgerow: hedgerowStrategy,
  watercourse: watercourseStrategy
}

/**
 * Pick the strategy module for a feature type returned by the backend's
 * unified feature endpoint. The data is the source of truth — callers do not
 * pass a type discriminator on the URL; the backend reports the type and
 * this lookup chooses how the page renders and validates.
 *
 * @param {string} type
 * @returns {import('./area.js').Strategy}
 */
export function getStrategy(type) {
  const strategy = STRATEGIES[type]
  if (!strategy) {
    throw Boom.badImplementation(`Unsupported feature type: ${type}`)
  }
  return strategy
}
