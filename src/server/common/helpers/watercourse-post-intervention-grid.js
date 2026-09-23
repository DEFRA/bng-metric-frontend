import { formatLabelAndScore, textCell } from './habitat-grid.js'
import {
  descriptiveSource,
  sourceValue
} from './post-intervention-habitat-grid.js'

function encroachmentColumn({
  text,
  valueKey,
  multiplierKey,
  interventionType
}) {
  return {
    text,
    cell: (feature) => {
      const source = descriptiveSource(feature, interventionType)
      return textCell(
        formatLabelAndScore(
          sourceValue(feature, source, valueKey),
          sourceValue(feature, source, multiplierKey)
        )
      )
    }
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
