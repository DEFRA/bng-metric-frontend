import { describe, it, expect } from 'vitest'

import { STANDARD_TIME_TO_TARGET_SUFFIX } from './constants.js'
import { buildEnhancedAreaViewOnlyViewModel } from './enhanced-area-view-only-view-model.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('buildEnhancedAreaViewOnlyViewModel', () => {
  it('maps an Enhanced area habitat to the two-section display model', () => {
    const feature = {
      ref: 'Habitat P-A2',
      sizeSquareMetres: 0,
      units: 0,
      retentionCategory: 'Enhanced',
      baseline: { condition: '5. Poor' },
      proposed: {
        broadType: 'Grassland',
        type: 'Modified grassland',
        condition: '6. Good',
        conditionScore: 3,
        distinctiveness: 'Low',
        distinctivenessScore: 2,
        standardTimeToTargetCondition: '10',
        difficulty: 'Low',
        advanceOrDelay: 'Delay',
        finalTimeToTargetCondition: '15',
        difficultyMultiplier: 1
      }
    }

    const vm = buildEnhancedAreaViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId
    })

    expect(vm).toMatchObject({
      heading: 'Habitat P-A2',
      pageTitle: 'Habitat P-A2',
      caption: 'Test Project',
      habitatDetailsSectionHeading: 'Post-intervention habitat details',
      timeDifficultySectionHeading: 'Time to target / difficulty',
      habitatUnitsLabel: 'Habitat units delivered',
      interventionDisplay: 'Enhanced',
      sizeDisplay: '0ha',
      broadHabitatDisplay: 'Grassland',
      habitatTypeDisplay: 'Modified grassland',
      distinctivenessDisplay: 'Low (2)',
      conditionDisplay: 'Good (3)',
      strategicSignificanceDisplay: 'Low (1)',
      habitatUnitsDisplay: '0.00',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list#area-habitats`,
      targetConditionDisplay: 'Good (3)',
      standardTimeToTargetDisplay: `Poor to Good - 10${STANDARD_TIME_TO_TARGET_SUFFIX}`,
      standardDifficultyDisplay: 'Low',
      advanceOrDelayDisplay: 'Delay',
      finalTimeToTargetDisplay: '15',
      appliedDifficultyMultiplierDisplay: '1'
    })
  })

  it('formats numeric display values and rejects non-primitive values', () => {
    const vm = buildEnhancedAreaViewOnlyViewModel(
      {
        retentionCategory: 'Enhanced',
        baseline: { condition: '5. Poor' },
        proposed: {
          condition: 'Good',
          standardTimeToTargetCondition: 10,
          finalTimeToTargetCondition: 15,
          difficultyMultiplier: 1.5,
          difficulty: { level: 'Low' },
          advanceOrDelay: ''
        }
      },
      { projectId, projectName: 'Test Project', baselineFeatureId: null }
    )

    expect(vm.standardTimeToTargetDisplay).toBe(
      `Poor to Good - 10${STANDARD_TIME_TO_TARGET_SUFFIX}`
    )
    expect(vm.finalTimeToTargetDisplay).toBe('15')
    expect(vm.appliedDifficultyMultiplierDisplay).toBe('1.5')
    expect(vm.standardDifficultyDisplay).toBe('')
    expect(vm.advanceOrDelayDisplay).toBe('')
  })

  it('uses empty placeholders and hides the baseline link for a sparse feature', () => {
    const vm = buildEnhancedAreaViewOnlyViewModel(
      { retentionCategory: 'Enhanced' },
      { projectId, projectName: 'Test Project', baselineFeatureId: null }
    )

    expect(vm.heading).toBe('')
    expect(vm.targetConditionDisplay).toBe('')
    expect(vm.standardTimeToTargetDisplay).toBe('')
    expect(vm.standardDifficultyDisplay).toBe('')
    expect(vm.advanceOrDelayDisplay).toBe('')
    expect(vm.finalTimeToTargetDisplay).toBe('')
    expect(vm.appliedDifficultyMultiplierDisplay).toBe('')
    expect(vm.viewBaselineHref).toBeNull()
  })
})
