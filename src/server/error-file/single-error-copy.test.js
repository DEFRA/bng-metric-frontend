import { describe, test, expect } from 'vitest'

import { resolveSingleErrorCopy } from './single-error-copy.js'

const UPLOAD_HREF = '/projects/proj-1/upload-baseline-file'

describe('#resolveSingleErrorCopy', () => {
  test('AC1: unmapped/structural codes fall back to the Natural England columns copy', () => {
    const result = resolveSingleErrorCopy(
      { code: 'GPKG_BASELINE_MISSING_COLUMN', message: 'x' },
      UPLOAD_HREF
    )
    expect(result).toEqual({
      variant: 'standard',
      h1: 'Your Geopackage (.gpkg) file contains an error',
      messageBefore:
        'The layer names and column names do not match what is required by Natural England. Rename the layers and columns and ',
      linkText: 'upload a new file',
      messageAfter: '.',
      uploadHref: UPLOAD_HREF
    })
  })

  test('AC2: NO_REDLINE', () => {
    const result = resolveSingleErrorCopy(
      { code: 'NO_REDLINE', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.messageBefore).toBe(
      'The redline boundary is missing. Draw the red line boundary and '
    )
  })

  test('AC2: GPKG_RLB_NO_POLYGON', () => {
    const result = resolveSingleErrorCopy(
      { code: 'GPKG_RLB_NO_POLYGON', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.messageBefore).toBe(
      'The redline boundary is missing. Draw the red line boundary and '
    )
  })

  test('AC3: GPKG_RLB_TOO_MANY_POLYGONS', () => {
    const result = resolveSingleErrorCopy(
      { code: 'GPKG_RLB_TOO_MANY_POLYGONS', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.messageBefore).toBe(
      'This file contains multiple red line boundaries. Draw the red line boundary again and '
    )
  })

  test('AC4: NO_HABITAT_AREAS', () => {
    const result = resolveSingleErrorCopy(
      { code: 'NO_HABITAT_AREAS', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.messageBefore).toBe(
      "The file doesn't contain any parcels. Draw parcels within your red line boundary and "
    )
  })

  test('AC5: REDLINE_INVALID_GEOMETRY', () => {
    const result = resolveSingleErrorCopy(
      { code: 'REDLINE_INVALID_GEOMETRY', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.messageBefore).toBe(
      'The redline boundary is overlapping itself. Draw the boundary again and '
    )
  })

  test('AC6a: HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE renders the distinctiveness variant', () => {
    const result = resolveSingleErrorCopy(
      { code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE', message: 'x' },
      UPLOAD_HREF
    )
    expect(result).toEqual({
      variant: 'distinctiveness',
      h1: 'Very high and high distinctiveness habitats are not yet included in this service',
      helpTextBefore: 'Use the ',
      linkText: 'metric tool (spreadsheet)',
      linkHref: expect.any(String),
      helpTextAfter: ' to calculate biodiversity value.'
    })
    // No upload link for this variant.
    expect(result.uploadHref).toBeUndefined()
  })

  test('AC7: AREA_PARCELS_INVALID_GEOMETRY interpolates the parcel ref from details.sample', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'AREA_PARCELS_INVALID_GEOMETRY',
        message: 'x',
        details: { sample: [{ feature_ref: 'P001' }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('This parcel P001 contains an error')
    expect(result.messageBefore).toBe(
      'This parcel is overlapping itself. Draw the parcel again and '
    )
  })

  test('AC7: falls back to the generic title when no feature_ref/fid is present', () => {
    const result = resolveSingleErrorCopy(
      { code: 'AREA_PARCELS_INVALID_GEOMETRY', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
  })

  test('AC8: PARCEL_OVERLAPS interpolates both parcel refs', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'PARCEL_OVERLAPS',
        message: 'x',
        details: {
          sample: [{ feature_ref_a: 'P001', feature_ref_b: 'P002' }]
        }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('These parcels P001, P002 contain an error')
    expect(result.messageBefore).toBe(
      'These parcels are overlapping. Draw the parcels again and '
    )
  })

  test('AC8: falls back to the generic title when only one ref is present', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'PARCEL_OVERLAPS',
        message: 'x',
        details: { sample: [{ feature_ref_a: 'P001' }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
  })

  test('AC9: SLIVERS_INSIDE_REDLINE', () => {
    const result = resolveSingleErrorCopy(
      { code: 'SLIVERS_INSIDE_REDLINE', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.messageBefore).toBe(
      'This parcel is a sliver (a thin strip of land). Draw the parcel again and '
    )
  })

  test('AC9: SLIVERS_OUTSIDE_REDLINE', () => {
    const result = resolveSingleErrorCopy(
      { code: 'SLIVERS_OUTSIDE_REDLINE', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.messageBefore).toBe(
      'This parcel is a sliver (a thin strip of land). Draw the parcel again and '
    )
  })

  test('AC10: AREA_PARCELS_OUTSIDE_REDLINE interpolates the parcel ref', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'AREA_PARCELS_OUTSIDE_REDLINE',
        message: 'x',
        details: { sample: [{ feature_ref: 'P004' }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('This parcel P004 contains an error')
    expect(result.messageBefore).toBe(
      'This parcel is outside the red line boundary. Draw the parcel again and '
    )
  })

  test('AC11: HEDGEROWS_OUTSIDE_REDLINE interpolates the hedgerow ref, falls back to fid', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'HEDGEROWS_OUTSIDE_REDLINE',
        message: 'x',
        details: { sample: [{ fid: '17' }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('This hedgerow 17 contains an error')
    expect(result.messageBefore).toBe(
      'This hedgerow is outside the red line boundary. Draw the hedgerow again and '
    )
  })

  test('AC12: WATERCOURSES_OUTSIDE_REDLINE interpolates the watercourse ref', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'WATERCOURSES_OUTSIDE_REDLINE',
        message: 'x',
        details: { sample: [{ feature_ref: 'W002' }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('This watercourse W002 contains an error')
    expect(result.messageBefore).toBe(
      'This watercourse is outside the red line boundary. Draw the watercourse again and '
    )
  })

  test.each([
    'REDLINE_OUTSIDE_ENGLAND',
    'REDLINE_AREA_TOO_LARGE',
    'IGGIS_OUTSIDE_REDLINE',
    'TREES_OUTSIDE_REDLINE',
    'AREA_SUM_MISMATCH'
  ])('AC14: %s renders the UCD placeholder variant', (code) => {
    const result = resolveSingleErrorCopy(
      { code, message: 'backend message for ' + code },
      UPLOAD_HREF
    )
    expect(result).toEqual({
      variant: 'placeholder',
      h1: 'PLACEHOLDER (AWAITING UCD)',
      helpText: `PLACEHOLDER - backend message for ${code}`
    })
  })

  test('standard variant omits the upload link when uploadHref is null', () => {
    const result = resolveSingleErrorCopy(
      { code: 'NO_REDLINE', message: 'x' },
      null
    )
    expect(result.uploadHref).toBeNull()
  })
})
