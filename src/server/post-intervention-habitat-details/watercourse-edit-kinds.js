// The edit kinds a watercourse's post-intervention details page uses: a
// Created watercourse's (BMD-1050) and an Enhanced one's (BMD-1047), as
// CREATED_EDIT_KINDS in created-area-edit.js lists them.

import {
  loadCreatedWatercourseReference,
  loadEnhancedWatercourseReference
} from './created-edit-reference.js'
import { buildCreatedWatercourseViewOnlyViewModel } from './created-watercourse-view-only-view-model.js'
import { buildEnhancedWatercourseViewOnlyViewModel } from './enhanced-watercourse-view-only-view-model.js'
import { formatLengthDisplay } from './view-only-shared.js'
import { formatLengthKm } from '../common/helpers/format-habitat-values.js'
import { formErrorText } from '../common/error-text/error-text.js'

const formError = (field, rule) => Object.freeze(formErrorText(field, rule))

export const CREATED_WATERCOURSE_KIND = Object.freeze({
  loadReference: loadCreatedWatercourseReference,
  label: 'Watercourse',
  optionalReference: true,
  readOnlyTemplate: 'habitat-details/pi-watercourse-details-created',
  buildBase: buildCreatedWatercourseViewOnlyViewModel,
  formatSize: (feature) => formatLengthDisplay(feature.sizeMetres),
  sizeLabel: 'Length (km)',
  backType: 'watercourse',
  savePath: 'watercourses',
  hasBroadHabitat: false,
  hasComment: true,
  hasEncroachments: true,
  restoresLineageAdvance: true,
  habitatTypeError: formError('habitatType', 'invalidWatercourse')
})

// BMD-1047: an Enhanced watercourse is edited on the Created watercourse form,
// with its habitat type and target condition limited to the valid
// enhancements of its baseline. Its encroachments are not limited, so they
// are offered and checked as a Created one's are (hasEncroachments). Its size
// row is "Size (kilometres)", as the ticket's Figma gives it. A refused
// enhancement blames the condition, and it falls back to BMD-735's read-only
// page while the backend does not serve the watercourse enhancement
// reference. Its advance is its own: a Created watercourse's lineage advance
// is not restored for it.
export const ENHANCED_WATERCOURSE_KIND = Object.freeze({
  ...CREATED_WATERCOURSE_KIND,
  loadReference: (feature) =>
    loadEnhancedWatercourseReference(feature?.baseline),
  label: 'Enhanced watercourse',
  readOnlyTemplate: 'habitat-details/pi-watercourse-details-enhanced',
  buildBase: buildEnhancedWatercourseViewOnlyViewModel,
  formatSize: (feature) => formatLengthKm(feature.sizeMetres),
  sizeLabel: 'Size (kilometres)',
  conditionError: formError('condition', 'notValidEnhancement'),
  // hasComment comes from the Created watercourse kind (BMD-1190).
  restoresLineageAdvance: false
})
