import { formatVerticalArea } from '../common/helpers/format-habitat-values.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import {
  WHEN_ALONE,
  canFill,
  catchAllPage,
  dropoutCopy,
  errorCopy,
  fill,
  firstKnown,
  joinKnownParts,
  pageText
} from './dropout-copy.js'
import { resolveSingleErrorCopy } from './single-error-copy.js'

// The drop-out page for a file with more than one problem: a heading for each
// error and a bullet for each habitat it names. The wording is the upload
// section of common/error-text/error-text.yaml; this module works out the
// {values} each error's bullets
// name, from the habitats in its details.sample.

const { names, unknown } = dropoutCopy

function known(value) {
  return value == null || value === '' ? null : value
}

// How most errors name a habitat: by its Feature Ref, fid or position.
function featureName(s, suffix = '') {
  return firstKnown(names.feature, {
    featureRef: known(s?.[`feature_ref${suffix}`]),
    fid: known(s?.[`fid${suffix}`]),
    idx: s?.[`idx${suffix}`]
  })
}

function squareMetres(value) {
  return value == null ? null : Number(value).toFixed(2)
}

// Backend emits the reference-data band identifiers; the copy gives
// user-facing labels ("V.High" → "Very high" etc.). Unknown values pass
// through unchanged so we never silently swallow a new band the backend
// might introduce.
function displayBand(band) {
  return (
    (Object.hasOwn(dropoutCopy.distinctiveness, band ?? '')
      ? dropoutCopy.distinctiveness[band]
      : known(band)) ?? unknown.distinctiveness
  )
}

function featureValues(s) {
  return {
    feature: featureName(s),
    reason: known(s?.reason),
    condition: known(s?.condition)
  }
}

function joinRefs(refs) {
  return (refs ?? []).filter(Boolean).join(', ')
}

// BMD-1083/BMD-1086: the lineage checks of a BNG Service template file name a
// post-intervention row or a baseline parent by its template table, Habitat
// Ref and habitat type, as the backend's message does. A row's parent, or a
// parent's post-intervention rows, follow it, so the user can find both.
function lineageValues(s) {
  return {
    table: known(s?.table),
    name: firstKnown(names.habitat, {
      ref: known(s?.ref),
      fid: s?.fid
    }),
    habitatType: known(s?.habitatType),
    parentRef: known(s?.parentRef),
    childRefs: joinRefs(s?.childRefs),
    length: s?.lengthMetres,
    childLength: s?.childLengthMetres,
    // A vertical area habitat's, in hectares as the surveyor typed them and
    // in square metres, as the habitat pages show them.
    area: formatVerticalArea(s?.areaSquareMetres),
    childArea: formatVerticalArea(s?.childAreaSquareMetres),
    // A tree's Count, and its kept trees' together.
    count: s?.count,
    childCount: s?.childCount
  }
}

// An ambiguous parent is every baseline habitat that shares the identity.
function ambiguousParentValues(s) {
  return lineageValues({ ...s, ref: joinRefs(s?.refs) })
}

function overlapValues(s) {
  return {
    featureA: featureName(s, '_a'),
    featureB: featureName(s, '_b')
  }
}

function sliverValues(s) {
  return {
    area: squareMetres(s?.area_sqm ?? 0),
    location: s?.location_wkt ?? unknown.location
  }
}

function tooSmallValues(s) {
  return { ...featureValues(s), area: squareMetres(s?.area_sqm) }
}

function outsideRedlineValues(s) {
  const escaped = s?.escape_area_sqm != null && s?.escape_location_wkt != null
  return {
    ...featureValues(s),
    area: escaped ? squareMetres(s.escape_area_sqm) : null,
    location: escaped ? s.escape_location_wkt : null
  }
}

function distinctivenessValues(s) {
  return {
    ...featureValues(s),
    habitatType: known(s?.habitat_type) ?? unknown.habitatType,
    distinctiveness: displayBand(s?.distinctiveness)
  }
}

function unenhanceableValues(s) {
  return {
    ...featureValues(s),
    habitatType: known(s?.habitat_type) ?? unknown.habitatType
  }
}

// A vertical area habitat's typed Area, with the value the file holds.
function verticalAreaValues(s) {
  return { ...featureValues(s), area: known(s?.area) ?? unknown.area }
}

// An irreplaceable tree, by its Habitat Ref, in the table of the stage that
// marks it.
function irreplaceableTreeValues(s) {
  return {
    table: known(s?.table),
    tree: firstKnown(names.tree, {
      featureRef: known(s?.feature_ref),
      fid: known(s?.fid),
      idx: s?.idx
    })
  }
}

