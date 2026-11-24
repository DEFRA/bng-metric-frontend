import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { serviceTemplateProject } from '../common/test-helpers/service-template-projects/index.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { renderTemplate } from '../test-helpers/render-template.js'
import { treeEnhancementReference } from './created-tree-test-fixtures.js'
import {
  createMockH,
  featureId,
  mockFeature,
  projectId
} from './controller-test-helpers.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const { getController, postController } = await import('./controller.js')
const { _resetCreatedAreaReferenceCache, createdAreaValues } =
  await import('./created-area-edit.js')

// On a BNG Service template project, "View baseline details" on a Retained or
// Enhanced feature's page goes to the baseline feature it names as its parent
// (parentFeatureId). Refs play no part. A Created feature's page has no link,
// though one Created over a baseline feature it degrades names that feature as
// its parent. The project is the backend's own, captured from the harness
// corpus.

const FEATURE_TYPES = {
  habitats: 'habitat',
  hedgerows: 'hedgerow',
  watercourses: 'watercourse',
  verticalHabitats: 'verticalHabitat',
  trees: 'tree'
}

function baselineHref(baselineFeatureId) {
  return `/baseline-habitat-details?featureId=${baselineFeatureId}&projectId=${projectId}`
}

/**
 * Render the details page for one post-intervention feature of the project.
 *
 * @param {object} body the project, as GET /projects/{id} returns it
 * @param {string} layer
 * @param {string} ref
 * @param {(feature: object) => void} [change] edits the feature first
 */
async function render(body, layer, ref, change = () => {}) {
  const feature = structuredClone(
    body.project.postIntervention[layer].find((f) => f.ref === ref)
  )
  change(feature)
  mockFeature({ type: FEATURE_TYPES[layer], feature }, { payload: body })
  // An Enhanced tree's edit page asks for the tree enhancement reference too.
  const get = vi.mocked(wreck.get).getMockImplementation()
  vi.mocked(wreck.get).mockImplementation((url) =>
    url.endsWith('/reference/tree-enhancement')
      ? Promise.resolve({ payload: treeEnhancementReference })
      : get(url)
  )
  const h = createMockH()
  await getController.handler({ query: { projectId, featureId } }, h)
  return { feature, view: h.view.mock.calls[0][1] }
}

function baselineIdOf(body, layer, ref) {
  return body.project.baseline[layer].find((f) => f.ref === ref).featureId
}

