import { describe, it, expect } from 'vitest'

import { buildAreaViewOnlyViewModel } from './area-view-only-view-model.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('buildAreaViewOnlyViewModel', () => {
  it('maps a fully populated retained area habitat to display values', () => {
    const feature = {
      ref: 'P-1',
      sizeSquareMetres: 25000,
      units: 2.5,
      baseline: { retentionCategory: 'Retained' },
      proposed: {
        broadType: 'Grassland',
        type: 'Modified grassland',
        condition: '6. Good',
        conditionScore: 3,
        distinctiveness: 'Low',
        distinctivenessScore: 2
      }
    }

    const vm = buildAreaViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId
    })

    expect(vm).toMatchObject({
      heading: 'Post-intervention habitat details',
      caption: 'Test Project',
      habitatRef: 'P-1',
      interventionDisplay: 'Retained',
      sizeDisplay: '2.5ha',
      broadHabitatDisplay: 'Grassland',
      habitatTypeDisplay: 'Modified grassland',
      distinctivenessDisplay: 'Low (2)',
      // condition prefix stripped, multiplier appended
      conditionDisplay: 'Good (3)',
      strategicSignificanceDisplay: 'Low (1)',
      habitatUnitsDisplay: '2.50',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list#area-habitats`
    })
  })

  it('renders a value without its multiplier when the score is missing', () => {
    const feature = {
      ref: 'P-2',
      proposed: { distinctiveness: 'Medium', condition: 'Fairly Good' }
    }

    const vm = buildAreaViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId
    })

    expect(vm.distinctivenessDisplay).toBe('Medium')
    expect(vm.conditionDisplay).toBe('Fairly Good')
  })

  it('falls back to empty/default values and hides the link for a sparse feature', () => {
    const vm = buildAreaViewOnlyViewModel(
      {},
      { projectId, projectName: 'Test Project', baselineFeatureId: null }
    )

    expect(vm).toMatchObject({
      habitatRef: '',
      // no retention category on the feature -> defaults to the story's variant
      interventionDisplay: 'Retained',
      sizeDisplay: '',
      broadHabitatDisplay: '',
      habitatTypeDisplay: '',
      distinctivenessDisplay: '',
      conditionDisplay: '',
      habitatUnitsDisplay: '',
      // no matching baseline feature -> link is omitted
      viewBaselineHref: null
    })
  })
})
