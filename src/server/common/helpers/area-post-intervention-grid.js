import { BROAD_HABITAT_HEADER } from './baseline-habitat-grid.js'
import { textCell } from './habitat-grid.js'
import {
  descriptiveSource,
  sourceValue
} from './post-intervention-habitat-grid.js'

// Broad habitat follows the same source rule as habitat type/distinctiveness/
// condition: retained habitats read from baseline (their proposed record
// isn't meaningful), everything else reads from proposed, falling back to
// the flat field for a retained feature copied straight from baseline.
function buildAreaLeadingExtraColumns(interventionType) {
  return [
    {
      text: BROAD_HABITAT_HEADER,
      cell: (feature) => {
        const source = descriptiveSource(feature, interventionType)
        return textCell(sourceValue(feature, source, 'broadType'))
      }
    }
  ]
}

export { buildAreaLeadingExtraColumns }
