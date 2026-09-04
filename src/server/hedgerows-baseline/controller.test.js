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
  ref: 'H-1',
  type: 'Native hedgerow',
  condition: 'Good',
  conditionScore: 3,
  distinctiveness: 'Low',
  distinctivenessScore: 2,
  units: 0.8,
  sizeMetres: 1234567.891
}

const featureSecond = {
  featureId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ref: 'H-2',
  type: 'Species-rich hedgerow',
  condition: 'Moderate',
  conditionScore: 2,
  distinctiveness: 'Medium',
  distinctivenessScore: 4,
  units: 1.2,
  sizeMetres: 1500
}

describe('hedgerows baseline', () => {
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
    path: '/hedgerows-baseline',
    pageHeading: 'Baseline for hedgerows',
    resultsHeading: 'Hedgerows results',
    detailsHeading: 'Hedgerows details',
    unitLabel: 'Hedgerows',
    summaryPath: '/hedgerows-summary',
    habitatKey: 'hedgerows',
    otherHabitatKey: 'watercourses',
    otherLabel: 'Watercourses',
    featureFirst,
    featureSecond,
    unitsTotalKey: 'hedgerowsTotal'
  })

  test('renders hedgerow feature types on the baseline page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-baseline`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Native hedgerow')
    expect(result).toContain('Species-rich hedgerow')
  })
})
