import { isServiceTemplateEnabled } from '../common/helpers/service-template.js'
import {
  LINK_TARGETS,
  WHEN_ALONE,
  canFill,
  dropoutCopy,
  errorCopy,
  firstKnown,
  splitLink
} from './dropout-copy.js'

// BMD-405: the drop-out page for a file with exactly one validation error,
// keyed by the backend's ERROR_CODES
// (backend/src/validation/geopackage/errors.js). The copy is in
// dropout-copy.yaml; this module only picks the entry and fills it in.

function describeRef(sample, suffix = '') {
  const ref =
    sample?.[`feature_ref${suffix}`] ??
    sample?.[`fid${suffix}`] ??
    sample?.[`idx${suffix}`]
  return ref != null && ref !== '' ? String(ref) : null
}

// The counts ride on the error's details rather than being parsed back out of
// the message.
function describeCount(error, key) {
  const value = error?.details?.[key]
  return Number.isFinite(value) ? value.toLocaleString('en-GB') : null
}

// The {values} a single error's copy can name.
function valuesFor(error) {
  const sample = error?.details?.sample?.[0] ?? null
  return {
    ref: describeRef(sample),
    refA: describeRef(sample, '_a'),
    refB: describeRef(sample, '_b'),
    featureCount: describeCount(error, 'featureCount'),
    maxFeatureCount: describeCount(error, 'maxFeatureCount')
  }
}

/** The {values} a page's title and body can name, for a test to check. */
export function pageValueNames() {
  return Object.keys(valuesFor({}))
}

// whenAlone may give several pages, the first whose title and body the error
// can fill.
function choosePage(pages, values) {
  const list = [pages].flat()
  return (
    list.find(
      (page) => canFill(page.title, values) && canFill(page.body, values)
    ) ?? list.at(-1)
  )
}

function catchAllPage() {
  return isServiceTemplateEnabled()
    ? dropoutCopy.catchAll.serviceTemplate
    : dropoutCopy.catchAll.legacyTemplate
}

// The page's fields for its variant, from where its sentence links: to the
// upload page, to the metric tool, or nowhere.
function buildPage(page, values) {
  const h1 = firstKnown(page.title, values)
  const { before, linkText, target, after } = splitLink(
    firstKnown(page.body, values)
  )
  const subheading = page.subheading ? { subheading: page.subheading } : {}

  if (target === LINK_TARGETS.UPLOAD) {
    return {
      variant: 'standard',
      h1,
      ...subheading,
      messageBefore: before,
      linkText,
      messageAfter: after
    }
  }
  if (target === LINK_TARGETS.METRIC_TOOL) {
    return {
      variant: 'metric-tool',
      h1,
      ...subheading,
      helpTextBefore: before,
      linkText,
      linkHref: dropoutCopy.links[LINK_TARGETS.METRIC_TOOL],
      helpTextAfter: after,
      ...(page.opensInNewTab === false ? { opensInNewTab: false } : {})
    }
  }
  return { variant: 'text', h1, subheading: page.subheading, helpText: before }
}

function placeholderPage(error) {
  const values = { serviceMessage: `${error?.message}` }
  return {
    variant: 'placeholder',
    h1: firstKnown(dropoutCopy.placeholder.title, values),
    helpText: firstKnown(dropoutCopy.placeholder.body, values)
  }
}

/**
 * Resolve the copy for a single validation error.
 *
 * @param {{code: string, message?: string, details?: object}} error
 * @param {string|null} uploadHref
 */
export function resolveSingleErrorCopy(error, uploadHref) {
  const whenAlone = errorCopy(error?.code)?.whenAlone

  if (whenAlone === WHEN_ALONE.PLACEHOLDER) {
    return placeholderPage(error)
  }

  // A code with no copy of its own, or one the page always lists, takes the
  // catch-all, so an error code we haven't seen yet still degrades to a
  // sensible message rather than a blank page.
  const pages = typeof whenAlone === 'object' ? whenAlone : catchAllPage()
  const values = valuesFor(error)
  const resolved = buildPage(choosePage(pages, values), values)

  if (resolved.variant === 'standard') {
    resolved.uploadHref = uploadHref
    if (!uploadHref) {
      // No upload destination available: trim the trailing "and " so the
      // instruction reads as a complete sentence without a dangling call-to-action.
      resolved.messageBefore = `${resolved.messageBefore.replace(/ and $/, '')}.`
      resolved.linkText = null
      resolved.messageAfter = ''
    }
  }

  return resolved
}
