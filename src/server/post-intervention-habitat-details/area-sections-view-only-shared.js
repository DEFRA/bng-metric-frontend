import { formatAreaHectares } from '../common/helpers/format-habitat-values.js'
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
    sizeDisplay: formatAreaHectares(feature.sizeSquareMetres),
    broadHabitatDisplay: proposed.broadType ?? EMPTY_PLACEHOLDER,
    habitatTypeDisplay: proposed.type ?? EMPTY_PLACEHOLDER
  }
}
