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
const forbiddenPath = '/auth/forbidden'
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const retainedWatercourse = {
  featureId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ref: 'W-A2',
  units: 0.5,
  sizeMetres: 1000,
  retentionCategory: 'Retained',
  baseline: {
    type: 'Rivers and streams',
    distinctiveness: 'V.High',
    distinctivenessScore: 8,
    condition: 'Fairly Poor',
    conditionScore: 1.5,
    watercourseEncroachment: 'Major',
    waterEncroachmentMultiplier: 0.5,
    riparianEncroachment: 'Major/Major',
    riparianEncroachmentMultiplier: 0.6
  },
  proposed: {
    type: 'Culvert',
    distinctiveness: 'High',
    distinctivenessScore: 6,
    condition: 'Good',
    conditionScore: 1,
    watercourseEncroachment: 'Minor',
    waterEncroachmentMultiplier: 0.7,
    riparianEncroachment: 'Minor/Minor',
    riparianEncroachmentMultiplier: 0.9
  }
}

const enhancedWatercourse = {
  featureId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ref: 'W-A3',
  units: 0.4,
  sizeMetres: 800,
  retentionCategory: '1. Enhanced',
  proposed: {
    type: 'Ditches',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    condition: 'Good',
    conditionScore: 3,
    watercourseEncroachment: 'Minor',
    waterEncroachmentMultiplier: 0.8,
    riparianEncroachment: 'Minor/No Encroachment',
    riparianEncroachmentMultiplier: 0.98,
    standardTimeToTargetCondition: '10',
    advanceYears: 1,
    delayYears: 0,
    finalTimeToTargetCondition: '9 years (0.7)',
    difficulty: 'Low',
    difficultyMultiplier: 1
  }
}

const createdWatercourseFirst = {
  featureId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  ref: 'W-A1',
  units: 0.74,
  sizeMetres: 500,
  retentionCategory: 'Created',
  proposed: {
    type: 'Canals',
    distinctiveness: 'Low',
    distinctivenessScore: 2,
    condition: 'Moderate',
    conditionScore: 2,
    watercourseEncroachment: 'No encroachment',
    waterEncroachmentMultiplier: 1,
    riparianEncroachment: 'Minor/Minor',
    riparianEncroachmentMultiplier: 0.8,
    standardTimeToTargetCondition: '1',
    advanceYears: 10,
    delayYears: 2,
    finalTimeToTargetCondition: '10 years (0.5555)',
    difficulty: 'Medium',
    difficultyMultiplier: 0.67
  }
}

