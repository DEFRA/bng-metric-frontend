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

import { SortableTable } from '@ministryofjustice/frontend'

import { initFileUploadValidation } from './file-upload-validation.js'
import { initBaselineHabitatDetails } from './baseline-habitat-details.js'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(FileUpload)
createAll(Radios)
createAll(ServiceNavigation)
createAll(SkipLink)
createAll(Tabs)
createAll(SortableTable)

initFileUploadValidation()
initBaselineHabitatDetails()
