import Joi from 'joi'
import { load } from 'js-yaml'

import { errorText } from '../common/error-text/error-text.js'
import {
  WORDING,
  logErrorTextWarnings,
  shownWordingField,
  wordingField
} from '../common/error-text/wording.js'
import { isServiceTemplateEnabled } from '../common/helpers/service-template.js'

// The drop-out page's copy is the upload section of error-text.yaml, where
// product, BAs and UCD review every error message the service shows. This
// module checks that section's shape, so a slip in an edit fails the tests and
// the server's start rather than a user's page, and fills in the {values} it
// names.

/** What whenAlone can say in place of copy of its own. */
export const WHEN_ALONE = Object.freeze({
  CATCH_ALL: 'catch-all',
  FILE_PROBLEM: 'file-problem',
  SERVICE_PROBLEM: 'service-problem',
  LIST: 'list'
})

/** The inList value that heads the list with the catch-all title. */
const CATCH_ALL = 'catch-all'

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

/**
 * A problem lists habitats or it does not, however the backend words it: so
 * its bullets, and its variants', are all items or all details. The page
 * reads only the one kind, and would drop a bullet of the other unseen.
 */
function oneKindOfBullet(inList, helpers) {
  const wording = [inList, ...Object.values(inList.variants ?? {})]
  const kinds = ['item', 'detail'].filter((key) =>
    wording.some((copy) => copy[key] !== undefined)
  )
  return kinds.length > 1 ? helpers.error('any.invalid') : inList
}

// A shared fallback page, which can say its wording is interim.
const fallbackCopy = pageCopy.keys({ wording: shownWordingField })

const errorEntry = Joi.object({
  // "none" says the error has no words of its own yet for when it is alone,
  // so it can only be on one whose whenAlone names the shared fallback the
  // page shows instead. Its inList heading is still shown in a list.
  wording: wordingField.when('whenAlone', {
    is: Joi.valid(
      WHEN_ALONE.CATCH_ALL,
      WHEN_ALONE.FILE_PROBLEM,
      WHEN_ALONE.SERVICE_PROBLEM
    ),
    otherwise: Joi.invalid(WORDING.NONE)
  }),
  whenAlone: Joi.alternatives(
    Joi.string().valid(...Object.values(WHEN_ALONE)),
    pageCopy,
    Joi.array().items(pageCopy).min(1)
  ).required(),
  inList: Joi.alternatives(
    Joi.string().valid(CATCH_ALL),
    Joi.object({
      heading: text.required(),
      listsHabitats: Joi.boolean(),
      // A bullet for each habitat the problem lists, or the one bullet of a
      // problem that lists none, filled from its details.
      item: options,
      detail: options,
      note: text,
      // Another way the backend words the problem, named by the error's
      // details.variants: its heading, item or detail replaces the code's own.
      variants: Joi.object().pattern(
        Joi.string().pattern(/^[a-z][a-z0-9-]*$/),
        Joi.object({ heading: text, item: options, detail: options }).min(1)
      )
    }).custom(oneKindOfBullet)
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
  'area',
  'srsId',
  'blank'
)

const copySchema = Joi.object({
  page: pageSchema.required(),
  links: Joi.object({
    [LINK_TARGETS.METRIC_TOOL]: Joi.string().uri().required()
  }).required(),
  catchAll: Joi.object({
    legacyTemplate: fallbackCopy.required(),
    serviceTemplate: fallbackCopy.required()
  }).required(),
  fileProblem: fallbackCopy.required(),
  serviceProblem: fallbackCopy.required(),
  names: Joi.object({
    feature: options.required(),
    tree: options.required(),
    habitat: options.required()
  }).required(),
  unknown: unknownSchema.required(),
  distinctiveness: Joi.object().pattern(Joi.string(), text).required(),
  errors: Joi.object()
    .pattern(Joi.string().pattern(/^[A-Z][A-Z0-9_]*$/), errorEntry)
    .required()
})

function checkDropoutCopy(section) {
  const { value, error, warning } = copySchema.validate(section, {
    abortEarly: false
  })
  if (error) {
    throw new Error(
      `error-text.yaml's upload section is not valid: ${error.message}`
    )
  }
  logErrorTextWarnings(warning, 'upload')
  return value
}

/**
 * Read and check the drop-out page's copy: the upload section, as YAML.
 * Exported so a test can feed it a broken one.
 *
 * @param {string} source - YAML text
 */
export function parseDropoutCopy(source) {
  return checkDropoutCopy(load(source))
}

export const dropoutCopy = checkDropoutCopy(errorText.upload)

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

/** The first of `templates` whose values are all known, not filled in. */
export function firstKnownTemplate(templates, values = {}) {
  const list = [templates].flat()
  return list.find((t) => hasValues(t, values)) ?? list.at(-1)
}

/** The first of `templates` whose values are all known, filled in. */
export function firstKnown(templates, values = {}) {
  return fill(firstKnownTemplate(templates, values), values)
}

/** Each of `parts` whose values are all known, filled in and joined. */
export function joinKnownParts(parts, values = {}) {
  return [parts]
    .flat()
    .filter((part) => hasValues(part, values))
    .map((part) => fill(part, values))
    .join('')
}

export { splitLink } from '../common/error-text/links.js'

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

/**
 * The catch-all copy for the template the service reads: its title heads the
 * list for a problem with no heading of its own, and its page is the
 * single-error page for one with no copy of its own.
 */
export function catchAllPage() {
  return isServiceTemplateEnabled()
    ? dropoutCopy.catchAll.serviceTemplate
    : dropoutCopy.catchAll.legacyTemplate
}

/**
 * The single-error page a whenAlone that names a fallback stands for: the
 * catch-all, about layer and column names; the file problem, which says only
 * that the file has an error; or the service problem, which says the fault is
 * the service's. A code with no entry, or one the page always lists, takes the
 * file problem, which cannot mislead about what is wrong.
 *
 * @param {string | undefined} whenAlone
 */
export function fallbackPage(whenAlone) {
  switch (whenAlone) {
    case WHEN_ALONE.CATCH_ALL:
      return catchAllPage()
    case WHEN_ALONE.SERVICE_PROBLEM:
      return dropoutCopy.serviceProblem
    default:
      return dropoutCopy.fileProblem
  }
}
