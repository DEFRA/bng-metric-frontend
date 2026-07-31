import { describe, it, expect } from 'vitest'

import { STANDARD_TIME_TO_TARGET_SUFFIX } from './constants.js'
import { buildCreatedAreaViewOnlyViewModel } from './created-area-view-only-view-model.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('buildCreatedAreaViewOnlyViewModel', () => {
  it('maps a Created area habitat to the two-section display model', () => {
    const feature = {
      ref: 'Habitat P-A1',
      sizeSquareMetres: 0,
      units: 0,
      retentionCategory: 'Created',
      baseline: { condition: '6. N/A - Other' },
      proposed: {
        broadType: 'Urban',
        type: 'Developed land; sealed surface',
        condition: 'N/A - Other',
        conditionScore: 0,
        distinctiveness: 'Very low',
        distinctivenessScore: 0,
        standardTimeToTargetCondition: '0',
        difficulty: 'Medium',
        advanceOrDelay: 'Advance – 0 years',
        finalTimeToTargetCondition: '0 years (0)',
        difficultyMultiplier: 1
      }
    }

    const vm = buildCreatedAreaViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Project name',
      baselineFeatureId
    })

    expect(vm).toMatchObject({
      heading: 'Habitat P-A1',
      pageTitle: 'Habitat P-A1',
      caption: 'Project name',
      habitatDetailsSectionHeading: 'Post-intervention habitat details',
      timeDifficultySectionHeading: 'Time to target / difficulty',
      habitatUnitsLabel: 'Habitat units delivered',
      interventionDisplay: 'Created',
      sizeDisplay: '0ha',
      broadHabitatDisplay: 'Urban',
      habitatTypeDisplay: 'Developed land; sealed surface',
      distinctivenessDisplay: 'Very low (0)',
      conditionDisplay: 'N/A - Other (0)',
      strategicSignificanceDisplay: 'Low (1)',
      habitatUnitsDisplay: '0.00',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list#area-habitats`,
      targetConditionDisplay: 'N/A - Other (0)',
      standardTimeToTargetDisplay: `N/A - Other to N/A - Other - 0${STANDARD_TIME_TO_TARGET_SUFFIX}`,
      standardDifficultyDisplay: 'Medium',
      advanceOrDelayDisplay: 'Advance – 0 years',
      finalTimeToTargetDisplay: '0 years (0)',
      appliedDifficultyMultiplierDisplay: '1'
    })
  })

  it('formats numeric display values and rejects non-primitive values', () => {
    const vm = buildCreatedAreaViewOnlyViewModel(
      {
        retentionCategory: 'Created',
        baseline: { condition: '6. N/A - Other' },
        proposed: {
          condition: 'N/A - Other',
          standardTimeToTargetCondition: 0,
          finalTimeToTargetCondition: 0,
          difficultyMultiplier: 1.5,
          difficulty: { level: 'Medium' },
          advanceOrDelay: ''
        }
      },
      { projectId, projectName: 'Project name', baselineFeatureId: null }
    )

    expect(vm.standardTimeToTargetDisplay).toBe(
      `N/A - Other to N/A - Other - 0${STANDARD_TIME_TO_TARGET_SUFFIX}`
    )
    expect(vm.finalTimeToTargetDisplay).toBe('0')
    expect(vm.appliedDifficultyMultiplierDisplay).toBe('1.5')
    expect(vm.standardDifficultyDisplay).toBe('')
    expect(vm.advanceOrDelayDisplay).toBe('')
  })

  it('uses empty placeholders and hides the baseline link for a sparse feature', () => {
    const vm = buildCreatedAreaViewOnlyViewModel(
      { retentionCategory: 'Created' },
      { projectId, projectName: 'Project name', baselineFeatureId: null }
    )

    expect(vm.heading).toBe('')
    expect(vm.conditionDisplay).toBe('')
    expect(vm.targetConditionDisplay).toBe('')
    expect(vm.standardTimeToTargetDisplay).toBe('')
    expect(vm.standardDifficultyDisplay).toBe('')
    expect(vm.advanceOrDelayDisplay).toBe('')
    expect(vm.finalTimeToTargetDisplay).toBe('')
    expect(vm.appliedDifficultyMultiplierDisplay).toBe('')
    expect(vm.viewBaselineHref).toBeNull()
  })
})
