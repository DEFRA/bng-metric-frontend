import { load } from 'cheerio'
import { createServer } from '../server.js'
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
const ROOT = `/projects/${PROJECT_ID}`
const TRADING_HREF = `${ROOT}/watercourses-trading-summary`
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const baseline = {
  name: 'Riverbank restoration',
  baseline: {
    watercourses: [{ ref: 'W1', units: 1, sizeMetres: 1000 }],
    units: { watercoursesTotal: 1 }
  }
}
const withPi = {
  ...baseline,
  postIntervention: {
    watercourses: [
      { ref: 'W1', units: 1.2, sizeMetres: 1000, retentionCategory: 'Retained' }
    ],
    units: {
      watercoursesTotal: 1.2,
      watercoursesNetUnitChange: 0.2,
      watercoursesNetUnitChangePercentage: 20
    }
  }
}

describe('watercourses trading summary links', () => {
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

  async function page(path, project) {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project }
    })
    const response = await server.inject({
      method: 'GET',
      url: `${ROOT}/${path}`,
      auth
    })
    expect(response.statusCode).toBe(statusCodes.ok)
    return load(response.result)
  }

  const summaryPaths = [
    'project-summary',
    'watercourses-summary',
    'watercourses-baseline-summary',
    'watercourses-post-intervention'
  ]

  test.each(summaryPaths)(
    '%s links its watercourse results tile after PI upload',
    async (path) => {
      const $ = await page(path, withPi)
      const link = $('.app-unit-type-summary__tile a').filter(
        (_, item) => $(item).text() === 'View watercourses trading rules'
      )
      expect(link).toHaveLength(1)
      expect(link.attr('href')).toBe(TRADING_HREF)
    }
  )

  test.each(summaryPaths.slice(0, 3))(
    '%s has no trading link before PI upload',
    async (path) => {
      const $ = await page(path, baseline)
      expect($(`a[href="${TRADING_HREF}"]`)).toHaveLength(0)
    }
  )

  test.each(summaryPaths.slice(1))(
    '%s links trading rules in the left navigation after PI upload',
    async (path) => {
      const $ = await page(path, withPi)
      const link = $('nav[aria-label="Project summary"] a').filter(
        (_, item) => $(item).text() === 'Trading rules'
      )
      expect(link).toHaveLength(1)
      expect(link.attr('href')).toBe(TRADING_HREF)
    }
  )

  test.each(summaryPaths.slice(1, 3))(
    '%s has only Baseline under Watercourses before PI upload',
    async (path) => {
      const $ = await page(path, baseline)
      const children = $(
        'nav[aria-label="Project summary"] .app-project-navigation__child'
      )
      expect(children).toHaveLength(1)
      expect(children.text().trim()).toBe('Baseline')
    }
  )

  test('the target route loads a placeholder and marks Trading rules current', async () => {
    const $ = await page('watercourses-trading-summary', withPi)
    expect($('h1').text()).toBe('Watercourses trading rules')
    expect($('.govuk-body').text()).toContain(
      'This page is under construction.'
    )
    expect(
      $('nav[aria-label="Project summary"] [aria-current="page"]').text()
    ).toBe('Trading rules')
  })
})
