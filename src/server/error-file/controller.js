import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import {
  HABITAT_REF_INVALID_CHARACTERS_TEXT,
  HABITAT_REF_MISSING_TEXT,
  resolveSingleErrorCopy
} from './single-error-copy.js'

// BMD-1058: errors that stand for every habitat they apply to at once, shown
// as one heading with no list of habitats. A habitat with no reference has
// nothing to list it by. The heading is the frontend's, matching the
// single-error copy, rather than the backend's message.
const COLLATED_ERROR_HEADINGS = {
  HABITAT_REF_MISSING: HABITAT_REF_MISSING_TEXT,
  HABITAT_REF_INVALID_CHARACTERS: HABITAT_REF_INVALID_CHARACTERS_TEXT
}

// Per-error renderers — mirror the backend's formatting so each offender
// can be shown on its own line under the error-type heading rather than
// crammed into a single comma-separated string.

function describeFeature(s) {
  if (s?.feature_ref) {
    return `Feature Ref ${s.feature_ref}`
  }
  if (s?.fid != null && s.fid !== '') {
    return `fid ${s.fid}`
  }
  if (s?.idx != null) {
    return `feature #${s.idx}`
  }
  return 'feature'
}

function describeOverlapPair(s) {
  const a = describeFeature({
    feature_ref: s?.feature_ref_a,
    fid: s?.fid_a,
    idx: s?.idx_a
  })
  const b = describeFeature({
    feature_ref: s?.feature_ref_b,
    fid: s?.fid_b,
    idx: s?.idx_b
  })
  return `${a} ↔ ${b}`
}

function describeSliver(s) {
  const area = Number(s?.area_sqm ?? 0).toFixed(2)
  const loc = s?.location_wkt ?? 'unknown location'
  return `~${area} sq m near ${loc}`
}

function describeFeatureWithArea(s) {
  const base = describeFeature(s)
  if (s?.area_sqm == null) {
    return base
  }
  return `${base} — ~${Number(s.area_sqm).toFixed(2)} sq m`
}

function describeFeatureWithEscape(s) {
  const base = describeFeature(s)
  if (s?.escape_area_sqm == null || s?.escape_location_wkt == null) {
    return base
  }
  const area = Number(s.escape_area_sqm).toFixed(2)
  return `${base} — ~${area} sq m near ${s.escape_location_wkt}`
}

// Backend emits the reference-data band identifiers; the AC uses
// user-facing labels ("V.High" → "Very high" etc.). Unknown values pass
// through unchanged so we never silently swallow a new band the backend
// might introduce.
const BAND_DISPLAY_NAMES = {
  'V.High': 'Very high',
  High: 'High',
  Medium: 'Medium',
  Low: 'Low',
  'V.Low': 'Very low'
}

function displayBand(band) {
  return BAND_DISPLAY_NAMES[band] ?? band ?? 'unknown'
}

function describeDistinctivenessOffender(s) {
  const base = describeFeature(s)
  const type = s?.habitat_type ?? 'unknown habitat'
  return `${base} — ${type} (${displayBand(s?.distinctiveness)})`
}

// BMD-1182: the baseline habitat that cannot be enhanced, in the condition
// that makes it so.
function describeUnenhanceableBaseline(s) {
  const base = describeFeature(s)
  const type = s?.habitat_type ?? 'unknown habitat'
  return s?.condition
    ? `${base} — ${type} (${s.condition})`
    : `${base} — ${type}`
}

// BMD-1083/BMD-1086: the lineage checks of a BNG Service template file name a
// post-intervention row or a baseline parent by its template table, Habitat
// Ref and habitat type, as the backend's message does. A row's parent, or a
// parent's post-intervention rows, follow it, so the user can find both.

function lineageName(s) {
  if (s?.ref) {
    return s.ref
  }
  return s?.fid == null ? 'a habitat' : `fid ${s.fid}`
}

function joinRefs(refs) {
  return (refs ?? []).filter(Boolean).join(', ')
}

function describeLineageFeature(s) {
  const table = s?.table ? `${s.table} ` : ''
  const type = s?.habitatType ? ` — ${s.habitatType}` : ''
  return `${table}${lineageName(s)}${type}`
}

function describeLineageRow(s) {
  const base = describeLineageFeature(s)
  return s?.parentRef ? `${base}, copied from ${s.parentRef}` : base
}

function describeLineageParent(s) {
  const base = describeLineageFeature(s)
  const rows = joinRefs(s?.childRefs)
  return rows ? `${base}, copied to ${rows}` : base
}

function describeAmbiguousParent(s) {
  const base = describeLineageFeature({ ...s, ref: joinRefs(s?.refs) })
  const rows = joinRefs(s?.childRefs)
  return rows ? `${base}, named by ${rows}` : base
}

