import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { statusCodes } from '../common/constants.js'
import { serviceTemplateProject } from '../common/test-helpers/service-template-projects/index.js'
import {
  getPage,
  projectPageUrl,
  serveProject,
  startServer,
  tableRows
} from '../common/test-helpers/service-template-projects/pages.js'
import { tilesIn } from '../common/test-helpers/trading-rules.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

// The summary, trading summary, reports and project details pages of a project
// uploaded in the BNG Service template, from the backend's own JSON. The data,
// not the flag, decides how they render, so they hold in both of CI's flag
// states.

const DECIMAL_PLACES = 2
const NO_POST_INTERVENTION_PERCENTAGE = '-100.00%'

/**
 * Each unit type: its summary page, its trading summary page, the key its
 * totals carry in the stage's `units`, and its key in `tradingRuleStatuses`.
 */
const UNIT_TYPES = [
  {
    name: 'area',
    summary: 'area-summary',
    trading: 'area-trading-summary',
    units: 'habitats',
    status: 'areaHabitats'
  },
  {
    name: 'hedgerow',
    summary: 'hedgerows-summary',
    trading: 'hedgerows-trading-summary',
    units: 'hedgerows',
    status: 'hedgerows'
  },
  {
    name: 'watercourse',
    summary: 'watercourses-summary',
    trading: 'watercourses-trading-summary',
    units: 'watercourses',
    status: 'watercourses'
  }
]

const TWO_STAGE_PROJECTS = [
  ['a project with both stages', 'twoStages'],
  ['a project with an Incomplete watercourse', 'watercourseAdvanceIncomplete']
]

const ALL_PROJECTS = [
  ...TWO_STAGE_PROJECTS,
  ['a baseline-only project', 'baselineOnly']
]

/** Each distinctiveness band: its row label, its key in the verdicts, its section. */
const BANDS = [
  { label: 'Medium', key: 'medium', section: 'medium-distinctiveness-heading' },
  { label: 'Low', key: 'low', section: 'low-distinctiveness-heading' },
  {
    label: 'Very low',
    key: 'veryLow',
    section: 'very-low-distinctiveness-heading'
  }
]

const units = (value) => `${value.toFixed(DECIMAL_PLACES)} units`
const percentage = (value) => `${value.toFixed(DECIMAL_PLACES)}%`

/** A section's tiles as `{ heading: { figure, tag } }`. */
function tilesByHeading($, section) {
  return Object.fromEntries(
    tilesIn($, section).map(([heading, figure, tag]) => [
      heading.trim(),
      { figure: figure.replaceAll(/\s+/gu, ' ').trim(), tag: tag.trim() }
    ])
  )
}

/** The trading summary table's status for each band, by its label. */
function bandStatuses($) {
  return Object.fromEntries(
    $('.app-trading-summary__status tbody tr')
      .map((_, row) => [
        $(row)
          .find('th, td')
          .map((_index, cell) => $(cell).text().trim())
          .get()
      ])
      .get()
  )
}

/** The verdict tags on a band's tiles, which must be there to be read. */
function sectionVerdicts($, band) {
  const section = $(`section[aria-labelledby="${band.section}"]`)
  expect(section, band.label).toHaveLength(1)
  return section
    .find('.app-unit-type-summary__tile .govuk-tag')
    .map((_, tag) => $(tag).text().trim())
    .get()
}

/**
 * A document's stored total for one unit type. The backend stores individual
 * trees' units apart from the other area habitats', and the Metric's area
 * habitat units include them, as the area tiles do.
 */
function storedTotal(document, unitType) {
  const total = document.units[`${unitType.units}Total`]
  return unitType.units === 'habitats'
    ? total + (document.units.treesTotal ?? 0)
    : total
}

/** The figures the backend stored for one unit type, as the tiles show them. */
function expectedFigures(body, unitType) {
  const { baseline, postIntervention } = body.project
  const baselineTotal = storedTotal(baseline, unitType)
  return {
    baseline: units(baselineTotal),
    postIntervention: postIntervention
      ? units(storedTotal(postIntervention, unitType))
      : units(0),
    netChange: postIntervention
      ? units(postIntervention.units[`${unitType.units}NetUnitChange`])
      : units(-baselineTotal),
    netPercentage: postIntervention
      ? percentage(
          postIntervention.units[`${unitType.units}NetUnitChangePercentage`]
        )
      : NO_POST_INTERVENTION_PERCENTAGE,
    tradingRules: body.tradingRuleStatuses[unitType.status].overall
  }
}

/** The tile headed "On-site post-intervention", however the page spells it. */
function postInterventionTile(tiles) {
  const heading = Object.keys(tiles).find((h) =>
    /^On-site post.intervention$/u.test(h)
  )
  return tiles[heading]
}

function expectSectionShows(tiles, expected) {
  expect(tiles['On-site baseline'].figure).toMatch(
    new RegExp(`^${RegExp.escape(expected.baseline)}`, 'u')
  )
  expect(postInterventionTile(tiles).figure).toMatch(
    new RegExp(`^${RegExp.escape(expected.postIntervention)}`, 'u')
  )
  expect(tiles['Total on-site net unit change'].figure).toBe(expected.netChange)
  expect(tiles['Total on-site net percentage change'].figure).toBe(
    expected.netPercentage
  )
  expect(tiles['Trading Rules'].tag).toBe(expected.tradingRules)
}

