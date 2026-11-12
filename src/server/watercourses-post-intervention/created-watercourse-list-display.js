import { sourceValue } from '../common/helpers/post-intervention-habitat-grid.js'
import { createdListDisplay } from '../common/helpers/created-list-display.js'
import { loadCreatedWatercourseReference } from '../post-intervention-habitat-details/created-edit-reference.js'

// BMD-1050 AC11 Scenario B: a Created watercourse saved Incomplete shows zero
// units, its type's distinctiveness and its saved strategic significance,
// exactly as a Created area does (BMD-1048, the PO ruling of 2026-11-06).
// Display only: the stored project is left unchanged.
export const prepareCreatedWatercourseListDisplay = createdListDisplay({
  layer: 'watercourses',
  label: 'Created watercourse',
  loadReference: () => loadCreatedWatercourseReference(),
  // A watercourse type has no broad habitat.
  findType: (feature, types) =>
    types.find(
      (t) => t.name === sourceValue(feature, feature.proposed, 'type')
    ),
  typeFields: ['distinctiveness', 'distinctivenessScore']
})
