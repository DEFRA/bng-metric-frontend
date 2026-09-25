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
const PAGE_URL = `/projects/${PROJECT_ID}/area-trading-summary`
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
  areaHabitats: { medium: 'Not met', low: 'Met', overall: 'Not met' }
}

function projectPayload({
  tradingRules = WORKED_EXAMPLE_TRADING_RULES,
  statuses = WORKED_EXAMPLE_STATUSES,
  baseline = { units: { habitatsTotal: 160 } },
  postIntervention = {
    units: { habitatsTotal: 170 },
    tradingRules: { areaHabitats: tradingRules }
  }
} = {}) {
  return {
    tradingRuleStatuses: statuses,
    project: { name: 'Worked example', baseline, postIntervention }
  }
}

function withHabitatTypes(filter) {
  const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
  figures.habitatTypes = figures.habitatTypes.filter(filter)
  return figures
}

function mockProject(payload) {
  vi.mocked(wreck.get).mockResolvedValue({
    res: { statusCode: statusCodes.ok },
    payload
  })
}

/** The section whose heading is exactly this text. */
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

/** The grid that follows the subheading with this text. */
const gridUnder = ($, heading) =>
  $('h3')
    .filter((_, h3) => $(h3).text() === heading)
    .nextAll('table')
    .first()

