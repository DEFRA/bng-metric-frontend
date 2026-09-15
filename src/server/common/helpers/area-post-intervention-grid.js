import { BROAD_HABITAT_HEADER } from './baseline-habitat-grid.js'
import { textCell } from './habitat-grid.js'
import { proposedValue } from './post-intervention-habitat-grid.js'

// Unlike baseline features (broadType is a flat field), post-intervention
// area habitats carry broadType nested under `proposed` — see the backend's
// enrich-post-intervention-area-habitat.js. proposedValue falls back to the
// flat field so a retained feature copied straight from baseline still reads.
const POST_INTERVENTION_BROAD_HABITAT_COLUMN = {
  text: BROAD_HABITAT_HEADER,
  cell: (feature) => textCell(proposedValue(feature, 'broadType'))
}

function buildAreaLeadingExtraColumns() {
  return [POST_INTERVENTION_BROAD_HABITAT_COLUMN]
}

export { buildAreaLeadingExtraColumns }
