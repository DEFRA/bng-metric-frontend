import { describe, it, expect } from 'vitest'

import { PI_DETAILS_HEADING } from './constants.js'
import {
  baselineDetailsHref,
  buildSharedPiViewOnlyFields,
  withMultiplier
} from './view-only-shared.js'
import { DEFAULT_INTERVENTION } from './retention.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const listTabAnchor = '#area-habitats'

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
