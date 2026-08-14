import { createServer } from '../server.js'
import { load } from 'cheerio'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { formatUnits } from './controller.js'

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

const project = {
  project: {
    name: 'Riverbank restoration',
    baseline: {
      units: {
        habitatsTotal: 1.23456789012345,
        treesTotal: 0.285,
        hedgerowsTotal: 4.5,
        watercoursesTotal: 3
      }
    }
  }
}

describe('project summary', () => {
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
      payload: project
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('renders the baseline-only summary and project name', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Riverbank restoration')
    expect(result).toContain(
      'class="govuk-width-container app-width-container--wide"'
    )
    expect(result).toContain(
      'class="govuk-grid-row app-project-summary-layout"'
    )
    expect(result).toContain('class="app-grid-column-one-sixth"')
    expect(result).toContain('class="app-grid-column-five-sixths"')
    expect(result).toContain(
      '<h1 class="govuk-heading-xl govuk-!-margin-bottom-0">Summary</h1>'
    )
    expect(result).toContain('Area habitats')
    expect(result).toContain('Hedgerows')
    expect(result).toContain('Watercourses')
    expect(result.match(/Total on-site net percentage change/g)).toHaveLength(3)
    expect(result.match(/-100.00%/g)).toHaveLength(3)
    expect(result.match(/Not met/g)).toHaveLength(3)
    expect(result.match(/Trading Rules/g)).toHaveLength(3)
  })

  test('formats baseline, zero post-intervention and negative net units', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(result).toContain('1.52 units')
    expect(result).toContain('-1.52 units')
    expect(result).toContain('4.50 units')
    expect(result).toContain('-4.50 units')
    expect(result).toContain('3.00 units')
    expect(result).toContain('-3.00 units')
    expect(result.match(/0.00 units/g)).toHaveLength(3)
  })

  test('renders upload actions pointing to the new chooser with a summary return URL', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })
    const href =
      `/projects/${PROJECT_ID}/upload-file?` +
      `returnUrl=%2Fprojects%2F${PROJECT_ID}%2Fproject-summary`

    expect(result.split(`href="${href}"`)).toHaveLength(5)
  })

  test('renders text-only navigation, trading rules, and project details', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')

    expect(navigation).toHaveLength(1)
    expect(navigation.find('li')).toHaveLength(4)
    expect(navigation.find('[aria-current="page"]').text()).toBe('Summary')
    expect(navigation.find('a')).toHaveLength(0)
    expect(navigation.text()).toContain('Area Habitats')
    expect(navigation.text()).toContain('Hedgerows')
    expect(navigation.text()).toContain('Watercourses')
    expect(result).toContain('View trading rules')
    expect(result).not.toContain('>View trading rules</a>')
    expect(result).toContain('View project details')
    expect(result).not.toContain('>View project details</a>')
    expect(result).toContain('class="app-project-summary__actions"')
    expect(result).not.toContain('Submit metric')
    expect(result).toContain(
      'View and amend your project details, including project name and target percentage'
    )
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
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('returns bad gateway when the backend is unavailable', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Connection refused'))

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
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
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
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
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('>Project</span>')
    expect(result.match(/N\/A/g)).toHaveLength(3)
    expect(result).not.toContain('-100.00%')
    expect(result).not.toContain('Not met')
    expect(result).not.toContain('-0.00 units')
    expect(result.match(/0.00 units/g)).toHaveLength(9)
  })

  test('shows N/A without a status for zero-unit habitat categories', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Area-only project',
          baseline: {
            units: {
              habitatsTotal: 1,
              hedgerowsTotal: 0,
              watercoursesTotal: 0
            }
          }
        }
      }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result.match(/N\/A/g)).toHaveLength(2)
    expect(result.match(/-100.00%/g)).toHaveLength(1)
    expect(result.match(/Not met/g)).toHaveLength(1)
  })

  test.each([
    ['without baseline data', { name: 'No baseline' }],
    [
      'with post-intervention data',
      {
        name: 'Post-intervention project',
        baseline: { units: {} },
        postIntervention: { units: {} }
      }
    ]
  ])('redirects a project %s to the existing task list', async (_, data) => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project: data }
    })

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${PROJECT_ID}`)
  })

  test('rejects an invalid project id', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/project-summary',
      auth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires authentication', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })

  test('requires an approved BNG completer role', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
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

describe('formatUnits', () => {
  test.each([
    [1.234567890123456, '1.23'],
    [12345678901234.56, '12345678901234.60'],
    [-1.235, '-1.24'],
    [-0, '0.00'],
    [null, '0.00'],
    [Number.NaN, '0.00']
  ])('formats %s as %s', (value, expected) => {
    expect(formatUnits(value)).toBe(expected)
  })
})
