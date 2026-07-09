import { AsyncLocalStorage } from 'node:async_hooks'

import { sessionCorrelationIdSymbol } from './session-correlation-id-symbol.js'

const correlationContext = new AsyncLocalStorage()
const SESSION_CORRELATION_CLAIM_NAMES = ['sessionId', 'correlationId', 'sid']
const pluginName = 'session-correlation'

export function getSessionCorrelationId(request) {
  const claimSources = [
    request.auth?.credentials,
    request.yar?.get('auth')?.user
  ]

  for (const claimName of SESSION_CORRELATION_CLAIM_NAMES) {
    for (const claims of claimSources) {
      const value = claims?.[claimName]
      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }
  }

  return null
}

export function getCorrelationId() {
  return correlationContext.getStore()?.get('correlationId') ?? null
}

function setCorrelationId(correlationId) {
  correlationContext.getStore()?.set('correlationId', correlationId)
}

function wrapCycle(request, cycle, store) {
  const requestCycle = request[cycle]?.bind(request)
  if (typeof requestCycle === 'function') {
    request[cycle] = () => correlationContext.run(store, requestCycle)
  }
}

function bindSessionCorrelationId(request) {
  const correlationId = getSessionCorrelationId(request)
  setCorrelationId(correlationId)

  request.plugins ??= {}
  request.plugins[pluginName] = { correlationId }

  if (correlationId && request.logger) {
    // hapi-pino response logs run outside the ALS context. Store the id on a
    // symbol so logger-options.js can prefix the message without emitting a
    // structured session.id field that CDP may strip.
    request.logger[sessionCorrelationIdSymbol] = correlationId
  }
}

export const sessionCorrelation = {
  plugin: {
    name: pluginName,
    register(server) {
      server.ext('onRequest', (request, h) => {
        const store = new Map()
        wrapCycle(request, '_lifecycle', store)
        wrapCycle(request, '_postCycle', store)

        return h.continue
      })

      server.ext('onPostAuth', (request, h) => {
        bindSessionCorrelationId(request)
        return h.continue
      })
    }
  }
}
