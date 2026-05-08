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

function describeFeatureWithEscape(s) {
  const base = describeFeature(s)
  if (s?.escape_area_sqm == null || s?.escape_location_wkt == null) {
    return base
  }
  const area = Number(s.escape_area_sqm).toFixed(2)
  return `${base} — ~${area} sq m near ${s.escape_location_wkt}`
}

function buildItems(err) {
  // Non-list errors don't carry details. Use the part of the message after
  // the first ": " as the single sub-line; if there's no separator, the
  // heading already says everything (no items).
  if (!err.details?.sample) {
    const idx = err.message.indexOf(': ')
    return idx === -1 ? [] : [err.message.slice(idx + 2)]
  }
  const sample = err.details.sample
  if (err.code === 'PARCEL_OVERLAPS') {
    return sample.map(describeOverlapPair)
  }
  if (
    err.code === 'SLIVERS_INSIDE_REDLINE' ||
    err.code === 'SLIVERS_OUTSIDE_REDLINE'
  ) {
    return sample.map(describeSliver)
  }
  if (err.code === 'AREA_PARCELS_INVALID_GEOMETRY') {
    return sample.map((s) => {
      const base = describeFeature(s)
      return s?.reason ? `${base} (${s.reason})` : base
    })
  }
  if (err.code === 'AREA_PARCELS_OUTSIDE_REDLINE') {
    return sample.map(describeFeatureWithEscape)
  }
  return sample.map(describeFeature)
}

function buildHeading(err) {
  const idx = err.message.indexOf(': ')
  return idx === -1 ? err.message : err.message.slice(0, idx)
}

function buildBlock(err) {
  const items = buildItems(err)
  const total = Number(err.details?.count ?? 0)
  const more = err.details
    ? Math.max(0, total - (err.details.sample?.length ?? 0))
    : 0
  return { heading: buildHeading(err), items, more }
}

export const invalidFileController = {
  handler(request, h) {
    const baselineValidationErrors =
      request.yar.get('baselineValidationErrors') ?? []
    const projectId =
      request.yar.get('baselineValidationErrorsProjectId') ?? null

    // Errors are one-shot — clear them so a refresh or back-nav doesn't
    // resurrect a stale rejection.
    request.yar.clear('baselineValidationErrors')
    request.yar.clear('baselineValidationErrorsProjectId')

    const hasParcelsOutside = baselineValidationErrors.some(
      (e) => e.code === 'AREA_PARCELS_OUTSIDE_REDLINE'
    )
    const visibleErrors = hasParcelsOutside
      ? baselineValidationErrors.filter(
          (e) => e.code !== 'SLIVERS_OUTSIDE_REDLINE'
        )
      : baselineValidationErrors

    const errorBlocks = visibleErrors.map(buildBlock)
    const errorList = errorBlocks.map((b) => ({ text: b.heading }))

    return h.view('invalid-file/index', {
      pageTitle: 'There is a problem with your file',
      errorList,
      errorBlocks,
      projectId
    })
  }
}
