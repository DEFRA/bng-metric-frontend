import {
  RETENTION_CREATED,
  RETENTION_ENHANCED,
  RETENTION_RETAINED,
  interventionDisplay
} from '../../post-intervention-habitat-details/retention.js'

const INTERVENTION_TAB_ORDER = [
  { id: 'retained', label: RETENTION_RETAINED },
  { id: 'enhanced', label: RETENTION_ENHANCED },
  { id: 'created', label: RETENTION_CREATED }
]

function featureMatchesCategory(feature, category) {
  return interventionDisplay(feature?.retentionCategory) === category
}

function visibleInterventionTabs(features) {
  const list = Array.isArray(features) ? features : []

  return INTERVENTION_TAB_ORDER.filter(({ label }) =>
    list.some((feature) => featureMatchesCategory(feature, label))
  )
}

export { featureMatchesCategory, visibleInterventionTabs }
