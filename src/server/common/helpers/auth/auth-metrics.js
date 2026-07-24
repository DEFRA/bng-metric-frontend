/**
 * Custom CloudWatch (EMF) metrics for authentication, emitted via the
 * already-registered `@defra/cdp-metrics` Hapi plugin. The plugin decorates the
 * request with the `Metrics` instance itself, so the call is
 * `request.metrics.counter(...)` — NOT `request.metrics().counter(...)`.
 *
 * Two counters:
 *   - LoginSucceeded — token exchange succeeded AND the user holds an approved
 *     "bng completer" role. No dimensions.
 *   - LoginFailed    — any failed login, tagged with a `reason` dimension:
 *       • 'initiation'     — building/redirecting to the authorize URL threw.
 *       • 'idp-error'      — the identity provider returned an ?error= response.
 *       • 'no-session'     — the callback arrived with no pending login state
 *                            (e.g. the session cookie did not survive the
 *                            round-trip); the user is sent back to /auth/login.
 *       • 'token-exchange' — the OIDC token exchange / callback handling threw.
 *       • 'rbac'           — token exchange succeeded but the user lacks an
 *                            approved role (the RBAC condition was not met).
 *
 * Local dev never reaches CloudWatch because `AWS_EMF_ENVIRONMENT=Local` is set
 * in the dev/test scripts, and every emit is wrapped so a metrics failure can
 * never break the login flow.
 */
export const LOGIN_METRIC = {
  succeeded: 'LoginSucceeded',
  failed: 'LoginFailed'
}

/** Values for the `reason` dimension on LoginFailed. */
export const LOGIN_FAILURE_REASON = {
  initiation: 'initiation',
  idpError: 'idp-error',
  noSession: 'no-session',
  tokenExchange: 'token-exchange',
  rbac: 'rbac'
}

/**
 * Record a successful, authorised login.
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<void>}
 */
export async function recordLoginSuccess(request) {
  try {
    await request.metrics.counter(LOGIN_METRIC.succeeded)
  } catch (error) {
    request.logger?.warn?.(error, 'Failed to record LoginSucceeded metric')
  }
}

/**
 * Record a failed login, tagged with why it failed.
 * @param {import('@hapi/hapi').Request} request
 * @param {string} reason - one of {@link LOGIN_FAILURE_REASON}
 * @returns {Promise<void>}
 */
export async function recordLoginFailure(request, reason) {
  try {
    await request.metrics.counter(LOGIN_METRIC.failed, 1, { reason })
  } catch (error) {
    request.logger?.warn?.(error, 'Failed to record LoginFailed metric')
  }
}
