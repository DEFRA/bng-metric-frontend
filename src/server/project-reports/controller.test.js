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

const project = {
  project: {
    name: 'Riverbank restoration',
    baseline: {
      habitats: [{}],
      hedgerows: [{}],
      watercourses: [{}],
      units: {
        habitatsTotal: 8,
        treesTotal: 2,
        hedgerowsTotal: 4,
        watercoursesTotal: 10
      }
    }
  }
}

describe('project reports', () => {
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

  test('renders the Reports page with the project name and navigation', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/reports`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = load(result)

    expect($('h1').text()).toBe('Reports')
    expect($('.govuk-caption-l').text()).toBe('Riverbank restoration')
    // Reports is the current navigation item, so it renders without a link.
    const navigationTexts = $('nav li')
      .map((_, el) => $(el).text().trim())
      .get()
    expect(navigationTexts).toEqual([
      'Summary',
      'Area habitats',
      'Hedgerows',
      'Watercourses',
      'Reports'
    ])
    expect(
      $('nav a').filter((_, el) => $(el).text().trim() === 'Reports')
    ).toHaveLength(0)
  })

  test('offers the site report as the primary action — a green button', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/reports`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = load(result)
    const button = $('[data-testid="site-report-link"]')

    expect(button.attr('href')).toBe(`/projects/${PROJECT_ID}/report.pdf`)
    expect(button.text().trim()).toBe('Download site report (PDF)')
    // The default govuk-button — green — per the design; `download` tells the
    // browser to save rather than display.
    expect(button.hasClass('govuk-button')).toBe(true)
    expect(button.attr('download')).toBeDefined()
  })

  test('redirects to the project details journey when there is no baseline', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project: { name: 'Riverbank restoration' } }
    })

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/reports`,
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${PROJECT_ID}`)
  })

  test('passes a backend 404 through', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.notFound },
      payload: null
    })

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/reports`,
      auth
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
