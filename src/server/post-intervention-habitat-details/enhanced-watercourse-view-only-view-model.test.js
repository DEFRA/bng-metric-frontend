import { describe, it, expect } from 'vitest'

import { STANDARD_TIME_TO_TARGET_SUFFIX } from './constants.js'
import { buildEnhancedWatercourseViewOnlyViewModel } from './enhanced-watercourse-view-only-view-model.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('buildEnhancedWatercourseViewOnlyViewModel', () => {
  it('maps an Enhanced watercourse to the two-section display model', () => {
    const feature = {
      ref: 'W-A2',
      sizeMetres: 1000,
      units: 9.9,
      retentionCategory: 'Enhanced',
      baseline: { condition: '5. Poor' },
      proposed: {
        type: 'Priority habitat',
        condition: '4. Moderate',
        conditionScore: 2,
        distinctiveness: 'V.High',
        distinctivenessScore: 8,
        watercourseEncroachment: 'Minor',
        waterEncroachmentMultiplier: 0.8,
        riparianEncroachment: 'Minor/No Encroachment',
        riparianEncroachmentMultiplier: 0.98,
        standardTimeToTargetCondition: '4',
        difficulty: 'Medium',
        advanceOrDelay: 'Neither',
        finalTimeToTargetCondition: '4 years (0.867)',
        difficultyMultiplier: 0.67
      }
    }

    const vm = buildEnhancedWatercourseViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId
    })

    expect(vm).toMatchObject({
      heading: 'W-A2',
      pageTitle: 'W-A2',
      caption: 'Test Project',
      habitatDetailsSectionHeading: 'Post-intervention habitat details',
      timeDifficultySectionHeading: 'Time to target / difficulty',
      habitatUnitsLabel: 'Habitat units delivered',
      interventionDisplay: 'Enhanced',
      sizeDisplay: '1km',
      habitatTypeDisplay: 'Priority habitat',
      distinctivenessDisplay: 'V.High (8)',
      conditionDisplay: 'Moderate (2)',
      strategicSignificanceDisplay: 'Low (1)',
      watercourseEncroachmentDisplay: 'Minor (0.8)',
      riparianEncroachmentDisplay: 'Minor/No Encroachment (0.98)',
      habitatUnitsDisplay: '9.90',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list#watercourses`,
      targetConditionDisplay: 'Moderate (2)',
      standardTimeToTargetDisplay: `Poor to Moderate - 4${STANDARD_TIME_TO_TARGET_SUFFIX}`,
      standardDifficultyDisplay: 'Medium',
      advanceOrDelayDisplay: 'Neither',
      finalTimeToTargetDisplay: '4 years (0.867)',
      appliedDifficultyMultiplierDisplay: '0.67'
    })
  })

  it('renders encroachment values without their multiplier when the score is missing', () => {
    const vm = buildEnhancedWatercourseViewOnlyViewModel(
      {
        retentionCategory: 'Enhanced',
        baseline: { condition: '5. Poor' },
        proposed: { watercourseEncroachment: 'Major' }
      },
      { projectId, projectName: 'Test Project', baselineFeatureId: null }
    )

    expect(vm.watercourseEncroachmentDisplay).toBe('Major')
    expect(vm.riparianEncroachmentDisplay).toBe('')
  })

  it('uses empty placeholders and hides the baseline link for a sparse feature', () => {
    const vm = buildEnhancedWatercourseViewOnlyViewModel(
      { retentionCategory: 'Enhanced' },
      { projectId, projectName: 'Test Project', baselineFeatureId: null }
    )

    expect(vm.heading).toBe('')
    expect(vm.sizeDisplay).toBe('')
    expect(vm.watercourseEncroachmentDisplay).toBe('')
    expect(vm.riparianEncroachmentDisplay).toBe('')
    expect(vm.targetConditionDisplay).toBe('')
    expect(vm.standardTimeToTargetDisplay).toBe('')
    expect(vm.standardDifficultyDisplay).toBe('')
    expect(vm.advanceOrDelayDisplay).toBe('')
    expect(vm.finalTimeToTargetDisplay).toBe('')
    expect(vm.appliedDifficultyMultiplierDisplay).toBe('')
    expect(vm.viewBaselineHref).toBeNull()
  })
})
