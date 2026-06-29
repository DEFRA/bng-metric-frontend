import { AsyncLocalStorage } from 'node:async_hooks'

const correlationContext = new AsyncLocalStorage()
const SESSION_CORRELATION_CLAIM_NAMES = ['sessionId', 'sid', 'cid']

export function getSessionCorrelationId(request) {
  const user = request.yar?.get('auth')?.user

  for (const claimName of SESSION_CORRELATION_CLAIM_NAMES) {
    const value = user?.[claimName]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return null
}

export function getCorrelationId() {
  return correlationContext.getStore()?.correlationId ?? null
}

export const sessionCorrelation = {
  plugin: {
    name: 'session-correlation',
    register(server) {
      server.ext('onPreAuth', (request, h) => {
        correlationContext.enterWith({
          correlationId: getSessionCorrelationId(request)
        })
        return h.continue
      })
    }
  }
}

