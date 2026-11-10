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

// A refusal no one field can put right: shown in the error summary only.
const summaryOnlyMessage = Joi.object({
  summaryOnly: text.required()
})

// A form field's message is either a pair, or one text that the error summary
// and the inline message both show.
const formMessage = Joi.alternatives().conditional(Joi.string(), {
  then: text,
  otherwise: message
})

// A {name} in a message, filled in by the page from a value it knows.
const BRACES = /\{(\w+)\}/g

const errorTextSchema = Joi.object({
  upload: Joi.object().required(),
  // Chosen by type, so a slip names the field it is in: "inline is required"
  // rather than "matches none of the allowed types".
  edit: Joi.object()
    .pattern(
      code,
      Joi.alternatives().conditional(Joi.string(), {
        then: Joi.string().valid(PLACEHOLDER),
        otherwise: Joi.alternatives().conditional(
          Joi.object({ summaryOnly: Joi.exist() }).unknown(),
          { then: summaryOnlyMessage, otherwise: message }
        )
      })
    )
    .required(),
  forms: Joi.object()
    .pattern(Joi.string(), Joi.object().pattern(Joi.string(), formMessage))
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
 * it has none yet: a placeholder, or no entry. A refusal no one field can put
 * right has `summaryOnly` in place of `summary` and `inline`.
 *
 * @param {string} errorCode
 * @returns {{ summary: string, inline: string } | { summaryOnly: string } | null}
 */
export function editErrorText(errorCode) {
  const entry = Object.hasOwn(errorText.edit, errorCode ?? '')
    ? errorText.edit[errorCode]
    : null
  return typeof entry === 'object' ? entry : null
}

/**
 * Fill each {name} in `template` from `values`. Throws when one has no value,
 * so a page that forgets one fails as it loads, not when a user meets it.
 *
 * @param {string} template
 * @param {Record<string, string | number>} values
 * @returns {string}
 */
export function fillErrorText(template, values) {
  return template.replaceAll(BRACES, (_, name) => {
    if (!Object.hasOwn(values, name)) {
      throw new Error(
        `error-text.yaml: no value for {${name}} in "${template}"`
      )
    }
    return `${values[name]}`
  })
}

/**
 * A form field's validation wording, with any {braces} filled in from
 * `values`. Throws when the file has none, so a page that names a missing one
 * fails as it loads, not when a user meets it.
 *
 * @param {string} field
 * @param {string} rule
 * @param {Record<string, string | number>} [values]
 * @returns {{ summary: string, inline: string }}
 */
export function formErrorText(field, rule, values = {}) {
  const entry = errorText.forms[field]?.[rule]
  if (!entry) {
    throw new Error(`error-text.yaml has no forms.${field}.${rule}`)
  }
  const { summary, inline } =
    typeof entry === 'string' ? { summary: entry, inline: entry } : entry
  return {
    summary: fillErrorText(summary, values),
    inline: fillErrorText(inline, values)
  }
}
