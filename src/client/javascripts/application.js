import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  FileUpload,
  Header,
  Radios,
  ServiceNavigation,
  SkipLink
} from 'govuk-frontend'

import { initFileUploadValidation } from './file-upload-validation.js'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(FileUpload)
createAll(Header)
createAll(Radios)
createAll(ServiceNavigation)
createAll(SkipLink)

initFileUploadValidation()
