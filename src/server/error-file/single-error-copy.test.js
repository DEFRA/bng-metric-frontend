import { afterEach, beforeEach, describe, test, expect } from 'vitest'

import { config } from '../../config/config.js'
import { pageText } from './dropout-copy.js'
import { resolveSingleErrorCopy } from './single-error-copy.js'
import { renderTemplate } from '../test-helpers/render-template.js'

const UPLOAD_HREF = '/projects/proj-1/upload-baseline-file'

describe('#resolveSingleErrorCopy', () => {
  // The legacy copy, which is the flag-off path. CI also runs the suite with
  // the flag on, so pin it off here rather than rely on the default.
  const originalEnabled = config.get('serviceTemplate.enabled')

  beforeEach(() => {
    config.set('serviceTemplate.enabled', false)
  })

  afterEach(() => {
    config.set('serviceTemplate.enabled', originalEnabled)
  })

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

  test('AC6a: HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE renders the metric-tool variant', () => {
    const result = resolveSingleErrorCopy(
      { code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE', message: 'x' },
      UPLOAD_HREF
    )
    expect(result).toEqual({
      variant: 'metric-tool',
      h1: 'Very high and high distinctiveness habitats are not yet included in this service',
      helpTextBefore: 'Use the ',
      linkText: 'metric tool (spreadsheet)',
      linkHref: expect.any(String),
      helpTextAfter: ' to calculate biodiversity value.'
    })
    // No upload link for this variant.
    expect(result.uploadHref).toBeUndefined()
  })

  test('AC6b: HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE renders the metric tool link in a new tab, and says so', () => {
    const html = renderTemplate('error-file/index.njk', {
      page: pageText(),
      singleError: resolveSingleErrorCopy(
        { code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE', message: 'x' },
        UPLOAD_HREF
      )
    })

    expect(html).toContain(
      'Use the <a class="govuk-link" href="https://www.gov.uk/government/publications/statutory-biodiversity-metric-tools-and-guides" target="_blank" rel="noreferrer noopener">metric tool (spreadsheet) (opens in a new tab)</a> to calculate biodiversity value.'
    )
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

  test('AC8: falls back to the generic title and generic body when only one ref is present', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'PARCEL_OVERLAPS',
        message: 'x',
        details: { sample: [{ feature_ref_a: 'P001' }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.messageBefore).toBe(
      'Some parcels in this file are overlapping. Draw the affected parcels again and '
    )
  })

  test('AC9: AREA_PARCELS_TOO_SMALL interpolates the parcel ref', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'AREA_PARCELS_TOO_SMALL',
        message: 'x',
        details: { sample: [{ idx: 0, fid: '2', feature_ref: 'P004' }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('This parcel P004 contains an error')
    expect(result.messageBefore).toBe(
      'This parcel is smaller than 1 square metre. Draw the parcel again and '
    )
  })

  test('AC9: AREA_PARCELS_TOO_SMALL falls back to the generic h1 with no sample', () => {
    const result = resolveSingleErrorCopy(
      { code: 'AREA_PARCELS_TOO_SMALL', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.messageBefore).toBe(
      'This parcel is smaller than 1 square metre. Draw the parcel again and '
    )
  })

  test('AC9: SLIVERS_OUTSIDE_REDLINE keeps the generic h1 — no parcel to name', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'SLIVERS_OUTSIDE_REDLINE',
        message: 'x',
        details: { sample: [{ area_sqm: 1.5, location_wkt: 'POINT(0 0)' }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
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

  test('INVALID_FILENAME names the filename problem rather than the layers and columns', () => {
    const result = resolveSingleErrorCopy(
      { code: 'INVALID_FILENAME', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.messageBefore).toBe(
      'The file name contains characters we cannot accept. Rename the file using letters, numbers, spaces, hyphens, underscores or brackets and '
    )
    expect(result.linkText).toBe('upload the renamed file')
  })

  test('INVALID_FILENAME reads as a full sentence when uploadHref is null', () => {
    const result = resolveSingleErrorCopy(
      { code: 'INVALID_FILENAME', message: 'x' },
      null
    )
    expect(result.linkText).toBeNull()
    expect(result.messageBefore).toBe(
      'The file name contains characters we cannot accept. Rename the file using letters, numbers, spaces, hyphens, underscores or brackets.'
    )
  })

  test('INVALID_FILE_METADATA says the service failed, not the file name', () => {
    const result = resolveSingleErrorCopy(
      { code: 'INVALID_FILE_METADATA', message: 'x' },
      UPLOAD_HREF
    )
    expect(result).toEqual({
      variant: 'text',
      h1: 'Sorry, there is a problem with the service',
      helpText: 'Try again later.'
    })
  })

  test('GPKG_TOO_MANY_FEATURES names the counts rather than the layers and columns', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'GPKG_TOO_MANY_FEATURES',
        message: 'x',
        details: { featureCount: 30000, maxFeatureCount: 25000 }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe(
      'Your Geopackage (.gpkg) file contains too many features'
    )
    expect(result.messageBefore).toBe(
      'This file contains 30,000 features. This service can check up to 25,000. Reduce the number of features and '
    )
    expect(result.linkText).toBe('upload a new file')
  })

  // Nothing is wrong with the file, so the "contains an error" heading the rest
  // of the page family uses would be telling the user the wrong thing.
  test('GPKG_TOO_MANY_FEATURES does not claim the file contains an error', () => {
    const result = resolveSingleErrorCopy(
      { code: 'GPKG_TOO_MANY_FEATURES', message: 'x', details: {} },
      UPLOAD_HREF
    )
    expect(result.h1).not.toBe('Your Geopackage (.gpkg) file contains an error')
  })

  test('GPKG_TOO_MANY_FEATURES still reads as a sentence without the counts', () => {
    const result = resolveSingleErrorCopy(
      { code: 'GPKG_TOO_MANY_FEATURES', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.messageBefore).toBe(
      'This file contains more features than this service can check. Reduce the number of features and '
    )
  })

  test('GPKG_TOO_MANY_FEATURES reads as a full sentence when uploadHref is null', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'GPKG_TOO_MANY_FEATURES',
        message: 'x',
        details: { featureCount: 30000, maxFeatureCount: 25000 }
      },
      null
    )
    expect(result.linkText).toBeNull()
    expect(result.messageBefore).toBe(
      'This file contains 30,000 features. This service can check up to 25,000. Reduce the number of features.'
    )
  })

  test('BASELINE_TYPE_MISSING names the missing baseline habitat type and the fix', () => {
    const result = resolveSingleErrorCopy(
      { code: 'BASELINE_TYPE_MISSING', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.messageBefore).toBe(
      'Some retained or enhanced habitats have no baseline habitat type. Add a baseline habitat type for each of them and '
    )
    expect(result.linkText).toBe('upload a new file')
    expect(result.messageAfter).toBe('.')
  })

  test('BASELINE_TYPE_MISSING reads as a full sentence when uploadHref is null', () => {
    const result = resolveSingleErrorCopy(
      { code: 'BASELINE_TYPE_MISSING', message: 'x' },
      null
    )
    expect(result.linkText).toBeNull()
    expect(result.messageBefore).toBe(
      'Some retained or enhanced habitats have no baseline habitat type. Add a baseline habitat type for each of them.'
    )
  })

  test('NO_DERIVED_BASELINE_HABITATS names the empty baseline and the fix', () => {
    const result = resolveSingleErrorCopy(
      { code: 'NO_DERIVED_BASELINE_HABITATS', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.messageBefore).toBe(
      'This file has no baseline area habitats. Add baseline habitats and '
    )
    expect(result.linkText).toBe('upload a new file')
  })

  test('HABITAT_REF_MISSING (BMD-1058) is one file-level error, in the dropout spreadsheet copy', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'HABITAT_REF_MISSING',
        message: 'x',
        details: { count: 3, sample: [{ layer: 'areas', idx: 0, fid: 1 }] }
      },
      UPLOAD_HREF
    )
    expect(result).toEqual({
      variant: 'text',
      h1: 'There is a problem with your project',
      subheading: 'Habitat parcels',
      helpText: 'Your file contains a habitat with no habitat reference.'
    })
  })

  test('HABITAT_REF_INVALID_CHARACTERS (BMD-1058) uses the dropout spreadsheet copy', () => {
    const result = resolveSingleErrorCopy(
      { code: 'HABITAT_REF_INVALID_CHARACTERS', message: 'x' },
      null
    )
    expect(result).toEqual({
      variant: 'text',
      h1: 'There is a problem with your project',
      subheading: 'Habitat parcels',
      helpText:
        'This habitat reference contains characters that are not allowed.'
    })
  })

  test('LEGACY_TEMPLATE_NOT_ACCEPTED (BMD-1086) uses the dropout spreadsheet copy, whole', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'LEGACY_TEMPLATE_NOT_ACCEPTED',
        message:
          'This file is in the legacy Natural England template. The service now takes the BNG Service template: convert the file with the QGIS plugin, then upload it again.'
      },
      UPLOAD_HREF
    )
    expect(result).toEqual({
      variant: 'text',
      h1: 'There is a problem with your file',
      subheading: 'Template',
      helpText:
        'Your file is using the legacy template. The service now uses the BNG service template.'
    })
    expect(JSON.stringify(result)).not.toContain('Natural England')
  })

  test('VERTICAL_HABITAT_AREA_NOT_POSITIVE names the habitat in the title and asks for the area in hectares', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'VERTICAL_HABITAT_AREA_NOT_POSITIVE',
        message: 'x',
        details: {
          count: 1,
          sample: [{ feature_ref: 'V001', fid: 1, idx: 0, area: -12 }]
        }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('This vertical area habitat V001 contains an error')
    expect(result.messageBefore).toBe(
      'The Area (ha) of a vertical area habitat must be a number above 0. Enter the area you estimated on site in hectares and '
    )
    expect(result.linkText).toBe('upload a new file')
  })

  test('VERTICAL_HABITATS_OUTSIDE_REDLINE names the habitat, as a hedgerow outside it is', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'VERTICAL_HABITATS_OUTSIDE_REDLINE',
        message: 'x',
        details: { sample: [{ feature_ref: 'I001' }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('This vertical area habitat I001 contains an error')
    expect(result.messageBefore).toBe(
      'This vertical area habitat is outside the red line boundary. Draw the vertical area habitat again and '
    )
  })

  test.each([
    [
      'VERTICAL_HABITAT_AREA_NOT_POSITIVE',
      'The Area (ha) of a vertical area habitat must be a number above 0. Enter the area you estimated on site in hectares.'
    ],
    [
      'VERTICAL_HABITATS_OUTSIDE_REDLINE',
      'This vertical area habitat is outside the red line boundary. Draw the vertical area habitat again.'
    ]
  ])(
    '%s falls back to the generic title without a ref',
    (code, messageBefore) => {
      const result = resolveSingleErrorCopy({ code, message: 'x' }, null)
      expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
      expect(result.linkText).toBeNull()
      expect(result.messageBefore).toBe(messageBefore)
    }
  )

  test('TREE_COUNT_NOT_WHOLE names the tree in the title and the fix in the message', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'TREE_COUNT_NOT_WHOLE',
        message: 'x',
        details: {
          count: 1,
          sample: [{ feature_ref: 'T001', fid: null, idx: 0, count: 2.5 }]
        }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('This tree T001 contains an error')
    expect(result.messageBefore).toBe(
      'The Count for a tree is not a whole number of trees. Leave Count blank for one tree, or enter how many trees the point stands for and '
    )
    expect(result.linkText).toBe('upload a new file')
  })

  test('TREE_COUNT_NOT_WHOLE falls back to the generic title without a ref', () => {
    const result = resolveSingleErrorCopy(
      { code: 'TREE_COUNT_NOT_WHOLE', message: 'x' },
      null
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.linkText).toBeNull()
    expect(result.messageBefore).toBe(
      'The Count for a tree is not a whole number of trees. Leave Count blank for one tree, or enter how many trees the point stands for.'
    )
  })

  test.each([
    [
      'COMMENT_INVALID_CHARACTERS',
      'The file contains a comment that uses non-UTF8 characters. Remove those characters and ',
      'The file contains a comment that uses non-UTF8 characters. Remove those characters.'
    ]
  ])(
    'AC7: %s names the comment problem and links to a new upload',
    (code, messageBefore, messageWithoutLink) => {
      const result = resolveSingleErrorCopy(
        { code, message: 'backend message for ' + code },
        UPLOAD_HREF
      )
      expect(result).toEqual({
        variant: 'standard',
        h1: 'Your Geopackage (.gpkg) file contains an error',
        messageBefore,
        linkText: 'upload a new file',
        messageAfter: '.',
        uploadHref: UPLOAD_HREF
      })

      const withoutUpload = resolveSingleErrorCopy(
        { code, message: 'backend message for ' + code },
        null
      )
      expect(withoutUpload.linkText).toBeNull()
      expect(withoutUpload.messageBefore).toBe(messageWithoutLink)
      expect(withoutUpload.messageAfter).toBe('')

      const html = renderTemplate('error-file/index.njk', {
        singleError: result
      })
      expect(html).toContain(
        '<h1 class="govuk-heading-l">Your Geopackage (.gpkg) file contains an error</h1>'
      )
      expect(html).toContain(
        `${messageBefore}<a class="govuk-link" href="${UPLOAD_HREF}">upload a new file</a>.`
      )
    }
  )

  test.each([
    'SIZING_FAILED',
    'VALIDATION_FAILED',
    'VALIDATION_UNAVAILABLE',
    'VALIDATION_BUSY'
  ])('%s says the service failed, so there is nothing to change', (code) => {
    const result = resolveSingleErrorCopy(
      { code, message: 'backend message, not shown' },
      UPLOAD_HREF
    )
    expect(result).toEqual({
      variant: 'text',
      h1: 'Sorry, there is a problem with the service',
      helpText: 'Try again later.'
    })
  })

  test.each([
    'GPKG_HABITATS_UNREADABLE_GEOMETRY',
    'GPKG_HEDGEROWS_WRONG_GEOMETRY_TYPE',
    'GPKG_RIVERS_NO_LINESTRING_GEOMETRY'
  ])(
    '%s says the file has an error, without telling the user to rename layers',
    (code) => {
      const result = resolveSingleErrorCopy(
        { code, message: 'backend message, not shown' },
        UPLOAD_HREF
      )
      expect(result).toMatchObject({
        variant: 'standard',
        h1: 'Your Geopackage (.gpkg) file contains an error',
        messageBefore: 'Check the habitats in your file and ',
        linkText: 'upload a new file',
        uploadHref: UPLOAD_HREF
      })
    }
  )

  test('a code with no entry says the file has an error, without telling the user to rename layers', () => {
    const result = resolveSingleErrorCopy(
      { code: 'NOT_A_CODE_YET', message: 'backend message, not shown' },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.messageBefore).toBe('Check the habitats in your file and ')
  })

  test('standard variant renders a complete sentence without a link when uploadHref is null', () => {
    const result = resolveSingleErrorCopy(
      { code: 'NO_REDLINE', message: 'x' },
      null
    )
    expect(result.uploadHref).toBeNull()
    expect(result.linkText).toBeNull()
    expect(result.messageBefore).toBe(
      'The redline boundary is missing. Draw the red line boundary.'
    )
    expect(result.messageAfter).toBe('')
  })
})
