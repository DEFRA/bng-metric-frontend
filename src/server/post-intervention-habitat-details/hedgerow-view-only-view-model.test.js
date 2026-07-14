import { describe, it, expect } from 'vitest'

import { buildHedgerowViewOnlyViewModel } from './hedgerow-view-only-view-model.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('buildHedgerowViewOnlyViewModel', () => {
  it('maps a fully populated retained hedgerow habitat to display values', () => {
    const feature = {
      ref: 'HG-2',
      sizeMetres: 336,
      units: 4.25,
      baseline: { retentionCategory: 'Retained' },
      proposed: {
        type: 'Native hedgerow',
        condition: '4. Moderate',
        conditionScore: 2,
        distinctiveness: 'Low',
        distinctivenessScore: 2
      }
    }

    const vm = buildHedgerowViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId
    })

    expect(vm).toMatchObject({
      heading: 'Post-intervention habitat details',
      caption: 'Test Project',
      habitatRef: 'HG-2',
      interventionDisplay: 'Retained',
      // length in metres rendered as kilometres
      sizeDisplay: '0.336',
      habitatTypeDisplay: 'Native hedgerow',
      distinctivenessDisplay: 'Low (2)',
      // condition prefix stripped, multiplier appended
      conditionDisplay: 'Moderate (2)',
      strategicSignificanceDisplay: 'Low (1)',
      habitatUnitsDisplay: '4.25',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list#hedgerows`
    })
  })

  it('renders a value without its multiplier when the score is missing', () => {
    const feature = {
      ref: 'HG-3',
      proposed: { distinctiveness: 'Medium', condition: 'Good' }
    }

    const vm = buildHedgerowViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId
    })

    expect(vm.distinctivenessDisplay).toBe('Medium')
    expect(vm.conditionDisplay).toBe('Good')
  })

  it('falls back to empty/default values and hides the link for a sparse feature', () => {
    const vm = buildHedgerowViewOnlyViewModel(
      {},
      { projectId, projectName: 'Test Project', baselineFeatureId: null }
    )

    expect(vm).toMatchObject({
      habitatRef: '',
      // no retention category on the feature -> defaults to the story's variant
      interventionDisplay: 'Retained',
      sizeDisplay: '',
      habitatTypeDisplay: '',
      distinctivenessDisplay: '',
      conditionDisplay: '',
      habitatUnitsDisplay: '',
      // no matching baseline feature -> link is omitted
      viewBaselineHref: null
    })
  })
})
