/**
 * Vertical area habitats: green walls and intertidal hard structures, drawn
 * in the BNG Service template as a line along the structure's base. They are
 * area habitats in every respect but their size, which is the face area the
 * surveyor estimated on site, in square metres, and which the pages show in
 * square metres, as it was entered, rather than in hectares.
 */

/** The backend's feature-type discriminator for a vertical area habitat. */
export const VERTICAL_HABITAT_TYPE = 'verticalHabitat'

/**
 * The habitats the Statutory Metric counts by their vertical area, which the
 * template's Vertical Area Habitats layers offer, and so the only choices on a
 * vertical area habitat's details page. The backend holds the same list
 * (src/validation/reference/vertical-habitats.js) and refuses any other.
 */
const URBAN = 'Urban'
const INTERTIDAL_HARD_STRUCTURES = 'Intertidal hard structures'

export const VERTICAL_HABITATS = Object.freeze([
  Object.freeze({ broad: URBAN, name: 'Facade-bound green wall' }),
  Object.freeze({ broad: URBAN, name: 'Ground based green wall' }),
  Object.freeze({
    broad: INTERTIDAL_HARD_STRUCTURES,
    name: 'Artificial hard structures'
  }),
  Object.freeze({
    broad: INTERTIDAL_HARD_STRUCTURES,
    name: 'Artificial features of hard structures'
  }),
  Object.freeze({
    broad: INTERTIDAL_HARD_STRUCTURES,
    name: 'Artificial hard structures with integrated greening of grey infrastructure (IGGI)'
  })
])

/**
 * A layer's vertical area habitats, each marked so a list page can show its
 * size in square metres beside the area habitats' hectares.
 *
 * @param {object[] | undefined} features
 * @returns {object[]}
 */
export function asVerticalHabitats(features) {
  return (features ?? []).map((feature) => ({
    ...feature,
    isVerticalHabitat: true
  }))
}

/**
 * @param {object | undefined} feature
 * @returns {boolean}
 */
export function isVerticalHabitat(feature) {
  return feature?.isVerticalHabitat === true
}
