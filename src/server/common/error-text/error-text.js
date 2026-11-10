import { readFileSync } from 'node:fs'
import path from 'node:path'

import Joi from 'joi'
import { load } from 'js-yaml'

import { splitLink } from './links.js'
import {
  WORDING,
  logErrorTextWarnings,
  requiredWhenWorded,
  wordingField
} from './wording.js'

// Every message a customer can see when the service refuses something lives
// in error-text.yaml, for product, BAs and UCD to review in one place. This
// module reads it once and checks the sections it serves, so a slip in an
// edit fails the tests and the server's start rather than a user's page. The
// drop-out page's section, upload, has a shape of its own, which
// error-file/dropout-copy.js checks.

export const ERROR_TEXT_FILE = path.join(import.meta.dirname, 'error-text.yaml')

const text = Joi.string().pattern(/\S/)
const code = Joi.string().pattern(/^[A-Z][A-Z0-9_]*$/)

// The error summary and the inline message say different things by design.
// An entry with no wording yet has neither.
const message = Joi.object({
  wording: wordingField,
  summary: requiredWhenWorded(text),
  inline: requiredWhenWorded(text)
}).and('summary', 'inline')

// A form field's message is one text that the error summary and the inline
// message both show, either alone or as `text` beside a `wording` field, or a
// pair. One with no wording yet shows common.unworded.
const formMessage = Joi.alternatives().conditional(Joi.string(), {
  then: text,
  otherwise: Joi.object({
    wording: wordingField,
    text,
    summary: text,
    inline: text
  })
    .and('summary', 'inline')
    .oxor('text', 'summary')
    .when(Joi.object({ wording: Joi.valid(WORDING.INTERIM) }).unknown(), {
      then: Joi.object().or('text', 'summary')
    })
})

// A {name} in a message, filled in by the page from a value it knows.
const BRACES = /\{(\w+)\}/g

/** Where a page's [link text](target) can go. */
export const PAGE_LINK_TARGETS = Object.freeze({ home: '/' })

// The pages show the words as text, so markup would show as typed.
const plainText = text.pattern(/[<>]/, { invert: true, name: 'no HTML' })

const pageLine = plainText.custom((line, helpers) => {
  const { target } = splitLink(line)
  return target === undefined || Object.hasOwn(PAGE_LINK_TARGETS, target)
    ? line
    : helpers.message(`links to "${target}", which is not a page link target`)
})

// Common text is what other entries fall back to, so it always has words:
// alone, or as `text` beside a `wording` field.
const commonText = Joi.alternatives().conditional(Joi.string(), {
  then: plainText,
  otherwise: Joi.object({ wording: wordingField, text: plainText.required() })
})

const errorTextSchema = Joi.object({
  common: Joi.object({
    summaryTitle: commonText.required(),
    unworded: commonText.required()
  }).required(),
  upload: Joi.object().required(),
  edit: Joi.object().pattern(code, message).required(),
  forms: Joi.object()
    .pattern(Joi.string(), Joi.object().pattern(Joi.string(), formMessage))
    .required(),
  pages: Joi.object()
    .pattern(
      Joi.string(),
      Joi.object({
        wording: wordingField,
        title: plainText,
        body: Joi.array().items(pageLine).min(1)
      }).or('title', 'body')
    )
    .required()
})

/**
 * Read and check an error text file. Exported so a test can feed it a broken
 * one.
 *
 * @param {string} source - YAML text
 */
export function parseErrorText(source) {
  const { value, error, warning } = errorTextSchema.validate(load(source), {
    abortEarly: false
  })
  if (error) {
    throw new Error(`error-text.yaml is not valid: ${error.message}`)
  }
  logErrorTextWarnings(warning)
  return value
}

/**
 * The words of an entry given as words alone, or as `text` beside a
 * `wording` field.
 *
 * @param {string | { text?: string }} entry
 */
function wordsOf(entry) {
  return typeof entry === 'string' ? entry : entry.text
}

export const errorText = parseErrorText(readFileSync(ERROR_TEXT_FILE, 'utf8'))

/**
 * The wording for an edit the backend refused with `errorCode`, or null when
 * it has none yet: an entry with no words, or no entry.
 *
 * @param {string} errorCode
 * @returns {{ summary: string, inline: string } | null}
 */
export function editErrorText(errorCode) {
  const entry = Object.hasOwn(errorText.edit, errorCode ?? '')
    ? errorText.edit[errorCode]
    : null
  return entry?.summary
    ? { summary: entry.summary, inline: entry.inline }
    : null
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
 * A form rule's summary and inline wording: the same words for both when it
 * has one text, and common.unworded when it has no wording yet.
 *
 * @param {string | { text?: string, summary?: string, inline?: string }} entry
 */
function formWords(entry) {
  if (typeof entry === 'string' || entry.text) {
    const words = wordsOf(entry)
    return { summary: words, inline: words }
  }
  if (entry.summary) {
    return { summary: entry.summary, inline: entry.inline }
  }
  const unworded = commonErrorText('unworded')
  return { summary: unworded, inline: unworded }
}

/**
 * A form field's validation wording, with any {braces} filled in from
 * `values`. Throws when the file has no such rule, so a page that names a
 * missing one fails as it loads, not when a user meets it.
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
  const { summary, inline } = formWords(entry)
  return {
    summary: fillErrorText(summary, values),
    inline: fillErrorText(inline, values)
  }
}

/**
 * Text error-text.yaml's common section holds, shared by every page.
 *
 * @param {'summaryTitle' | 'unworded'} key
 * @returns {string}
 */
export function commonErrorText(key) {
  return wordsOf(errorText.common[key])
}

/**
 * A page of pages, with its {braces} filled in from `values`: its title, and
 * each body line as the text before its link, the link, and the text after.
 * Throws when the file has no such page, so a page that names a missing one
 * fails as it loads, not when a user meets it.
 *
 * @param {string} key
 * @param {Record<string, string | number>} [values]
 * @returns {{ title?: string, body: Array<{ before: string, link?: { text: string, href: string }, after?: string }> }}
 */
export function pageErrorText(key, values = {}) {
  const page = errorText.pages[key]
  if (!page) {
    throw new Error(`error-text.yaml has no pages.${key}`)
  }
  return fillPage(page, values)
}

/**
 * pageErrorText's work on one page. A line is split at its link before it is
 * filled in, so a value holding "[" or "](" stays text. Exported so a test can
 * give it a page whose values hold link syntax, which no page in the file has.
 *
 * @param {{ title?: string, body?: string[] }} page
 * @param {Record<string, string | number>} values
 */
export function fillPage(page, values) {
  const body = (page.body ?? []).map((line) => {
    const { before, linkText, target, after } = splitLink(line)
    return target === undefined
      ? { before: fillErrorText(before, values) }
      : {
          before: fillErrorText(before, values),
          link: {
            text: fillErrorText(linkText, values),
            href: PAGE_LINK_TARGETS[target]
          },
          after: fillErrorText(after, values)
        }
  })
  return {
    ...(page.title ? { title: fillErrorText(page.title, values) } : {}),
    body
  }
}
