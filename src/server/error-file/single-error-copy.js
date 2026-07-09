// BMD-405 — exact GOV.UK copy for the "exactly one validation error" dropout
// page, keyed by the backend's ERROR_CODES (backend/src/validation/baseline/errors.js).
// Copy is taken verbatim from the BMD-405 acceptance criteria; the Figma linked
// on the ticket is the source of truth for anything not covered here.

const GEOPACKAGE_ERROR_H1 = 'Your Geopackage (.gpkg) file contains an error'
const UPLOAD_LINK_TEXT = 'upload a new file'

const STATUTORY_METRIC_TOOL_URL =
  'https://www.gov.uk/government/publications/statutory-biodiversity-metric-tools-and-guides'

// AC14 — BMD-300 checks whose finalised GOV.UK copy isn't written yet.
// Placeholder text pending BMD-592.
const PLACEHOLDER_ERROR_CODES = new Set([
  'REDLINE_OUTSIDE_ENGLAND',
  'REDLINE_AREA_TOO_LARGE',
  'IGGIS_OUTSIDE_REDLINE',
  'TREES_OUTSIDE_REDLINE',
  'AREA_SUM_MISMATCH'
])

function describeRef(sample, suffix = '') {
  const ref = sample?.[`feature_ref${suffix}`] ?? sample?.[`fid${suffix}`]
  return ref != null && ref !== '' ? String(ref) : null
}

function firstSample(error) {
  return error?.details?.sample?.[0] ?? null
}

function standard(h1, messageBefore, messageAfter = '.') {
  return {
    variant: 'standard',
    h1,
    messageBefore,
    linkText: UPLOAD_LINK_TEXT,
    messageAfter
  }
}

const CODE_ENTRIES = {
  // AC2 — No redline boundary (BMD-340)
  NO_REDLINE: () =>
    standard(
      GEOPACKAGE_ERROR_H1,
      'The redline boundary is missing. Draw the red line boundary and '
    ),
  GPKG_RLB_NO_POLYGON: () =>
    standard(
      GEOPACKAGE_ERROR_H1,
      'The redline boundary is missing. Draw the red line boundary and '
    ),

  // AC3 — Multiple redline boundaries (BMD-340)
  GPKG_RLB_TOO_MANY_POLYGONS: () =>
    standard(
      GEOPACKAGE_ERROR_H1,
      'This file contains multiple red line boundaries. Draw the red line boundary again and '
    ),

  // AC4 — No area habitat polygons (BMD-461)
  NO_HABITAT_AREAS: () =>
    standard(
      GEOPACKAGE_ERROR_H1,
      "The file doesn't contain any parcels. Draw parcels within your red line boundary and "
    ),

  // AC5 — Self-intersecting redline boundary (BMD-300 AC4)
  REDLINE_INVALID_GEOMETRY: () =>
    standard(
      GEOPACKAGE_ERROR_H1,
      'The redline boundary is overlapping itself. Draw the boundary again and '
    ),

  // AC6a — Ineligible distinctiveness (BMD-352)
  HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE: () => ({
    variant: 'distinctiveness',
    h1: 'Very high and high distinctiveness habitats are not yet included in this service',
    helpTextBefore: 'Use the ',
    linkText: 'metric tool (spreadsheet)',
    linkHref: STATUTORY_METRIC_TOOL_URL,
    helpTextAfter: ' to calculate biodiversity value.'
  }),

  // AC7 — Self-intersecting parcel (BMD-300 AC5)
  AREA_PARCELS_INVALID_GEOMETRY: (error) => {
    const ref = describeRef(firstSample(error))
    return standard(
      ref ? `This parcel ${ref} contains an error` : GEOPACKAGE_ERROR_H1,
      'This parcel is overlapping itself. Draw the parcel again and '
    )
  },

  // AC8 — Overlapping parcel (BMD-300 AC6)
  PARCEL_OVERLAPS: (error) => {
    const sample = firstSample(error)
    const refs = [describeRef(sample, '_a'), describeRef(sample, '_b')].filter(
      Boolean
    )
    return standard(
      refs.length === 2
        ? `These parcels ${refs.join(', ')} contain an error`
        : GEOPACKAGE_ERROR_H1,
      'These parcels are overlapping. Draw the parcels again and '
    )
  },

  // AC9 — Sliver (BMD-300 AC7). Sliver rows don't carry a feature_ref (they
  // describe a gap, not a titled parcel), so this falls back to the generic
  // title when one isn't available.
  SLIVERS_INSIDE_REDLINE: () =>
    standard(
      GEOPACKAGE_ERROR_H1,
      'This parcel is a sliver (a thin strip of land). Draw the parcel again and '
    ),
  SLIVERS_OUTSIDE_REDLINE: () =>
    standard(
      GEOPACKAGE_ERROR_H1,
      'This parcel is a sliver (a thin strip of land). Draw the parcel again and '
    ),

  // AC10 — Parcel outside redline boundary (BMD-300 AC8)
  AREA_PARCELS_OUTSIDE_REDLINE: (error) => {
    const ref = describeRef(firstSample(error))
    return standard(
      ref ? `This parcel ${ref} contains an error` : GEOPACKAGE_ERROR_H1,
      'This parcel is outside the red line boundary. Draw the parcel again and '
    )
  },

  // AC11 — Hedgerow outside redline boundary (BMD-300 AC9)
  HEDGEROWS_OUTSIDE_REDLINE: (error) => {
    const ref = describeRef(firstSample(error))
    return standard(
      ref ? `This hedgerow ${ref} contains an error` : GEOPACKAGE_ERROR_H1,
      'This hedgerow is outside the red line boundary. Draw the hedgerow again and '
    )
  },

  // AC12 — Watercourse outside redline boundary (BMD-300 AC10)
  WATERCOURSES_OUTSIDE_REDLINE: (error) => {
    const ref = describeRef(firstSample(error))
    return standard(
      ref ? `This watercourse ${ref} contains an error` : GEOPACKAGE_ERROR_H1,
      'This watercourse is outside the red line boundary. Draw the watercourse again and '
    )
  }
}

// AC1 — Invalid Natural England columns/layers (BMD-339) is the catch-all:
// every GeoPackage structural/schema error not covered by a more specific AC
// above lands here, so an error code we haven't seen yet still degrades to a
// sensible message rather than a blank page.
function defaultEntry() {
  return standard(
    GEOPACKAGE_ERROR_H1,
    'The layer names and column names do not match what is required by Natural England. Rename the layers and columns and '
  )
}

/**
 * Resolve the exact AC copy for a single validation error.
 *
 * @param {{code: string, message: string, details?: object}} error
 * @param {string|null} uploadHref
 */
export function resolveSingleErrorCopy(error, uploadHref) {
  if (PLACEHOLDER_ERROR_CODES.has(error?.code)) {
    return {
      variant: 'placeholder',
      h1: 'PLACEHOLDER (AWAITING UCD)',
      helpText: `PLACEHOLDER - ${error.message}`
    }
  }

  const build = CODE_ENTRIES[error?.code] ?? defaultEntry
  const resolved = build(error)

  if (resolved.variant === 'standard') {
    resolved.uploadHref = uploadHref
  }

  return resolved
}
