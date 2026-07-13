import { describe, it, expect } from 'vitest'

import { buildWatercourseViewOnlyViewModel } from './watercourse-view-only-view-model.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('buildWatercourseViewOnlyViewModel', () => {
  it('maps a fully populated retained watercourse to display values', () => {
    const feature = {
      ref: 'W-1',
      sizeMetres: 1234.56,
      units: 6.5,
      baseline: { retentionCategory: 'Retained' },
      proposed: {
        type: 'Ditches',
        condition: '4. Moderate',
        conditionScore: 2,
        distinctiveness: 'Low',
        distinctivenessScore: 4,
        watercourseEncroachment: 'Minor',
        waterEncroachmentMultiplier: 0.8,
        riparianEncroachment: 'Minor/No Encroachment',
        riparianEncroachmentMultiplier: 0.98
      }
    }

    const vm = buildWatercourseViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId
    })

    expect(vm).toMatchObject({
      heading: 'Post-intervention habitat details',
      caption: 'Test Project',
      habitatRef: 'W-1',
      interventionDisplay: 'Retained',
      // 7 significant figures, metres -> km
      sizeDisplay: '1.23456',
      habitatTypeDisplay: 'Ditches',
      distinctivenessDisplay: 'Low (4)',
      // condition prefix stripped, multiplier appended
      conditionDisplay: 'Moderate (2)',
      watercourseEncroachmentDisplay: 'Minor (0.8)',
      riparianEncroachmentDisplay: 'Minor/No Encroachment (0.98)',
      strategicSignificanceDisplay: 'Low (1)',
      habitatUnitsDisplay: '6.50',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list#watercourses`
    })
  })

  it('renders a value without its multiplier when the score is missing', () => {
    const feature = {
      ref: 'W-2',
      proposed: {
        distinctiveness: 'Medium',
        condition: 'Good',
        watercourseEncroachment: 'Major'
      }
    }

    const vm = buildWatercourseViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId
    })

    expect(vm.distinctivenessDisplay).toBe('Medium')
    expect(vm.conditionDisplay).toBe('Good')
    expect(vm.watercourseEncroachmentDisplay).toBe('Major')
  })

  it('falls back to empty/default values and hides the link for a sparse feature', () => {
    const vm = buildWatercourseViewOnlyViewModel(
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
      watercourseEncroachmentDisplay: '',
      riparianEncroachmentDisplay: '',
      habitatUnitsDisplay: '',
      // no matching baseline feature -> link is omitted
      viewBaselineHref: null
    })
  })
})
