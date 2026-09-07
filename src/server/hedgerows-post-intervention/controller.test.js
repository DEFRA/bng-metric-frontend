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
const PAGE_PATH = `/projects/${PROJECT_ID}/hedgerows-post-intervention`
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const retainedHedgerow = {
  featureId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ref: 'P-A2',
  units: 0.5,
  sizeMetres: 1000,
  retentionCategory: 'Retained',
  proposed: {
    type: 'Native hedgerow',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    condition: 'Fairly Poor',
    conditionScore: 1
  }
}

const enhancedHedgerow = {
  featureId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ref: 'P-A3',
  units: 0.4,
  sizeMetres: 800,
  retentionCategory: '1. Enhanced',
  proposed: {
    type: 'Species-rich native hedgerow',
    distinctiveness: 'High',
    distinctivenessScore: 6,
    condition: 'Good',
    conditionScore: 3,
    standardTimeToTargetCondition: '10',
    advanceYears: 1,
    delayYears: 0,
    finalTimeToTargetCondition: '9 years (0.7)',
    difficulty: 'Low',
    difficultyMultiplier: 1
  }
}

const createdHedgerowFirst = {
  featureId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  ref: 'P-A1',
  units: 0.74,
  sizeMetres: 500,
  retentionCategory: 'Created',
  proposed: {
    type: 'Native hedgerow - associated with bank or ditch',
    distinctiveness: 'Low',
    distinctivenessScore: 2,
    condition: 'Moderate',
    conditionScore: 2,
    standardTimeToTargetCondition: '1',
    advanceYears: 10,
    delayYears: 2,
    finalTimeToTargetCondition: '10 years (0.5555)',
    difficulty: 'Medium',
    difficultyMultiplier: 0.67
  }
}

const createdHedgerowSecond = {
  featureId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  ref: 'P-A10',
  units: 0.01,
  sizeMetres: 100,
  retentionCategory: 'Created',
  proposed: {
    type: 'Line of trees',
    distinctiveness: 'Low',
    distinctivenessScore: 2,
    condition: 'Poor',
    conditionScore: 1,
    standardTimeToTargetCondition: '5',
    advanceYears: 0,
    delayYears: 0,
    finalTimeToTargetCondition: '5 years (1)',
    difficulty: 'Low',
    difficultyMultiplier: 1
  }
}

const populatedProject = {
  project: {
    name: 'Riverbank restoration',
    baseline: {
      hedgerows: [{}],
      units: { hedgerowsTotal: 1.52 }
    },
    postIntervention: {
      hedgerows: [
        retainedHedgerow,
        enhancedHedgerow,
        createdHedgerowSecond,
        createdHedgerowFirst
      ],
      watercourses: [{}],
      units: {
        hedgerowsTotal: 1.64,
        hedgerowsNetUnitChange: 0.12,
        hedgerowsNetUnitChangePercentage: 7.72
      }
    }
  }
}

