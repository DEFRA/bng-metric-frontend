import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  FileUpload,
  Radios,
  ServiceNavigation,
  SkipLink,
  Tabs
} from 'govuk-frontend'

import { initFileUploadValidation } from './file-upload-validation.js'
import { HabitatDetailsSortableTable } from './habitat-details-sortable-table.js'
import { initBaselineHabitatDetails } from './baseline-habitat-details.js'
import { initCreatedAreaDetails } from './created-area-details.js'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(FileUpload)
createAll(Radios)
createAll(ServiceNavigation)
createAll(SkipLink)
createAll(Tabs)
createAll(HabitatDetailsSortableTable)

initFileUploadValidation()
initBaselineHabitatDetails()
initCreatedAreaDetails()
