import { AsyncLocalStorage } from 'node:async_hooks'

const correlationContext = new AsyncLocalStorage()
const SESSION_CORRELATION_CLAIM_NAMES = ['sessionId', 'correlationId', 'sid']
const pluginName = 'session-correlation'

export function getSessionCorrelationId(request) {
  const user = request.auth?.credentials ?? request.yar?.get('auth')?.user

  for (const claimName of SESSION_CORRELATION_CLAIM_NAMES) {
    const value = user?.[claimName]
    if (typeof value === 'string' && value.trim()) {
      return value
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

  if (!correlationId || typeof request.logger?.child !== 'function') {
    return
  }

  request.logger = request.logger.child({
    session: { id: correlationId }
  })
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
