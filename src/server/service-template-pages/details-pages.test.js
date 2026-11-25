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
// read-only. An Enhanced area habitat opens on it too (BMD-1045).
const EDITABLE_CREATED_LAYERS = new Set([
  'habitats',
  'trees',
  'hedgerows',
  'watercourses'
])

// The layers whose Retained features can have their reference changed; a
// Retained vertical area habitat renders read-only.
const RETAINED_REF_LAYERS = new Set([
  'habitats',
  'trees',
  'hedgerows',
  'watercourses'
])

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

// The fields a user edits: not the form's hidden inputs or its CSRF token.
function editableFieldNames($) {
  return $('form [name]')
    .filter((_, field) => $(field).attr('type') !== 'hidden')
    .map((_, field) => $(field).attr('name'))
    .get()
    .sort()
}

// The value of a field shown read-only, or the option chosen in its dropdown.
function shownOrChosen($, heading, name) {
  return (
    fieldValue($, heading) ??
    $(`[name="${name}"] option[selected]`).attr('value')
  )
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

// A Created feature of those layers opens on the edit form, and so does an
// Enhanced tree, whose condition is all it enhances, an Enhanced area habitat
// (BMD-1045), an Enhanced hedgerow (BMD-1046) and an Enhanced watercourse
// (BMD-1047).
const EDITABLE_ENHANCED_LAYERS = new Set([
  'trees',
  'habitats',
  'hedgerows',
  'watercourses'
])
const isEditable = (layer, feature) =>
  (feature.retentionCategory === 'Created' &&
    EDITABLE_CREATED_LAYERS.has(layer)) ||
  (feature.retentionCategory === 'Enhanced' &&
    EDITABLE_ENHANCED_LAYERS.has(layer))

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

  test('baseline details of a tree offer its size class to edit, and no number of trees', async () => {
    const body = serviceTemplateProject('twoStages')
    const [tree] = body.project.baseline.trees

    const $ = await render(body, baselineDetailsUrl(body, tree.featureId))

    // Its size class is a dropdown of the Metric's, with its own chosen.
    expect(fieldValue($, 'Tree size')).toBeUndefined()
    expect(
      $('[name="treeSize"] option')
        .map((_, option) => $(option).attr('value'))
        .get()
    ).toEqual(['Small', 'Medium', 'Large', 'Very large'])
    expect(shownOrChosen($, 'Tree size', 'treeSize')).toBe(tree.treeSize)
    // A BNG Service template tree is one tree: it has no Count to show.
    expect(fieldValue($, 'Number of trees')).toBeUndefined()
  })

  // A Created or Enhanced area habitat opens on its edit form; a Created
  // vertical area habitat uses the read-only Created page the trees share.
  test.each([
    ['habitats', 'Retained'],
    ['verticalHabitats', 'Enhanced'],
    ['verticalHabitats', 'Created']
  ])(
    'post-intervention details of %s (%s) have no tree rows',
    async (layer, retentionCategory) => {
      const body = serviceTemplateProject('twoStages')
      const habitat = body.project.postIntervention[layer].find(
        (f) => f.retentionCategory === retentionCategory
      )

      const $ = await render(
        body,
        postInterventionDetailsUrl(body, habitat.featureId)
      )

      expect(fieldValue($, 'Broad habitat')).toBeDefined()
      expect(fieldValue($, 'Tree size')).toBeUndefined()
      expect(fieldValue($, 'Number of trees')).toBeUndefined()
    }
  )

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
      'renders %s on the edit form, with its significance chosen',
      async (_label, _layer, { featureId, proposed }) => {
        const body = serviceTemplateProject('twoStages')

        const $ = await render(
          body,
          postInterventionDetailsUrl(body, featureId)
        )

        expect(fieldNames($)).toContain('strategicSignificance')
        expect(headings($)).toContain(TIME_TO_TARGET_HEADING)
        // A file that saved only the legacy label still restores it (BMD-1050).
        expect(selectedSignificance($)).toBe(
          proposed.strategicSignificanceCategory ??
            proposed.strategicSignificance
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

    // A Retained or Enhanced feature's page links to the baseline feature it
    // names as its parent, a tree's included; a Created one's, a degraded
    // one's included, to none.
    const linksToParent = (retentionCategory, parentFeatureId, body) =>
      retentionCategory !== 'Created' && baselineIds(body).has(parentFeatureId)

    test.each(cases)(
      'links %s to the baseline feature it names as its parent unless it is Created, or shows no link',
      async (
        _label,
        _layer,
        { featureId, parentFeatureId, retentionCategory }
      ) => {
        const body = serviceTemplateProject('twoStages')
        const expected = linksToParent(retentionCategory, parentFeatureId, body)
          ? baselineDetailsUrl(body, parentFeatureId)
          : undefined

        const $ = await render(
          body,
          postInterventionDetailsUrl(body, featureId)
        )

        expect(viewBaselineHref($)).toBe(expected)
      }
    )

    test.each(['Retained', 'Enhanced'])(
      'a %s feature that names a baseline parent links to it, and a tree is among them',
      async (retentionCategory) => {
        const body = serviceTemplateProject('twoStages')
        const linked = cases.filter(
          ([, , f]) =>
            f.retentionCategory === retentionCategory &&
            baselineIds(body).has(f.parentFeatureId)
        )
        expect(new Set(linked.map(([, layer]) => layer))).toContain('trees')
        const [, , feature] = linked[0]

        const $ = await render(
          body,
          postInterventionDetailsUrl(body, feature.featureId)
        )

        expect(viewBaselineHref($)).toBe(
          baselineDetailsUrl(body, feature.parentFeatureId)
        )
        expect($('main').text()).toContain(VIEW_BASELINE_LINK)
      }
    )

    // On the edit form an Enhanced feature opens on, the link sits straight
    // below the Strategic significance drop-down.
    test('an Enhanced feature on the edit form shows the link below Strategic significance', async () => {
      const body = serviceTemplateProject('twoStages')
      const enhanced = cases.filter(
        ([, , f]) =>
          f.retentionCategory === 'Enhanced' &&
          baselineIds(body).has(f.parentFeatureId)
      )
      let onEditForm = 0

      for (const [, , feature] of enhanced) {
        const $ = await render(
          body,
          postInterventionDetailsUrl(body, feature.featureId)
        )
        if (!fieldNames($).includes('strategicSignificance')) {
          continue
        }
        onEditForm += 1
        const next = $('#strategicSignificance')
          .closest('.govuk-form-group')
          .next()

        expect(normalise(next.find('a').text())).toBe(VIEW_BASELINE_LINK)
      }
      expect(onEditForm).toBeGreaterThan(0)
    })

    test('a Created feature that names a baseline parent shows no link, and there is one', async () => {
      const body = serviceTemplateProject('twoStages')
      const created = cases.filter(
        ([, , f]) =>
          f.retentionCategory === 'Created' &&
          baselineIds(body).has(f.parentFeatureId)
      )
      expect(created.length).toBeGreaterThan(0)
      const [, , feature] = created[0]

      const $ = await render(
        body,
        postInterventionDetailsUrl(body, feature.featureId)
      )

      expect(viewBaselineHref($)).toBeUndefined()
      expect($('main').text()).not.toContain(VIEW_BASELINE_LINK)
    })

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

    // A degraded habitat is recorded as Created, so it links to no baseline,
    // though it names the one it degrades as its parent.
    test('the degraded hedgerow HG017 renders in the Created layout, with no link to its parent', async () => {
      const body = serviceTemplateProject('twoStages')
      const hedgerow = body.project.postIntervention.hedgerows.find(
        (f) => f.ref === 'HG017'
      )

      const $ = await render(
        body,
        postInterventionDetailsUrl(body, hedgerow.featureId)
      )

      expect(hedgerow.retentionCategory).toBe('Created')
      expect(baselineIds(body).has(hedgerow.parentFeatureId)).toBe(true)
      expect(fieldNames($)).toContain('strategicSignificance')
      expect(viewBaselineHref($)).toBeUndefined()
    })

    // A Retained tree takes the reference form, and a Created or an Enhanced
    // one the edit form, with its supporting information (BMD-1153,
    // BMD-1190).
    const TREE_EDIT_FIELDS = [
      'ref',
      'habitatType',
      'strategicSignificance',
      'condition',
      'advanceYears',
      'delayYears',
      'comment'
    ]
    test.each([
      ['Retained', ['habitatRef']],
      ['Enhanced', TREE_EDIT_FIELDS],
      // A Created tree's planted size class can be edited; an Enhanced one's
      // is its baseline tree's.
      ['Created', [...TREE_EDIT_FIELDS, 'treeSize']]
    ])(
      'a %s individual tree renders in the area layout, sized in hectares',
      async (retentionCategory, editableFields) => {
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
        expect(shownOrChosen($, 'Tree size', 'treeSize')).toBe(
          tree.proposed.treeSize
        )
        // A BNG Service template tree is one tree: it has no Count to show.
        expect(fieldValue($, 'Number of trees')).toBeUndefined()
        expect(
          fieldValue($, 'Habitat type') ??
            $('[name="habitatType"] option[selected]').attr('value')
        ).toBe(tree.proposed.type)
        expect(editableFieldNames($)).toEqual([...editableFields].sort())
        expect(viewBaselineHref($)).toBe(
          linksToParent(retentionCategory, tree.parentFeatureId, body)
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
    // Recorded as Created, it links to no baseline watercourse.
    expect(viewBaselineHref($)).toBeUndefined()
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
