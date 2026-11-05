import { dropoutCopy } from '../../../server/error-file/dropout-copy.js'

const govukRebrand = true

// The drop-out page's own wording (dropout-copy.yaml), so the page reads it
// however it is rendered.
const dropoutPage = dropoutCopy.page

export { govukRebrand, dropoutPage }
