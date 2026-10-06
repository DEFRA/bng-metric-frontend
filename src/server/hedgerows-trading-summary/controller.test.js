import { createServer } from '../server.js'
import { load } from 'cheerio'
import { DEFAULT_PROJECT_NAME, statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { WORKED_EXAMPLE_TRADING_RULES } from './worked-example.fixture.js'

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

/** The statuses the backend derives for the worked example (BMD-1003). */
const WORKED_EXAMPLE_STATUSES = {
  hedgerows: {
    medium: 'Met',
    low: 'Not met',
    veryLow: 'Not met',
    overall: 'Not met'
  }
}

function projectPayload({
  tradingRules = WORKED_EXAMPLE_TRADING_RULES,
  statuses = WORKED_EXAMPLE_STATUSES,
  baselineDocument = { hedgerows: [{ id: 'baseline-hedge' }] },
  postInterventionDocument = {
    hedgerows: [{ id: 'created-hedge' }],
    tradingRules: { hedgerows: tradingRules }
  }
} = {}) {
  return {
    tradingRuleStatuses: statuses,
    project: {
      name: 'Worked example',
      baseline: baselineDocument,
      postIntervention: postInterventionDocument
    }
  }
}

function withHabitats(filter) {
  const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
  figures.habitatTypes = figures.habitatTypes.filter(filter)
  return figures
}

const sectionHeaded = ($, heading) =>
  $('section').filter((_, section) => $(section).find('h2').text() === heading)

const tableRows = ($, table) =>
  table
    .find('tbody tr, tfoot tr')
    .map((_, row) => [
      $(row)
        .find('td')
        .map((__, cell) => $(cell).text().trim())
        .get()
    ])
    .get()

const tilesIn = ($, section) =>
  section
    .find('.app-unit-type-summary__tile')
    .map((_, tile) => [
      [
        $(tile).find('h3').text(),
        $(tile).find('p').text(),
        $(tile).find('.govuk-tag').text()
      ]
    ])
    .get()

const columnHeadings = ($, table) =>
  table
    .find('th')
    .map((_, th) => $(th).text())
    .get()

describe('hedgerows trading summary', () => {
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
      payload: projectPayload()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function mockPayload(payload) {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload
    })
  }

  async function renderPage() {
    const response = await server.inject({
      method: 'GET',
      url: TRADING_HREF,
      auth
    })
    expect(response.statusCode).toBe(statusCodes.ok)
    return load(response.result)
  }

  describe('left navigation', () => {
    test('shows Hedgerows with Trading rules as the current page', async () => {
      const $ = await renderPage()
      const nav = $('nav[aria-label="Project summary"]')
      const current = nav.find('[aria-current="page"]')

      expect(current.text()).toBe('Trading rules')
      expect(current.is('strong')).toBe(true)

      const links = Object.fromEntries(
        nav
          .find('a')
          .map((_, link) => [[$(link).text(), $(link).attr('href')]])
          .get()
      )
      expect(links).toMatchObject({
        Summary: `/projects/${PROJECT_ID}/project-summary`,
        'Area habitats': `/projects/${PROJECT_ID}/area-summary`,
        Hedgerows: `/projects/${PROJECT_ID}/hedgerows-summary`,
        Baseline: `/projects/${PROJECT_ID}/hedgerows-baseline`,
        'Post intervention': `/projects/${PROJECT_ID}/hedgerows-post-intervention`
      })
      expect(links).not.toHaveProperty('Watercourses')
    })

    test('links Watercourses only when the project has a watercourse', async () => {
      const payload = projectPayload()
      payload.project.baseline.watercourses = [{ id: 'w1' }]
      mockPayload(payload)

      const $ = await renderPage()
      const watercourses = $('nav[aria-label="Project summary"]')
        .find('a')
        .filter((_, link) => $(link).text() === 'Watercourses')

      expect(watercourses).toHaveLength(1)
      expect(watercourses.attr('href')).toBe(
        `/projects/${PROJECT_ID}/watercourses-summary`
      )
    })
  })

  describe('headings and upload button', () => {
    test('shows the project name, heading and Upload file button', async () => {
      const $ = await renderPage()

      expect($('title').text()).toContain('Hedgerows trading summary')
      expect($('.govuk-caption-l').text()).toBe('Worked example')
      expect($('h1').text()).toBe('Hedgerows trading summary')

      const upload = $('a.govuk-button').filter(
        (_, link) => $(link).text().trim() === 'Upload file'
      )
      expect(upload.attr('href')).toBe(
        `/projects/${PROJECT_ID}/upload-file?returnUrl=${encodeURIComponent(TRADING_HREF)}`
      )
    })
  })

  describe('trading summary', () => {
    test('shows a status row per band present, from the backend statuses', async () => {
      const $ = await renderPage()
      const table = sectionHeaded($, 'Trading summary').find('table')

      expect(columnHeadings($, table)).toEqual([
        'Distinctiveness group',
        'Status'
      ])
      expect(tableRows($, table)).toEqual([
        ['Medium', 'Met'],
        ['Low', 'Not met'],
        ['Very low', 'Not met']
      ])
      expect(table.find('.govuk-tag--green')).toHaveLength(1)
      expect(table.find('.govuk-tag--red')).toHaveLength(2)
    })

    test.each([
      ['Medium', 'Medium distinctiveness'],
      ['Low', 'Low distinctiveness'],
      ['V.Low', 'Very low distinctiveness']
    ])(
      'omits the row and section for %s when no hedgerow is in that band',
      async (band, heading) => {
        mockPayload(
          projectPayload({
            tradingRules: withHabitats(
              (habitat) => habitat.distinctiveness !== band
            )
          })
        )

        const $ = await renderPage()
        const rows = tableRows(
          $,
          sectionHeaded($, 'Trading summary').find('table')
        )

        expect(rows).toHaveLength(2)
        expect(sectionHeaded($, heading)).toHaveLength(0)
      }
    )

    test('renders the figures without tags when no statuses were derived', async () => {
      const payload = projectPayload()
      delete payload.tradingRuleStatuses
      mockPayload(payload)

      const $ = await renderPage()
      const table = sectionHeaded($, 'Trading summary').find('table')

      expect(tableRows($, table)).toEqual([
        ['Medium', ''],
        ['Low', ''],
        ['Very low', '']
      ])
      expect($('.app-hedgerows-trading-summary .govuk-tag')).toHaveLength(0)
      expect(sectionHeaded($, 'Medium distinctiveness').find('p').text()).toBe(
        '0.41 units'
      )
    })
  })

  describe('medium distinctiveness', () => {
    test('shows the tile, each medium hedgerow type and the total', async () => {
      const $ = await renderPage()
      const section = sectionHeaded($, 'Medium distinctiveness')
      const grid = section.find('table')

      expect(tilesIn($, section)).toEqual([
        [
          'Medium distinctiveness unit deficit required to meet trading rules',
          '0.41 units',
          'Met'
        ]
      ])
      expect(section.find('.govuk-tag--green')).toHaveLength(1)
      expect(columnHeadings($, grid)).toEqual(['Habitat type', 'Unit change'])
      expect(tableRows($, grid)).toEqual([
        ['Species-rich native hedgerow', '-1.68'],
        ['Native hedgerow - associated with bank or ditch', '1.29'],
        ['Native hedgerow with trees', '0.80'],
        ['Total unit change', '0.41']
      ])
    })

    test('shows Not met when the medium band is in deficit', async () => {
      const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
      figures.medium.netUnitChange = -1.5
      mockPayload(
        projectPayload({
          tradingRules: figures,
          statuses: {
            hedgerows: {
              ...WORKED_EXAMPLE_STATUSES.hedgerows,
              medium: 'Not met'
            }
          }
        })
      )

      const $ = await renderPage()
      const section = sectionHeaded($, 'Medium distinctiveness')

      expect(tilesIn($, section)).toEqual([
        [
          'Medium distinctiveness unit deficit required to meet trading rules',
          '-1.50 units',
          'Not met'
        ]
      ])
      expect(section.find('.govuk-tag--red')).toHaveLength(1)
    })

    test('does not list high or very high distinctiveness hedgerows', async () => {
      const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
      figures.habitatTypes.push({
        habitatType: 'Ancient hedgerow',
        distinctiveness: 'High',
        netUnitChange: 4
      })
      mockPayload(projectPayload({ tradingRules: figures }))

      const $ = await renderPage()

      expect($('body').text()).not.toContain('Ancient hedgerow')
      expect($('body').text()).not.toContain('High distinctiveness')
    })
  })

  describe('low distinctiveness', () => {
    test('shows the three summary tiles and the low hedgerow types', async () => {
      const $ = await renderPage()
      const section = sectionHeaded($, 'Low distinctiveness')
      const grid = section.find('table')

      expect(tilesIn($, section)).toEqual([
        ['Low distinctiveness net change in units', '-2.55 units', ''],
        [
          'Medium units available to offset low distinctiveness deficit',
          '0.41 units',
          ''
        ],
        ['Cumulative surplus of units', '-2.13 units', 'Not met']
      ])
      expect(columnHeadings($, grid)).toEqual(['Habitat type', 'Unit change'])
      expect(tableRows($, grid)).toEqual([
        ['Native hedgerow', '-1.98'],
        ['Line of trees', '0.16'],
        ['Line of trees - associated with bank or ditch', '-0.73'],
        ['Total unit change', '-2.55']
      ])
    })

    test('makes no medium units available when the medium band is in deficit', async () => {
      const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
      figures.medium.netUnitChange = -1.5
      mockPayload(projectPayload({ tradingRules: figures }))

      const $ = await renderPage()

      expect(tilesIn($, sectionHeaded($, 'Low distinctiveness'))[1]).toEqual([
        'Medium units available to offset low distinctiveness deficit',
        '0.00 units',
        ''
      ])
    })
  })

  describe('very low distinctiveness', () => {
    test('shows the three summary tiles and the very low hedgerow types', async () => {
      const $ = await renderPage()
      const section = sectionHeaded($, 'Very low distinctiveness')
      const grid = section.find('table')

      expect(tilesIn($, section)).toEqual([
        ['Very low distinctiveness net change in units', '-0.35 units', ''],
        [
          'Medium and low units available to offset very low distinctiveness deficit',
          '0.00 units',
          ''
        ],
        ['Cumulative surplus of units', '-0.35 units', 'Not met']
      ])
      expect(columnHeadings($, grid)).toEqual(['Habitat type', 'Unit change'])
      expect(tableRows($, grid)).toEqual([
        ['Non-native and ornamental hedgerow', '-0.35'],
        ['Total unit change', '-0.35']
      ])
    })

    test('carries positive low availability down to very low', async () => {
      const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
      figures.low.cumulativeAvailability = 1.234
      figures.veryLow.cumulativeAvailability = 0.884
      mockPayload(
        projectPayload({
          tradingRules: figures,
          statuses: {
            hedgerows: {
              medium: 'Met',
              low: 'Met',
              veryLow: 'Met',
              overall: 'Met'
            }
          }
        })
      )

      const $ = await renderPage()

      expect(tilesIn($, sectionHeaded($, 'Very low distinctiveness'))).toEqual([
        ['Very low distinctiveness net change in units', '-0.35 units', ''],
        [
          'Medium and low units available to offset very low distinctiveness deficit',
          '1.23 units',
          ''
        ],
        ['Cumulative surplus of units', '0.88 units', 'Met']
      ])
    })
  })

  describe('missing data', () => {
    test('says the figures are unavailable when none were saved', async () => {
      mockPayload(
        projectPayload({
          postInterventionDocument: { hedgerows: [{ id: 'created-hedge' }] },
          statuses: {
            hedgerows: { medium: null, low: null, veryLow: null, overall: null }
          }
        })
      )

      const $ = await renderPage()

      expect($('.govuk-inset-text').text()).toContain(
        'Trading rules have not been calculated for this project'
      )
      expect($('table')).toHaveLength(0)
    })

    test('shows no band when the figures list no hedgerow types', async () => {
      mockPayload(projectPayload({ tradingRules: {} }))

      const $ = await renderPage()

      expect(
        tableRows($, sectionHeaded($, 'Trading summary').find('table'))
      ).toEqual([])
      expect($('.app-trading-summary__tiles')).toHaveLength(0)
    })

    test('shows zero units for band figures that were not saved', async () => {
      const payload = projectPayload({
        tradingRules: {
          habitatTypes: WORKED_EXAMPLE_TRADING_RULES.habitatTypes.filter(
            (habitat) => habitat.distinctiveness === 'Low'
          )
        }
      })
      mockPayload(payload)

      const $ = await renderPage()

      expect(tilesIn($, sectionHeaded($, 'Low distinctiveness'))).toEqual([
        ['Low distinctiveness net change in units', '0.00 units', ''],
        [
          'Medium units available to offset low distinctiveness deficit',
          '0.00 units',
          ''
        ],
        ['Cumulative surplus of units', '0.00 units', 'Not met']
      ])
    })
  })
})

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

  test('opens the trading summary and marks Trading rules current', async () => {
    mockProject({ name: 'Test project', baseline, postIntervention })
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: TRADING_HREF,
      auth
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text()).toBe('Hedgerows trading summary')
    expect(
      $('nav[aria-label="Project summary"] [aria-current="page"]').text()
    ).toBe('Trading rules')
  })
})