// BMD-1175: a text value that fails, by its table, its habitat's Habitat Ref
// (or fid, when it has no usable one) and its column, with the values the
// code's wording names: a length and its limit, the refused value (cut to 99
// characters by the backend), or the table's shape.
function textValueValues(s) {
  const count = (value) =>
    value == null ? null : value.toLocaleString('en-GB')
  return {
    table: known(s?.table),
    feature: firstKnown(names.habitat, {
      ref: known(s?.ref),
      fid: known(s?.fid)
    }),
    column: known(s?.column),
    length: count(s?.length),
    limit: count(s?.limit),
    value: known(s?.value),
    shape: known(s?.shape)
  }
}

// The {values} each error's bullets name, by error code; any other code names
// each habitat by its ref.
const SAMPLE_VALUES = {
  PARCEL_OVERLAPS: overlapValues,
  SLIVERS_OUTSIDE_REDLINE: sliverValues,
  AREA_PARCELS_TOO_SMALL: tooSmallValues,
  AREA_PARCELS_OUTSIDE_REDLINE: outsideRedlineValues,
  HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE: distinctivenessValues,
  BASELINE_NOT_ENHANCEABLE: unenhanceableValues,
  VERTICAL_HABITAT_AREA_NOT_POSITIVE: verticalAreaValues,
  IRREPLACEABLE_TREE: irreplaceableTreeValues,
  STAGED_AMBIGUOUS_PARENT: ambiguousParentValues,
  TEXT_TOO_LONG: textValueValues,
  VALUE_NOT_ALLOWED: textValueValues,
  FEATURE_UUID_INVALID: textValueValues,
  PARENT_UUID_INVALID: textValueValues,
  PARENT_GEOM_INVALID: textValueValues
}

const DEFAULT_ITEM = '{feature}'

// How a code's bullets get their {values}. A code whose copy gives no item is
// named by its ref, whatever it is.
function valuesFor(code) {
  if (!inListCopy(code).item) {
    return featureValues
  }
  if (Object.hasOwn(SAMPLE_VALUES, code)) {
    return SAMPLE_VALUES[code]
  }
  return code.startsWith('STAGED_') ? lineageValues : featureValues
}

/**
 * The {values} a code's bullets can name, so a test can check the copy names
 * no other: a name the code does not supply would leave its part off every
 * bullet.
 *
 * @param {string} code
 * @returns {string[]}
 */
export function itemValueNames(code) {
  return Object.keys(valuesFor(code)({}))
}

// The copy for an error in a list. A code that words a problem more than one
// way names the way in details.variants, and each variant's heading, item or
// detail replaces the code's own.
function inListCopy(code, variants = []) {
  const inList = errorCopy(code)?.inList
  if (typeof inList !== 'object') {
    return {}
  }
  return variants.reduce(
    (copy, variant) => ({ ...copy, ...inList.variants?.[variant] }),
    inList
  )
}

function variantsOf(err) {
  const variants = err.details?.variants
  return Array.isArray(variants) ? variants : []
}

// Each value as the backend's message writes it.
const asText = (value) => (value == null || value === '' ? null : String(value))
const asList = (value) => (Array.isArray(value) ? value.join(', ') : null)
const asNumber = (format) => (value) =>
  Number.isFinite(value) ? format(value) : null
const grouped = asNumber((n) => n.toLocaleString('en-GB'))
const wholeNumber = asNumber((n) => n.toFixed(0))
const twoDecimals = asNumber((n) => n.toFixed(2))
const hexadecimal = asNumber((n) => n.toString(16).toUpperCase())
// A value the file holds, or the copy's word for one it leaves blank or
// unset (the backend sends that as null). A value the details do not carry at
// all is missing, as for any other: the file did not say it was blank.
const fileValue = (blankWord) => (value) =>
  value === undefined ? null : (asText(value) ?? blankWord)
const srsId = fileValue(unknown.srsId)
const fileText = fileValue(unknown.blank)
// A type label with its article: "a Text", "an Integer".
function withArticle(value) {
  if (!value) {
    return null
  }
  const article = /^[aeiou]/i.test(value) ? 'an' : 'a'
  return `${article} ${value}`
}

/**
 * The values each error's heading and bullets name from its details, when it
 * names no habitats: the backend sends them raw (its ERROR_CODE_DETAILS), and
 * this formats each as the backend's message does.
 */
