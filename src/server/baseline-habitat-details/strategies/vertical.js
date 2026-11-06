import { formatVerticalArea } from '../../common/helpers/format-habitat-values.js'
import { VERTICAL_HABITATS } from '../../common/helpers/vertical-habitats.js'
import { areaStrategy } from './area.js'

const isVerticalChoice = (habitatType) =>
  VERTICAL_HABITATS.some(
    ({ broad, name }) =>
      broad === habitatType.broad && name === habitatType.name
  )

/**
 * The area habitat reference, narrowed to the habitats the Metric counts by
 * vertical area: a green wall stays a vertical area habitat when edited.
 */
async function loadReference(habitat) {
  const reference = await areaStrategy.loadReference(habitat)
  const habitatTypes = reference.habitatTypes.filter(isVerticalChoice)
  return {
    ...reference,
    habitatTypes,
    broadHabitats: reference.broadHabitats.filter((broad) =>
      habitatTypes.some((habitatType) => habitatType.broad === broad)
    )
  }
}

/**
 * The area habitat page, with the size the surveyor typed in, in hectares,
 * and in square metres too, rather than an area measured from the map.
 */
function buildViewModel(habitat, reference, ctx) {
  return {
    ...areaStrategy.buildViewModel(habitat, reference, ctx),
    sizeDisplay: formatVerticalArea(habitat.sizeSquareMetres)
  }
}

/** @type {import('./area.js').Strategy} */
export const verticalStrategy = {
  loadReference,
  buildViewModel,
  payloadSchema: areaStrategy.payloadSchema
}
