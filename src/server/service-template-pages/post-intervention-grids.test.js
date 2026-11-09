import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { statusCodes } from '../common/constants.js'
import { serviceTemplateProject } from '../common/test-helpers/service-template-projects/index.js'
import {
  getPage,
  projectPageUrl,
  serveProject,
  significanceDisplay,
  startServer,
  tableRows
} from '../common/test-helpers/service-template-projects/pages.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

// The post-intervention grids of a project uploaded in the BNG Service
// template, from the backend's own JSON. The data, not the flag, decides how
// they render, so they hold in both of CI's flag states.

const GRIDS = [
  ['area', 'area-post-intervention', ['habitats', 'verticalHabitats', 'trees']],
  ['hedgerow', 'hedgerows-post-intervention', ['hedgerows']],
  ['watercourse', 'watercourses-post-intervention', ['watercourses']]
]

const SECTIONS = [
  ['Retained', 'retained'],
  ['Enhanced', 'enhanced'],
  ['Created', 'created']
]

const SIGNIFICANCE = 'Strategic significance'

const DETAILS_PATH = '/post-intervention-habitat-details'

const featureIdOf = (href) =>
  new URL(href, 'http://frontend').searchParams.get('featureId')

const byRef = (a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true })

function postInterventionFeatures(body, layers) {
  return layers.flatMap((layer) => body.project.postIntervention[layer] ?? [])
}

describe('post-intervention grids of a BNG Service template project', () => {
  let server

  beforeAll(async () => {
    server = await startServer()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  /** Each section's rows, keyed by its Retention Category. */
  async function renderGrid(body, page) {
    serveProject(body)
    const { statusCode, $ } = await getPage(server, projectPageUrl(body, page))
    expect(statusCode).toBe(statusCodes.ok)
    return Object.fromEntries(
      SECTIONS.map(([category, id]) => [
        category,
        tableRows($, $(`#${id} table`).first())
      ])
    )
  }

  test.each(GRIDS)(
    'the %s grid lists each feature under its Retention Category, linked to its details by featureId',
    async (_kind, page, layers) => {
      const body = serviceTemplateProject('twoStages')
      const features = postInterventionFeatures(body, layers)

      const sections = await renderGrid(body, page)

      for (const [category] of SECTIONS) {
        const expected = features
          .filter((f) => f.retentionCategory === category)
          .map((f) => ({ ref: f.ref, featureId: f.featureId }))
          .sort(byRef)
        const shown = sections[category]
          .map(({ ref, href }) => ({ ref, featureId: featureIdOf(href) }))
          .sort(byRef)
        expect(shown, category).toEqual(expected)
      }
      for (const row of Object.values(sections).flat()) {
        const link = new URL(row.href, 'http://frontend')
        expect(link.pathname).toBe(DETAILS_PATH)
        expect(link.searchParams.get('projectId')).toBe(body.id)
      }
    }
  )

  test.each(GRIDS)(
    'the %s grid shows each priced Created and Enhanced feature at the significance set in the file, Low (1) or High (1.15)',
    async (_kind, page, layers) => {
      const body = serviceTemplateProject('twoStages')
      const features = postInterventionFeatures(body, layers).filter(
        (f) =>
          f.retentionCategory !== 'Retained' &&
          f.status === 'Complete' &&
          f.proposed?.strategicSignificance
      )

      const sections = await renderGrid(body, page)

      expect(features.length).toBeGreaterThan(0)
      for (const feature of features) {
        const row = sections[feature.retentionCategory].find(
          (r) => r.ref === feature.ref
        )
        expect(row.cells[SIGNIFICANCE], feature.ref).toBe(
          significanceDisplay(feature.proposed.strategicSignificance)
        )
      }
    }
  )

  test('the area grid shows both Low (1) and High (1.15) among Created and Enhanced habitats', async () => {
    const sections = await renderGrid(
      serviceTemplateProject('twoStages'),
      'area-post-intervention'
    )
    const shown = [...sections.Enhanced, ...sections.Created].map(
      (row) => row.cells[SIGNIFICANCE]
    )

    expect(new Set(shown)).toEqual(new Set(['Low (1)', 'High (1.15)']))
  })

  test.each(GRIDS)(
    'the %s grid shows every Retained feature at Low (1), even one whose stored significance says High',
    async (_kind, page, layers) => {
      const body = serviceTemplateProject('twoStages')
      const [edited] = postInterventionFeatures(body, layers).filter(
        (f) => f.retentionCategory === 'Retained'
      )
      edited.proposed.strategicSignificance = 'High'

      const sections = await renderGrid(body, page)

      expect(
        new Set(sections.Retained.map((row) => row.cells[SIGNIFICANCE]))
      ).toEqual(new Set(['Low (1)']))
    }
  )

  test('the area grid lists vertical area habitats under their Retention Category', async () => {
    const body = serviceTemplateProject('twoStages')
    const vertical = body.project.postIntervention.verticalHabitats

    const sections = await renderGrid(body, 'area-post-intervention')

    expect(vertical.length).toBeGreaterThan(0)
    for (const feature of vertical) {
      expect(
        sections[feature.retentionCategory].map((row) => row.ref),
        feature.ref
      ).toContain(feature.ref)
    }
  })

  test('the watercourse grid lists an Incomplete Created watercourse, rather than failing', async () => {
    const body = serviceTemplateProject('twoStages')
    const blank = body.project.postIntervention.watercourses.find(
      (f) => f.retentionCategory === 'Created' && f.status === 'Incomplete'
    )

    const sections = await renderGrid(body, 'watercourses-post-intervention')

    expect(blank).toBeDefined()
    expect(sections.Created.map((row) => row.ref)).toContain(blank.ref)
  })

  test.each(GRIDS)(
    'the %s grid renders for a baseline-only project, which has no post-intervention stage',
    async (_kind, page) => {
      const body = serviceTemplateProject('baselineOnly')
      serveProject(body)

      const { statusCode } = await getPage(server, projectPageUrl(body, page))

      expect(body.project).not.toHaveProperty('postIntervention')
      expect(statusCode).toBe(statusCodes.ok)
    }
  )
})
