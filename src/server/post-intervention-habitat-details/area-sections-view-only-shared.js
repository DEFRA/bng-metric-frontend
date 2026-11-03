import { formatAreaSize } from '../common/helpers/format-habitat-values.js'
import {
  isVerticalHabitat,
  VERTICAL_SIZE_LABEL
} from '../common/helpers/vertical-habitats.js'
import { AREAS_TAB_ANCHOR } from './constants.js'
import {
  buildSectionsViewOnlyBaseFields,
  buildSharedPiViewOnlyFields,
  EMPTY_PLACEHOLDER
} from './view-only-shared.js'

/**
 * Shared two-section display fields for Created and Enhanced area habitats.
 * Heading uses the parcel ref; time/difficulty rows come from `proposed`.
 *
 * @param {object} feature the raw feature from the PI feature endpoint
 * @param {{ projectId: string, projectName: string, baselineFeatureId: string|null }} ctx
 * @returns {object}
 */
export function buildAreaSectionsViewOnlyFields(
  feature,
  { projectId, projectName, baselineFeatureId }
) {
  const proposed = feature.proposed ?? {}
  const shared = buildSharedPiViewOnlyFields(feature, {
    projectId,
    projectName,
    baselineFeatureId,
    listTabAnchor: AREAS_TAB_ANCHOR
  })

  return {
    ...buildSectionsViewOnlyBaseFields(feature, shared, proposed),
    // In hectares, or a vertical area habitat's in square metres.
    sizeDisplay: formatAreaSize(feature.sizeSquareMetres, feature),
    // The template labels any other size "Area".
    ...(isVerticalHabitat(feature) && { sizeLabel: VERTICAL_SIZE_LABEL }),
    broadHabitatDisplay: proposed.broadType ?? EMPTY_PLACEHOLDER,
    habitatTypeDisplay: proposed.type ?? EMPTY_PLACEHOLDER
  }
}
