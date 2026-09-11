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

const projectId = '11111111-1111-4111-8111-111111111111'
const pagePath = `/projects/${projectId}/watercourses-post-intervention`
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
      watercourses: [{}],
      hedgerows: [{}],
      units: { watercoursesTotal: 4.5 }
    },
    postIntervention: {
      watercourses: [
        { retentionCategory: 'Retained' },
        { retentionCategory: '1. Enhanced' },
        { retentionCategory: 'Created' }
      ],
      units: {
        watercoursesTotal: 4.6,
        watercoursesNetUnitChange: 0.1,
        watercoursesNetUnitChangePercentage: 2.22
      }
    }
  }
}

describe('watercourses post intervention', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })
  afterAll(async () => server.stop({ timeout: 0 }))
  beforeEach(() =>
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: project
    })
  )
  afterEach(() => vi.clearAllMocks())

  test('renders the requested page content, summary tiles and upload return URL', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Post intervention for watercourses')
    expect(result).toContain('Watercourses results')
    expect(result).toContain('Watercourses habitat details')
    expect(result).toContain(
      `returnUrl=%2Fprojects%2F${projectId}%2Fwatercourses-post-intervention`
    )
    expect($('.app-unit-type-summary').text()).toContain('4.60 units')
    expect($('.app-unit-type-summary').text()).not.toContain(
      'View on-site watercourses post intervention'
    )
    expect($('.app-unit-type-summary').text()).not.toContain(
      'View on-site post intervention'
    )
  })

  test('renders post-intervention as the current left-nav item', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth
    })
    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')

    expect(navigation.find('[aria-current="page"]').text()).toBe(
      'Post intervention'
    )
    expect(
      navigation.find('a').filter((_, link) => $(link).text() === 'Baseline')
    ).toHaveLength(1)
    expect(navigation.text()).toContain('Hedgerows')
    const links = {}
    navigation.find('a').each((_, link) => {
      links[$(link).text().trim()] = $(link).attr('href')
    })
    expect(links).toMatchObject({
      Summary: `/projects/${projectId}/project-summary`,
      'Area habitats': `/projects/${projectId}/area-summary`,
      Hedgerows: `/projects/${projectId}/hedgerows-summary`,
      Watercourses: `/projects/${projectId}/watercourses-summary`,
      Baseline: `/projects/${projectId}/watercourses-baseline-summary`
    })
  })

  test('renders visible intervention tabs in retained, enhanced, created order', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth
    })
    const $ = load(result)
    const tabs = $('.app-habitat-intervention-tabs')

    expect(
      tabs
        .find('.govuk-tabs__tab')
        .map((_, tab) => $(tab).text())
        .get()
    ).toEqual(['Retained', 'Enhanced', 'Created'])
    expect(tabs.find('.govuk-tabs__list-item--selected span').text()).toBe(
      'Retained'
    )
    expect(
      tabs.find('.govuk-tabs__list-item--selected span').attr('tabindex')
    ).toBe('-1')
    expect(tabs.find('a.govuk-tabs__tab')).toHaveLength(2)
    expect(tabs.find('.govuk-table')).toHaveLength(0)
  })

  test.each([
    ['Retained', 'Retained'],
    ['1. Enhanced', 'Enhanced'],
    ['Created', 'Created']
  ])(
    'shows only the %s intervention tab when it is the only category',
    async (retentionCategory, expectedLabel) => {
      vi.mocked(wreck.get).mockResolvedValue({
        res: { statusCode: statusCodes.ok },
        payload: {
          project: {
            ...project.project,
            postIntervention: {
              ...project.project.postIntervention,
              watercourses: [{ retentionCategory }]
            }
          }
        }
      })

      const { result } = await server.inject({
        method: 'GET',
        url: pagePath,
        auth
      })
      const $ = load(result)
      expect($('.govuk-tabs__tab').text()).toBe(expectedLabel)
      expect($('a.govuk-tabs__tab')).toHaveLength(0)
    }
  )

  test('hides Hedgerows and Baseline navigation when those habitats are absent', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Created watercourse',
          baseline: { watercourses: [], units: { watercoursesTotal: 0 } },
          postIntervention: project.project.postIntervention
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth
    })
    const navigationText = load(result)(
      'nav[aria-label="Project summary"]'
    ).text()
    expect(navigationText).not.toContain('Hedgerows')
    expect(navigationText).not.toContain('Baseline')
  })
})
