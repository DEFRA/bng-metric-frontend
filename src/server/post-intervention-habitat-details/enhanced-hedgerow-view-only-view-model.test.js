import { STANDARD_TIME_TO_TARGET_SUFFIX } from './constants.js'
import { buildEnhancedHedgerowViewOnlyViewModel } from './enhanced-hedgerow-view-only-view-model.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('buildEnhancedHedgerowViewOnlyViewModel', () => {
  it('maps an Enhanced hedgerow to the two-section display model', () => {
    const vm = buildEnhancedHedgerowViewOnlyViewModel(
      {
        ref: 'Hedge P-H2',
        sizeMetres: 336,
        units: 4.25,
        retentionCategory: 'Enhanced',
        baseline: { condition: '5. Poor' },
        proposed: {
          type: 'Native hedgerow',
          condition: '4. Moderate',
          conditionScore: 2,
          distinctiveness: 'Low',
          distinctivenessScore: 2,
          standardTimeToTargetCondition: '10',
          difficulty: 'Low',
          advanceOrDelay: 'Delay',
          finalTimeToTargetCondition: '15',
          difficultyMultiplier: 1
        }
      },
      { projectId, projectName: 'Test Project', baselineFeatureId }
    )

    expect(vm).toMatchObject({
      heading: 'Hedge P-H2',
      pageTitle: 'Hedge P-H2',
      caption: 'Test Project',
      habitatDetailsSectionHeading: 'Post-intervention habitat details',
      timeDifficultySectionHeading: 'Time to target / difficulty',
      habitatUnitsLabel: 'Habitat units delivered',
      interventionDisplay: 'Enhanced',
      sizeDisplay: '0.336km',
      habitatTypeDisplay: 'Native hedgerow',
      distinctivenessDisplay: 'Low (2)',
      conditionDisplay: 'Moderate (2)',
      targetConditionDisplay: 'Moderate (2)',
      standardTimeToTargetDisplay: `Poor to Moderate - 10${STANDARD_TIME_TO_TARGET_SUFFIX}`,
      standardDifficultyDisplay: 'Low',
      advanceOrDelayDisplay: 'Delay',
      finalTimeToTargetDisplay: '15',
      appliedDifficultyMultiplierDisplay: '1',
      habitatUnitsDisplay: '4.25',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list#hedgerows`
    })
  })

  it('uses empty placeholders for a sparse feature', () => {
    const vm = buildEnhancedHedgerowViewOnlyViewModel(
      { retentionCategory: 'Enhanced' },
      { projectId, projectName: 'Test Project', baselineFeatureId: null }
    )

    expect(vm.heading).toBe('')
    expect(vm.sizeDisplay).toBe('')
    expect(vm.targetConditionDisplay).toBe('')
    expect(vm.standardTimeToTargetDisplay).toBe('')
    expect(vm.standardDifficultyDisplay).toBe('')
    expect(vm.advanceOrDelayDisplay).toBe('')
    expect(vm.finalTimeToTargetDisplay).toBe('')
    expect(vm.appliedDifficultyMultiplierDisplay).toBe('')
    expect(vm.viewBaselineHref).toBeNull()
  })
})
