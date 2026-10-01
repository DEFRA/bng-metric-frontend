import { createServer } from '../server.js'
import { load } from 'cheerio'
import { statusCodes } from '../common/constants.js'
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
const ROOT = `/projects/${PROJECT_ID}`
const PAGE_URL = `${ROOT}/watercourses-trading-summary`
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

/** The statuses the backend derives for the worked example. */
const WORKED_EXAMPLE_STATUSES = {
  watercourses: { medium: 'Not met', low: 'Not met', overall: 'Not met' }
}

function projectPayload({
  tradingRules = WORKED_EXAMPLE_TRADING_RULES,
  statuses = WORKED_EXAMPLE_STATUSES,
  baseline = { watercourses: [{ id: 'baseline-ditch' }] },
  postIntervention = {
    watercourses: [{ id: 'created-ditch' }],
    tradingRules: { watercourses: tradingRules }
  }
} = {}) {
  return {
    tradingRuleStatuses: statuses,
    project: { name: 'Worked example', baseline, postIntervention }
  }
}

function withHabitats(filter) {
  const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
  figures.habitats = figures.habitats.filter(filter)
  return figures
}

function mockProject(payload) {
  vi.mocked(wreck.get).mockResolvedValue({
    res: { statusCode: statusCodes.ok },
    payload
  })
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

describe('watercourses trading summary', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    mockProject(projectPayload())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function renderPage() {
    const response = await server.inject({ method: 'GET', url: PAGE_URL, auth })
    expect(response.statusCode).toBe(statusCodes.ok)
    return load(response.result)
  }

  describe('left navigation', () => {
    test('shows Watercourses with Trading rules as the current page', async () => {
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
        Watercourses: `/projects/${PROJECT_ID}/watercourses-summary`,
        Baseline: `/projects/${PROJECT_ID}/watercourses-baseline-summary`,
        'Post-intervention': `/projects/${PROJECT_ID}/watercourses-post-intervention`
      })
      expect(links).not.toHaveProperty('Hedgerows')
    })

    test('links Hedgerows only when the project has a hedgerow', async () => {
      const payload = projectPayload()
      payload.project.baseline.hedgerows = [{ id: 'h1' }]
      mockProject(payload)

      const $ = await renderPage()
      const hedgerows = $('nav[aria-label="Project summary"]')
        .find('a')
        .filter((_, link) => $(link).text() === 'Hedgerows')

      expect(hedgerows).toHaveLength(1)
      expect(hedgerows.attr('href')).toBe(
        `/projects/${PROJECT_ID}/hedgerows-summary`
      )
    })
  })

  describe('headings and upload button', () => {
    test('shows the project name, heading and Upload file button', async () => {
      const $ = await renderPage()

      expect($('title').text()).toContain('Watercourses trading summary')
      expect($('.govuk-caption-l').text()).toBe('Worked example')
      expect($('h1').text()).toBe('Watercourses trading summary')

      const upload = $('a.govuk-button').filter(
        (_, link) => $(link).text().trim() === 'Upload file'
      )
      expect(upload.attr('href')).toBe(
        `/projects/${PROJECT_ID}/upload-file?returnUrl=${encodeURIComponent(PAGE_URL)}`
      )
    })
  })

  describe('trading summary', () => {
    test('shows a status row per band present, from the backend statuses', async () => {
      const $ = await renderPage()
      const table = sectionHeaded($, 'Trading summary').find('table')

      expect(
        table
          .find('th')
          .map((_, th) => $(th).text())
          .get()
      ).toEqual(['Distinctiveness group', 'Status'])
      expect(tableRows($, table)).toEqual([
        ['Medium', 'Not met'],
        ['Low', 'Not met']
      ])
      expect(table.find('.govuk-tag--red')).toHaveLength(2)
    })

    test('omits a band that has no habitats of that distinctiveness', async () => {
      mockProject(
        projectPayload({
          tradingRules: withHabitats(
            (habitat) => habitat.distinctiveness === 'Low'
          ),
          statuses: {
            watercourses: { medium: 'Met', low: 'Not met', overall: 'Not met' }
          }
        })
      )

      const $ = await renderPage()
      const table = sectionHeaded($, 'Trading summary').find('table')

      expect(tableRows($, table)).toEqual([['Low', 'Not met']])
      expect(sectionHeaded($, 'Medium distinctiveness')).toHaveLength(0)
    })

    test('omits the Low row when no Low habitat is present', async () => {
      mockProject(
        projectPayload({
          tradingRules: withHabitats(
            (habitat) => habitat.distinctiveness === 'Medium'
          ),
          statuses: {
            watercourses: { medium: 'Met', low: 'Not met', overall: 'Not met' }
          }
        })
      )

      const $ = await renderPage()
      const table = sectionHeaded($, 'Trading summary').find('table')

      expect(tableRows($, table)).toEqual([['Medium', 'Met']])
      expect(table.find('.govuk-tag--green').text()).toBe('Met')
      expect(sectionHeaded($, 'Low distinctiveness')).toHaveLength(0)
    })

    test('renders the figures without tags when no statuses were derived', async () => {
      const payload = projectPayload({ statuses: undefined })
      delete payload.tradingRuleStatuses
      mockProject(payload)

      const $ = await renderPage()
      const table = sectionHeaded($, 'Trading summary').find('table')

      expect(tableRows($, table)).toEqual([
        ['Medium', ''],
        ['Low', '']
      ])
      expect($('.app-watercourses-trading-summary .govuk-tag')).toHaveLength(0)
      expect(sectionHeaded($, 'Medium distinctiveness').find('p').text()).toBe(
        '-6.18 units'
      )
    })
  })

  describe('medium distinctiveness', () => {
    test('shows the deficit tile and each medium watercourse type', async () => {
      const $ = await renderPage()
      const section = sectionHeaded($, 'Medium distinctiveness')
      const tile = section.find('.app-unit-type-summary__tile')
      const grid = section.find('table')

      expect(tile.find('h3').text()).toBe(
        'Remaining losses; like for like not satisfied'
      )
      expect(tile.find('p').text()).toBe('-6.18 units')
      expect(tile.find('.govuk-tag--red').text()).toBe('Not met')
      expect(
        grid
          .find('th')
          .map((_, th) => $(th).text())
          .get()
      ).toEqual(['Habitat type', 'Unit change'])
      expect(tableRows($, grid)).toEqual([
        ['Canals', '-6.18'],
        ['Ditches', '12.92']
      ])
      expect(grid.find('tfoot')).toHaveLength(0)
    })

    test('shows Met when the medium band is not in deficit', async () => {
      const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
      figures.medium.deficit = 0
      mockProject(
        projectPayload({
          tradingRules: figures,
          statuses: {
            watercourses: { medium: 'Met', low: 'Met', overall: 'Met' }
          }
        })
      )

      const $ = await renderPage()
      const tile = sectionHeaded($, 'Medium distinctiveness').find(
        '.app-unit-type-summary__tile'
      )
      const statusTable = sectionHeaded($, 'Trading summary').find('table')

      expect(tile.find('p').text()).toBe('0.00 units')
      expect(tile.find('.govuk-tag--green').text()).toBe('Met')
      expect(tableRows($, statusTable)).toEqual([
        ['Medium', 'Met'],
        ['Low', 'Met']
      ])
      expect(statusTable.find('.govuk-tag--green')).toHaveLength(2)
    })

    test('does not list high or very high distinctiveness watercourses', async () => {
      const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
      figures.habitats.push(
        {
          habitatType: 'Other rivers and streams',
          distinctiveness: 'High',
          netUnitChange: 4
        },
        {
          habitatType: 'Priority habitat',
          distinctiveness: 'V.High',
          netUnitChange: 9
        }
      )
      mockProject(projectPayload({ tradingRules: figures }))

      const $ = await renderPage()

      expect($('body').text()).not.toContain('Other rivers and streams')
      expect($('body').text()).not.toContain('Priority habitat')
      expect($('body').text()).not.toContain('Very high')
    })
  })

  describe('low distinctiveness', () => {
    test('shows the three summary tiles and the low watercourse types', async () => {
      const $ = await renderPage()
      const section = sectionHeaded($, 'Low distinctiveness')
      const tiles = section
        .find('.app-unit-type-summary__tile')
        .map((_, tile) => [
          [$(tile).find('h3').text(), $(tile).find('p').text()]
        ])
        .get()
      const grid = section.find('table')

      expect(tiles).toEqual([
        ['Low distinctiveness net change in units', '-21.49 units'],
        [
          'Medium units available to offset low distinctiveness deficit',
          '12.92 units'
        ],
        ['Cumulative surplus of units', '-8.56 units']
      ])
      expect(
        grid
          .find('th')
          .map((_, th) => $(th).text())
          .get()
      ).toEqual(['Habitat type', 'Unit change'])
      expect(tableRows($, grid)).toEqual([['Culvert', '-21.49']])
      expect(grid.find('tfoot')).toHaveLength(0)
    })
  })

  describe('missing data', () => {
    test('says the figures are unavailable when none were saved', async () => {
      mockProject(
        projectPayload({
          postIntervention: { watercourses: [{ id: 'created-ditch' }] },
          statuses: {
            watercourses: { medium: null, low: null, overall: null }
          }
        })
      )

      const $ = await renderPage()

      expect($('.govuk-inset-text').text()).toContain(
        'Trading rules have not been calculated for this project'
      )
      expect($('table')).toHaveLength(0)
    })

    test('redirects to the watercourses summary before a post-intervention upload', async () => {
      const payload = projectPayload()
      delete payload.project.postIntervention
      mockProject(payload)

      const response = await server.inject({
        method: 'GET',
        url: PAGE_URL,
        auth
      })

      expect(response.statusCode).toBe(statusCodes.redirect)
      expect(response.headers.location).toBe(
        `/projects/${PROJECT_ID}/watercourses-summary`
      )
    })

    test('redirects a project without baseline data to its task list', async () => {
      mockProject({ project: { name: 'Empty' } })

      const response = await server.inject({
        method: 'GET',
        url: PAGE_URL,
        auth
      })

      expect(response.statusCode).toBe(statusCodes.redirect)
      expect(response.headers.location).toBe(
        `/add-project-details/${PROJECT_ID}`
      )
    })
  })
})

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
        {
          ref: 'W1',
          units: 1.2,
          sizeMetres: 1000,
          retentionCategory: 'Retained'
        }
      ],
      units: {
        watercoursesTotal: 1.2,
        watercoursesNetUnitChange: 0.2,
        watercoursesNetUnitChangePercentage: 20
      }
    }
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
      expect(link.attr('href')).toBe(PAGE_URL)
    }
  )

  test.each(summaryPaths.slice(0, 3))(
    '%s has no trading link before PI upload',
    async (path) => {
      const $ = await page(path, baseline)
      expect($(`a[href="${PAGE_URL}"]`)).toHaveLength(0)
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
      expect(link.attr('href')).toBe(PAGE_URL)
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

  test('the trading summary route marks Trading rules current', async () => {
    const $ = await page('watercourses-trading-summary', withPi)
    expect($('h1').text()).toBe('Watercourses trading summary')
    expect(
      $('nav[aria-label="Project summary"] [aria-current="page"]').text()
    ).toBe('Trading rules')
  })
})