const createdWatercourseSecond = {
  featureId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ref: 'W-A10',
  units: 0.01,
  sizeMetres: 100,
  retentionCategory: 'Created',
  proposed: {
    type: 'Culvert',
    distinctiveness: 'Low',
    distinctivenessScore: 2,
    condition: 'Poor',
    conditionScore: 1,
    watercourseEncroachment: 'N/A - Culvert',
    waterEncroachmentMultiplier: 1,
    riparianEncroachment: 'N/A - Culvert',
    riparianEncroachmentMultiplier: 1,
    standardTimeToTargetCondition: '5',
    advanceYears: 0,
    delayYears: 0,
    finalTimeToTargetCondition: '5 years (1)',
    difficulty: 'Low',
    difficultyMultiplier: 1
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
        retainedWatercourse,
        enhancedWatercourse,
        createdWatercourseSecond,
        createdWatercourseFirst
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

  test('renders safely when optional project data is missing', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          baseline: { watercourses: [{}] }
        }
      }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('>Project</span>')
    expect($('.govuk-tabs__tab')).toHaveLength(0)
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
      'Post-intervention'
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
        .map((_, tab) => $(tab).text().trim())
        .get()
    ).toEqual(['Retained', 'Enhanced', 'Created'])
    expect(tabs.find('.govuk-tabs__list-item--selected a').text().trim()).toBe(
      'Retained'
    )
    expect(tabs.find('a.govuk-tabs__tab')).toHaveLength(3)
    expect(tabs.attr('data-module')).toBe('govuk-tabs')
    expect(tabs.find('.govuk-tabs__panel[hidden]')).toHaveLength(0)
    expect(tabs.find('.govuk-table')).toHaveLength(3)
    expect($('#retained').find('h3').text()).toBe(
      'Retained watercourse habitats'
    )
    expect($('#enhanced').find('h3').text()).toBe(
      'Enhanced watercourse habitats'
    )
    expect($('#created').find('h3').text()).toBe('Created watercourse habitats')
  })

  test('renders retained columns, values, totals and unsorted headers', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth
    })
    const $ = load(result)
    const panel = $('#retained')
    const headers = panel
      .find('thead th')
      .map((_, heading) => $(heading).text().trim())
      .get()
    const row = panel.find('tbody').text()

    expect(headers).toEqual([
      'Ref',
      'Units',
      'Size',
      'Habitat type',
      'Distinctiveness',
      'Condition',
      'Watercourse encroachment',
      'Riparian encroachment',
      'Strategic significance'
    ])
    expect(panel.find('th[aria-sort="none"]')).toHaveLength(headers.length)
    expect(panel.find('tbody a').text()).toBe('W-A2')
    expect(panel.find('tbody a').attr('href')).toBe(
      `/post-intervention-habitat-details?featureId=${retainedWatercourse.featureId}&projectId=${projectId}&returnUrl=${encodeURIComponent(pagePath)}`
    )
    expect(row).toContain('0.50')
    expect(row).toContain('1km')
    expect(row).toContain('Rivers and streams')
    expect(row).toContain('V.High (8)')
    expect(row).toContain('Fairly Poor (1.5)')
    expect(row).toContain('Major (0.5)')
    expect(row).toContain('Major/Major (0.6)')
    expect(row).toContain('Low (1)')
    expect(panel.find('tfoot').text()).toContain('Total')
    expect(panel.find('tfoot').text()).toContain('0.50')
    expect(panel.find('tfoot').text()).toContain('1km')
    expect(panel.find('.moj-scrollable-pane').attr('aria-label')).toBe(
      'Retained watercourse habitats'
    )
  })

  test('renders enhanced columns and proposed target values without condition', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth
    })
    const $ = load(result)
    const panel = $('#enhanced')
    const headers = panel
      .find('thead th')
      .map((_, heading) => $(heading).text().trim())
      .get()
    const row = panel.find('tbody').text()

    expect(headers).toEqual([
      'Ref',
      'Units',
      'Size',
      'Habitat type',
      'Distinctiveness',
      'Watercourse encroachment',
      'Riparian encroachment',
      'Strategic significance',
      'Target condition',
      'Standard time to target',
      'Advance',
      'Delay',
      'Final time to target',
      'Standard difficulty'
    ])
    expect(row).toContain('Minor (0.8)')
    expect(row).toContain('Minor/No Encroachment (0.98)')
    expect(row).toContain('Good (3)')
    expect(row).toContain('10 years')
    expect(row).toContain('1 year')
    expect(row).toContain('0 years')
    expect(row).toContain('9 years (0.7)')
    expect(row).toContain('Low (1)')
  })

  test('sorts created rows naturally by reference and totals units and size', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth
    })
    const $ = load(result)
    const panel = $('#created')
    const refs = panel
      .find('tbody a')
      .map((_, link) => $(link).text())
      .get()
    const footer = panel.find('tfoot').text()

    expect(refs).toEqual(['W-A1', 'W-A10'])
    expect(footer).toContain('Total')
    expect(footer).toContain('0.75')
    expect(footer).toContain('0.6km')
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
      expect($('.govuk-tabs__tab').text().trim()).toBe(expectedLabel)
      expect($('a.govuk-tabs__tab')).toHaveLength(1)
    }
  )

  test('uses post-intervention-only summary behaviour when no baseline watercourses exist', async () => {
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
    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')
    const watercoursesSummary = $('.app-unit-type-summary')

    expect(navigation.find('[aria-current="page"]').text()).toBe(
      'Post-intervention'
    )
    expect(
      navigation.find('a').filter((_, link) => $(link).text() === 'Baseline')
    ).toHaveLength(0)
    expect(navigation.text()).not.toContain('Hedgerows')
    expect(watercoursesSummary.text()).toContain('Not applicable')
    expect(watercoursesSummary.find('.govuk-tag')).toHaveLength(0)
    expect(watercoursesSummary.text()).not.toContain('View on-site baseline')
    expect(watercoursesSummary.find('a').text().trim()).toBe(
      'Upload on-site post intervention file'
    )
  })

  test('redirects a project without baseline data to the existing task list', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project: { name: 'No baseline' } }
    })

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${projectId}`)
  })

  test('rejects an invalid project id', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/watercourses-post-intervention',
      auth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires authentication', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: pagePath
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(forbiddenPath)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires an approved BNG completer role', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: pagePath,
      auth: {
        strategy: 'session',
        credentials: { ...auth.credentials, roles: [] }
      }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(forbiddenPath)
    expect(wreck.get).not.toHaveBeenCalled()
  })
})
