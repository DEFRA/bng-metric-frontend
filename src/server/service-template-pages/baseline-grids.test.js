import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { statusCodes } from '../common/constants.js'
import { serviceTemplateProject } from '../common/test-helpers/service-template-projects/index.js'
import {
  baselineDetailsUrl,
  getPage,
  projectPageUrl,
  serveProject,
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

// The baseline grids of a project uploaded in the BNG Service template, from
// the backend's own JSON. The data, not the flag, decides how they render, so
// they hold in both of CI's flag states.

const GRIDS = [
  ['area', 'area-baseline', ['habitats', 'verticalHabitats', 'trees']],
  ['hedgerow', 'hedgerows-baseline', ['hedgerows']],
  ['watercourse', 'watercourses-baseline-summary', ['watercourses']]
]

const PROJECTS = [
  ['a project with both stages', 'twoStages'],
  ['a baseline-only project', 'baselineOnly']
]

const byRef = (a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true })

function baselineFeatures(body, layers) {
  return layers.flatMap((layer) => body.project.baseline[layer] ?? [])
}

describe('baseline grids of a BNG Service template project', () => {
  let server

  beforeAll(async () => {
    server = await startServer()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  async function renderGrid(body, page) {
    serveProject(body)
    const { statusCode, $ } = await getPage(server, projectPageUrl(body, page))
    expect(statusCode).toBe(statusCodes.ok)
    return tableRows($, $('table').first())
  }

  describe.each(PROJECTS)('on %s', (_, fixture) => {
    test.each(GRIDS)(
      'the %s grid lists every baseline feature, linked to its details by featureId',
      async (_kind, page, layers) => {
        const body = serviceTemplateProject(fixture)
        const features = baselineFeatures(body, layers)

        const rows = await renderGrid(body, page)

        expect(features.length).toBeGreaterThan(0)
        expect(
          rows.map(({ ref, href }) => ({ ref, href })).sort(byRef)
        ).toEqual(
          features
            .map((f) => ({
              ref: f.ref,
              href: baselineDetailsUrl(body, f.featureId)
            }))
            .sort(byRef)
        )
      }
    )

    test.each(GRIDS)(
      'the %s grid shows every baseline feature at Low (1) strategic significance',
      async (_kind, page) => {
        const rows = await renderGrid(serviceTemplateProject(fixture), page)

        expect(
          new Set(rows.map((row) => row.cells['Strategic significance']))
        ).toEqual(new Set(['Low (1)']))
      }
    )
  })

  test.each(GRIDS)(
    'the %s grid shows Low (1) for a baseline feature the file gave High, as the service always treats baseline as Low',
    async (_kind, page, layers) => {
      const body = serviceTemplateProject('twoStages')
      const [edited] = baselineFeatures(body, layers)
      edited.strategicSignificance = 'High'

      const rows = await renderGrid(body, page)

      expect(
        rows.find((row) => row.ref === edited.ref).cells[
          'Strategic significance'
        ]
      ).toBe('Low (1)')
    }
  )

  test('the area grid lists vertical area habitats with the area habitats', async () => {
    const body = serviceTemplateProject('twoStages')
    const vertical = body.project.baseline.verticalHabitats

    const rows = await renderGrid(body, 'area-baseline')

    expect(vertical.length).toBeGreaterThan(0)
    expect(rows.map((row) => row.ref)).toEqual(
      expect.arrayContaining(vertical.map((f) => f.ref))
    )
  })
})
