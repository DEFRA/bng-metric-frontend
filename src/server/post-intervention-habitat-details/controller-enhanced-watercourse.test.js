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

describe('#postInterventionHabitatDetailsController enhanced watercourse', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('GET renders the Enhanced watercourse details page with section layout', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'watercourse',
            feature: {
              featureId,
              ref: 'W-A2',
              sizeMetres: 1000,
              units: 9.9,
              retentionCategory: '1. Enhanced',
              proposed: {
                type: 'Priority habitat',
                condition: 'Moderate',
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
          }
        })
      }
      if (isProjectUrl(url)) {
        return Promise.resolve({
          payload: {
            project: {
              name: 'Test Project',
              baseline: {
                watercourses: [{ featureId: baselineFeatureId, ref: 'W-A2' }]
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
      'habitat-details/pi-watercourse-details-enhanced',
      expect.objectContaining({
        heading: 'W-A2',
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
        targetConditionDisplay: 'Moderate (2)',
        standardTimeToTargetDisplay: `${STANDARD_TIME_TO_TARGET_PREFIX}4${STANDARD_TIME_TO_TARGET_SUFFIX}`,
        standardDifficultyDisplay: 'Medium',
        advanceOrDelayDisplay: 'Neither',
        finalTimeToTargetDisplay: '4 years (0.867)',
        appliedDifficultyMultiplierDisplay: '0.67',
        viewBaselineHref: `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`,
        backHref: `/projects/${projectId}/post-intervention-habitat-list#watercourses`
      })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('formAction')
  })
})
