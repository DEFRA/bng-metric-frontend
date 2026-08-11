import { describe, it, expect } from 'vitest'

import { STANDARD_TIME_TO_TARGET_SUFFIX } from './constants.js'
import { buildCreatedWatercourseViewOnlyViewModel } from './created-watercourse-view-only-view-model.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('buildCreatedWatercourseViewOnlyViewModel', () => {
  it('maps a Created watercourse to the two-section display model', () => {
    const feature = {
      ref: 'W-A1',
      sizeMetres: 500,
      units: 3.5,
      retentionCategory: 'Created',
      proposed: {
        type: 'Ditches',
        condition: 'Moderate',
        conditionScore: 2,
        distinctiveness: 'Low',
        distinctivenessScore: 4,
        watercourseEncroachment: 'Minor',
        waterEncroachmentMultiplier: 0.8,
        riparianEncroachment: 'Minor/No Encroachment',
        riparianEncroachmentMultiplier: 0.98,
        standardTimeToTargetCondition: '0',
        difficulty: 'Low',
        advanceOrDelay: 'Neither',
        finalTimeToTargetCondition: '0 years (1)',
        difficultyMultiplier: 1
      }
    }

    const vm = buildCreatedWatercourseViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Project name',
      baselineFeatureId
    })

    expect(vm).toMatchObject({
      heading: 'W-A1',
      pageTitle: 'W-A1',
      caption: 'Project name',
      habitatDetailsSectionHeading: 'Post-intervention habitat details',
      timeDifficultySectionHeading: 'Time to target / difficulty',
      habitatUnitsLabel: 'Habitat units delivered',
      interventionDisplay: 'Created',
      sizeDisplay: '0.5km',
      habitatTypeDisplay: 'Ditches',
      distinctivenessDisplay: 'Low (4)',
      conditionDisplay: 'Moderate (2)',
      strategicSignificanceDisplay: 'Low (1)',
      watercourseEncroachmentDisplay: 'Minor (0.8)',
      riparianEncroachmentDisplay: 'Minor/No Encroachment (0.98)',
      habitatUnitsDisplay: '3.50',
      viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
      backHref: `/projects/${projectId}/post-intervention-habitat-list#watercourses`,
      targetConditionDisplay: 'Moderate (2)',
      standardTimeToTargetDisplay: `Moderate - 0${STANDARD_TIME_TO_TARGET_SUFFIX}`,
      standardDifficultyDisplay: 'Low',
      advanceOrDelayDisplay: 'Neither',
      finalTimeToTargetDisplay: '0 years (1)',
      appliedDifficultyMultiplierDisplay: '1'
    })
  })

  it('formats numeric display values and rejects non-primitive values', () => {
    const vm = buildCreatedWatercourseViewOnlyViewModel(
      {
        retentionCategory: 'Created',
        proposed: {
          condition: 'Moderate',
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
      `Moderate - 0${STANDARD_TIME_TO_TARGET_SUFFIX}`
    )
    expect(vm.finalTimeToTargetDisplay).toBe('0')
    expect(vm.appliedDifficultyMultiplierDisplay).toBe('1.5')
    expect(vm.standardDifficultyDisplay).toBe('')
    expect(vm.advanceOrDelayDisplay).toBe('')
  })

  it('uses empty placeholders and hides the baseline link for a sparse feature', () => {
    const vm = buildCreatedWatercourseViewOnlyViewModel(
      { retentionCategory: 'Created' },
      { projectId, projectName: 'Project name', baselineFeatureId: null }
    )

    expect(vm.heading).toBe('')
    expect(vm.sizeDisplay).toBe('')
    expect(vm.conditionDisplay).toBe('')
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
