import {
  LINK_TARGETS,
  SHARED_PAGE,
  canFill,
  dropoutCopy,
  sharedPage,
  singleProblemPages,
  fill,
  firstKnown,
  firstKnownTemplate,
  layerName,
  splitLink
} from './dropout-copy.js'

// BMD-405: the drop-out page for a file with exactly one validation error,
// keyed by the backend's ERROR_CODES
// (backend/src/validation/geopackage/errors.js). The copy is the upload
// section of common/error-text/error-text.yaml; this module only picks the
// entry and fills it in.

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

// The habitat an error names, by its ref or else its fid, and null when the
// error names several, so a page about one habitat is not shown for the first
// of many.
function describeOnlyRef(error, sample) {
  const ref = sample?.feature_ref
  const fid = sample?.fid
  if (error?.details?.count !== 1 || !(isGiven(ref) || isGiven(fid))) {
    return null
  }
  return firstKnown(dropoutCopy.names.habitat, {
    ref: isGiven(ref) ? ref : null,
    fid: isGiven(fid) ? fid : null
  })
}

function isGiven(value) {
  return value != null && value !== ''
}

// The layer of the one habitat an error names.
function describeOnlyLayer(error, sample) {
  return error?.details?.count === 1 ? layerName(sample?.layer) : null
}

// The layer every habitat an error names is in, when they share one. Null
// when the sample leaves some out, as those could be in another.
function describeSharedLayer(error) {
  const sample = error?.details?.sample ?? []
  const layers = new Set(sample.map((s) => s?.layer))
  return sample.length > 0 &&
    sample.length === error?.details?.count &&
    layers.size === 1
    ? layerName(sample[0]?.layer)
    : null
}

// The {values} a single error's copy can name.
function valuesFor(error) {
  const sample = error?.details?.sample?.[0] ?? null
  return {
    ref: describeRef(sample),
    onlyRef: describeOnlyRef(error, sample),
    onlyLayer: describeOnlyLayer(error, sample),
    sharedLayer: describeSharedLayer(error),
    refA: describeRef(sample, '_a'),
    refB: describeRef(sample, '_b'),
    // How many habitats the error names: for wording for several.
    count: describeCount(error, 'count'),
    featureCount: describeCount(error, 'featureCount'),
    maxFeatureCount: describeCount(error, 'maxFeatureCount')
  }
}

/** The {values} a page's title and body can name, for a test to check. */
export function pageValueNames() {
  return Object.keys(valuesFor({}))
}

// singleProblemPage may give several pages, the first whose title,
// subheading and body the error can fill.
function choosePage(pages, values) {
  const list = [pages].flat()
  return (
    list.find(
      (page) =>
        canFill(page.title, values) &&
        canFill(page.subheading ?? '', values) &&
        canFill(page.body, values)
    ) ?? list.at(-1)
  )
}

// The page's fields for its variant, from where its sentence links: to the
// upload page, to the metric tool, or nowhere.
function buildPage(page, values) {
  const h1 = firstKnown(page.title, values)
  // Split at the link before filling in, so a value cannot move the link.
  const parts = splitLink(firstKnownTemplate(page.body, values))
  const { target } = parts
  const [before, linkText, after] = [
    parts.before,
    parts.linkText,
    parts.after
  ].map((part) => (part === undefined ? undefined : fill(part, values)))
  const subheading = page.subheading
    ? { subheading: fill(page.subheading, values) }
    : {}

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
  return { variant: 'text', h1, ...subheading, helpText: before }
}

/**
 * Resolve the copy for a single validation error.
 *
 * @param {{code: string, message?: string, details?: object}} error
 * @param {string|null} uploadHref
 */
export function resolveSingleErrorCopy(error, uploadHref) {
  // A code with no copy of its own takes the shared page its
  // singleProblemPage names, and one we haven't seen yet the file problem, so
  // it still degrades to a sensible message rather than a blank page. The
  // page shows the problems list for an error with no page for it, so the
  // file problem here is only a guard.
  const pages =
    singleProblemPages(error) ?? sharedPage(SHARED_PAGE.FILE_PROBLEM)
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
