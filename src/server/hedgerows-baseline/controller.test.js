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
    postInterventionPath: '/hedgerows-post-intervention',
    postInterventionRequiresUpload: true,
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

  test('links the post-intervention tile when post-intervention has been loaded', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Riverbank restoration',
          baseline: {
            units: { hedgerowsTotal: 2 },
            hedgerows: [featureFirst]
          },
          postIntervention: {
            hedgerows: [{ retentionCategory: 'Created' }],
            units: { hedgerowsTotal: 1.64 }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-baseline`,
      auth
    })

    const $ = load(result)
    const interventionLink = $('.app-unit-type-summary a').filter(
      (_, link) =>
        $(link).text().trim() === 'View on-site hedgerows post intervention'
    )

    expect(interventionLink).toHaveLength(1)
    expect(interventionLink.attr('href')).toBe(
      `/projects/${PROJECT_ID}/hedgerows-post-intervention`
    )
  })
})

describe('hedgerows baseline trading rules status', () => {
  let server

  const baselineProject = {
    project: {
      name: 'Riverbank restoration',
      baseline: {
        units: { hedgerowsTotal: 2 },
        hedgerows: [featureFirst, featureSecond]
      }
    }
  }

  const projectWithStatus = (overall) => ({
    ...baselineProject,
    tradingRuleStatuses: {
      hedgerows: { medium: 'Met', low: 'Not met', veryLow: 'Met', overall }
    }
  })

  const renderWith = async (payload) => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload
    })
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-baseline`,
      auth
    })
    return load(result)
  }

  const tradingRulesTile = ($) =>
    $('.app-unit-type-summary__tile').filter(
      (_, tile) => $(tile).find('h3').first().text() === 'Trading Rules'
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
    const tag = tradingRulesTile($).find('.govuk-tag')

    expect(tag.text()).toBe('Met')
    expect(tag.hasClass('govuk-tag--green')).toBe(true)
  })

  test('shows Not met in the trading rules tile', async () => {
    // The site-wide verdict, not a band: here Low fails while Medium and Very
    // Low pass.
    const $ = await renderWith(projectWithStatus('Not met'))
    const tag = tradingRulesTile($).find('.govuk-tag')

    expect(tag.text()).toBe('Not met')
    expect(tag.hasClass('govuk-tag--red')).toBe(true)
  })

  test('shows no status when the backend returns no verdict', async () => {
    const $ = await renderWith(projectWithStatus(null))

    expect(tradingRulesTile($)).toHaveLength(1)
    expect(tradingRulesTile($).find('.govuk-tag')).toHaveLength(0)
  })
})
