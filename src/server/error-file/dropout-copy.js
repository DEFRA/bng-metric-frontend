import { readFileSync } from 'node:fs'
import path from 'node:path'

import Joi from 'joi'
import { load } from 'js-yaml'

// The drop-out page's copy lives in dropout-copy.yaml, for product, BAs and
// UCD to review in one place. This module reads it once, checks its shape so a
// slip in an edit fails the tests and the server's start rather than a user's
// page, and fills in the {values} it names.

const COPY_FILE = path.join(import.meta.dirname, 'dropout-copy.yaml')

/** What whenAlone can say in place of copy of its own. */
export const WHEN_ALONE = Object.freeze({
  CATCH_ALL: 'catch-all',
  PLACEHOLDER: 'placeholder',
  LIST: 'list'
})

/** The inList value that shows the service's own message as the heading. */
const SERVICE_MESSAGE = 'service-message'

/** The link targets a sentence can name, as [link text](target). */
export const LINK_TARGETS = Object.freeze({
  UPLOAD: 'upload',
  METRIC_TOOL: 'metric-tool'
})

// Not trimmed: a bullet's part keeps the space that joins it to the last.
const text = Joi.string().pattern(/\S/)
const options = Joi.alternatives(text, Joi.array().items(text).min(1))

const pageCopy = Joi.object({
  title: options.required(),
  subheading: text,
  body: options.required(),
  opensInNewTab: Joi.boolean()
})

const errorEntry = Joi.object({
  whenAlone: Joi.alternatives(
    Joi.string().valid(...Object.values(WHEN_ALONE)),
    pageCopy,
    Joi.array().items(pageCopy).min(1)
  ).required(),
  inList: Joi.alternatives(
    Joi.string().valid(SERVICE_MESSAGE),
    Joi.object({
      heading: text,
      listsHabitats: Joi.boolean(),
      item: options,
      note: text
    })
  ).required()
})

// Every key the page and the bullets read, so renaming or removing one fails
// here rather than on a user's page.
const required = (...keys) =>
  Joi.object(Object.fromEntries(keys.map((key) => [key, text.required()])))

const pageSchema = required(
  'title',
  'summaryTitle',
  'listHeading',
  'listIntro',
  'more',
  'uploadButton',
  'backToProject',
  'backToStart',
  'opensInNewTab',
  'noErrorsHeading',
  'noErrorsBody'
)

const unknownSchema = required(
  'location',
  'habitatType',
  'distinctiveness',
  'area'
)

const copySchema = Joi.object({
  page: pageSchema.required(),
  links: Joi.object({
    [LINK_TARGETS.METRIC_TOOL]: Joi.string().uri().required()
  }).required(),
  catchAll: Joi.object({
    legacyTemplate: pageCopy.required(),
    serviceTemplate: pageCopy.required()
  }).required(),
  placeholder: pageCopy.required(),
  names: Joi.object({
    feature: options.required(),
    habitat: options.required()
  }).required(),
  unknown: unknownSchema.required(),
  distinctiveness: Joi.object().pattern(Joi.string(), text).required(),
  errors: Joi.object()
    .pattern(Joi.string().pattern(/^[A-Z][A-Z0-9_]*$/), errorEntry)
    .required()
})

/**
 * Read and check a copy file. Exported so a test can feed it a broken one.
 *
 * @param {string} source - YAML text
 */
export function parseDropoutCopy(source) {
  const { value, error } = copySchema.validate(load(source), {
    abortEarly: false
  })
  if (error) {
    throw new Error(`dropout-copy.yaml is not valid: ${error.message}`)
  }
  return value
}

export const dropoutCopy = parseDropoutCopy(readFileSync(COPY_FILE, 'utf8'))

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g

function isKnown(value) {
  return value != null && value !== ''
}

/** Whether every {value} `template` names is known. */
function hasValues(template, values) {
  return [...template.matchAll(PLACEHOLDER_PATTERN)].every(([, name]) =>
    isKnown(values[name])
  )
}

/**
 * `template` with each {value} filled in from `values`; a value not given
 * leaves nothing in its place.
 */
export function fill(template, values = {}) {
  return template.replaceAll(PLACEHOLDER_PATTERN, (_, name) =>
    isKnown(values[name]) ? String(values[name]) : ''
  )
}

/** Whether any of `templates` has all its values known. */
export function canFill(templates, values = {}) {
  return [templates].flat().some((t) => hasValues(t, values))
}

/** The first of `templates` whose values are all known, filled in. */
export function firstKnown(templates, values = {}) {
  const list = [templates].flat()
  const chosen = list.find((t) => hasValues(t, values)) ?? list.at(-1)
  return fill(chosen, values)
}

/** Each of `parts` whose values are all known, filled in and joined. */
export function joinKnownParts(parts, values = {}) {
  return [parts]
    .flat()
    .filter((part) => hasValues(part, values))
    .map((part) => fill(part, values))
    .join('')
}

const LINK_OPEN = '['
const LINK_MIDDLE = ']('
const LINK_CLOSE = ')'

/**
 * Split a sentence at its [link text](target), or return it whole as
 * `before` when it has none.
 *
 * @param {string} sentence
 * @returns {{ before: string, linkText?: string, target?: string, after?: string }}
 */
export function splitLink(sentence) {
  const open = sentence.indexOf(LINK_OPEN)
  const middle = open === -1 ? -1 : sentence.indexOf(LINK_MIDDLE, open)
  const close = middle === -1 ? -1 : sentence.indexOf(LINK_CLOSE, middle)
  if (close === -1) {
    return { before: sentence }
  }
  return {
    before: sentence.slice(0, open),
    linkText: sentence.slice(open + LINK_OPEN.length, middle),
    target: sentence.slice(middle + LINK_MIDDLE.length, close),
    after: sentence.slice(close + LINK_CLOSE.length)
  }
}

/**
 * The {values} each page string can name: pageText fills these and no
 * others, so a test can check the copy names only them. A page string not
 * listed names none.
 */
export const PAGE_TEXT_VALUES = Object.freeze({
  listHeading: ['fileLabel'],
  more: ['count']
})

/**
 * The page's own wording, filled in for this page, as the template reads it:
 * `listHeading` names the file's stage, and `more(count)` says how many
 * habitats a list leaves out.
 *
 * @param {{ fileLabel?: string }} [values]
 */
export function pageText({ fileLabel } = {}) {
  const { page } = dropoutCopy
  return {
    ...page,
    listHeading: fill(page.listHeading, { fileLabel }),
    more: (count) => fill(page.more, { count })
  }
}

/** The copy for an error code, or null when the file has none. */
export function errorCopy(code) {
  return Object.hasOwn(dropoutCopy.errors, code ?? '')
    ? dropoutCopy.errors[code]
    : null
}

/** The heading the copy gives a code in a list, or null for the service's. */
export function listHeading(code) {
  const inList = errorCopy(code)?.inList
  return typeof inList === 'object' ? (inList.heading ?? null) : null
}
