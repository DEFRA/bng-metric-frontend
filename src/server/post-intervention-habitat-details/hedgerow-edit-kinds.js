// The edit kinds a hedgerow's post-intervention details page uses: a Created
// hedgerow's (BMD-1049) and an Enhanced one's (BMD-1046), as CREATED_EDIT_KINDS
// in created-area-edit.js lists them.

import {
  loadCreatedHedgerowReference,
  loadEnhancedHedgerowReference
} from './created-edit-reference.js'
import {
  buildCreatedHedgerowViewOnlyViewModel,
  buildEnhancedHedgerowViewOnlyViewModel
} from './enhanced-hedgerow-view-only-view-model.js'
import { formatLengthDisplay } from './view-only-shared.js'
import { formatLengthKm } from '../common/helpers/format-habitat-values.js'
import { formErrorText } from '../common/error-text/error-text.js'

const formError = (field, rule) => Object.freeze(formErrorText(field, rule))

export const CREATED_HEDGEROW_KIND = Object.freeze({
  loadReference: loadCreatedHedgerowReference,
  label: 'Hedgerow',
  optionalReference: true,
  readOnlyTemplate: 'habitat-details/pi-hedgerow-details-enhanced',
  buildBase: buildCreatedHedgerowViewOnlyViewModel,
  formatSize: (feature) => formatLengthDisplay(feature.sizeMetres),
  sizeLabel: 'Length (km)',
  backType: 'hedgerow',
  savePath: 'hedgerows',
  hasBroadHabitat: false,
  hasComment: true,
  habitatTypeError: formError('habitatType', 'invalidHedgerow')
})

// BMD-1046: an Enhanced hedgerow is edited on the Created hedgerow form, with
// the choices limited to the valid enhancements of its baseline. Its size row
// is "Size (kilometres)", the unit on the label, as AC1 and Figma give it. A
// refused enhancement blames the condition, a stored habitat type the list no
// longer offers is kept unchanged (sent as omitted, as a Created watercourse's
// is), and it falls back to BMD-733's read-only page while the backend does
// not serve the hedgerow enhancement reference.
export const ENHANCED_HEDGEROW_KIND = Object.freeze({
  ...CREATED_HEDGEROW_KIND,
  loadReference: (feature) => loadEnhancedHedgerowReference(feature?.baseline),
  label: 'Enhanced hedgerow',
  buildBase: buildEnhancedHedgerowViewOnlyViewModel,
  formatSize: (feature) => formatLengthKm(feature.sizeMetres),
  sizeLabel: 'Size (kilometres)',
  conditionError: formError('condition', 'notValidEnhancement'),
  // Its supporting information is not editable yet (BMD-1190), as an
  // Enhanced area's is not.
  hasComment: false,
  preservesImportedType: true,
  // A kept habitat type shows its stored distinctiveness, difficulty and
  // times, as an Enhanced area's kept choices do.
  showsKeptDisplays: true
})
