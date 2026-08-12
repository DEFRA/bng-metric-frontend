import { describe, it, expect } from 'vitest'

import {
  HABITAT_UNITS_DELIVERED_LABEL,
  PI_DETAILS_HEADING,
  STANDARD_TIME_TO_TARGET_SUFFIX,
  TIME_DIFFICULTY_SECTION_HEADING
} from './constants.js'
import {
  baselineDetailsHref,
  buildSectionsViewOnlyBaseFields,
  buildSharedPiViewOnlyFields,
  displayText,
  formatFiniteNumber,
  formatLengthDisplay,
  formatStandardTimeToTarget,
  withMultiplier
} from './view-only-shared.js'
import { DEFAULT_INTERVENTION } from './retention.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const listTabAnchor = '#area-habitats'

describe('formatFiniteNumber', () => {
  it('stringifies finite numbers', () => {
    expect(formatFiniteNumber(1.5)).toBe('1.5')
    expect(formatFiniteNumber(0)).toBe('0')
  })

  it('returns empty for non-finite values', () => {
    expect(formatFiniteNumber(Number.NaN)).toBe('')
    expect(formatFiniteNumber(Infinity)).toBe('')
    expect(formatFiniteNumber('1')).toBe('')
    expect(formatFiniteNumber(null)).toBe('')
  })
})

describe('displayText', () => {
  it('returns non-empty strings as-is', () => {
    expect(displayText('Low')).toBe('Low')
  })

  it('returns empty for blank strings and non-string non-numbers', () => {
    expect(displayText('')).toBe('')
    expect(displayText({})).toBe('')
  })

  it('stringifies finite numbers', () => {
    expect(displayText(10)).toBe('10')
  })
})

describe('formatStandardTimeToTarget', () => {
  it('formats baseline condition to post-intervention condition and years', () => {
    expect(formatStandardTimeToTarget('5. Poor', '4. Moderate', 10)).toBe(
      'Poor to Moderate - 10 years'
    )
    expect(formatStandardTimeToTarget('Moderate', 'Good', '5')).toBe(
      'Moderate to Good - 5 years'
    )
  })

  it('formats target condition and years when baseline condition is absent', () => {
    expect(formatStandardTimeToTarget(null, '4. Moderate', 10)).toBe(
      'Moderate - 10 years'
    )
    expect(formatStandardTimeToTarget('', 'Good', 0)).toBe('Good - 0 years')
  })

  it('returns empty when target condition or years are absent', () => {
    expect(formatStandardTimeToTarget('Poor', null, 10)).toBe('')
    expect(formatStandardTimeToTarget('Poor', 'Moderate', null)).toBe('')
    expect(formatStandardTimeToTarget('Poor', 'Moderate', '')).toBe('')
  })
})

describe('formatLengthDisplay', () => {
  it('formats metres as km with unit', () => {
    expect(formatLengthDisplay(336)).toBe('0.336km')
  })

  it('returns empty when length cannot be formatted', () => {
    expect(formatLengthDisplay(null)).toBe('')
  })
})

describe('buildSectionsViewOnlyBaseFields', () => {
  it('maps chrome and time/difficulty rows from proposed', () => {
    const fields = buildSectionsViewOnlyBaseFields(
      { ref: 'W-1', baseline: { condition: '5. Poor' } },
      { caption: 'Test Project' },
      {
        condition: '4. Moderate',
        conditionScore: 2,
        standardTimeToTargetCondition: 10,
        difficulty: 'Low',
        advanceOrDelay: 'Delay',
        finalTimeToTargetCondition: 15,
        difficultyMultiplier: 1
      }
    )

    expect(fields).toMatchObject({
      caption: 'Test Project',
      heading: 'W-1',
      pageTitle: 'W-1',
      habitatDetailsSectionHeading: PI_DETAILS_HEADING,
      timeDifficultySectionHeading: TIME_DIFFICULTY_SECTION_HEADING,
      habitatUnitsLabel: HABITAT_UNITS_DELIVERED_LABEL,
      targetConditionDisplay: 'Moderate (2)',
      standardTimeToTargetDisplay: `Poor to Moderate - 10${STANDARD_TIME_TO_TARGET_SUFFIX}`,
      standardDifficultyDisplay: 'Low',
      advanceOrDelayDisplay: 'Delay',
      finalTimeToTargetDisplay: '15',
      appliedDifficultyMultiplierDisplay: '1'
    })
  })
})

describe('withMultiplier', () => {
  it('returns an empty string when the value is absent', () => {
    expect(withMultiplier(null, 2)).toBe('')
    expect(withMultiplier('', 2)).toBe('')
  })

  it('appends the score in brackets when both value and score are present', () => {
    expect(withMultiplier('Low', 2)).toBe('Low (2)')
  })

  it('returns the value alone when the score is not a number', () => {
    expect(withMultiplier('Low', null)).toBe('Low')
    expect(withMultiplier('Low', undefined)).toBe('Low')
  })
})

describe('baselineDetailsHref', () => {
  it('builds the baseline details href when a feature id is provided', () => {
    expect(baselineDetailsHref(baselineFeatureId, projectId)).toBe(
      `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`
    )
  })

  it('returns null when no baseline feature id is provided', () => {
    expect(baselineDetailsHref(null, projectId)).toBeNull()
  })
})

describe('buildSharedPiViewOnlyFields', () => {
  it('maps shared display fields from a populated feature', () => {
    const feature = {
      ref: 'P-1',
      units: 2.5,
      retentionCategory: 'Retained',
      proposed: {
        distinctiveness: 'Low',
        distinctivenessScore: 2,
        condition: '6. Good',
        conditionScore: 3
      }
    }

    const fields = buildSharedPiViewOnlyFields(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId,
      listTabAnchor
    })

    expect(fields).toMatchObject({
      pageTitle: PI_DETAILS_HEADING,
      heading: PI_DETAILS_HEADING,
      caption: 'Test Project',
      habitatRef: 'P-1',
      interventionDisplay: 'Retained',
      distinctivenessDisplay: 'Low (2)',
      conditionDisplay: 'Good (3)',
      strategicSignificanceDisplay: 'Low (1)',
      habitatUnitsDisplay: '2.50',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list${listTabAnchor}`
    })
  })

  it('falls back to defaults when the feature is sparse', () => {
    const fields = buildSharedPiViewOnlyFields(
      {},
      {
        projectId,
        projectName: 'Test Project',
        baselineFeatureId: null,
        listTabAnchor
      }
    )

    expect(fields).toMatchObject({
      habitatRef: '',
      interventionDisplay: DEFAULT_INTERVENTION,
      distinctivenessDisplay: '',
      conditionDisplay: '',
      viewBaselineHref: null
    })
  })
})
