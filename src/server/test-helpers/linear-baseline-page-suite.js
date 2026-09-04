import { beforeEach, expect, test, vi } from 'vitest'
import { load } from 'cheerio'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { BROAD_HABITAT_HEADER } from '../common/helpers/baseline-habitat-grid.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const POPULATED_UNITS_TOTAL = 2
const EMPTY_UNITS_TOTAL = 0
const LINEAR_BASELINE_COLUMN_COUNT = 7
const UNIT_SUMMARY_TILE_COUNT = 5
const BODY_ROW_SELECTOR = 'tbody .govuk-table__row'
const EXPECTED_UNITS_DISPLAY = '0.80'
const EXPECTED_SIZE_DISPLAY = '1234.568km'
const EXPECTED_TOTAL_UNITS_DISPLAY = '2.00'
const EXPECTED_TOTAL_SIZE_DISPLAY = '1236.067891km'
const EXPECTED_ROUNDED_TOTAL_SIZE_DISPLAY = '1236.068km'
const PROJECT_NAME = 'Riverbank restoration'
const NAVIGATION_LABEL = 'Project summary'
const AREA_HABITATS_LABEL = 'Area habitats'
const BASELINE_LABEL = 'Baseline'
const ON_SITE_BASELINE_HEADING = 'On-site baseline'
const FORBIDDEN_PATH = '/auth/forbidden'

function pageUrl(path) {
  return `/projects/${PROJECT_ID}${path}`
}

function createLinearBaselineTestContext(spec) {
  const populatedProject = {
    project: {
      name: PROJECT_NAME,
      baseline: {
        units: { [spec.unitsTotalKey]: POPULATED_UNITS_TOTAL },
        [spec.habitatKey]: [spec.featureSecond, spec.featureFirst],
        [spec.otherHabitatKey]: [{ featureId: 'other-1' }]
      }
    }
  }

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: populatedProject
    })
  })

  async function loadPage() {
    return spec.getServer().inject({
      method: 'GET',
      url: pageUrl(spec.path),
      auth
    })
  }

  return { ...spec, loadPage }
}

function registerPageSectionTests(ctx) {
  test('renders the heading, caption, results and details sections', async () => {
    const { result, statusCode } = await ctx.loadPage()

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain(PROJECT_NAME)
    expect(result).toContain(
      `<h1 class="govuk-heading-xl govuk-!-margin-bottom-0">${ctx.pageHeading}</h1>`
    )
    expect(result).toContain(
      `<h2 class="govuk-heading-m">${ctx.resultsHeading}</h2>`
    )
    expect(result).toContain(
      `<h2 class="govuk-heading-m">${ctx.detailsHeading}</h2>`
    )
  })

  test('renders the upload action with a return URL back to this page', async () => {
    const { result } = await ctx.loadPage()
    const href =
      `/projects/${PROJECT_ID}/upload-file?` +
      `returnUrl=%2Fprojects%2F${PROJECT_ID}%2F${ctx.path.replace(/^\//, '')}`

    expect(result).toContain(`href="${href}"`)
  })
}

function registerSummaryTileTests(ctx) {
  test('renders five tiles without a baseline action below the units', async () => {
    const { result } = await ctx.loadPage()
    const $ = load(result)
    const summary = $('.app-unit-type-summary')
    const baselineTile = summary
      .find('.app-unit-type-summary__tile')
      .filter(
        (_, tile) =>
          $(tile).find('h3').first().text() === ON_SITE_BASELINE_HEADING
      )

    expect(summary).toHaveLength(1)
    expect($(`#${ctx.unitLabel.toLowerCase()}-heading`)).toHaveLength(0)
    expect(summary.find('.app-unit-type-summary__tile')).toHaveLength(
      UNIT_SUMMARY_TILE_COUNT
    )
    expect(baselineTile).toHaveLength(1)
    expect(baselineTile.find('p')).toHaveLength(1)
    expect(baselineTile.text()).not.toContain('View on-site')
  })
}

