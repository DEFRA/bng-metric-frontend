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

/** @type {import('./area.js').Strategy} */
export const verticalStrategy = {
  loadReference,
  // The area habitat page: the size the surveyor typed in, in hectares.
  buildViewModel: areaStrategy.buildViewModel,
  payloadSchema: areaStrategy.payloadSchema
}
