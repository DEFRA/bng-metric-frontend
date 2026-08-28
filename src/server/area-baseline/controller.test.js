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
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const habitatP2 = {
  featureId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ref: 'P-2',
  type: 'Modified grassland',
  broadType: 'Grassland',
  condition: 'Moderate',
  conditionScore: 2,
  distinctiveness: 'Low',
  distinctivenessScore: 2,
  units: 1,
  sizeSquareMetres: 20000
}

const habitatP1 = {
  featureId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ref: 'P-1',
  type: 'Lowland meadows',
  broadType: 'Grassland',
  condition: 'Good',
  conditionScore: 3,
  distinctiveness: 'V.High',
  distinctivenessScore: 8,
  units: 24,
  sizeSquareMetres: 10000,
  strategicSignificance: 'High'
}

const treeT1 = {
  featureId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  ref: 'T-1',
  type: 'Urban tree',
  broadType: 'Individual trees',
  condition: 'Good',
  conditionScore: 3,
  distinctiveness: 'Medium',
  distinctivenessScore: 4,
  units: 0.2,
  sizeSquareMetres: 163
}

const projectWithHabitats = {
  project: {
    name: 'Riverbank restoration',
    baseline: {
      units: {
        habitatsTotal: 24,
        treesTotal: 0.2
      },
      habitats: [habitatP2, habitatP1],
      trees: [treeT1],
      hedgerows: [{ featureId: 'h-1' }]
    }
  }
}

