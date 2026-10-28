import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { serviceTemplateProject } from '../common/test-helpers/service-template-projects/index.js'
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

// BMD-1086: on a BNG Service template project, "View baseline details" goes
// to the baseline feature a post-intervention feature names as its parent
// (parentFeatureId, BMD-1083), for every Retention Category. Refs play no
// part. The project is the backend's own, captured from the harness corpus.

const FEATURE_TYPES = {
  habitats: 'habitat',
  hedgerows: 'hedgerow',
  watercourses: 'watercourse'
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
    ['a Created area habitat that degrades its parent', 'habitats', 'H043'],
    ['an Enhanced hedgerow', 'hedgerows', 'HG002'],
    ['a Created watercourse that degrades its parent', 'watercourses', 'R004']
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

  test('links by parent, not by ref: a Created hedgerow HG018b goes to its parent HG018', async () => {
    const body = serviceTemplateProject('twoStages')

    const { view } = await render(body, 'hedgerows', 'HG018b')

    expect(view.viewBaselineHref).toBe(
      baselineHref(baselineIdOf(body, 'hedgerows', 'HG018'))
    )
  })

  test('shows no link for a feature with no parent, even when a baseline feature shares its ref', async () => {
    const body = serviceTemplateProject('twoStages')

    const { feature, view } = await render(
      body,
      'hedgerows',
      'HG008',
      (unlinked) => {
        unlinked.ref = 'HG002'
      }
    )

    expect(feature).not.toHaveProperty('parentFeatureId')
    expect(view.viewBaselineHref).toBeNull()
  })

  describe('a Created area habitat, on its edit page and when a validation error redisplays it', () => {
    beforeEach(() => _resetCreatedAreaReferenceCache())

    /** The view models GET and an invalid POST render for H043. */
    async function renderGetAndRedisplay(change) {
      const body = serviceTemplateProject('twoStages')
      const feature = structuredClone(
        body.project.postIntervention.habitats.find((f) => f.ref === 'H043')
      )
      change(feature)
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
      return { body, views: h.view.mock.calls.map(([, vm]) => vm) }
    }

    test('links to its parent', async () => {
      const { body, views } = await renderGetAndRedisplay((renamed) => {
        renamed.ref = 'H043 renamed'
      })

      expect(views).toHaveLength(2)
      for (const vm of views) {
        expect(vm.viewBaselineHref).toBe(
          baselineHref(baselineIdOf(body, 'habitats', 'H043'))
        )
      }
    })

    test('shows no link when it names no parent, even though a baseline feature shares its ref', async () => {
      const { views } = await renderGetAndRedisplay((unlinked) => {
        delete unlinked.parentFeatureId
      })

      expect(views).toHaveLength(2)
      for (const vm of views) {
        expect(vm.viewBaselineHref).toBeNull()
      }
    })
  })

  test('shows no link for a Created area habitat whose edited reference cleared its parent', async () => {
    const body = serviceTemplateProject('twoStages')

    const { view } = await render(body, 'habitats', 'H043', (edited) => {
      edited.parentFeatureId = null
    })

    expect(view.viewBaselineHref).toBeNull()
  })

  test('shows no link when the baseline no longer holds the parent', async () => {
    const body = serviceTemplateProject('twoStages')
    const parentId = baselineIdOf(body, 'watercourses', 'R004')
    body.project.baseline.watercourses =
      body.project.baseline.watercourses.filter((f) => f.featureId !== parentId)

    const { view } = await render(body, 'watercourses', 'R004')

    expect(view.viewBaselineHref).toBeNull()
  })
})
