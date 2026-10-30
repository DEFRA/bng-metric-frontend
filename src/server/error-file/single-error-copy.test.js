import { afterEach, describe, test, expect } from 'vitest'

import { config } from '../../config/config.js'
import {
  UNENHANCEABLE_BASELINE_MAX_ROWS,
  resolveSingleErrorCopy
} from './single-error-copy.js'
import { renderTemplate } from '../test-helpers/render-template.js'

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

  test('INVALID_FILE_METADATA describes a malformed document, not the file name', () => {
    const result = resolveSingleErrorCopy(
      { code: 'INVALID_FILE_METADATA', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.messageBefore).toBe(
      'The layer names and column names do not match what is required by Natural England. Rename the layers and columns and '
    )
    expect(result.messageBefore).not.toContain('file name')
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

  test('ADVANCE_AND_DELAY_BOTH_SET names the advance/delay problem and fix', () => {
    const result = resolveSingleErrorCopy(
      { code: 'ADVANCE_AND_DELAY_BOTH_SET', message: 'x' },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.messageBefore).toBe(
      'A habitat has both advance and delayed creation set. Select either advance or delayed creation but not both. To create a habitat in stages, add a separate row for each and '
    )
    expect(result.linkText).toBe('upload a new file')
  })

  test('ADVANCE_AND_DELAY_BOTH_SET reads as a full sentence when uploadHref is null', () => {
    const result = resolveSingleErrorCopy(
      { code: 'ADVANCE_AND_DELAY_BOTH_SET', message: 'x' },
      null
    )
    expect(result.linkText).toBeNull()
    expect(result.messageBefore).toBe(
      'A habitat has both advance and delayed creation set. Select either advance or delayed creation but not both. To create a habitat in stages, add a separate row for each.'
    )
  })

  test('HABITAT_REF_MISSING (BMD-1058) is one file-level error, not one per habitat', () => {
    const result = resolveSingleErrorCopy(
      {
        code: 'HABITAT_REF_MISSING',
        message: 'x',
        details: { count: 3, sample: [{ layer: 'areas', idx: 0, fid: 1 }] }
      },
      UPLOAD_HREF
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.messageBefore).toBe(
      'All habitats must have a reference. Add a reference to every habitat and '
    )
    expect(result.linkText).toBe('upload a new file')
  })

  test('HABITAT_REF_INVALID_CHARACTERS (BMD-1058) names the problem and the fix', () => {
    const result = resolveSingleErrorCopy(
      { code: 'HABITAT_REF_INVALID_CHARACTERS', message: 'x' },
      null
    )
    expect(result.h1).toBe('Your Geopackage (.gpkg) file contains an error')
    expect(result.messageBefore).toBe(
      'One or more habitat references contain characters that are not allowed. Change the references to use only letters, numbers and standard punctuation.'
    )
    expect(result.linkText).toBeNull()
  })

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

  test('placeholder variant handles a missing message field without crashing', () => {
    const result = resolveSingleErrorCopy(
      { code: 'REDLINE_OUTSIDE_ENGLAND' },
      UPLOAD_HREF
    )
    expect(result.variant).toBe('placeholder')
    expect(result.helpText).toBe('PLACEHOLDER - undefined')
  })
})

describe('#resolveSingleErrorCopy with the service-template flag on', () => {
  const originalEnabled = config.get('serviceTemplate.enabled')

  afterEach(() => {
    config.set('serviceTemplate.enabled', originalEnabled)
  })

  test('BMD-1086: the catch-all names the BNG Service template, not Natural England', () => {
    config.set('serviceTemplate.enabled', true)

    const result = resolveSingleErrorCopy(
      { code: 'GPKG_BASELINE_MISSING_COLUMN', message: 'x' },
      UPLOAD_HREF
    )

    expect(result.messageBefore).toBe(
      'The layer names and column names do not match the BNG Service template. Rename the layers and columns and '
    )
    expect(result.messageBefore).not.toContain('Natural England')
  })
})

describe('#resolveSingleErrorCopy — BMD-1182 BASELINE_NOT_ENHANCEABLE', () => {
  const offender = (fields) => ({
    layer: 'habitats',
    feature_ref: 'H001',
    habitat_type: 'Grassland - Other neutral grassland',
    condition: 'Good',
    distinctiveness: 'Medium',
    proposed_habitat_type: 'Grassland - Other neutral grassland',
    proposed_condition: 'Good',
    rule: 'medium-area-good',
    mvsOnly: true,
    ...fields
  })
  const error = (sample, count = sample.length) => ({
    code: 'BASELINE_NOT_ENHANCEABLE',
    message: 'backend message',
    details: { count, sample }
  })

  test('replaces the placeholder with interim copy and a table of the habitats', () => {
    const result = resolveSingleErrorCopy(
      error([
        offender(),
        offender({
          layer: 'hedgerows',
          feature_ref: 'HG011',
          habitat_type: 'Ecologically valuable line of trees',
          proposed_habitat_type: 'Native hedgerow with trees'
        }),
        offender({
          layer: 'watercourses',
          feature_ref: 'R001',
          habitat_type: 'Ditches',
          proposed_habitat_type: 'Ditches',
          proposed_condition: 'Moderate'
        }),
        offender({
          layer: 'trees',
          feature_ref: 'T018',
          habitat_type: 'Individual trees - Rural tree',
          proposed_habitat_type: 'Individual trees - Rural tree'
        })
      ]),
      UPLOAD_HREF
    )

    expect(result.variant).toBe('standard')
    expect(result.h1).toBe(
      'Some enhanced habitats cannot be enhanced from their baseline'
    )
    expect(result.h1).not.toContain('PLACEHOLDER')
    expect(result.intro).toBeUndefined()
    expect(result.messageBefore).toBe(
      'The baseline habitats below are already at the highest distinctiveness and condition they can be enhanced to in this service. If a habitat is not changing, record it as Retained. If it is being replaced, record it as lost and the new habitat as created. Make these changes in your file and '
    )
    expect(result.uploadHref).toBe(UPLOAD_HREF)
    expect(result.table.head.map((h) => h.text)).toEqual([
      'Reference',
      'Feature',
      'Baseline habitat',
      'Baseline condition',
      'Proposed habitat',
      'Proposed condition'
    ])
    expect(result.table.rows.map((row) => row.map((c) => c.text))).toEqual([
      [
        'H001',
        'Area habitat',
        'Grassland - Other neutral grassland',
        'Good',
        'Grassland - Other neutral grassland',
        'Good'
      ],
      [
        'HG011',
        'Hedgerow',
        'Ecologically valuable line of trees',
        'Good',
        'Native hedgerow with trees',
        'Good'
      ],
      ['R001', 'Watercourse', 'Ditches', 'Good', 'Ditches', 'Moderate'],
      [
        'T018',
        'Individual tree',
        'Individual trees - Rural tree',
        'Good',
        'Individual trees - Rural tree',
        'Good'
      ]
    ])
    expect(result.table.caption).toBe('Habitats that cannot be enhanced')
    expect(result.table.moreText).toBeNull()
  })

  test('says what is missing rather than leaving a cell blank', () => {
    const result = resolveSingleErrorCopy(
      error([
        offender({
          layer: 'hedgerows',
          feature_ref: null,
          habitat_type: 'Non-native and ornamental hedgerow',
          condition: '',
          proposed_habitat_type: null,
          proposed_condition: ''
        })
      ]),
      UPLOAD_HREF
    )

    expect(result.table.rows[0].map((c) => c.text)).toEqual([
      'No reference',
      'Hedgerow',
      'Non-native and ornamental hedgerow',
      'Not recorded',
      'Not recorded',
      'Not recorded'
    ])
  })

  test('still fills every column from a backend that sends no proposed side', () => {
    const {
      proposed_habitat_type: _habitat,
      proposed_condition: _condition,
      ...baselineOnly
    } = offender()
    const result = resolveSingleErrorCopy(error([baselineOnly]), UPLOAD_HREF)

    expect(result.table.rows[0].slice(-2).map((c) => c.text)).toEqual([
      'Not recorded',
      'Not recorded'
    ])
  })

  test(`shows at most ${UNENHANCEABLE_BASELINE_MAX_ROWS} rows, and the count of all of them`, () => {
    const sample = Array.from({ length: 60 }, (_, i) =>
      offender({ feature_ref: `H${String(i + 1).padStart(3, '0')}` })
    )
    const result = resolveSingleErrorCopy(error(sample, 75), UPLOAD_HREF)

    expect(result.table.rows).toHaveLength(UNENHANCEABLE_BASELINE_MAX_ROWS)
    expect(result.table.rows.at(-1)[0].text).toBe('H050')
    expect(result.table.moreText).toBe(
      'Showing the first 50 of 75 habitats. Fix these and upload the file again to see any others.'
    )
  })

  test('reads the count from the sample when the backend sends none', () => {
    const result = resolveSingleErrorCopy(
      { code: 'BASELINE_NOT_ENHANCEABLE', details: { sample: [offender()] } },
      UPLOAD_HREF
    )

    expect(result.table.rows).toHaveLength(1)
    expect(result.table.moreText).toBeNull()
  })

  test('still reads as a sentence with no upload link', () => {
    const result = resolveSingleErrorCopy(error([offender()]), null)

    expect(result.messageBefore).toBe(
      'The baseline habitats below are already at the highest distinctiveness and condition they can be enhanced to in this service. If a habitat is not changing, record it as Retained. If it is being replaced, record it as lost and the new habitat as created. Make these changes in your file.'
    )
    expect(result.linkText).toBeNull()
  })

  test('renders the copy and the table on the page', () => {
    const sample = Array.from({ length: 50 }, (_, i) =>
      offender({ feature_ref: `H${String(i + 1).padStart(3, '0')}` })
    )
    const html = renderTemplate('error-file/index.njk', {
      singleError: resolveSingleErrorCopy(error(sample, 52), UPLOAD_HREF)
    })

    expect(html).not.toContain('PLACEHOLDER')
    expect(html).toContain(
      'The baseline habitats below are already at the highest distinctiveness and condition they can be enhanced to in this service. If a habitat is not changing, record it as Retained. If it is being replaced, record it as lost and the new habitat as created. Make these changes in your file and'
    )
    expect(html).not.toContain('already in good condition')
    expect(html).toContain(
      'Some enhanced habitats cannot be enhanced from their baseline'
    )
    expect(html).toContain('data-testid="unenhanceable-habitats"')
    expect(html).toContain('Habitats that cannot be enhanced')
    expect(html).toContain(`href="${UPLOAD_HREF}"`)
    expect(html.match(/<tr class="govuk-table__row">/g)).toHaveLength(51)
    expect(html).toContain('Showing the first 50 of 52 habitats.')
    expect(html).toContain('data-testid="unenhanceable-habitats-more"')
  })

  test('says nothing about others when every habitat is shown', () => {
    const html = renderTemplate('error-file/index.njk', {
      singleError: resolveSingleErrorCopy(error([offender()]), UPLOAD_HREF)
    })

    expect(html).not.toContain('data-testid="unenhanceable-habitats-more"')
  })

  test('renders each cell of a row', () => {
    const html = renderTemplate('error-file/index.njk', {
      singleError: resolveSingleErrorCopy(
        error([
          offender({
            layer: 'hedgerows',
            feature_ref: 'HG011',
            habitat_type: 'Ecologically valuable line of trees',
            proposed_habitat_type: 'Native hedgerow with trees',
            proposed_condition: 'Moderate'
          })
        ]),
        UPLOAD_HREF
      )
    })
    const cells = [
      ...html.matchAll(
        /<t[hd] scope="row" class="govuk-table__header">([^<]*)<\/th>|<td class="govuk-table__cell">([^<]*)<\/td>/g
      )
    ].map((m) => (m[1] ?? m[2]).trim())

    expect(cells).toEqual([
      'HG011',
      'Hedgerow',
      'Ecologically valuable line of trees',
      'Good',
      'Native hedgerow with trees',
      'Moderate'
    ])
  })

  test.each([
    [{ fid: 12 }, 'fid 12'],
    [{ idx: 3 }, 'feature #3'],
    [{}, 'No reference']
  ])(
    'falls back to the row the multi-error list names when there is no Feature Ref (%o)',
    (fields, ref) => {
      const result = resolveSingleErrorCopy(
        error([offender({ feature_ref: null, ...fields })]),
        UPLOAD_HREF
      )

      expect(result.table.rows[0][0].text).toBe(ref)
    }
  )

  test.each([
    ['no sample', { count: 3 }],
    ['an empty sample', { count: 3, sample: [] }],
    ['a sample that is not a list', { count: 3, sample: 'H001' }]
  ])('shows no table, only the copy, for %s', (_, details) => {
    const singleError = resolveSingleErrorCopy(
      { code: 'BASELINE_NOT_ENHANCEABLE', message: 'x', details },
      UPLOAD_HREF
    )

    expect(singleError.table).toBeUndefined()
    expect(singleError.messageBefore).toMatch(
      /^Some baseline habitats in your file are already at the highest/
    )
    expect(singleError.messageBefore).not.toContain('below')
    expect(singleError.messageBefore).toContain('record it as Retained')
    const html = renderTemplate('error-file/index.njk', { singleError })
    expect(html).not.toContain('govuk-table')
    expect(html).toContain(`href="${UPLOAD_HREF}"`)
  })
})