const DETAIL_VALUES = {
  GPKG_NOT_A_GEOPACKAGE: { applicationId: hexadecimal },
  GPKG_MISSING_SYSTEM_TABLE: { table: asText },
  GPKG_MISSING_LAYER: { layer: asText },
  // The name of a table the file adds.
  GPKG_UNEXPECTED_FEATURE_LAYER: { layer: fileText },
  GPKG_BASELINE_CONTENTS_DATA_TYPE: {
    layer: asText,
    expected: asText,
    found: fileText
  },
  GPKG_BASELINE_SRS_ID: {
    layer: asText,
    expectedSrsId: asText,
    foundSrsId: asText,
    contentsSrsId: srsId,
    geometryColumnsSrsId: srsId
  },
  GPKG_BASELINE_GPKG_SRS_INCONSISTENT: {
    layer: asText,
    contentsSrsId: srsId,
    geometryColumnsSrsId: srsId
  },
  GPKG_BASELINE_INVALID_GEOMETRY_COLUMN_NAME: {
    layer: asText,
    column: fileText,
    expected: asText
  },
  GPKG_BASELINE_MULTIPLE_GEOMETRY_COLUMNS: { layer: asText, found: asText },
  GPKG_BASELINE_GEOMETRY_TYPE_NAME: {
    layer: asText,
    expected: asText,
    found: fileText
  },
  // The geometry variant's column is the name the file registers.
  GPKG_BASELINE_MISSING_COLUMN: { layer: asText, column: fileText },
  // For a geometry column, column is the name the file registers.
  GPKG_BASELINE_COLUMN_SQLITE_TYPE: {
    layer: asText,
    column: fileText,
    expectedType: asText,
    actualType: withArticle
  },
  GPKG_BASELINE_COLUMN_NOT_NULL: { layer: asText, column: asText },
  GPKG_BASELINE_COLUMN_PRIMARY_KEY: { layer: asText, column: asText },
  GPKG_BASELINE_GEOMETRY_REGISTRATION_MISSING: { layer: asText },
  GPKG_TOO_MANY_FEATURES: { featureCount: grouped, maxFeatureCount: grouped },
  TEMPLATE_VERSION_DUPLICATED: { recordCount: asText },
  TEMPLATE_VERSION_UNSUPPORTED: { version: asText, supportedVersions: asList },
  REDLINE_AREA_TOO_LARGE: { areaSqM: wholeNumber },
  REDLINE_INVALID_GEOMETRY: { reason: asText, location: asText },
  AREA_SUM_MISMATCH: {
    habitatsAreaSqM: twoDecimals,
    redlineAreaSqM: twoDecimals
  },
  BASELINE_TYPE_MISSING: { rowCount: asText }
}

function detailValues(err) {
  const formats = DETAIL_VALUES[err.code] ?? {}
  return Object.fromEntries(
    Object.entries(formats).map(([name, format]) => [
      name,
      format(err.details?.[name])
    ])
  )
}

/**
 * The {values} a code's heading and detail can name, for a test to check.
 *
 * @param {string} code
 * @returns {string[]}
 */
export function detailValueNames(code) {
  return Object.keys(DETAIL_VALUES[code] ?? {})
}

function listsHabitats(code) {
  return inListCopy(code).listsHabitats !== false
}

function buildItems(err) {
  if (!listsHabitats(err.code)) {
    return []
  }
  // An error that names no habitats has one bullet at most: its copy's
  // detail, filled from its details, when it gives one and any of it is known.
  if (!err.details?.sample) {
    const { detail } = inListCopy(err.code, variantsOf(err))
    const bullet = detail ? joinKnownParts(detail, detailValues(err)) : ''
    return bullet ? [bullet] : []
  }
  const item = inListCopy(err.code).item ?? DEFAULT_ITEM
  const values = valuesFor(err.code)
  // A bullet whose every part lacks a value would be an empty line, so name
  // the habitat by its ref instead.
  return err.details.sample.map(
    (s) =>
      joinKnownParts(item, values(s)) ||
      joinKnownParts(DEFAULT_ITEM, featureValues(s))
  )
}

// The catch-all title, for a code with no heading of its own (inList:
// catch-all, or none in the copy), or one whose details lack a value its
// heading names.
function catchAllHeading() {
  return firstKnown(catchAllPage().title)
}

function buildHeading(err) {
  const { heading } = inListCopy(err.code, variantsOf(err))
  const values = detailValues(err)
  return heading && canFill(heading, values)
    ? fill(heading, values)
    : catchAllHeading()
}

