import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import {
  PROJECT_ID,
  auth,
  registerLinearBaselinePageTests
} from '../test-helpers/linear-baseline-page-suite.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const featureFirst = {
  featureId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ref: 'W-1',
  type: 'Ditch',
  condition: 'Moderate',
  conditionScore: 2,
  distinctiveness: 'Medium',
  distinctivenessScore: 4,
  units: 0.8,
  sizeMetres: 1234567.891
}

const featureSecond = {
  featureId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ref: 'W-2',
  type: 'Rivers and streams',
  condition: 'Good',
  conditionScore: 3,
  distinctiveness: 'High',
  distinctivenessScore: 6,
  units: 1.2,
  sizeMetres: 1500
}

describe('watercourses baseline', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  registerLinearBaselinePageTests({
    getServer: () => server,
    path: '/watercourses-baseline',
    pageHeading: 'Baseline for watercourses',
    resultsHeading: 'Watercourses results',
    detailsHeading: 'Watercourses details',
    unitLabel: 'Watercourses',
    baselineActionText: 'View on-site watercourses baseline',
    summaryPath: '/watercourses-summary',
    habitatKey: 'watercourses',
    otherHabitatKey: 'hedgerows',
    otherLabel: 'Hedgerows',
    featureFirst,
    featureSecond,
    unitsTotalKey: 'watercoursesTotal'
  })

  test('renders watercourse feature types on the baseline page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/watercourses-baseline`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Ditch')
    expect(result).toContain('Rivers and streams')
  })
})