function describeHedgerowChildrenTooLong(s) {
  const base = describeLineageParent(s)
  if (s?.lengthMetres == null || s?.childLengthMetres == null) {
    return base
  }
  return `${base} (${s.lengthMetres} m, linked ${s.childLengthMetres} m)`
}

const LINEAGE_DESCRIBERS = {
  STAGED_PARENT_LINK_MISSING: describeLineageFeature,
  STAGED_UNKNOWN_PARENT_REF: describeLineageFeature,
  STAGED_AMBIGUOUS_PARENT: describeAmbiguousParent,
  STAGED_BASELINE_DRIFTED: describeLineageParent,
  STAGED_HEDGEROW_CHILDREN_TOO_LONG: describeHedgerowChildrenTooLong,
  STAGED_WATERCOURSE_RETAINED_AND_CREATED: describeLineageParent,
  STAGED_NATURAL_WATERCOURSE_LOST: describeLineageParent,
  STAGED_DEGRADE_NOT_WORSE: describeLineageRow,
  STAGED_DEGRADE_ADVANCE_NOT_30_PLUS: describeLineageRow,
  STAGED_WATERCOURSE_NO_INTERVENTION: describeLineageRow
}

function describeFeatureWithReason(s) {
  const base = describeFeature(s)
  return s?.reason ? `${base} (${s.reason})` : base
}

// How each error's offenders are listed, by error code; any other code lists
// each offender by its ref.
const SAMPLE_DESCRIBERS = {
  PARCEL_OVERLAPS: describeOverlapPair,
  SLIVERS_OUTSIDE_REDLINE: describeSliver,
  AREA_PARCELS_TOO_SMALL: describeFeatureWithArea,
  AREA_PARCELS_INVALID_GEOMETRY: describeFeatureWithReason,
  AREA_PARCELS_OUTSIDE_REDLINE: describeFeatureWithEscape,
  HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE: describeDistinctivenessOffender,
  BASELINE_NOT_ENHANCEABLE: describeUnenhanceableBaseline,
  ...LINEAGE_DESCRIBERS
}

function buildItems(err) {
  if (COLLATED_ERROR_HEADINGS[err.code]) {
    return []
  }
  // Non-list errors don't carry details. Use the part of the message after
  // the first ": " as the single sub-line; if there's no separator, the
  // heading already says everything (no items).
  if (!err.details?.sample) {
    const idx = err.message.indexOf(': ')
    return idx === -1 ? [] : [err.message.slice(idx + 2)]
  }
  const describe = SAMPLE_DESCRIBERS[err.code] ?? describeFeature
  return err.details.sample.map(describe)
}

function buildHeading(err) {
  if (COLLATED_ERROR_HEADINGS[err.code]) {
    return COLLATED_ERROR_HEADINGS[err.code]
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
  if (err.code !== 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE') {
    return null
  }
  const bands = err.details?.allowedBands
  if (!Array.isArray(bands) || bands.length === 0) {
    return null
  }
  const labels = bands.map(displayBand)
  return `Allowed distinctiveness: ${joinWithAnd(labels)}.`
}

function buildBlock(err) {
  const items = buildItems(err)
  const total = Number(err.details?.count ?? 0)
  const more =
    err.details && !COLLATED_ERROR_HEADINGS[err.code]
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

// A lineage error is its list of habitats: which rows, and which parents, the
// user has to put right. The backend's heading already says what the Metric
// guide asks for, so even on its own it is shown as a list, never reduced to
// single-error copy.
//
// A BNG Service template file the service cannot read as one has no copy of
// its own yet either. Shown alone through single-error copy it would carry
// the "PLACEHOLDER (AWAITING UCD)" title, and a legacy file refused once the
// flag is on is the refusal users will meet most, so it is shown the same
// way: under the backend's message, which says what to do.
//
// Both are interim layouts until UCD's copy (BMD-1086).
const TEMPLATE_FILE_ERROR_CODES = new Set([
  'TEMPLATE_VERSION_MISSING',
  'TEMPLATE_VERSION_DUPLICATED',
  'TEMPLATE_VERSION_INVALID',
  'TEMPLATE_VERSION_UNSUPPORTED',
  'LEGACY_TEMPLATE_NOT_ACCEPTED',
  'POST_INTERVENTION_TABLES_EMPTY'
])

function isShownAsList(code) {
  return (
    Object.hasOwn(LINEAGE_DESCRIBERS, code) ||
    TEMPLATE_FILE_ERROR_CODES.has(code)
  )
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

    return h.view('error-file/index', {
      pageTitle: singleError?.h1 ?? 'There is a problem with your file',
      errorList,
      errorBlocks,
      singleError,
      projectId,
      fileLabel: uploadType.label,
      uploadHref
    })
  }
}
