import { STANDARD_TIME_TO_TARGET_SUFFIX } from './constants.js'
import {
  baselineFeatureId,
  createMockH,
  featureId,
  mockSectionAreaFeature,
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

describe('#postInterventionHabitatDetailsController created area', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('GET renders the Created area details page with section layout', async () => {
    mockSectionAreaFeature({
      ref: 'Habitat P-A1',
      retentionCategory: '1. Created',
      projectName: 'Project name',
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
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-created',
      expect.objectContaining({
        heading: 'Habitat P-A1',
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
        targetConditionDisplay: 'N/A - Other (0)',
        standardTimeToTargetDisplay: `N/A - Other - 0${STANDARD_TIME_TO_TARGET_SUFFIX}`,
        standardDifficultyDisplay: 'Medium',
        advanceOrDelayDisplay: 'Advance – 0 years',
        finalTimeToTargetDisplay: '0 years (0)',
        appliedDifficultyMultiplierDisplay: '1',
        viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
        backHref: `/projects/${projectId}/post-intervention-habitat-list#area-habitats`
      })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('formAction')
  })
})
