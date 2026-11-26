import {
  RETENTION_CREATED,
  RETENTION_ENHANCED,
  RETENTION_RETAINED,
  DEFAULT_INTERVENTION,
  featureRetentionCategory
} from '../../post-intervention-habitat-details/retention.js'

const INTERVENTION_TAB_ORDER = [
  { id: 'retained', label: RETENTION_RETAINED },
  { id: 'enhanced', label: RETENTION_ENHANCED },
  { id: 'created', label: RETENTION_CREATED }
]

function featureMatchesCategory(feature, category) {
  return (
    (featureRetentionCategory(feature) ?? DEFAULT_INTERVENTION) === category
  )
}

function visibleInterventionTabs(features) {
  const list = Array.isArray(features) ? features : []

  return INTERVENTION_TAB_ORDER.filter(({ label }) =>
    list.some((feature) => featureMatchesCategory(feature, label))
  )
}

/**
 * The id of an intervention type's tab, which is also the URL fragment that
 * opens the post-intervention page on that tab.
 *
 * @param {string} category Retained, Enhanced or Created
 * @returns {string | undefined}
 */
function interventionTabId(category) {
  return INTERVENTION_TAB_ORDER.find(({ label }) => label === category)?.id
}

export { featureMatchesCategory, interventionTabId, visibleInterventionTabs }
