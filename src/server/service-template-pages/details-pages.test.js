import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { statusCodes } from '../common/constants.js'
import { serviceTemplateProject } from '../common/test-helpers/service-template-projects/index.js'
import {
  baselineDetailsUrl,
  getPage,
  postInterventionDetailsUrl,
  serveProject,
  significanceDisplay,
  startServer
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

// The baseline and post-intervention details pages of a project uploaded in
// the BNG Service template, from the backend's own JSON. The data, not the
// flag, decides how they render, so they hold in both of CI's flag states.

const LAYERS = [
  'habitats',
  'verticalHabitats',
  'hedgerows',
  'watercourses',
  'trees'
]

// The layers whose Created features open on the edit form; the others render
// read-only.
const EDITABLE_CREATED_LAYERS = new Set(['habitats', 'hedgerows'])

// The layers whose Retained features can have their reference changed; a
// Retained vertical area habitat renders read-only.
const RETAINED_REF_LAYERS = new Set(['habitats', 'hedgerows', 'watercourses'])

const TIME_TO_TARGET_HEADING = 'Time to target / difficulty'
const VIEW_BASELINE_LINK = 'View baseline details'
const SIGNIFICANCE_KEY = 'Strategic significance'
const LOW = 'Low (1)'
const HIGH_SCORE = 1.15
const UNKNOWN_FEATURE_ID = '00000000-0000-4000-8000-000000000000'

const normalise = (text) => text.replaceAll(/\s+/gu, ' ').trim()

/** Every feature of one stage as `[label, layer, feature]`, for test.each. */
function casesOf(body, stage) {
  return LAYERS.flatMap((layer) =>
    (body.project[stage]?.[layer] ?? []).map((feature) => [
      `${layer} ${feature.ref}${feature.retentionCategory ? ` (${feature.retentionCategory})` : ''}`,
      layer,
      feature
    ])
  )
}

/** The value a details page shows under one of its field headings. */
function fieldValue($, heading) {
  const item = $('.app-stacked-fields__item').filter(
    (_, el) => normalise($(el).children('h3').first().text()) === heading
  )
  return item.length
    ? normalise(item.first().children('p').first().text())
    : undefined
}

function viewBaselineHref($) {
  return $('a')
    .filter((_, a) => normalise($(a).text()) === VIEW_BASELINE_LINK)
    .attr('href')
}

function fieldNames($) {
  return $('form [name]')
    .map((_, field) => $(field).attr('name'))
    .get()
}

function headings($) {
  return $('h2')
    .map((_, h2) => normalise($(h2).text()))
    .get()
}

function selectedSignificance($) {
  return $('[name="strategicSignificance"] option[selected]').attr('value')
}

function baselineIds(body) {
  return new Set(
    LAYERS.flatMap((layer) =>
      body.project.baseline[layer].map((feature) => feature.featureId)
    )
  )
}

const isEditable = (layer, feature) =>
  feature.retentionCategory === 'Created' && EDITABLE_CREATED_LAYERS.has(layer)

describe('details pages of a BNG Service template project', () => {
  let server

  beforeAll(async () => {
    server = await startServer()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  async function render(body, url) {
    serveProject(body)
    const { statusCode, $ } = await getPage(server, url)
    expect(statusCode).toBe(statusCodes.ok)
    return $
  }

  describe.each([
    ['a project with both stages', 'twoStages'],
    ['a baseline-only project', 'baselineOnly']
  ])('baseline details on %s', (_, fixture) => {
    test.each(casesOf(serviceTemplateProject(fixture), 'baseline'))(
      'renders %s with its ref, at Low (1) strategic significance',
      async (_label, layer, { featureId, ref }) => {
        const body = serviceTemplateProject(fixture)

        const $ = await render(body, baselineDetailsUrl(body, featureId))

        expect(normalise($('h1').text())).toContain(ref)
        expect($('[name="habitatRef"]').attr('value')).toBe(ref)
        expect(fieldValue($, SIGNIFICANCE_KEY)).toBe(LOW)
      }
    )
  })

  test('baseline details of a tree show its size class and number of trees', async () => {
    const body = serviceTemplateProject('twoStages')
    const [tree] = body.project.baseline.trees

    const $ = await render(body, baselineDetailsUrl(body, tree.featureId))

    expect(fieldValue($, 'Tree size')).toBe(tree.treeSize)
    expect(fieldValue($, 'Number of trees')).toBe(String(tree.count ?? 1))
  })

  test('baseline details of an area habitat have no tree rows', async () => {
    const body = serviceTemplateProject('twoStages')
    const [habitat] = body.project.baseline.habitats

    const $ = await render(body, baselineDetailsUrl(body, habitat.featureId))

    expect(fieldValue($, 'Tree size')).toBeUndefined()
  })

  test.each(LAYERS)(
    'baseline details show Low (1) for a %s feature the file gave High, as the service always treats baseline as Low',
    async (layer) => {
      const body = serviceTemplateProject('twoStages')
      const [edited] = body.project.baseline[layer]
      edited.strategicSignificance = 'High'

      const $ = await render(body, baselineDetailsUrl(body, edited.featureId))

      expect(fieldValue($, SIGNIFICANCE_KEY)).toBe(LOW)
    }
  )

  describe('post-intervention details on a project with both stages', () => {
    const cases = casesOf(
      serviceTemplateProject('twoStages'),
      'postIntervention'
    )

    test.each(cases.filter(([, , f]) => f.retentionCategory === 'Retained'))(
      'renders %s in the Retained layout, at Low (1)',
      async (_label, layer, { featureId }) => {
        const body = serviceTemplateProject('twoStages')

        const $ = await render(
          body,
          postInterventionDetailsUrl(body, featureId)
        )

        expect(fieldNames($).includes('habitatRef')).toBe(
          RETAINED_REF_LAYERS.has(layer)
        )
        expect(fieldNames($)).not.toContain('strategicSignificance')
        expect(headings($)).not.toContain(TIME_TO_TARGET_HEADING)
        expect(fieldValue($, SIGNIFICANCE_KEY)).toBe(LOW)
      }
    )

    test('renders a Retained feature at Low (1), even one whose stored significance says High', async () => {
      const body = serviceTemplateProject('twoStages')
      const retained = body.project.postIntervention.habitats.find(
        (f) => f.retentionCategory === 'Retained'
      )
      retained.proposed.strategicSignificanceCategory = 'High'
      retained.proposed.strategicSignificanceScore = HIGH_SCORE

      const $ = await render(
        body,
        postInterventionDetailsUrl(body, retained.featureId)
      )

      expect(fieldValue($, SIGNIFICANCE_KEY)).toBe(LOW)
    })

    test.each(cases.filter(([, layer, f]) => isEditable(layer, f)))(
      'renders %s on the Created edit form, with its significance chosen',
      async (_label, _layer, { featureId, proposed }) => {
        const body = serviceTemplateProject('twoStages')

        const $ = await render(
          body,
          postInterventionDetailsUrl(body, featureId)
        )

        expect(fieldNames($)).toContain('strategicSignificance')
        expect(headings($)).toContain(TIME_TO_TARGET_HEADING)
        expect(selectedSignificance($)).toBe(
          proposed.strategicSignificanceCategory
        )
      }
    )

    test.each(
      cases.filter(
        ([, layer, f]) =>
          f.retentionCategory !== 'Retained' &&
          !isEditable(layer, f) &&
          f.proposed?.strategicSignificanceCategory
      )
    )(
      'renders %s read-only, with the significance the file set',
      async (_label, _layer, { featureId, proposed }) => {
        const body = serviceTemplateProject('twoStages')

        const $ = await render(
          body,
          postInterventionDetailsUrl(body, featureId)
        )

        expect(fieldNames($)).toEqual([])
        expect(headings($)).toContain(TIME_TO_TARGET_HEADING)
        expect(fieldValue($, SIGNIFICANCE_KEY)).toBe(
          significanceDisplay(proposed.strategicSignificanceCategory)
        )
      }
    )

    test.each(cases)(
      'links %s to the baseline feature it names as its parent, or shows no link',
      async (_label, _layer, { featureId, parentFeatureId }) => {
        const body = serviceTemplateProject('twoStages')
        const expected = baselineIds(body).has(parentFeatureId)
          ? baselineDetailsUrl(body, parentFeatureId)
          : undefined

        const $ = await render(
          body,
          postInterventionDetailsUrl(body, featureId)
        )

        expect(viewBaselineHref($)).toBe(expected)
      }
    )

    test('a feature with no parent shows no link, and there is one', async () => {
      const unlinked = cases.filter(([, , f]) => !f.parentFeatureId)
      expect(unlinked.length).toBeGreaterThan(0)
      const body = serviceTemplateProject('twoStages')
      const [, , feature] = unlinked[0]

      const $ = await render(
        body,
        postInterventionDetailsUrl(body, feature.featureId)
      )

      expect(viewBaselineHref($)).toBeUndefined()
    })

    test('the degraded hedgerow HG017 renders in the Created layout and links to its parent', async () => {
      const body = serviceTemplateProject('twoStages')
      const hedgerow = body.project.postIntervention.hedgerows.find(
        (f) => f.ref === 'HG017'
      )

      const $ = await render(
        body,
        postInterventionDetailsUrl(body, hedgerow.featureId)
      )

      expect(hedgerow.retentionCategory).toBe('Created')
      expect(fieldNames($)).toContain('strategicSignificance')
      expect(viewBaselineHref($)).toBe(
        baselineDetailsUrl(body, hedgerow.parentFeatureId)
      )
    })

    test.each(['Retained', 'Enhanced', 'Created'])(
      'a %s individual tree renders in the area layout, sized in hectares',
      async (retentionCategory) => {
        const body = serviceTemplateProject('twoStages')
        const tree = body.project.postIntervention.trees.find(
          (f) => f.retentionCategory === retentionCategory
        )

        const $ = await render(
          body,
          postInterventionDetailsUrl(body, tree.featureId)
        )

        expect(normalise($('h1').text())).toContain(tree.ref)
        expect(normalise($('main').text())).not.toContain('not yet supported')
        expect(fieldValue($, 'Broad habitat')).toBe('Individual trees')
        expect(fieldValue($, 'Tree size')).toBe(tree.proposed.treeSize)
        expect(fieldValue($, 'Number of trees')).toBe(String(tree.count ?? 1))
        expect(fieldValue($, 'Habitat type')).toBe(tree.proposed.type)
        expect(fieldNames($)).toEqual([])
        expect(viewBaselineHref($)).toBe(
          tree.parentFeatureId
            ? baselineDetailsUrl(body, tree.parentFeatureId)
            : undefined
        )
      }
    )

    test('a Created watercourse saved Incomplete, with no values, renders', async () => {
      const body = serviceTemplateProject('twoStages')
      const watercourse = body.project.postIntervention.watercourses.find(
        (f) => f.ref === 'R005'
      )

      const $ = await render(
        body,
        postInterventionDetailsUrl(body, watercourse.featureId)
      )

      expect(watercourse.status).toBe('Incomplete')
      expect(normalise($('h1').text())).toContain('R005')
    })
  })

  test('the degraded watercourse whose advance the backend cleared renders', async () => {
    const body = serviceTemplateProject('watercourseAdvanceIncomplete')
    const degraded = body.project.postIntervention.watercourses.filter(
      (f) =>
        f.retentionCategory === 'Created' &&
        f.parentFeatureId &&
        f.status === 'Incomplete'
    )

    expect(degraded).toHaveLength(1)
    const [watercourse] = degraded
    const $ = await render(
      body,
      postInterventionDetailsUrl(body, watercourse.featureId)
    )

    expect(watercourse.proposed.advanceYears).toBeNull()
    expect(normalise($('h1').text())).toContain(watercourse.ref)
    expect(viewBaselineHref($)).toBe(
      baselineDetailsUrl(body, watercourse.parentFeatureId)
    )
  })

  test.each([
    ['baseline', baselineDetailsUrl],
    ['post-intervention', postInterventionDetailsUrl]
  ])(
    'the %s details page answers 404 for a feature the project does not hold',
    async (_stage, detailsUrl) => {
      const body = serviceTemplateProject('twoStages')
      serveProject(body)

      const { statusCode } = await getPage(
        server,
        detailsUrl(body, UNKNOWN_FEATURE_ID)
      )

      expect(statusCode).toBe(statusCodes.notFound)
    }
  )
})
