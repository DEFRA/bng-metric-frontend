import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import {
  WHEN_ALONE,
  dropoutCopy,
  errorCopy,
  fill,
  firstKnown,
  joinKnownParts,
  listHeading
} from './dropout-copy.js'
import { resolveSingleErrorCopy } from './single-error-copy.js'

// The drop-out page for a file with more than one problem: a heading for each
// error and a bullet for each habitat it names. The wording is in
// dropout-copy.yaml; this module works out the {values} each error's bullets
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
      : band) ?? unknown.distinctiveness
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
    area: s?.areaSquareMetres,
    childArea: s?.childAreaSquareMetres
  }
}

// An ambiguous parent is every baseline habitat that shares the identity.
function ambiguousParentValues(s) {
  return lineageValues({ ...s, ref: joinRefs(s?.refs) })
}

// The {values} each error's bullets name, by error code; any other code names
// each habitat by its ref.
const SAMPLE_VALUES = {
  PARCEL_OVERLAPS: (s) => ({
    featureA: featureName(s, '_a'),
    featureB: featureName(s, '_b')
  }),
  SLIVERS_OUTSIDE_REDLINE: (s) => ({
    area: squareMetres(s?.area_sqm ?? 0),
    location: s?.location_wkt ?? unknown.location
  }),
  AREA_PARCELS_TOO_SMALL: (s) => ({
    ...featureValues(s),
    area: squareMetres(s?.area_sqm)
  }),
  AREA_PARCELS_OUTSIDE_REDLINE: (s) => {
    const escaped = s?.escape_area_sqm != null && s?.escape_location_wkt != null
    return {
      ...featureValues(s),
      area: escaped ? squareMetres(s.escape_area_sqm) : null,
      location: escaped ? s.escape_location_wkt : null
    }
  },
  HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE: (s) => ({
    ...featureValues(s),
    habitatType: s?.habitat_type ?? unknown.habitatType,
    distinctiveness: displayBand(s?.distinctiveness)
  }),
  BASELINE_NOT_ENHANCEABLE: (s) => ({
    ...featureValues(s),
    habitatType: s?.habitat_type ?? unknown.habitatType
  }),
  // A vertical area habitat's typed Area, with the value the file holds.
  VERTICAL_HABITAT_AREA_NOT_POSITIVE: (s) => ({
    ...featureValues(s),
    area: known(s?.area) ?? unknown.area
  }),
  STAGED_AMBIGUOUS_PARENT: ambiguousParentValues
}

const DEFAULT_ITEM = '{feature}'

function valuesFor(code) {
  if (SAMPLE_VALUES[code]) {
    return SAMPLE_VALUES[code]
  }
  return code?.startsWith('STAGED_') ? lineageValues : featureValues
}

function inListCopy(code) {
  const inList = errorCopy(code)?.inList
  return typeof inList === 'object' ? inList : {}
}

function listsHabitats(code) {
  return inListCopy(code).listsHabitats !== false
}

function buildItems(err) {
  if (!listsHabitats(err.code)) {
    return []
  }
  // Non-list errors don't carry details. Use the part of the message after
  // the first ": " as the single sub-line; if there's no separator, the
  // heading already says everything (no items).
  if (!err.details?.sample) {
    const idx = err.message.indexOf(': ')
    return idx === -1 ? [] : [err.message.slice(idx + 2)]
  }
  const { item } = inListCopy(err.code)
  const values = item ? valuesFor(err.code) : featureValues
  return err.details.sample.map((s) =>
    joinKnownParts(item ?? DEFAULT_ITEM, values(s))
  )
}

// The copy's heading for the error, or else the part of the service's message
// before its first ": ".
function buildHeading(err) {
  const heading = listHeading(err.code)
  if (heading) {
    return heading
  }
  const idx = err.message.indexOf(': ')
  return idx === -1 ? err.message : err.message.slice(0, idx)
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

    const errorBlocks = visibleErrors.map(buildBlock)
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
      ? resolveSingleErrorCopy(visibleErrors[0], uploadHref)
      : null

    const { page } = dropoutCopy
    return h.view('error-file/index', {
      pageTitle: singleError?.h1 ?? page.title,
      listHeading: fill(page.listHeading, { fileLabel: uploadType.label }),
      errorList,
      errorBlocks,
      singleError,
      projectId,
      fileLabel: uploadType.label,
      uploadHref
    })
  }
}
