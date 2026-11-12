import { sourceValue } from '../common/helpers/post-intervention-habitat-grid.js'
import { createdListDisplay } from '../common/helpers/created-list-display.js'
import { loadCreatedAreaReference } from '../post-intervention-habitat-details/created-edit-reference.js'

// Complete unit calculations are not needed to display independently known attributes.
// Project data and calculation status remain unchanged; this is a display-only projection.
// Only area parcels (`habitats`) are projected: Created area editing and
// /reference/area-creation cover the `habitat` feature type, not green walls
// (`verticalHabitats`) or individual trees.
export const prepareCreatedAreaListDisplay = createdListDisplay({
  layer: 'habitats',
  label: 'Created area',
  loadReference: () => loadCreatedAreaReference(),
  // An area habitat type is named within its broad habitat.
  findType: (feature, types) =>
    types.find(
      (t) =>
        t.name === sourceValue(feature, feature.proposed, 'type') &&
        t.broad === sourceValue(feature, feature.proposed, 'broadType')
    ),
  typeFields: ['distinctiveness', 'distinctivenessScore']
})
