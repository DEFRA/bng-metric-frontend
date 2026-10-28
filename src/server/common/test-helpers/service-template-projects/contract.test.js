import { describe, expect, test } from 'vitest'

import { isServiceTemplateDocument } from '../../helpers/service-template.js'
import { serviceTemplateProject } from './index.js'

// What the frontend relies on in a BNG Service template project (BMD-1086).
// The fixtures are captured from the backend (see README.md), so a failure
// here after re-capturing them means the backend's shape changed.

const LINKED_LAYERS = ['habitats', 'hedgerows', 'watercourses']
const RETENTION_CATEGORIES = ['Retained', 'Enhanced', 'Created']
const LOST_OUTCOMES = ['removed', 'lostAndRecreated', 'lost']
const SIGNIFICANCE_CATEGORIES = ['Low', 'High']
const LOST_SIZE_FIELD = {
  habitats: 'lostSizeSquareMetres',
  hedgerows: 'lostSizeMetres',
  watercourses: 'lostSizeMetres'
}

function featureIds(features) {
  return new Set(features.map(({ featureId }) => featureId))
}

describe('service-template project fixtures', () => {
  const { project } = serviceTemplateProject('twoStages')
  const { baseline, postIntervention } = project

  test('record the BNG Service template on both documents', () => {
    for (const document of [baseline, postIntervention]) {
      expect(document.template).toEqual({ name: 'bng-service', version: '1.0' })
      expect(isServiceTemplateDocument(document)).toBe(true)
    }
  })

  test.each(LINKED_LAYERS)(
    'link each post-intervention %s feature to a baseline feature on its own layer',
    (layer) => {
      const parents = featureIds(baseline[layer])
      const linked = postIntervention[layer].filter(
        ({ parentFeatureId }) => parentFeatureId
      )
      expect(linked.length).toBeGreaterThan(0)
      for (const feature of linked) {
        expect(parents.has(feature.parentFeatureId), feature.ref).toBe(true)
      }
    }
  )

  test('link Created features too, where a habitat gets worse', () => {
    const createdWithParent = LINKED_LAYERS.flatMap((layer) =>
      postIntervention[layer].filter(
        (feature) =>
          feature.retentionCategory === 'Created' && feature.parentFeatureId
      )
    )
    expect(createdWithParent.length).toBeGreaterThan(0)
  })

  test('hold only Retained, Enhanced and Created features: no Lost rows', () => {
    const categories = new Set(
      LINKED_LAYERS.flatMap((layer) =>
        postIntervention[layer].map(
          ({ retentionCategory }) => retentionCategory
        )
      )
    )
    expect([...categories].sort()).toEqual([...RETENTION_CATEGORIES].sort())
  })

  test('list each lost baseline habitat, by its featureId and outcome', () => {
    const { lostHabitats } = postIntervention
    expect(new Set(lostHabitats.map(({ outcome }) => outcome))).toEqual(
      new Set(LOST_OUTCOMES)
    )
    for (const lost of lostHabitats) {
      expect(featureIds(baseline[lost.layer]).has(lost.featureId)).toBe(true)
      expect(lost[LOST_SIZE_FIELD[lost.layer]]).toBeGreaterThanOrEqual(0)
      const recreated = featureIds(postIntervention[lost.layer])
      for (const featureId of lost.recreatedAs) {
        expect(recreated.has(featureId)).toBe(true)
      }
    }
  })

  test('give proposed strategic significance as Low or High', () => {
    const categories = LINKED_LAYERS.flatMap((layer) =>
      postIntervention[layer]
        .map(({ proposed }) => proposed?.strategicSignificanceCategory)
        .filter(Boolean)
    )
    expect(categories.length).toBeGreaterThan(0)
    expect(new Set(categories)).toEqual(new Set(SIGNIFICANCE_CATEGORIES))
  })

  test('read no individual trees yet (BMD-1172)', () => {
    expect(baseline.trees).toEqual([])
    expect(postIntervention.trees).toEqual([])
  })

  test('hand out a fresh copy each time', () => {
    const copy = serviceTemplateProject('twoStages')
    copy.project.baseline.habitats.length = 0
    expect(
      serviceTemplateProject('twoStages').project.baseline.habitats
    ).toHaveLength(baseline.habitats.length)
  })

  test('name only the fixtures there are', () => {
    expect(() => serviceTemplateProject('nonesuch')).toThrow(
      'No service-template project fixture named nonesuch'
    )
  })
})

describe('a baseline-only service-template project', () => {
  const { project } = serviceTemplateProject('baselineOnly')

  test('has a baseline in the template and no post-intervention document', () => {
    expect(isServiceTemplateDocument(project.baseline)).toBe(true)
    expect(project.baseline.habitats.length).toBeGreaterThan(0)
    expect(project).not.toHaveProperty('postIntervention')
  })
})

describe('a service-template project with an advance the guide does not allow', () => {
  const { project } = serviceTemplateProject('watercourseAdvanceIncomplete')

  test('saves the linked Created watercourse Incomplete, with its advance cleared', () => {
    const cleared = project.postIntervention.watercourses.filter(
      (watercourse) =>
        watercourse.retentionCategory === 'Created' &&
        watercourse.parentFeatureId &&
        watercourse.status === 'Incomplete'
    )
    expect(cleared.length).toBeGreaterThan(0)
    for (const watercourse of cleared) {
      expect(watercourse.proposed.advanceYears).toBeNull()
    }
  })
})
