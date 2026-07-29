import { wreck } from '../common/helpers/wreck-client.js'
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

describe('#postInterventionHabitatDetailsController created hedgerow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('GET renders the Created hedgerow details page with section layout', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/post-intervention/features/${featureId}`)) {
        return Promise.resolve({
          payload: {
            type: 'hedgerow',
            feature: {
              featureId,
              ref: 'Hedge P-H2',
              sizeMetres: 336,
              units: 4.25,
              retentionCategory: '2. Created',
              proposed: {
                type: 'Native hedgerow',
                condition: 'Moderate',
                conditionScore: 2,
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
                hedgerows: [{ featureId: baselineFeatureId, ref: 'Hedge P-H2' }]
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
      'habitat-details/pi-hedgerow-details-enhanced',
      expect.objectContaining({
        heading: 'Hedge P-H2',
        caption: 'Test Project',
        habitatDetailsSectionHeading: 'Post-intervention habitat details',
        timeDifficultySectionHeading: 'Time to target / difficulty',
        habitatUnitsLabel: 'Habitat units delivered',
        interventionDisplay: 'Created',
        sizeDisplay: '0.336km',
        habitatTypeDisplay: 'Native hedgerow',
        targetConditionDisplay: 'Moderate (2)',
        standardTimeToTargetDisplay:
          'Baseline condition to target condition - 10 years',
        standardDifficultyDisplay: 'Low',
        advanceOrDelayDisplay: 'Delay',
        finalTimeToTargetDisplay: '15',
        appliedDifficultyMultiplierDisplay: '1',
        viewBaselineHref: null,
        backHref: `/projects/${projectId}/post-intervention-habitat-list#hedgerows`
      })
    )
    expect(h.view.mock.calls[0][1]).not.toHaveProperty('formAction')
  })
})
