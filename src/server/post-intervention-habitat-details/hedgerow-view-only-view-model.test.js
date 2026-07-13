import { describe, it, expect } from 'vitest'

import { buildHedgerowViewOnlyViewModel } from './hedgerow-view-only-view-model.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('buildHedgerowViewOnlyViewModel', () => {
  it('maps a fully populated retained hedgerow to display values', () => {
    const feature = {
      ref: 'H-1',
      sizeMetres: 2500,
      units: 3.5,
      baseline: { retentionCategory: 'Retained' },
      proposed: {
        type: 'Native hedgerow',
        condition: '3. Good',
        conditionScore: 3,
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
      habitatRef: 'H-1',
      interventionDisplay: 'Retained',
      // hedgerows measure length in km, not area
      sizeLabel: 'Length (km)',
      sizeDisplay: '2.5',
      // no broad-habitat dimension for hedgerows
      showBroadHabitatRow: false,
      habitatTypeDisplay: 'Native hedgerow',
      distinctivenessDisplay: 'Low (2)',
      // condition prefix stripped, multiplier appended
      conditionDisplay: 'Good (3)',
      strategicSignificanceDisplay: 'Low (1)',
      habitatUnitsDisplay: '3.50',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list#hedgerows`
    })
    // View-only page never carries a broad-habitat value for hedgerows.
    expect(vm).not.toHaveProperty('broadHabitatDisplay')
  })

  it('renders a value without its multiplier when the score is missing', () => {
    const feature = {
      ref: 'H-2',
      proposed: { distinctiveness: 'Medium', condition: 'Moderate' }
    }

    const vm = buildHedgerowViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId
    })

    expect(vm.distinctivenessDisplay).toBe('Medium')
    expect(vm.conditionDisplay).toBe('Moderate')
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