describe('#postInterventionHabitatDetailsController on a BNG Service template project', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test.each([
    ['a Retained area habitat', 'habitats', 'H002'],
    ['an Enhanced area habitat', 'habitats', 'H001'],
    ['a Retained hedgerow', 'hedgerows', 'HG001'],
    ['an Enhanced hedgerow', 'hedgerows', 'HG002'],
    ['a Retained watercourse', 'watercourses', 'R001'],
    ['an Enhanced watercourse', 'watercourses', 'R006'],
    ['a Retained vertical area habitat', 'verticalHabitats', 'V001'],
    ['an Enhanced vertical area habitat', 'verticalHabitats', 'V002'],
    ['a Retained tree', 'trees', 'T004'],
    ['an Enhanced tree', 'trees', 'T001']
  ])(
    'links %s to the baseline feature it names as its parent, whatever its ref',
    async (_, layer, ref) => {
      const body = serviceTemplateProject('twoStages')
      const parentId = baselineIdOf(body, layer, ref)

      // Renamed, so that no baseline feature shares its ref: only the parent
      // link can find the baseline feature.
      const { view } = await render(body, layer, ref, (renamed) => {
        renamed.ref = `${ref} renamed`
      })

      expect(view.viewBaselineHref).toBe(baselineHref(parentId))
    }
  )

  test('links by parent, not by ref: a Retained hedgerow HG018a goes to its parent HG018', async () => {
    const body = serviceTemplateProject('twoStages')

    const { view } = await render(body, 'hedgerows', 'HG018a')

    expect(view.viewBaselineHref).toBe(
      baselineHref(baselineIdOf(body, 'hedgerows', 'HG018'))
    )
  })

  test.each([
    ['a Created area habitat that degrades its parent', 'habitats', 'H043'],
    ['a Created hedgerow that degrades its parent', 'hedgerows', 'HG017'],
    ['a Created hedgerow split from its parent', 'hedgerows', 'HG018b'],
    ['a Created watercourse that degrades its parent', 'watercourses', 'R004'],
    ['a Created vertical area habitat', 'verticalHabitats', 'V003']
  ])(
    'shows no link for %s, though the baseline holds the parent it names',
    async (_, layer, ref) => {
      const body = serviceTemplateProject('twoStages')

      const { feature, view } = await render(body, layer, ref)

      expect(feature.retentionCategory).toBe('Created')
      expect(
        body.project.baseline[layer].some(
          (f) => f.featureId === feature.parentFeatureId
        )
      ).toBe(true)
      expect(view.viewBaselineHref).toBeNull()
    }
  )

  test('shows no link for a feature with no parent, even when a baseline feature shares its ref', async () => {
    const body = serviceTemplateProject('twoStages')

    const { view } = await render(body, 'hedgerows', 'HG001', (unlinked) => {
      delete unlinked.parentFeatureId
      unlinked.ref = 'HG002'
    })

    expect(view.viewBaselineHref).toBeNull()
  })

  describe('a Created area habitat, on its edit page and when a validation error redisplays it', () => {
    beforeEach(() => _resetCreatedAreaReferenceCache())

    test('shows no link, though it names its parent', async () => {
      const body = serviceTemplateProject('twoStages')
      const feature = structuredClone(
        body.project.postIntervention.habitats.find((f) => f.ref === 'H043')
      )
      mockFeature({ type: 'habitat', feature }, { payload: body })
      const h = createMockH()
      await getController.handler({ query: { projectId, featureId } }, h)
      await postController.handler(
        {
          payload: {
            projectId,
            featureId,
            ...createdAreaValues(feature),
            ref: ' '
          }
        },
        h
      )
      const views = h.view.mock.calls.map(([, vm]) => vm)

      expect(feature.parentFeatureId).toBe(
        baselineIdOf(body, 'habitats', 'H043')
      )
      expect(views).toHaveLength(2)
      for (const vm of views) {
        expect(vm.viewBaselineHref).toBeNull()
      }
    })
  })

  test('shows no link for a vertical area habitat with no parent, even when a baseline one shares its ref', async () => {
    const body = serviceTemplateProject('twoStages')

    const { view } = await render(
      body,
      'verticalHabitats',
      'V001',
      (unlinked) => {
        delete unlinked.parentFeatureId
      }
    )

    expect(view.viewBaselineHref).toBeNull()
  })

  test('shows no link when the baseline no longer holds a vertical area habitat’s parent', async () => {
    const body = serviceTemplateProject('twoStages')
    const parentId = baselineIdOf(body, 'verticalHabitats', 'V001')
    body.project.baseline.verticalHabitats =
      body.project.baseline.verticalHabitats.filter(
        (f) => f.featureId !== parentId
      )

    const { view } = await render(body, 'verticalHabitats', 'V001')

    expect(view.viewBaselineHref).toBeNull()
  })

  test('shows a Created vertical area habitat’s timing and difficulty, and its size in hectares', async () => {
    const body = serviceTemplateProject('twoStages')
    mockFeature(
      {
        type: 'verticalHabitat',
        feature: body.project.postIntervention.verticalHabitats.find(
          (f) => f.ref === 'V003'
        )
      },
      { payload: body }
    )
    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)
    const [template, viewModel] = h.view.mock.calls[0]

    const html = renderTemplate(`${template}.njk`, viewModel)
    const row = (label) =>
      new RegExp(`${label}</[^>]+>\\s*<[^>]+>\\s*([^<]*?)\\s*<`).exec(html)?.[1]

    expect(template).toBe('habitat-details/pi-habitat-details-enhanced')
    expect(row('Area')).toBe('0.0079ha')
    expect(row('Advance or delay\\?')).toBe('Delay - 30 years')
    expect(row('Standard difficulty')).toBe('Medium')
    expect(row('Standard time to target condition')).toContain('8')
  })

  test('shows no link when the baseline no longer holds the parent', async () => {
    const body = serviceTemplateProject('twoStages')
    const parentId = baselineIdOf(body, 'watercourses', 'R001')
    body.project.baseline.watercourses =
      body.project.baseline.watercourses.filter((f) => f.featureId !== parentId)

    const { view } = await render(body, 'watercourses', 'R001')

    expect(view.viewBaselineHref).toBeNull()
  })
})
