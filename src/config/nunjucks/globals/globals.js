import { commonErrorText } from '../../../server/common/error-text/error-text.js'

const govukRebrand = true

// Every error summary's title, from error-text.yaml.
const errorSummaryTitle = commonErrorText('summaryTitle')

export { errorSummaryTitle, govukRebrand }
