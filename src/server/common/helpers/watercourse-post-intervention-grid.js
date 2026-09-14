import { RETENTION_RETAINED } from '../../post-intervention-habitat-details/retention.js'
import { formatLabelAndScore, textCell } from './habitat-grid.js'

function proposedValue(feature, key) {
  return feature?.proposed?.[key] ?? feature?.[key]
}

function encroachmentValue(feature, interventionType, key) {
  if (interventionType === RETENTION_RETAINED) {
    return feature?.baseline?.[key] ?? proposedValue(feature, key)
  }

  return proposedValue(feature, key)
}

function encroachmentColumn({
  text,
  valueKey,
  multiplierKey,
  interventionType
}) {
  return {
    text,
    cell: (feature) =>
      textCell(
        formatLabelAndScore(
          encroachmentValue(feature, interventionType, valueKey),
          proposedValue(feature, multiplierKey)
        )
      )
  }
}

function buildWatercourseExtraColumns(interventionType) {
  return [
    encroachmentColumn({
      text: 'Watercourse encroachment',
      valueKey: 'watercourseEncroachment',
      multiplierKey: 'waterEncroachmentMultiplier',
      interventionType
    }),
    encroachmentColumn({
      text: 'Riparian encroachment',
      valueKey: 'riparianEncroachment',
      multiplierKey: 'riparianEncroachmentMultiplier',
      interventionType
    })
  ]
}

export { buildWatercourseExtraColumns }
