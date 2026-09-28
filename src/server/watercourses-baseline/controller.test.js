import { createServer } from '../server.js'
import { load } from 'cheerio'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
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
    path: '/watercourses-baseline-summary',
    pageHeading: 'Baseline for watercourses',
    resultsHeading: 'Watercourses results',
    detailsHeading: 'Watercourses details',
    unitLabel: 'Watercourses',
    summaryPath: '/watercourses-summary',
    postInterventionPath: '/watercourses-post-intervention',
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
      url: `/projects/${PROJECT_ID}/watercourses-baseline-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Ditch')
    expect(result).toContain('Rivers and streams')
  })

  test('permanently redirects the previous baseline pathname to the canonical URL', async () => {
    const { headers, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/watercourses-baseline`,
      auth
    })

    expect(statusCode).toBe(statusCodes.movedPermanently)
    expect(headers.location).toBe(
      `/projects/${PROJECT_ID}/watercourses-baseline-summary`
    )
  })
})

describe('watercourses baseline trading rules status', () => {
  let server

  const projectWithStatus = (overall) => ({
    project: {
      name: 'Riverbank restoration',
      baseline: {
        units: { watercoursesTotal: 2 },
        watercourses: [featureFirst]
      }
    },
    tradingRuleStatuses: {
      watercourses: { medium: 'Not met', low: 'Met', overall }
    }
  })

  const renderWith = async (payload) => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload
    })
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/watercourses-baseline-summary`,
      auth
    })
    return load(result)
  }

  const tileByHeading = ($, heading) =>
    $('.app-unit-type-summary__tile').filter(
      (_, tile) => $(tile).find('h3').first().text() === heading
    )

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

  test('shows Met in the trading rules tile', async () => {
    const $ = await renderWith(projectWithStatus('Met'))
    const tag = tileByHeading($, 'Trading Rules').find('.govuk-tag')

    expect(tag.text()).toBe('Met')
    expect(tag.hasClass('govuk-tag--green')).toBe(true)
  })

  test('shows Not met in the trading rules tile', async () => {
    const $ = await renderWith(projectWithStatus('Not met'))
    const tag = tileByHeading($, 'Trading Rules').find('.govuk-tag')

    expect(tag.text()).toBe('Not met')
    expect(tag.hasClass('govuk-tag--red')).toBe(true)
  })

  test('shows no status when the backend returns no verdict', async () => {
    const $ = await renderWith({
      ...projectWithStatus(null),
      tradingRuleStatuses: { watercourses: { overall: null } }
    })

    expect(tileByHeading($, 'Trading Rules').find('.govuk-tag')).toHaveLength(0)
  })
})
