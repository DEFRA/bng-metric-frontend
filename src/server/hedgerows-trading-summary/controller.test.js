import { createServer } from '../server.js'
import { load } from 'cheerio'
import { DEFAULT_PROJECT_NAME, statusCodes } from '../common/constants.js'
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
const TRADING_HREF = `/projects/${PROJECT_ID}/hedgerows-trading-summary`
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const baseline = {
  hedgerows: [{ ref: 'H-1', sizeMetres: 100 }],
  units: { hedgerowsTotal: 1 }
}
const postIntervention = {
  hedgerows: [{ ref: 'H-1', sizeMetres: 100 }],
  units: { hedgerowsTotal: 2 }
}

describe('hedgerows trading summary links', () => {
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

  function mockProject(project) {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project }
    })
  }

  test.each([
    'project-summary',
    'hedgerows-summary',
    'hedgerows-baseline',
    'hedgerows-post-intervention'
  ])('links the hedgerow results tile from %s when PI exists', async (path) => {
    mockProject({ name: 'Test project', baseline, postIntervention })
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/${path}`,
      auth
    })
    const $ = load(result)
    const hedgerows = $('.app-unit-type-summary').filter((_, section) =>
      $(section).text().includes('View hedgerows trading rules')
    )
    const link = hedgerows
      .find('a')
      .filter((_, item) =>
        $(item).text().includes('View hedgerows trading rules')
      )

    expect(statusCode).toBe(statusCodes.ok)
    expect(link.attr('href')).toBe(TRADING_HREF)

    if (path !== 'project-summary') {
      expect(
        $('nav[aria-label="Project summary"] a')
          .filter((_, item) => $(item).text() === 'Trading rules')
          .attr('href')
      ).toBe(TRADING_HREF)
    }
  })

  test.each(['project-summary', 'hedgerows-summary', 'hedgerows-baseline'])(
    'keeps the hedgerow trading tile as text on %s before PI upload',
    async (path) => {
      mockProject({ name: 'Test project', baseline })
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/projects/${PROJECT_ID}/${path}`,
        auth
      })
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.ok)
      expect($(`a[href="${TRADING_HREF}"]`)).toHaveLength(0)
      expect($('nav[aria-label="Project summary"]').text()).not.toContain(
        'Trading rules'
      )
    }
  )

  describe.each([
    'project-summary',
    'hedgerows-summary',
    'hedgerows-baseline',
    'hedgerows-post-intervention'
  ])('%s trading link eligibility', (path) => {
    test('omits the trading link when neither phase contains hedgerows', async () => {
      mockProject({
        name: 'Area-only project',
        baseline: { habitats: [{}], units: { areaTotal: 1 } },
        postIntervention: { habitats: [{}], units: { areaTotal: 2 } }
      })
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/projects/${PROJECT_ID}/${path}`,
        auth
      })
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.ok)
      expect($(`a[href="${TRADING_HREF}"]`)).toHaveLength(0)
      expect($('nav[aria-label="Project summary"]').text()).not.toContain(
        'Hedgerows'
      )
    })

    test.each(['baseline', 'postIntervention'])(
      'links trading rules when hedgerows occur only in %s',
      async (phase) => {
        const project = {
          baseline: { units: { hedgerowsTotal: 0 } },
          postIntervention: { units: { hedgerowsTotal: 0 } }
        }
        project[phase].hedgerows = [{ ref: 'H-1', sizeMetres: 100 }]
        mockProject(project)
        const { result, statusCode } = await server.inject({
          method: 'GET',
          url: `/projects/${PROJECT_ID}/${path}`,
          auth
        })
        const $ = load(result)

        expect(statusCode).toBe(statusCodes.ok)
        expect(
          $(`.app-unit-type-summary a[href="${TRADING_HREF}"]`).text()
        ).toBe('View hedgerows trading rules')
        if (path !== 'project-summary') {
          expect(
            $(`nav[aria-label="Project summary"] a[href="${TRADING_HREF}"]`)
          ).toHaveLength(1)
        }
      }
    )
  })

  test.each([undefined, { units: { areaTotal: 2 } }])(
    'redirects projects without hedgerows to the project summary',
    async (intervention) => {
      mockProject({
        baseline: { units: { areaTotal: 1 }, hedgerows: [] },
        postIntervention: intervention
      })
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: TRADING_HREF,
        auth
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/projects/${PROJECT_ID}/project-summary`)
    }
  )

  test.each(['baseline', 'postIntervention'])(
    'opens the trading page with current navigation when hedgerows occur only in %s',
    async (phase) => {
      const project = { baseline: {}, postIntervention: {} }
      project[phase].hedgerows = [{}]
      mockProject(project)
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: TRADING_HREF,
        auth
      })
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.ok)
      expect(
        $('nav[aria-label="Project summary"] [aria-current="page"]').text()
      ).toBe('Trading rules')
      expect($('[aria-current="page"] a')).toHaveLength(0)
    }
  )

  test('redirects a baseline-only project to the hedgerows summary', async () => {
    mockProject({ name: 'Test project', baseline })
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: TRADING_HREF,
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/projects/${PROJECT_ID}/hedgerows-summary`)
  })

  test.each([null, { name: 'No baseline' }])(
    'redirects to project setup when baseline data is missing: %j',
    async (project) => {
      mockProject(project)
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: TRADING_HREF,
        auth
      })

      expect(statusCode).toBe(statusCodes.redirect)
      expect(headers.location).toBe(`/add-project-details/${PROJECT_ID}`)
    }
  )

  test('shows the default project name when none was saved', async () => {
    mockProject({ baseline, postIntervention })
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: TRADING_HREF,
      auth
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-caption-l').text()).toBe(DEFAULT_PROJECT_NAME)
  })

  test('requires authentication before fetching a project', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: TRADING_HREF
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('rejects a user without an approved completer role', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: TRADING_HREF,
      auth: { ...auth, credentials: { ...auth.credentials, roles: [] } }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('rejects an invalid project ID before fetching a project', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/hedgerows-trading-summary',
      auth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test.each([
    [404, statusCodes.notFound],
    [500, statusCodes.badGateway]
  ])('handles a backend %s response', async (backendStatus, expectedStatus) => {
    vi.mocked(wreck.get).mockRejectedValue({
      data: { isResponseError: true, res: { statusCode: backendStatus } }
    })
    const { statusCode } = await server.inject({
      method: 'GET',
      url: TRADING_HREF,
      auth
    })

    expect(statusCode).toBe(expectedStatus)
  })

  test('handles an unreachable backend', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Connection refused'))
    const { statusCode } = await server.inject({
      method: 'GET',
      url: TRADING_HREF,
      auth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('opens the placeholder and marks Trading rules current', async () => {
    mockProject({ name: 'Test project', baseline, postIntervention })
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: TRADING_HREF,
      auth
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text()).toBe('Hedgerows trading rules')
    expect(
      $('nav[aria-label="Project summary"] [aria-current="page"]').text()
    ).toBe('Trading rules')
  })
})
