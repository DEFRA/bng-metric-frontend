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
const PAGE_PATH = `/projects/${PROJECT_ID}/area-post-intervention`
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const retainedHabitat = {
  featureId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ref: 'P-1',
  units: 24,
  sizeSquareMetres: 10000,
  broadType: 'Grassland',
  retentionCategory: 'Retained',
  proposed: {
    type: 'Lowland meadows',
    distinctiveness: 'V.High',
    distinctivenessScore: 8,
    condition: 'Good',
    conditionScore: 3
  }
}

const enhancedHabitat = {
  featureId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ref: 'P-2',
  units: 1,
  sizeSquareMetres: 20000,
  retentionCategory: '1. Enhanced',
  proposed: {
    // Post-intervention features nest broadType under proposed (unlike
    // baseline's flat field) — see enrich-post-intervention-area-habitat.js
    // in the backend.
    broadType: 'Grassland',
    type: 'Modified grassland',
    distinctiveness: 'Low',
    distinctivenessScore: 2,
    condition: 'Moderate',
    conditionScore: 2,
    standardTimeToTargetCondition: '10',
    advanceYears: 1,
    delayYears: 0,
    finalTimeToTargetCondition: '9 years (0.7)',
    difficulty: 'Low',
    difficultyMultiplier: 1
  }
}

const createdTree = {
  featureId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  ref: 'T-1',
  units: 0.2,
  sizeSquareMetres: 163,
  broadType: 'Individual trees',
  retentionCategory: 'Created',
  proposed: {
    type: 'Urban tree',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    condition: 'Good',
    conditionScore: 3,
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
      habitats: [{}],
      units: { habitatsTotal: 24, treesTotal: 0.2 }
    },
    postIntervention: {
      habitats: [retainedHabitat, enhancedHabitat],
      trees: [createdTree],
      habitatSizes: {
        site: { totalSquareMetres: 30000 },
        areaHabitats: { totalSquareMetres: 30163 }
      },
      units: {
        habitatsTotal: 25,
        treesTotal: 0.2,
        habitatsNetUnitChange: 0.68,
        habitatsNetUnitChangePercentage: 2.8
      }
    }
  }
}

describe('area post intervention', () => {
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
      '<h1 class="govuk-heading-xl govuk-!-margin-bottom-0">Post intervention for area habitats</h1>'
    )
    expect(result).toContain(
      '<h2 class="govuk-heading-m">Area habitats results</h2>'
    )
    expect(result).toContain(
      '<h2 class="govuk-heading-m">Area habitat details</h2>'
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
      `returnUrl=%2Fprojects%2F${PROJECT_ID}%2Farea-post-intervention`

    expect(result).toContain(`href="${href}"`)
  })

  test('renders results tiles combining habitats and trees, with a baseline link', async () => {
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
        (_, link) => $(link).text().trim() === 'View on-site area baseline'
      )

    expect(summary).toHaveLength(1)
    expect(summary.text()).toContain('2.80%')
    expect(summary.text()).toContain('24.20 units')
    expect(summary.text()).toContain('25.20 units')
    expect(summary.text()).toContain('0.68 units')
    expect(baselineLink).toHaveLength(1)
    expect(baselineLink.attr('href')).toBe(
      `/projects/${PROJECT_ID}/area-baseline`
    )
  })

  test('renders the site size and area habitats size figures', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const areaSize = $('.app-area-size')

    expect(areaSize.text()).toContain('Site size')
    expect(areaSize.text()).toContain('3ha')
    expect(areaSize.text()).toContain('Area habitats size')
    expect(areaSize.text()).toContain('3.0163ha')
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
        .filter((_, link) => $(link).text() === 'Baseline')
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}/area-baseline`)
  })

  test('shows Retained, Enhanced and Created GOV.UK tabs with habitats and trees split across them', async () => {
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

    expect(labels).toEqual(['Retained', 'Enhanced', 'Created'])
    expect($('#retained').find('h3').text()).toBe('Retained area habitats')
    expect($('#enhanced').find('h3').text()).toBe('Enhanced area habitats')
    expect($('#created').find('h3').text()).toBe('Created area habitats')
    expect($('#retained tbody a').text()).toBe('P-1')
    expect($('#enhanced tbody a').text()).toBe('P-2')
    expect($('#created tbody a').text()).toBe('T-1')
  })

  test('shows the Broad habitat column for both habitat and tree rows', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const headings = (selector) =>
      $(selector)
        .map((_, heading) => $(heading).text())
        .get()

    expect(headings('#retained thead th')).toEqual([
      'Ref',
      'Units',
      'Size',
      'Broad habitat',
      'Habitat type',
      'Distinctiveness',
      'Condition',
      'Strategic significance'
    ])
    const targetAndTimeHeaders = [
      'Strategic significance',
      'Target condition',
      'Standard time to target',
      'Advance',
      'Delay',
      'Final time to target',
      'Standard difficulty'
    ]
    expect(headings('#enhanced thead th')).toEqual([
      'Ref',
      'Units',
      'Size',
      'Broad habitat',
      'Habitat type',
      'Distinctiveness',
      ...targetAndTimeHeaders
    ])
    expect(headings('#created thead th')).toEqual([
      'Ref',
      'Units',
      'Size',
      'Broad habitat',
      'Habitat type',
      'Distinctiveness',
      ...targetAndTimeHeaders
    ])
    expect($('#retained tbody').text()).toContain('Grassland')
    expect($('#created tbody').text()).toContain('Individual trees')
  })

  test('shows the area habitat totals row in hectares', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: PAGE_PATH,
      auth
    })

    const $ = load(result)
    const retainedFooter = $('#retained tfoot').text()

    expect(retainedFooter).toContain('Total')
    expect(retainedFooter).toContain('24.00')
    expect(retainedFooter).toContain('1ha')
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
      url: '/projects/not-a-uuid/area-post-intervention',
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