function registerGridTests(ctx) {
  test('orders rows by ref and links refs with featureId', async () => {
    const { result } = await ctx.loadPage()
    const $ = load(result)
    const refs = $(BODY_ROW_SELECTOR)
      .map((_, row) => $(row).find('a').first().text())
      .get()

    expect(refs).toEqual([ctx.featureFirst.ref, ctx.featureSecond.ref])
    expect($('tbody a').eq(0).attr('href')).toBe(
      `/baseline-habitat-details?featureId=${ctx.featureFirst.featureId}&projectId=${PROJECT_ID}`
    )
  })

  test('renders size in kilometres, units to 2 d.p. and a 10-sig-fig total', async () => {
    const { result } = await ctx.loadPage()
    const $ = load(result)
    const firstRow = $(BODY_ROW_SELECTOR).eq(0).text()
    const footer = $('tfoot').text()

    expect(firstRow).toContain(EXPECTED_UNITS_DISPLAY)
    expect(firstRow).toContain(EXPECTED_SIZE_DISPLAY)
    expect(firstRow).toContain(ctx.featureFirst.type)
    expect(firstRow).toContain('Low (1)')
    expect(footer).toContain('Total')
    expect(footer).toContain(EXPECTED_TOTAL_UNITS_DISPLAY)
    expect(footer).toContain(EXPECTED_TOTAL_SIZE_DISPLAY)
    expect(footer).not.toContain(EXPECTED_ROUNDED_TOTAL_SIZE_DISPLAY)
  })

  test('keeps the header, habitat rows and totals row the same width', async () => {
    const { result } = await ctx.loadPage()
    const $ = load(result)
    const headerCount = $('thead th').length

    expect(headerCount).toBe(LINEAR_BASELINE_COLUMN_COUNT)
    expect($('tfoot td')).toHaveLength(headerCount)
  })

  test('loads every column as unsorted', async () => {
    const { result } = await ctx.loadPage()
    const $ = load(result)

    expect($('table').hasClass('app-habitat-details-table')).toBe(true)
    expect($('th[aria-sort="none"]')).toHaveLength(LINEAR_BASELINE_COLUMN_COUNT)
    expect($('thead th').text()).not.toContain(BROAD_HABITAT_HEADER)
    expect($('.moj-scrollable-pane').attr('aria-label')).toBe(
      ctx.detailsHeading
    )
  })
}

function registerNavigationTests(ctx) {
  test('marks Baseline as current under this unit type and keeps the parent linked', async () => {
    const { result } = await ctx.loadPage()
    const $ = load(result)
    const navigation = $(`nav[aria-label="${NAVIGATION_LABEL}"]`)
    const baselineLinks = navigation
      .find('a')
      .filter((_, link) => $(link).text() === BASELINE_LABEL)

    expect(navigation.find('[aria-current="page"]').text()).toBe(BASELINE_LABEL)
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === ctx.unitLabel)
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}${ctx.summaryPath}`)
    expect(
      navigation
        .find('a')
        .filter((_, link) => $(link).text() === AREA_HABITATS_LABEL)
        .attr('href')
    ).toBe(`/projects/${PROJECT_ID}/area-summary`)
    expect(baselineLinks).toHaveLength(0)
    expect(navigation.find('.app-project-navigation__child')).toHaveLength(1)
    expect(
      navigation.find('.app-project-navigation__child').text().trim()
    ).toBe(BASELINE_LABEL)
    expect(navigation.text()).toContain(ctx.otherLabel)
  })
}

function registerEmptyGridTest(ctx) {
  test('renders an empty grid when this unit type has no rows', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Empty linear baseline',
          baseline: { units: { [ctx.unitsTotalKey]: EMPTY_UNITS_TOTAL } }
        }
      }
    })

    const { result, statusCode } = await ctx.loadPage()
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($(BODY_ROW_SELECTOR)).toHaveLength(0)
    expect($('thead th')).toHaveLength(LINEAR_BASELINE_COLUMN_COUNT)
    expect($('tfoot td')).toHaveLength(LINEAR_BASELINE_COLUMN_COUNT)
  })
}

function registerAccessControlTests(ctx) {
  test('requires authentication', async () => {
    const { statusCode, headers } = await ctx.getServer().inject({
      method: 'GET',
      url: pageUrl(ctx.path)
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(FORBIDDEN_PATH)
  })

  test('requires an approved BNG completer role', async () => {
    const { statusCode, headers } = await ctx.getServer().inject({
      method: 'GET',
      url: pageUrl(ctx.path),
      auth: {
        strategy: 'session',
        credentials: { ...auth.credentials, roles: [] }
      }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(FORBIDDEN_PATH)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('redirects a project without baseline data to the existing task list', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project: { name: 'No baseline' } }
    })

    const { statusCode, headers } = await ctx.getServer().inject({
      method: 'GET',
      url: pageUrl(ctx.path),
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${PROJECT_ID}`)
  })

  test('rejects an invalid project id', async () => {
    const { statusCode } = await ctx.getServer().inject({
      method: 'GET',
      url: `/projects/not-a-uuid${ctx.path}`,
      auth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })
}

function registerLinearBaselinePageTests(spec) {
  const ctx = createLinearBaselineTestContext(spec)

  registerPageSectionTests(ctx)
  registerSummaryTileTests(ctx)
  registerGridTests(ctx)
  registerNavigationTests(ctx)
  registerEmptyGridTest(ctx)
  registerAccessControlTests(ctx)
}

export { PROJECT_ID, auth, registerLinearBaselinePageTests }
