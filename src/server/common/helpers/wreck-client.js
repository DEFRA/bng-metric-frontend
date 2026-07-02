import { withTraceId } from '@defra/hapi-tracing'
import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'

const timeoutMs = config.get('backend.timeoutMs')
const tracingHeader = config.get('tracing.header')

const wreckClient = Wreck.defaults({
  timeout: timeoutMs,
  json: true
})

function withTraceOptions(options = {}) {
  return {
    ...options,
    headers: withTraceId(tracingHeader, { ...options.headers })
  }
}

export const wreck = {
  ...wreckClient,
  get: (uri, options) => wreckClient.get(uri, withTraceOptions(options)),
  post: (uri, options) => wreckClient.post(uri, withTraceOptions(options)),
  put: (uri, options) => wreckClient.put(uri, withTraceOptions(options)),
  patch: (uri, options) => wreckClient.patch(uri, withTraceOptions(options)),
  delete: (uri, options) => wreckClient.delete(uri, withTraceOptions(options))
}
