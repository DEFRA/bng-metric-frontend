import { STANDARD_TIME_TO_TARGET_SUFFIX } from './constants.js'
import {
  baselineFeatureId,
  createMockH,
  featureId,
  mockSectionWatercourseFeature,
  projectId
} from './controller-test-helpers.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const { getController } = await import('./controller.js')

describe('#postInterventionHabitatDetailsController created watercourse', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('GET renders the Created watercourse details page with section layout', async () => {
    mockSectionWatercourseFeature({
      ref: 'W-A1',
      retentionCategory: '1. Created',
      baseline: { condition: '6. N/A' },
      projectName: 'Project name',
      sizeMetres: 500,
      units: 3.5,
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
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-watercourse-details-created',
      expect.objectContaining({
        heading: 'W-A1',
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
        targetConditionDisplay: 'Moderate (2)',
        standardTimeToTargetDisplay: `N/A to Moderate - 0${STANDARD_TIME_TO_TARGET_SUFFIX}`,
        standardDifficultyDisplay: 'Low',
        advanceOrDelayDisplay: 'Neither',
        finalTimeToTargetDisplay: '0 years (1)',
        appliedDifficultyMultiplierDisplay: '1',
        viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
        backHref: `/projects/${projectId}/post-intervention-habitat-list#watercourses`
      })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('formAction')
  })
})
