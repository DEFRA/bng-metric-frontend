import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  FileUpload,
  Header,
  Radios,
  ServiceNavigation,
  SkipLink,
  Tabs
} from 'govuk-frontend'

import { initFileUploadValidation } from './file-upload-validation.js'
import { initBaselineHabitatDetails } from './baseline-habitat-details.js'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(FileUpload)
createAll(Header)
createAll(Radios)
createAll(ServiceNavigation)
createAll(SkipLink)
createAll(Tabs)

initFileUploadValidation()
initBaselineHabitatDetails()
