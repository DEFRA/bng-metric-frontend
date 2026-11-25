import { config } from '../../../../config/config.js'

/**
 * The Private Beta allowlist (BMD-1104). While the service is in Private Beta,
 * only the users whose email address is on this list may use it.
 *
 * The list comes from one environment variable, PRIVATE_BETA_ALLOWED_EMAILS, a
 * comma-separated list of email addresses set as a secret in the CDP Portal.
 * When it is unset or empty the filter is off and every user with an approved
 * BNG Completer role can use the service.
 *
 * The list is parsed once, when this module loads, into a Set. It is never
 * parsed again for a request. Neither the list nor a user's email address is
 * ever logged.
 */

export const PRIVATE_BETA_PATH = '/auth/private-beta'

// A loose check, on purpose not RFC 5322: one "@", something before it, and a
// domain with a "." that has something on each side of it.
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

/**
 * Clean an email address for comparison: trim it and change it to lower case.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * Parse the comma-separated allowlist. Empty entries (from a trailing comma,
 * say) are skipped without being counted; an entry that is not a plausible
 * email address is counted as rejected.
 *
 * @param {string | undefined | null} raw
 * @returns {{ enabled: boolean, emails: Set<string>, rejected: number }}
 */
export function parseAllowList(raw) {
  const emails = new Set()
  let rejected = 0

  for (const entry of (raw ?? '').split(',')) {
    const email = normaliseEmail(entry)
    if (!email) {
      continue
    }
    if (PLAUSIBLE_EMAIL.test(email)) {
      emails.add(email)
    } else {
      rejected += 1
    }
  }

  // The filter is on whenever the variable holds anything, even if every entry
  // was rejected: a mistyped secret must deny, not quietly open the service.
  const enabled = (raw ?? '').trim() !== ''
  return { enabled, emails, rejected }
}

const allowList = parseAllowList(config.get('privateBeta.allowedEmails'))

/**
 * Whether the user may use the service while it is in Private Beta. Always true
 * when the filter is off. A user whose token holds no email claim is not on the
 * list.
 *
 * @param {object} user the token claims (request.auth.credentials)
 * @param {{ enabled: boolean, emails: Set<string> }} [list]
 * @returns {boolean}
 */
export function isOnPrivateBetaList(user, list = allowList) {
  if (!list.enabled) {
    return true
  }
  const email = normaliseEmail(user?.email)
  return email !== '' && list.emails.has(email)
}

/**
 * Log, once at start-up, whether the filter is on and how many entries it
 * holds. Never logs the addresses themselves.
 *
 * @param {{ info: Function, warn: Function }} logger
 * @param {{ enabled: boolean, emails: Set<string>, rejected: number }} [list]
 */
export function logPrivateBetaState(logger, list = allowList) {
  if (!list.enabled) {
    logger.info(
      'Private Beta filter is off: PRIVATE_BETA_ALLOWED_EMAILS is not set'
    )
    return
  }
  logger.info(
    `Private Beta filter is on, with ${list.emails.size} entries (${list.rejected} rejected)`
  )
  if (list.rejected > 0) {
    logger.warn(
      `Private Beta filter rejected ${list.rejected} entries that are not email addresses`
    )
  }
}
