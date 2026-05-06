import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'

const timeoutMs = config.get('backend.timeoutMs')

export const wreck = Wreck.defaults({
  timeout: timeoutMs,
  json: true
})
