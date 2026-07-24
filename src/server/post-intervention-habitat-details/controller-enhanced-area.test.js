import { wreck } from '../common/helpers/wreck-client.js'
import {
  STANDARD_TIME_TO_TARGET_PREFIX,
  STANDARD_TIME_TO_TARGET_SUFFIX
} from './constants.js'
import {
  baselineFeatureId,
  createMockH,
  featureId,
  isProjectUrl,
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

describe('#postInterventionHabitatDetailsController enhanced area', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('GET renders the Enhanced area details page with section layout', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'habitat',
            feature: {
              featureId,
              ref: 'Habitat P-A2',
              sizeSquareMetres: 0,
              units: 0,
              retentionCategory: '1. Enhanced',
              proposed: {
                broadType: 'Grassland',
                type: 'Modified grassland',
                condition: 'Good',
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
          }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve({
          payload: {
            project: {
              name: 'Test Project',
              baseline: {
                habitats: [
                  { featureId: baselineFeatureId, ref: 'Habitat P-A2' }
                ]
              }
            }
          }
        })
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/pi-habitat-details-enhanced',
      expect.objectContaining({
        heading: 'Habitat P-A2',
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
        targetConditionDisplay: 'Good (3)',
        standardTimeToTargetDisplay: `${STANDARD_TIME_TO_TARGET_PREFIX}10${STANDARD_TIME_TO_TARGET_SUFFIX}`,
        standardDifficultyDisplay: 'Low',
        advanceOrDelayDisplay: 'Delay',
        finalTimeToTargetDisplay: '15',
        appliedDifficultyMultiplierDisplay: '1',
        viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
        backHref: `/projects/${projectId}/post-intervention-habitat-list#area-habitats`
      })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('formAction')
  })
})