describe('area baseline', () => {
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
      payload: projectWithHabitats
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('renders the heading, caption, results and details sections', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Riverbank restoration')
    expect(result).toContain(
      '<h1 class="govuk-heading-xl govuk-!-margin-bottom-0">Baseline for area habitats</h1>'
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
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })
    const href =
      `/projects/${PROJECT_ID}/upload-file?` +
      `returnUrl=%2Fprojects%2F${PROJECT_ID}%2Farea-baseline`

    expect(result).toContain(`href="${href}"`)
  })

  test('renders five area habitat tiles with a text-only baseline action', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const summary = $('.app-unit-type-summary')
    const baselineAction = summary
      .find('span')
      .filter((_, node) => $(node).text() === 'View on-site area baseline')

    expect($('.app-unit-type-summary')).toHaveLength(1)
    expect($('#area-habitats-heading')).toHaveLength(0)
    expect(summary.find('.app-unit-type-summary__tile')).toHaveLength(5)
    expect(baselineAction).toHaveLength(1)
    expect(
      summary
        .find('a')
        .filter((_, link) => $(link).text() === 'View on-site area baseline')
    ).toHaveLength(0)
  })

  test('orders habitat and tree rows by ref and links refs with featureId', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const refs = $('tbody .govuk-table__row')
      .map((_, row) => $(row).find('a').first().text())
      .get()

    expect(refs).toEqual(['P-1', 'P-2', 'T-1'])
    expect($('tbody a').eq(0).attr('href')).toBe(
      `/baseline-habitat-details?featureId=${habitatP1.featureId}&projectId=${PROJECT_ID}`
    )
    expect($('tbody a').eq(1).attr('href')).toBe(
      `/baseline-habitat-details?featureId=${habitatP2.featureId}&projectId=${PROJECT_ID}`
    )
    expect($('tbody a').eq(2).attr('href')).toBe(
      `/baseline-habitat-details?featureId=${treeT1.featureId}&projectId=${PROJECT_ID}`
    )
  })

  // MoJ's SortableTable compares a non-numeric data-sort-value with a plain
  // localeCompare, so the padded sort keys must survive that comparison in the
  // same order the server rendered them.
  test('keeps double-figure refs in server order when sorted as plain strings', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Many parcels',
          baseline: {
            units: { habitatsTotal: 4 },
            habitats: [
              { ...habitatP1, ref: 'P-10' },
              { ...habitatP1, ref: 'P-2' },
              { ...habitatP1, ref: 'P-11' },
              { ...habitatP1, ref: 'P-1' }
            ],
            trees: []
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const rendered = $('tbody .govuk-table__row')
      .map((_, row) => {
        const cell = $(row).find('td').first()
        return { ref: cell.text(), sortValue: cell.attr('data-sort-value') }
      })
      .get()

    expect(rendered.map(({ ref }) => ref)).toEqual([
      'P-1',
      'P-2',
      'P-10',
      'P-11'
    ])

    const clientSorted = [...rendered].sort((left, right) =>
      left.sortValue.localeCompare(right.sortValue)
    )

    expect(clientSorted.map(({ ref }) => ref)).toEqual(
      rendered.map(({ ref }) => ref)
    )
  })

  test('renders formatted columns for units, size, distinctiveness and condition', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const firstRow = $('tbody .govuk-table__row').eq(0).text()
    const secondRow = $('tbody .govuk-table__row').eq(1).text()

    expect(firstRow).toContain('24.00')
    expect(firstRow).toContain('1ha')
    expect(firstRow).toContain('Grassland')
    expect(firstRow).toContain('Lowland meadows')
    expect(firstRow).toContain('V.High (8)')
    expect(firstRow).toContain('Good (3)')
    expect(secondRow).toContain('Low (2)')
    expect($('tfoot').text()).toContain('Total')
    expect($('tfoot').text()).toContain('25.20')
    expect($('tfoot').text()).toContain('3.0163ha')
  })

  // Strategic significance is fixed at Low (1) for MVS, so an uploaded category
  // such as habitatP1's 'High' is deliberately not surfaced here.
  test('renders the fixed Low (1) strategic significance for every row', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const significanceCells = $('tbody .govuk-table__row')
      .map((_, row) => $(row).find('td').last().text())
      .get()

    expect(significanceCells).toEqual(['Low (1)', 'Low (1)', 'Low (1)'])
  })

  test('keeps the header, habitat rows and totals row the same width', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const headerCount = $('thead th').length
    const bodyRowWidths = $('tbody .govuk-table__row')
      .map((_, row) => $(row).find('td').length)
      .get()

    expect(headerCount).toBe(8)
    expect(bodyRowWidths).toEqual([headerCount, headerCount, headerCount])
    expect($('tfoot td')).toHaveLength(headerCount)
  })

  test('leaves a missing label blank, drops a missing score and excludes non-numeric units from the total', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Partial data',
          baseline: {
            units: { habitatsTotal: 24 },
            habitats: [
              {
                ...habitatP1,
                distinctiveness: null,
                distinctivenessScore: null,
                condition: 'Moderate',
                conditionScore: Number.NaN
              },
              { ...habitatP2, units: null, distinctiveness: '' }
            ],
            trees: []
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const firstRow = $('tbody .govuk-table__row').eq(0)
    const secondRow = $('tbody .govuk-table__row').eq(1)

    expect(firstRow.find('td').eq(5).text()).toBe('')
    expect(firstRow.find('td').eq(6).text()).toBe('Moderate')
    expect(secondRow.find('td').eq(5).text()).toBe('')
    // Only habitatP1's 24 units count; habitatP2's null is skipped, not NaN.
    expect($('tfoot td').eq(1).text()).toBe('24.00')
  })

  test('falls back to Project when the project has no name', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          baseline: { units: { habitatsTotal: 0, treesTotal: 0 } }
        }
      }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain(
      `<span class="govuk-caption-l">${DEFAULT_PROJECT_NAME}</span>`
    )
  })

  test('falls back to the feature id for a blank ref and drops the link when there is no feature id', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Sparse refs',
          baseline: {
            units: { habitatsTotal: 24 },
            habitats: [
              { ...habitatP1, ref: null },
              { ref: '   ', units: 1, sizeSquareMetres: 100 }
            ],
            trees: []
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const refCells = $('tbody .govuk-table__row')
      .map((_, row) => {
        const cell = $(row).find('td').eq(0)
        return { text: cell.text(), linked: cell.find('a').length === 1 }
      })
      .get()

    expect(refCells).toContainEqual({ text: habitatP1.featureId, linked: true })
    expect(refCells).toContainEqual({ text: '', linked: false })
  })

  test('shows post-intervention figures in the tiles when the project has them', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'With post intervention',
          baseline: {
            units: { habitatsTotal: 10, treesTotal: 0 },
            habitats: [habitatP1],
            trees: []
          },
          postIntervention: {
            units: {
              habitatsTotal: 12,
              treesTotal: 0,
              habitatsNetUnitChange: 2,
              habitatsNetUnitChangePercentage: 20
            }
          }
        }
      }
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const summary = $('.app-unit-type-summary')

    expect(summary.text()).toContain('20.00%')
    expect(summary.text()).toContain('10.00 units')
    expect(summary.text()).toContain('12.00 units')
    expect(summary.text()).toContain('2.00 units')
    expect($('.govuk-tag--green').text()).toBe('Met')
  })

  test('loads every column as unsorted so the Ref heading is not highlighted', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)

    expect($('table').attr('data-module')).toBe('moj-sortable-table')
    expect($('table').hasClass('app-area-habitat-details-table')).toBe(true)
    expect($('th[aria-sort="none"]')).toHaveLength(8)
    expect($('th[aria-sort="ascending"]')).toHaveLength(0)
    expect($('.moj-scrollable-pane').attr('aria-label')).toBe(
      'Area habitat details'
    )
  })

  test('marks Baseline as the current nav item and keeps Area habitats as a link', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')

    expect(navigation.find('[aria-current="page"]').text()).toBe('Baseline')
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === 'Area habitats')
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}/area-summary`)
    expect(navigation.text()).toContain('Hedgerows')
    expect(navigation.text()).not.toContain('Watercourses')
  })

  test('redirects a project without baseline data to the existing task list', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project: { name: 'No baseline' } }
    })

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/area-baseline`,
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${PROJECT_ID}`)
  })

  test('rejects an invalid project id', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/area-baseline',
      auth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })
})