describe('summary pages of a BNG Service template project', () => {
  let server

  beforeAll(async () => {
    server = await startServer()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  async function renderPage(body, url) {
    serveProject(body)
    return getPage(server, url)
  }

  describe.each(ALL_PROJECTS)('on %s', (_, fixture) => {
    test('the project summary shows each unit type’s figures as the backend stored them', async () => {
      const body = serviceTemplateProject(fixture)

      const { statusCode, $ } = await renderPage(
        body,
        projectPageUrl(body, 'project-summary')
      )

      expect(statusCode).toBe(statusCodes.ok)
      const sections = $('.app-unit-type-summary')
      expect(sections).toHaveLength(UNIT_TYPES.length)
      UNIT_TYPES.forEach((unitType, index) => {
        expectSectionShows(
          tilesByHeading($, sections.eq(index)),
          expectedFigures(body, unitType)
        )
      })
    })

    test.each(UNIT_TYPES)(
      'the $name summary shows the figures the backend stored',
      async (unitType) => {
        const body = serviceTemplateProject(fixture)

        const { statusCode, $ } = await renderPage(
          body,
          projectPageUrl(body, unitType.summary)
        )

        expect(statusCode).toBe(statusCodes.ok)
        expectSectionShows(
          tilesByHeading($, $('.app-unit-type-summary').first()),
          expectedFigures(body, unitType)
        )
      }
    )

    test('the reports page renders', async () => {
      const body = serviceTemplateProject(fixture)

      const { statusCode, $ } = await renderPage(
        body,
        projectPageUrl(body, 'reports')
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1').text().trim()).toBe('Reports')
    })

    test('the project details page renders with the project’s name', async () => {
      const body = serviceTemplateProject(fixture)

      const { statusCode, $ } = await renderPage(
        body,
        `/project-details/${body.id}`
      )

      expect(statusCode).toBe(statusCodes.ok)
      expect($('h1').text().trim()).toBe('Project details')
      expect($('#projectName').val()).toBe(body.project.name)
    })
  })

  describe.each(TWO_STAGE_PROJECTS)('on %s', (_, fixture) => {
    test.each(UNIT_TYPES)(
      'the $name trading summary shows each band’s verdict as the backend gave it',
      async (unitType) => {
        const body = serviceTemplateProject(fixture)
        const statuses = body.tradingRuleStatuses[unitType.status]

        const { statusCode, $ } = await renderPage(
          body,
          projectPageUrl(body, unitType.trading)
        )

        expect(statusCode).toBe(statusCodes.ok)
        const shown = bandStatuses($)
        const given = BANDS.filter((band) => statuses[band.key])
        expect(given.length).toBeGreaterThan(0)
        for (const band of given) {
          expect(shown[band.label], band.label).toBe(statuses[band.key])
        }
        for (const band of BANDS.filter((b) => b.label in shown)) {
          expect(sectionVerdicts($, band), band.label).toEqual(
            statuses[band.key] ? [statuses[band.key]] : []
          )
        }
        expect($('main').text()).not.toMatch(/NaN|undefined/u)
      }
    )
  })

  describe('on a baseline-only project', () => {
    test.each(UNIT_TYPES)(
      'the $name summary offers the post-intervention upload in place of its figures',
      async (unitType) => {
        const body = serviceTemplateProject('baselineOnly')

        const { $ } = await renderPage(
          body,
          projectPageUrl(body, unitType.summary)
        )

        const tiles = tilesByHeading($, $('.app-unit-type-summary').first())
        expect(postInterventionTile(tiles).figure).toBe(
          `${units(0)} Upload on-site post intervention file`
        )
      }
    )

    test.each(UNIT_TYPES)(
      'the $name trading summary sends the user to the $summary page, as nothing has been delivered to trade against',
      async (unitType) => {
        const body = serviceTemplateProject('baselineOnly')

        const { statusCode, headers } = await renderPage(
          body,
          projectPageUrl(body, unitType.trading)
        )

        expect(statusCode).toBe(statusCodes.redirect)
        expect(headers.location).toBe(projectPageUrl(body, unitType.summary))
      }
    )
  })

  test('the watercourse pages render a Created watercourse saved Incomplete, with no units', async () => {
    const body = serviceTemplateProject('watercourseAdvanceIncomplete')
    const incomplete = body.project.postIntervention.watercourses.find(
      (f) => f.status === 'Incomplete'
    )

    const { statusCode, $ } = await renderPage(
      body,
      projectPageUrl(body, 'watercourses-post-intervention')
    )

    expect(statusCode).toBe(statusCodes.ok)
    const rows = $('table')
      .map((_, table) => tableRows($, table))
      .get()
    const row = rows.find((r) => r.ref === incomplete.ref)
    expect(row.cells.Units).toBe('')
    expect($('main').text()).not.toMatch(/NaN|undefined/u)
  })
})