describe('area trading summary', () => {
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

  describe('AC1 left navigation', () => {
    test('shows the area section with Trading as the current page', async () => {
      const $ = await renderPage()
      const nav = $('nav[aria-label="Project summary"]')
      const current = nav.find('[aria-current="page"]')

      expect(current.text()).toBe('Trading Rules')
      expect(current.is('strong')).toBe(true)

      const links = Object.fromEntries(
        nav
          .find('a')
          .map((_, link) => [[$(link).text(), $(link).attr('href')]])
          .get()
      )
      // The area Post-intervention link arrives with the area post-intervention
      // page itself, which is a separate story.
      expect(links).toMatchObject({
        Summary: `/projects/${PROJECT_ID}/project-summary`,
        'Area habitats': `/projects/${PROJECT_ID}/area-summary`,
        Baseline: `/projects/${PROJECT_ID}/area-baseline`
      })
      expect(links).not.toHaveProperty('Hedgerows')
      expect(links).not.toHaveProperty('Watercourses')
    })

    test('links Hedgerows and Watercourses only when the project has them', async () => {
      const payload = projectPayload()
      payload.project.baseline.hedgerows = [{ id: 'h1' }]
      payload.project.postIntervention.watercourses = [{ id: 'w1' }]
      mockProject(payload)

      const $ = await renderPage()
      const nav = $('nav[aria-label="Project summary"]')

      expect(
        nav.find('a').filter((_, link) => $(link).text() === 'Hedgerows')
      ).toHaveLength(1)
      expect(
        nav
          .find('a')
          .filter((_, link) => $(link).text() === 'Watercourses')
          .attr('href')
      ).toBe(`/projects/${PROJECT_ID}/watercourses-summary`)
    })
  })

  describe('AC2 headings and upload button', () => {
    test('shows the project name, heading and Upload file button', async () => {
      const $ = await renderPage()

      expect($('title').text()).toContain('Area habitats trading summary')
      expect($('.govuk-caption-l').text()).toBe('Worked example')
      expect($('h1').text()).toBe('Area habitats trading summary')

      const upload = $('a.govuk-button').filter(
        (_, link) => $(link).text().trim() === 'Upload file'
      )
      expect(upload.attr('href')).toBe(
        `/projects/${PROJECT_ID}/upload-file?returnUrl=${encodeURIComponent(PAGE_URL)}`
      )
    })
  })

  describe('AC3 trading summary', () => {
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
        ['Low', 'Met']
      ])
      expect(table.find('.govuk-tag--red').text()).toBe('Not met')
      expect(table.find('.govuk-tag--green').text()).toBe('Met')
    })

    test('omits the Medium row when no Medium habitat is present', async () => {
      mockProject(
        projectPayload({
          tradingRules: withHabitatTypes((h) => h.distinctiveness === 'Low'),
          statuses: {
            areaHabitats: { medium: 'Met', low: 'Not met', overall: 'Not met' }
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
          tradingRules: withHabitatTypes((h) => h.distinctiveness === 'Medium')
        })
      )

      const $ = await renderPage()
      const table = sectionHeaded($, 'Trading summary').find('table')

      expect(tableRows($, table)).toEqual([['Medium', 'Not met']])
      expect(sectionHeaded($, 'Low distinctiveness')).toHaveLength(0)
    })
  })

  describe('AC4 medium distinctiveness tile', () => {
    test('shows the Medium deficit to 2 dp with its status', async () => {
      const $ = await renderPage()
      const tile = sectionHeaded($, 'Medium distinctiveness').find(
        '.app-unit-type-summary__tile'
      )

      expect(tile.find('h3').text()).toBe(
        'Medium distinctiveness unit deficit required to meet trading rules'
      )
      expect(tile.find('p').text()).toBe('-9.42 units')
      expect(tile.find('.govuk-tag--red').text()).toBe('Not met')
    })

    test('shows Met when no Medium broad habitat is in deficit', async () => {
      const figures = structuredClone(WORKED_EXAMPLE_TRADING_RULES)
      figures.medium.deficit = 0
      mockProject(
        projectPayload({
          tradingRules: figures,
          statuses: {
            areaHabitats: { medium: 'Met', low: 'Met', overall: 'Met' }
          }
        })
      )

      const $ = await renderPage()
      const tile = sectionHeaded($, 'Medium distinctiveness').find(
        '.app-unit-type-summary__tile'
      )

      expect(tile.find('p').text()).toBe('0.00 units')
      expect(tile.find('.govuk-tag--green').text()).toBe('Met')
    })
  })

  describe('AC5 medium distinctiveness unit change', () => {
    test('shows a grid per non-intertidal broad habitat, ordered as saved', async () => {
      const $ = await renderPage()
      const section = sectionHeaded($, 'Medium distinctiveness')

      expect(
        section
          .find('h3.govuk-heading-m')
          .map((_, h3) => $(h3).text())
          .get()
      ).toEqual([
        'Grassland',
        'Heathland and shrub',
        'Lakes',
        'Woodland and forest',
        'Intertidal sediment and Intertidal hard structures'
      ])
    })

    test.each([
      [
        'Grassland',
        [
          ['Other lowland acid grassland', '108.29'],
          ['Other neutral grassland', '6.19'],
          ['Upland acid grassland', '5.09'],
          ['Total broad habitat change', '119.57']
        ]
      ],
      [
        'Heathland and shrub',
        [
          ['Blackthorn scrub', '0.18'],
          ['Gorse scrub', '-2.00'],
          ['Mixed scrub', '0.00'],
          ['Willow scrub', '0.40'],
          ['Total broad habitat change', '-1.42']
        ]
      ],
      [
        'Lakes',
        [
          ['Reservoirs', '2.95'],
          ['Total broad habitat change', '2.95']
        ]
      ],
      [
        'Woodland and forest',
        [
          ["Other Scot's pine woodland", '0.00'],
          ['Total broad habitat change', '0.00']
        ]
      ]
    ])('shows the worked example figures for %s', async (heading, rows) => {
      const $ = await renderPage()
      const grid = gridUnder($, heading)

      expect(
        grid
          .find('th')
          .map((_, th) => $(th).text())
          .get()
      ).toEqual(['Habitat type', 'Unit change'])
      expect(tableRows($, grid)).toEqual(rows)
    })

    test('merges the two intertidal broad habitats into one grid', async () => {
      const $ = await renderPage()
      const grid = gridUnder(
        $,
        'Intertidal sediment and Intertidal hard structures'
      )

      expect(
        grid
          .find('th')
          .map((_, th) => $(th).text())
          .get()
      ).toEqual(['Broad habitat', 'Habitat type', 'On-site unit change'])
      expect(tableRows($, grid)).toEqual([
        [
          'Intertidal hard structures',
          'Artificial hard structures with integrated greening of grey infrastructure (IGGI)',
          '-4.00'
        ],
        ['Intertidal sediment', 'Littoral coarse sediment', '-4.00'],
        ['Intertidal sediment', 'Littoral sand', '0.00'],
        ['Total broad habitat change', '', '-8.00']
      ])
    })

    test('shows no intertidal grid when no Medium intertidal habitat is present', async () => {
      const figures = withHabitatTypes(
        (h) => !h.broadHabitat.startsWith('Intertidal')
      )
      figures.medium.broadHabitats = figures.medium.broadHabitats.filter(
        (b) => !b.broadHabitat.startsWith('Intertidal')
      )
      mockProject(projectPayload({ tradingRules: figures }))

      const $ = await renderPage()

      expect($('body').text()).not.toContain(
        'Intertidal sediment and Intertidal hard structures'
      )
      expect(gridUnder($, 'Grassland')).toHaveLength(1)
    })
  })

  describe('AC6 and AC7 low distinctiveness', () => {
    test('shows the three Low summary tiles to 2 dp', async () => {
      const $ = await renderPage()
      const tiles = sectionHeaded($, 'Low distinctiveness')
        .find('.app-unit-type-summary__tile')
        .map((_, tile) => [
          [$(tile).find('h3').text(), $(tile).find('p').text()]
        ])
        .get()

      expect(tiles).toEqual([
        ['Low distinctiveness net change in units', '-90.00 units'],
        [
          'Medium units available to offset low distinctiveness deficit',
          '122.52 units'
        ],
        ['Cumulative surplus of units', '32.52 units']
      ])
    })

    test('lists every Low habitat with the band total', async () => {
      const $ = await renderPage()
      const grid = sectionHeaded($, 'Low distinctiveness').find('table')

      expect(
        grid
          .find('th')
          .map((_, th) => $(th).text())
          .get()
      ).toEqual(['Broad habitat', 'Habitat type', 'On-site unit change'])
      expect(tableRows($, grid)).toEqual([
        ['Urban', 'Allotments', '-30.00'],
        ['Urban', 'Bioswale', '-60.00'],
        ['Total on-site unit change', '', '-90.00']
      ])
    })
  })

  describe('missing data', () => {
    test('says the figures are unavailable when none were saved', async () => {
      mockProject(
        projectPayload({
          postIntervention: { units: { habitatsTotal: 1 } },
          statuses: {
            areaHabitats: { medium: null, low: null, overall: null }
          }
        })
      )

      const $ = await renderPage()

      expect($('.govuk-inset-text').text()).toContain(
        'Trading rules have not been calculated for this project'
      )
      expect($('table')).toHaveLength(0)
    })

    test('redirects to the area summary before a post-intervention upload', async () => {
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
        `/projects/${PROJECT_ID}/area-summary`
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
