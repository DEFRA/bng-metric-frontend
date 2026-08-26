import { createServer } from '../server.js'
import { load } from 'cheerio'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const projectWithPostIntervention = {
  project: {
    name: 'Riverbank restoration',
    baseline: {
      units: {
        habitatsTotal: 1.23456789012345,
        treesTotal: 0.285
      }
    },
    postIntervention: {
      units: {
        habitatsTotal: 1.64,
        treesTotal: 0,
        habitatsNetUnitChange: 0.12,
        habitatsNetUnitChangePercentage: 7.72
      }
    }
  }
}

const baselineOnlyProject = {
  project: {
    name: 'Baseline only project',
    baseline: {
      units: {
        habitatsTotal: 1.23456789012345,
        treesTotal: 0.285
      }
    }
  }
}

describe('area summary', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: projectWithPostIntervention
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('renders the page heading, project name and Results subheading', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Riverbank restoration')
    expect(result).toContain(
      '<h1 class="govuk-heading-xl govuk-!-margin-bottom-0">Area habitats</h1>'
    )
    expect(result).toContain('<h2 class="govuk-heading-m">Results</h2>')
    expect(result).toContain('class="app-grid-column-one-sixth"')
    expect(result).toContain('class="app-grid-column-five-sixths"')
  })

  test('renders a single Results section for area habitats only', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    const $ = load(result)

    expect($('.app-unit-type-summary')).toHaveLength(1)
    expect($('#area-habitats-heading')).toHaveLength(0)
    expect(
      $('.app-unit-type-summary a').filter(
        (_, link) => $(link).text() === 'Area habitats'
      )
    ).toHaveLength(0)
  })

  test('links the baseline action to the area baseline page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    const $ = load(result)
    const baselineLink = $('a').filter(
      (_, link) => $(link).text() === 'View on-site area baseline'
    )

    expect(baselineLink).toHaveLength(1)
    expect(baselineLink.attr('href')).toBe(
      `/projects/${PROJECT_ID}/area-baseline`
    )
  })

  test('renders results values matching baseline and post-intervention data', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    const $ = load(result)
    const areaSummary = $('.app-unit-type-summary')

    expect(areaSummary.text()).toContain('7.72%')
    expect(areaSummary.text()).toContain('1.52 units')
    expect(areaSummary.text()).toContain('1.64 units')
    expect(areaSummary.text()).toContain('0.12 units')
    expect($('.govuk-tag--red').text()).toBe('Not met')
  })

  test('renders the targets section with the worked example from the design', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    const $ = load(result)
    const targets = $('#targets-heading').closest('section')

    expect(targets.text()).toContain('10%')
    expect(targets.text()).toContain('1.67 units')
    expect(targets.text()).toContain('0.03 units')
    expect(targets.find('a')).toHaveLength(0)
  })

  test('clamps unit deficit to zero when post-intervention meets the target, independently of the net percentage badge', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Riverbank restoration',
          baseline: { units: { habitatsTotal: 1, treesTotal: 0 } },
          postIntervention: {
            units: {
              habitatsTotal: 2,
              treesTotal: 0,
              habitatsNetUnitChange: 1,
              habitatsNetUnitChangePercentage: 5
            }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    const $ = load(result)
    const targets = $('#targets-heading').closest('section')

    expect(targets.text()).toContain('1.10 units')
    expect(targets.text()).toContain('0.00 units')
    expect($('.govuk-tag--red').text()).toBe('Not met')
  })

  test('renders a baseline-only project instead of redirecting, with deficit equal to units required', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: baselineOnlyProject
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)

    const $ = load(result)
    const areaSummary = $('.app-unit-type-summary')
    const targets = $('#targets-heading').closest('section')

    expect(areaSummary.text()).toContain('-100.00%')
    expect($('.govuk-tag--red').text()).toBe('Not met')
    expect(result).toContain('Upload on-site post intervention file')
    expect(targets.text()).toContain('1.67 units')
    expect(targets.text().match(/1\.67 units/g)).toHaveLength(2)
  })

  test('renders navigation with Summary linked and Area habitats current, no href', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')

    expect(navigation.find('[aria-current="page"]').text()).toBe(
      'Area habitats'
    )
    expect(navigation.find('a').attr('href')).toBe(
      `/projects/${PROJECT_ID}/project-summary`
    )
    expect(navigation.text()).toContain('Summary')
    expect(
      navigation.find('a').filter((_, link) => $(link).text() === 'Baseline')
    ).toHaveLength(1)
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === 'Baseline')
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}/area-baseline`)
  })

  test('shows Hedgerows and Watercourses nav links only when those habitats are present', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Mixed habitats',
          baseline: {
            units: { habitatsTotal: 1, treesTotal: 0 },
            hedgerows: [{ id: 'h1' }],
            watercourses: []
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')

    expect(navigation.text()).toContain('Hedgerows')
    expect(navigation.text()).not.toContain('Watercourses')
    expect(
      navigation.find('a').filter((_, link) => $(link).text() === 'Hedgerows')
    ).toHaveLength(1)
  })

  test('does not render the out-of-scope map or actions sections', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    expect(result).not.toContain('View map')
    expect(result).not.toContain('flags for review')
  })

  test('renders the upload action with a return URL back to this page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })
    const href =
      `/projects/${PROJECT_ID}/upload-file?` +
      `returnUrl=%2Fprojects%2F${PROJECT_ID}%2Farea-summary`

    expect(result).toContain(`href="${href}"`)
  })

  test('uses safe display defaults for missing or malformed unit data', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          baseline: {
            units: {
              habitatsTotal: 'not-a-number',
              treesTotal: Number.POSITIVE_INFINITY
            }
          }
        }
      }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('>Project</span>')
    expect(result).not.toContain('Not met')
  })

  test('shows N/A for the unit deficit, not a full deficit, when post-intervention data is present but incomplete', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Riverbank restoration',
          baseline: { units: { habitatsTotal: 1, treesTotal: 0 } },
          postIntervention: {
            units: {
              habitatsTotal: 'not-a-number',
              treesTotal: Number.POSITIVE_INFINITY
            }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    const $ = load(result)
    const areaSummary = $('.app-unit-type-summary')
    const targets = $('#targets-heading').closest('section')

    expect(areaSummary.text()).toContain('N/A')
    expect(targets.text()).toContain('1.10 units')
    expect(targets.text()).toContain('N/A')
    expect(targets.text()).not.toMatch(/0\.00 units/)
  })

  test('returns not found when the backend cannot find the project', async () => {
    vi.mocked(wreck.get).mockRejectedValue(
      Object.assign(new Error('Not found'), {
        data: {
          isResponseError: true,
          res: { statusCode: statusCodes.notFound },
          payload: null
        }
      })
    )

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('returns bad gateway when the backend is unavailable', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Connection refused'))

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('returns bad gateway for an unsuccessful backend response', async () => {
    vi.mocked(wreck.get).mockRejectedValue(
      Object.assign(new Error('Service unavailable'), {
        data: {
          isResponseError: true,
          res: { statusCode: 503 },
          payload: null
        }
      })
    )

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('redirects a project without baseline data to the existing task list', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project: { name: 'No baseline' } }
    })

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${PROJECT_ID}`)
  })

  test('rejects an invalid project id', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/area-summary',
      auth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires authentication', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })

  test('requires an approved BNG completer role', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-summary`,
      auth: {
        strategy: 'session',
        credentials: { ...auth.credentials, roles: [] }
      }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
    expect(wreck.get).not.toHaveBeenCalled()
  })
})
