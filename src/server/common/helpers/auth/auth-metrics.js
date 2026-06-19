/**
 * Custom CloudWatch (EMF) metrics for authentication, emitted via the
 * already-registered `@defra/cdp-metrics` Hapi plugin (`request.metrics()`).
 *
 * Scope is authentication only: a successful OIDC callback and the two
 * authentication failure points (login initiation + callback). Role/authorisation
 * denials are deliberately not counted here.
 *
 * Local dev never reaches CloudWatch because `AWS_EMF_ENVIRONMENT=Local` is set
 * in the dev/test scripts, and every emit is wrapped so a metrics failure can
 * never break the login flow.
 */
export const LOGIN_METRIC = {
  succeeded: 'LoginSucceeded',
  failed: 'LoginFailed'
}

/** Emitted when the best-effort backend session persist fails (login still succeeds). */
export const SESSION_PERSIST_FAILED_METRIC = 'BackendSessionPersistFailed'

/** Values for the `reason` dimension on LoginFailed. */
export const LOGIN_FAILURE_REASON = {
  initiation: 'initiation',
  callback: 'callback'
}

/**
 * Record a successful login (OIDC callback succeeded).
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<void>}
 */
export async function recordLoginSuccess(request) {
  try {
    await request.metrics().counter(LOGIN_METRIC.succeeded)
  } catch (error) {
    request.logger?.warn?.(error, 'Failed to record LoginSucceeded metric')
  }
}

/**
 * Record a failed login attempt.
 * @param {import('@hapi/hapi').Request} request
 * @param {string} reason - one of {@link LOGIN_FAILURE_REASON}
 * @returns {Promise<void>}
 */
export async function recordLoginFailure(request, reason) {
  try {
    await request.metrics().counter(LOGIN_METRIC.failed, 1, { reason })
  } catch (error) {
    request.logger?.warn?.(error, 'Failed to record LoginFailed metric')
  }
}

/**
 * Record a failed best-effort backend session persist (login itself succeeded).
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<void>}
 */
export async function recordSessionPersistFailure(request) {
  try {
    await request.metrics().counter(SESSION_PERSIST_FAILED_METRIC)
  } catch (error) {
    request.logger?.warn?.(
      error,
      'Failed to record BackendSessionPersistFailed metric'
    )
  }
}