describe('hedgerows post intervention', () => {
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
      payload: populatedProject
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('renders the page heading, project name and results subheading', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Riverbank restoration')
    expect(result).toContain(
      '<h1 class="govuk-heading-xl govuk-!-margin-bottom-0">Post intervention for hedgerows</h1>'
    )
    expect(result).toContain(
      '<h2 class="govuk-heading-m">Hedgerows results</h2>'
    )
    expect(result).toContain(
      '<h2 class="govuk-heading-m">Hedgerow habitat details</h2>'
    )
  })

  test('renders the upload action with a return URL back to this page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })
    const href =
      `/projects/${PROJECT_ID}/upload-file?` +
      `returnUrl=%2Fprojects%2F${PROJECT_ID}%2Fhedgerows-post-intervention`

    expect(result).toContain(`href="${href}"`)
  })

  test('renders results tiles with a baseline link and no post-intervention self-link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const summary = $('.app-unit-type-summary')
    const baselineLink = summary
      .find('a')
      .filter(
        (_, link) => $(link).text().trim() === 'View on-site hedgerows baseline'
      )
    const postInterventionTile = summary
      .find('.app-unit-type-summary__secondary .app-unit-type-summary__tile')
      .eq(1)

    expect(summary).toHaveLength(1)
    expect(summary.text()).toContain('7.72%')
    expect(summary.text()).toContain('1.52 units')
    expect(summary.text()).toContain('1.64 units')
    expect(summary.text()).toContain('0.12 units')
    expect(baselineLink).toHaveLength(1)
    expect(baselineLink.attr('href')).toBe(
      `/projects/${PROJECT_ID}/hedgerows-baseline`
    )
    expect(postInterventionTile.text()).not.toContain(
      'View on-site hedgerows post intervention'
    )
    expect(postInterventionTile.find('a')).toHaveLength(0)
  })

  test('marks Post-intervention as current and links the rest of the left nav', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')

    expect(navigation.find('[aria-current="page"]').text()).toBe(
      'Post-intervention'
    )
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === 'Summary')
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}/project-summary`)
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === 'Area habitats')
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}/area-summary`)
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === 'Hedgerows')
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}/hedgerows-summary`)
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === 'Baseline')
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}/hedgerows-baseline`)
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === 'Watercourses')
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}/watercourses-summary`)
  })

  test('uses post-intervention-only summary behaviour when no baseline hedgerows exist', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Created only',
          baseline: { units: { hedgerowsTotal: 0 } },
          postIntervention: {
            hedgerows: [{ retentionCategory: 'Created' }],
            units: { hedgerowsTotal: 1.99 }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')
    const hedgerowsSummary = $('.app-unit-type-summary')

    expect(navigation.find('[aria-current="page"]').text()).toBe(
      'Post-intervention'
    )
    expect(
      navigation.find('a').filter((_, link) => $(link).text() === 'Baseline')
    ).toHaveLength(0)
    expect(navigation.text()).not.toContain('Watercourses')
    expect(hedgerowsSummary.text()).toContain('Not applicable')
    expect(hedgerowsSummary.find('.govuk-tag')).toHaveLength(0)
    expect(hedgerowsSummary.text()).not.toContain('View on-site baseline')
    expect(hedgerowsSummary.find('a').text().trim()).toBe(
      'Upload on-site post intervention file'
    )
  })

  test('shows Retained, Enhanced and Created GOV.UK tabs with in-page hash links', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const tabs = $('.govuk-tabs')
    const labels = tabs
      .find('.govuk-tabs__tab')
      .map((_, link) => $(link).text().trim())
      .get()
    const selectedTab = $('.govuk-tabs__list-item--selected .govuk-tabs__tab')

    expect(labels).toEqual(['Retained', 'Enhanced', 'Created'])
    expect($('h2.govuk-heading-m').eq(1).text().trim()).toBe(
      'Hedgerow habitat details'
    )
    expect(tabs.find('.govuk-tabs__title').text().trim()).toBe(
      'Intervention type'
    )
    expect(selectedTab.get(0).tagName).toBe('span')
    expect(selectedTab.attr('aria-current')).toBe('true')
    expect(
      tabs.find('a').filter((_, link) => $(link).text().trim() === 'Retained')
    ).toHaveLength(0)
    expect(
      tabs
        .find('a')
        .filter((_, link) => $(link).text().trim() === 'Enhanced')
        .attr('href')
    ).toBe('#enhanced')
    expect(
      tabs
        .find('a')
        .filter((_, link) => $(link).text().trim() === 'Created')
        .attr('href')
    ).toBe('#created')
    expect($('#retained').find('h3').text()).toBe('Retained hedgerow habitats')
    expect($('#enhanced').find('h3').text()).toBe('Enhanced hedgerow habitats')
    expect($('#created').find('h3').text()).toBe('Created hedgerow habitats')
  })

  test('renders every tab panel on a single page load', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)

    expect($('#retained')).toHaveLength(1)
    expect($('#enhanced')).toHaveLength(1)
    expect($('#created')).toHaveLength(1)
    expect(
      $('.govuk-tabs__list-item--selected .govuk-tabs__tab').text().trim()
    ).toBe('Retained')
  })

  test('shows the retained grid subheading, columns, totals and unsorted headers', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const panel = $('#retained')
    const headers = panel
      .find('thead th')
      .map((_, heading) => $(heading).text())
      .get()
    const refs = panel
      .find('tbody a')
      .map((_, link) => $(link).text())
      .get()

    expect(panel.find('h3').text()).toBe('Retained hedgerow habitats')
    expect(headers).toEqual([
      'Ref',
      'Units',
      'Size',
      'Habitat type',
      'Distinctiveness',
      'Condition',
      'Strategic significance'
    ])
    expect(headers).not.toContain('Target condition')
    expect(panel.find('th[aria-sort="none"]')).toHaveLength(headers.length)
    expect(refs).toEqual(['P-A2'])
    expect(panel.find('tbody a').attr('href')).toBe(
      `/post-intervention-habitat-details?featureId=${retainedHedgerow.featureId}&projectId=${PROJECT_ID}`
    )
    expect(panel.find('tbody').text()).toContain('0.50')
    expect(panel.find('tbody').text()).toContain('1km')
    expect(panel.find('tbody').text()).toContain('Fairly Poor (1)')
    expect(panel.find('tfoot').text()).toContain('Total')
    expect(panel.find('tfoot').text()).toContain('0.50')
    expect(panel.find('tfoot').text()).toContain('1km')
    expect(panel.find('.moj-scrollable-pane').attr('aria-label')).toBe(
      'Retained hedgerow habitats'
    )
  })

  test('shows enhanced columns without condition in the Enhanced panel', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const panel = $('#enhanced')
    const headers = panel
      .find('thead th')
      .map((_, heading) => $(heading).text())
      .get()
    const row = panel.find('tbody').text()

    expect(panel.find('h3').text()).toBe('Enhanced hedgerow habitats')
    expect(headers).toContain('Target condition')
    expect(headers).toContain('Standard time to target')
    expect(headers).toContain('Advance')
    expect(headers).toContain('Delay')
    expect(headers).toContain('Final time to target')
    expect(headers).toContain('Standard Difficulty')
    expect(headers).not.toContain('Condition')
    expect(row).toContain('Good (3)')
    expect(row).toContain('10 years')
    expect(row).toContain('1 year')
    expect(row).toContain('0 years')
    expect(row).toContain('9 years (0.7)')
    expect(row).toContain('Low (1)')
  })

  test('sorts created habitats by ref and totals their units and size', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const panel = $('#created')
    const refs = panel
      .find('tbody a')
      .map((_, link) => $(link).text())
      .get()
    const footer = panel.find('tfoot').text()

    expect(panel.find('h3').text()).toBe('Created hedgerow habitats')
    expect(refs).toEqual(['P-A1', 'P-A10'])
    expect(footer).toContain('0.75')
    expect(footer).toContain('0.6km')
  })

  test('hides tabs that have no matching habitats', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Created only',
          baseline: { hedgerows: [{}], units: { hedgerowsTotal: 1 } },
          postIntervention: {
            hedgerows: [{ retentionCategory: 'Created' }],
            units: { hedgerowsTotal: 1 }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const tabs = $('.govuk-tabs')

    expect(tabs.find('.govuk-tabs__tab').text().trim()).toBe('Created')
    expect(tabs.find('a.govuk-tabs__tab')).toHaveLength(0)
    expect(tabs.find('span.govuk-tabs__tab').attr('aria-current')).toBe('true')
    expect(tabs.text()).not.toContain('Retained')
    expect(tabs.text()).not.toContain('Enhanced')
    expect($('#created')).toHaveLength(1)
    expect($('#retained')).toHaveLength(0)
    expect($('#enhanced')).toHaveLength(0)
  })

  test('redirects a project without baseline data to the existing task list', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project: { name: 'No baseline' } }
    })

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${PROJECT_ID}`)
  })

  test('rejects an invalid project id', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/hedgerows-post-intervention',
      auth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires authentication', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: PAGE_PATH
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })
})
