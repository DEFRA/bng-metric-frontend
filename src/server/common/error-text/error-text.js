import { readFileSync } from 'node:fs'
import path from 'node:path'

import Joi from 'joi'
import { load } from 'js-yaml'

// Every message a customer can see when the service refuses something lives
// in error-text.yaml, for product, BAs and UCD to review in one place. This
// module reads it once and checks the sections it serves, so a slip in an
// edit fails the tests and the server's start rather than a user's page. The
// drop-out page's section, upload, has a shape of its own, which
// error-file/dropout-copy.js checks.

export const ERROR_TEXT_FILE = path.join(import.meta.dirname, 'error-text.yaml')

/** An entry whose wording is awaiting UCD. */
export const PLACEHOLDER = 'placeholder'

const text = Joi.string().pattern(/\S/)
const code = Joi.string().pattern(/^[A-Z][A-Z0-9_]*$/)

// The error summary and the inline message say different things by design.
const message = Joi.object({
  summary: text.required(),
  inline: text.required()
})

const errorTextSchema = Joi.object({
  upload: Joi.object().required(),
  // Chosen by type, so a slip names the field it is in: "inline is required"
  // rather than "matches none of the allowed types".
  edit: Joi.object()
    .pattern(
      code,
      Joi.alternatives().conditional(Joi.string(), {
        then: Joi.string().valid(PLACEHOLDER),
        otherwise: message
      })
    )
    .required(),
  forms: Joi.object()
    .pattern(Joi.string(), Joi.object().pattern(Joi.string(), message))
    .required()
})

/**
 * Read and check an error text file. Exported so a test can feed it a broken
 * one.
 *
 * @param {string} source - YAML text
 */
export function parseErrorText(source) {
  const { value, error } = errorTextSchema.validate(load(source), {
    abortEarly: false
  })
  if (error) {
    throw new Error(`error-text.yaml is not valid: ${error.message}`)
  }
  return value
}

export const errorText = parseErrorText(readFileSync(ERROR_TEXT_FILE, 'utf8'))

/**
 * The wording for an edit the backend refused with `errorCode`, or null when
 * it has none yet: a placeholder, or no entry.
 *
 * @param {string} errorCode
 * @returns {{ summary: string, inline: string } | null}
 */
export function editErrorText(errorCode) {
  const entry = Object.hasOwn(errorText.edit, errorCode ?? '')
    ? errorText.edit[errorCode]
    : null
  return typeof entry === 'object' ? entry : null
}

/**
 * A form field's validation wording. Throws when the file has none, so a page
 * that names a missing one fails as it loads, not when a user meets it.
 *
 * @param {string} field
 * @param {string} rule
 * @returns {{ summary: string, inline: string }}
 */
export function formErrorText(field, rule) {
  const entry = errorText.forms[field]?.[rule]
  if (!entry) {
    throw new Error(`error-text.yaml has no forms.${field}.${rule}`)
  }
  return entry
}