function joinWithAnd(items) {
  if (items.length <= 1) {
    return items.join('')
  }
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

// Render an optional explanatory line shown between the heading and the
// offender list. For distinctiveness rejection the backend supplies the raw
// allowed-band identifiers in details.allowedBands; we map them through
// displayBand so the user sees "Very low" rather than "V.Low".
/** The {values} a list's note can name, for a test to check. */
export const NOTE_VALUE_NAMES = Object.freeze(['bands'])

function buildNote(err) {
  const note = inListCopy(err.code).note
  const bands = err.details?.allowedBands
  if (!note || !Array.isArray(bands) || bands.length === 0) {
    return null
  }
  return fill(note, { bands: joinWithAnd(bands.map(displayBand)) })
}

function buildBlock(err) {
  const items = buildItems(err)
  const total = Number(err.details?.count ?? 0)
  const more =
    err.details && listsHabitats(err.code)
      ? Math.max(0, total - (err.details.sample?.length ?? 0))
      : 0
  const note = buildNote(err)
  const block = { heading: buildHeading(err), items, more }
  if (note) {
    block.note = note
  }
  return block
}

// Two errors the page words the same way, such as two the copy has no
// heading for, say nothing new the second time: show each block once.
function distinctBlocks(blocks) {
  const seen = new Set()
  return blocks.filter((block) => {
    const key = JSON.stringify([
      block.heading,
      block.items,
      block.more,
      block.note ?? null
    ])
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

// What a placeholder page says of the error: its heading and bullets as the
// list shows them.
function placeholderMessage(block) {
  const more =
    block.more > 0
      ? fill(dropoutCopy.placeholder.more, { count: block.more })
      : ''
  if (block.items.length === 0) {
    return `${block.heading}${more}`
  }
  return `${block.heading}: ${block.items.join(', ')}${more}`
}

const SINGLE_VALIDATION_ERROR = 1

// Errors the page shows as their list even alone (whenAlone: list in the
// copy): a lineage error is its list of habitats, which the user has to put
// right, and a BNG Service template file the service cannot read as one has
// no copy of its own yet, and would otherwise carry a placeholder title.
function isShownAsList(code) {
  return errorCopy(code)?.whenAlone === WHEN_ALONE.LIST
}

function isShownAsSingleError(errors) {
  return (
    errors.length === SINGLE_VALIDATION_ERROR && !isShownAsList(errors[0].code)
  )
}

function resolveUploadContext(request) {
  const requestedUploadType = request.yar.get('validationUploadType')
  const uploadType =
    requestedUploadType === HABITAT_UPLOAD_TYPES.postIntervention.key
      ? HABITAT_UPLOAD_TYPES.postIntervention
      : HABITAT_UPLOAD_TYPES.baseline
  const validationErrors =
    request.yar.get(uploadType.validationErrorsSessionKey) ?? []
  const projectId =
    request.yar.get(uploadType.validationErrorsProjectIdSessionKey) ?? null
  return { uploadType, validationErrors, projectId }
}

export const invalidFileController = {
  handler(request, h) {
    const { uploadType, validationErrors, projectId } =
      resolveUploadContext(request)

    // Errors are one-shot — clear them so a refresh or back-nav doesn't
    // resurrect a stale rejection.
    for (const type of Object.values(HABITAT_UPLOAD_TYPES)) {
      request.yar.clear(type.validationErrorsSessionKey)
      request.yar.clear(type.validationErrorsProjectIdSessionKey)
    }
    request.yar.clear(uploadType.validationUploadTypeSessionKey)

    const hasParcelsOutside = validationErrors.some(
      (e) => e.code === 'AREA_PARCELS_OUTSIDE_REDLINE'
    )
    const visibleErrors = hasParcelsOutside
      ? validationErrors.filter((e) => e.code !== 'SLIVERS_OUTSIDE_REDLINE')
      : validationErrors

    const errorBlocks = distinctBlocks(visibleErrors.map(buildBlock))
    const errorList = errorBlocks.map((b) => ({
      text: b.note ? `${b.heading}. ${b.note}` : b.heading
    }))

    const uploadHref = projectId
      ? `/projects/${projectId}/${uploadType.uploadRoute}`
      : null

    // BMD-405 is scoped to exactly one validation error. AREA_PARCELS_OUTSIDE_REDLINE
    // always co-fires with SLIVERS_OUTSIDE_REDLINE (same escape geometry, reported
    // from both the per-parcel and union-of-parcels angle), so "exactly one" has to
    // be judged against visibleErrors — the same de-duplicated list the multi-error
    // view already renders — or AC10's personalised copy could never be reached.
    const singleError = isShownAsSingleError(visibleErrors)
      ? resolveSingleErrorCopy(
          visibleErrors[0],
          uploadHref,
          placeholderMessage(errorBlocks[0])
        )
      : null

    const page = pageText({ fileLabel: uploadType.label })
    return h.view('error-file/index', {
      pageTitle: singleError?.h1 ?? page.title,
      page,
      errorList,
      errorBlocks,
      singleError,
      projectId,
      uploadHref
    })
  }
}
