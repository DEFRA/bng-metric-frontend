import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'
import { signUserContext } from '../helpers/user-context/sign.js'

const backendUrl = config.get('backend').url
const signOpts = {
  rootSecret: config.get('userContext.rootSecret'),
  periodSeconds: config.get('userContext.rotationPeriodSeconds'),
  tokenTtlSeconds: config.get('userContext.tokenTtlSeconds')
}

const HEADER_NAME = 'x-user-context'

function buildHeaders(request, extraHeaders) {
  const credentials = request?.auth?.credentials
  const userId = credentials?.sub
  const sid = request?.yar?.id

  const headers = { ...extraHeaders }

  if (userId && sid) {
    headers[HEADER_NAME] = signUserContext(userId, sid, signOpts)
  }

  return headers
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return `${backendUrl}${path.startsWith('/') ? '' : '/'}${path}`
}

function withSignedHeaders(request, opts = {}) {
  return {
    ...opts,
    headers: buildHeaders(request, opts.headers)
  }
}

export function backendClient(request) {
  return {
    get: (path, opts = {}) => Wreck.get(buildUrl(path), withSignedHeaders(request, opts)),
    post: (path, opts = {}) =>
      Wreck.post(buildUrl(path), withSignedHeaders(request, opts)),
    put: (path, opts = {}) =>
      Wreck.put(buildUrl(path), withSignedHeaders(request, opts)),
    delete: (path, opts = {}) =>
      Wreck.delete(buildUrl(path), withSignedHeaders(request, opts))
  }
}
