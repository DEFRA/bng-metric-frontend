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
      hedgerows: [{}],
      units: { hedgerowsTotal: 4.5 }
    },
    postIntervention: {
      hedgerows: [{}],
      units: {
        hedgerowsTotal: 4.6,
        hedgerowsNetUnitChange: 0.1,
        hedgerowsNetUnitChangePercentage: 2.22
      }
    }
  }
}

const baselineOnlyProject = {
  project: {
    name: 'Baseline only project',
    baseline: {
      hedgerows: [{}],
      units: { hedgerowsTotal: 1.23456789012345 }
    }
  }
}

const postInterventionOnlyProject = {
  project: {
    name: 'Created hedgerows project',
    baseline: {
      hedgerows: [],
      units: { hedgerowsTotal: 0 }
    },
    postIntervention: {
      hedgerows: [{ retentionCategory: 'Created' }],
      units: {
        hedgerowsTotal: 1.99,
        hedgerowsNetUnitChange: 1.99,
        hedgerowsNetUnitChangePercentage: null
      }
    }
  }
}

describe('hedgerows summary', () => {
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
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Riverbank restoration')
    expect(result).toContain(
      '<h1 class="govuk-heading-xl govuk-!-margin-bottom-0">Hedgerows</h1>'
    )
    expect(result).toContain('<h2 class="govuk-heading-m">Results</h2>')
    expect(result).toContain('class="app-grid-column-one-sixth"')
    expect(result).toContain('class="app-grid-column-five-sixths"')
  })

  test('renders a single Results section for hedgerows only', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    const $ = load(result)

    expect($('#hedgerows-heading')).toHaveLength(1)
    expect($('.app-unit-type-summary')).toHaveLength(1)
    expect($('#hedgerows-heading a')).toHaveLength(0)
  })

  test('renders results values matching baseline and post-intervention data', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    const $ = load(result)
    const hedgerowsSummary = $('#hedgerows-heading').closest('section')

    expect(hedgerowsSummary.text()).toContain('2.22%')
    expect(hedgerowsSummary.text()).toContain('4.50 units')
    expect(hedgerowsSummary.text()).toContain('4.60 units')
    expect(hedgerowsSummary.text()).toContain('0.10 units')
    expect($('.govuk-tag--red').text()).toBe('Not met')
  })

  test('renders the targets section based on the hedgerows baseline and post-intervention totals', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    const $ = load(result)
    const targets = $('#targets-heading').closest('section')

    expect(targets.text()).toContain('10%')
    expect(targets.text()).toContain('4.95 units')
    expect(targets.text()).toContain('0.35 units')
    expect(targets.find('a')).toHaveLength(0)
  })

  test('clamps unit deficit to zero when post-intervention meets the target, independently of the net percentage badge', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Riverbank restoration',
          baseline: { hedgerows: [{}], units: { hedgerowsTotal: 1 } },
          postIntervention: {
            hedgerows: [{}],
            units: {
              hedgerowsTotal: 2,
              hedgerowsNetUnitChange: 1,
              hedgerowsNetUnitChangePercentage: 5
            }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
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
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)

    const $ = load(result)
    const hedgerowsSummary = $('#hedgerows-heading').closest('section')
    const targets = $('#targets-heading').closest('section')

    expect(hedgerowsSummary.text()).toContain('-100.00%')
    expect($('.govuk-tag--red').text()).toBe('Not met')
    expect(result).toContain('Upload on-site post intervention file')
    expect(targets.text()).toContain('1.36 units')
    expect(targets.text().match(/1\.36 units/g)).toHaveLength(2)
  })

  test('renders the post-intervention-only variant when hedgerows only exist post-intervention', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: postInterventionOnlyProject
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    const $ = load(result)
    const hedgerowsSummary = $('#hedgerows-heading').closest('section')
    const targets = $('#targets-heading').closest('section')
    const uploadLink = hedgerowsSummary.find('a')

    expect(statusCode).toBe(statusCodes.ok)
    expect(hedgerowsSummary.text()).toContain('Not applicable')
    expect(hedgerowsSummary.find('.govuk-tag')).toHaveLength(0)
    expect(hedgerowsSummary.text()).toContain('0.00 units')
    expect(hedgerowsSummary.text()).not.toContain('View on-site baseline')
    expect(hedgerowsSummary.text()).toContain('1.99 units')
    expect(uploadLink.text().trim()).toBe(
      'Upload on-site post intervention file'
    )
    expect(targets.text()).toContain('0.00 units')
  })

  test('renders navigation with Summary linked and Hedgerows current, no href', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')

    expect(navigation.find('[aria-current="page"]').text()).toBe('Hedgerows')
    expect(navigation.find('a').attr('href')).toBe(
      `/projects/${PROJECT_ID}/project-summary`
    )
    expect(navigation.text()).toContain('Summary')
  })

  test('shows the Area habitats link always, and Watercourses only when present', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Mixed habitats',
          baseline: {
            units: { hedgerowsTotal: 4.5 },
            hedgerows: [{ id: 'h1' }],
            watercourses: []
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')

    expect(navigation.text()).toContain('Area habitats')
    expect(navigation.text()).not.toContain('Watercourses')
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === 'Area habitats')
    ).toHaveLength(1)
  })

  test('does not render the out-of-scope map or actions sections', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    expect(result).not.toContain('View map')
    expect(result).not.toContain('flags for review')
  })

  test('renders the upload action with a return URL back to this page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })
    const href =
      `/projects/${PROJECT_ID}/upload-file?` +
      `returnUrl=%2Fprojects%2F${PROJECT_ID}%2Fhedgerows-summary`

    expect(result).toContain(`href="${href}"`)
  })

  test('uses safe display defaults for missing or malformed unit data', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          baseline: {
            units: { hedgerowsTotal: 'not-a-number' }
          }
        }
      }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
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
          baseline: { hedgerows: [{}], units: { hedgerowsTotal: 1 } },
          postIntervention: {
            hedgerows: [{}],
            units: { hedgerowsTotal: 'not-a-number' }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    const $ = load(result)
    const hedgerowsSummary = $('#hedgerows-heading').closest('section')
    const targets = $('#targets-heading').closest('section')

    expect(hedgerowsSummary.text()).toContain('N/A')
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
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('returns bad gateway when the backend is unavailable', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Connection refused'))

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
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
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
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
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${PROJECT_ID}`)
  })

  test('rejects an invalid project id', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/hedgerows-summary',
      auth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires authentication', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })

  test('requires an approved BNG completer role', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/hedgerows-summary`,
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
