import { createLogger } from '../helpers/logging/logger.js'
import { formErrorText } from './error-text.js'

// Joi words its own messages, starting with the field's name in quotes:
// '"applicant" length must be less than or equal to 500 characters long'.
// None of them is fit to show a customer, so a form's schema names an
// error-text.yaml rule for each check it makes, and joiErrorText keeps any it
// missed off the page.

const logger = createLogger()

// What the page shows for a check whose schema names no rule.
const UNWORDED = formErrorText('common', 'invalid').inline

/**
 * A Joi schema's `.messages()` for a form field: each Joi error type it can
 * raise, mapped to an error-text.yaml rule under forms.<field>, with any
 * {braces} filled in. The field's messages show the same words in the error
 * summary and against the field, so only the inline text is used.
 *
 * @param {string} field
 * @param {Record<string, string | [string, Record<string, string | number>]>} rules
 *   Joi error type to rule, or to [rule, values]
 * @returns {Record<string, string>}
 */
export function joiMessages(field, rules) {
  return Object.fromEntries(
    Object.entries(rules).map(([type, rule]) => {
      const [name, values] = [rule].flat()
      return [type, formErrorText(field, name, values).inline]
    })
  )
}

/**
 * The text to show for one of a failed validation's details: its message,
 * unless that is Joi's own wording, which a schema with no rule for the check
 * leaves. Then the page shows forms.common.invalid, and the gap is logged for
 * a developer to word.
 *
 * @param {{ message: string, type: string, path: Array<string | number>, context?: { label?: string } }} detail
 * @returns {string}
 */
export function joiErrorText(detail) {
  const label = detail.context?.label
  if (label && detail.message.startsWith(`"${label}"`)) {
    logger.warn(
      `No error-text.yaml rule for ${detail.type} on ${detail.path.join('.')}`
    )
    return UNWORDED
  }
  return detail.message
}
