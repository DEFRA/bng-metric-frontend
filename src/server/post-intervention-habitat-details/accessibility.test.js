// @vitest-environment happy-dom
/* global DOMParser */
import { createServer } from '../server.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'
import { assertLayoutLandmarks } from '../test-helpers/assert-landmarks.js'
import { servesReference } from './controller-test-helpers.js'
import {
  createdAreaValues,
  _resetCreatedAreaReferenceCache
} from './created-area-edit.js'
import {
  createdAreaFeature,
  creationReference,
  enhancedAreaFeature,
  enhancementReference
} from './created-area-test-fixtures.js'
import {
  createdHedgerowFeature,
  enhancedHedgerowFeature,
  hedgerowCreationReference,
  hedgerowEnhancementReference
} from './created-hedgerow-test-fixtures.js'
import {
  createdWatercourseFeature,
  watercourseCreationReference
} from './created-watercourse-test-fixtures.js'
import {
  createdTree,
  enhancedTree,
  treeCreationReference,
  treeEnhancementReference
} from './created-tree-test-fixtures.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn(), put: vi.fn() }
}))

const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const projectId = 'aa0e8400-e29b-41d4-a716-446655440000'
const featureId = 'aa0e8400-e29b-41d4-a716-446655440001'
const baselineFeatureId = 'aa0e8400-e29b-41d4-a716-446655440002'

// Retained, so the page carries the reference input (BMD-1180).
const FEATURES = {
  habitat: {
    featureId,
    ref: 'A1',
    sizeSquareMetres: 25000,
    units: 4,
    retentionCategory: 'Retained',
    proposed: {
      broadType: 'Grassland',
      type: 'Modified grassland',
      condition: 'Good',
      conditionScore: 3,
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  },
  hedgerow: {
    featureId,
    ref: 'H1',
    sizeMetres: 1000,
    units: 6,
    retentionCategory: 'Retained',
    proposed: {
      type: 'Native hedgerow',
      condition: 'Good',
      conditionScore: 3,
      distinctiveness: 'Low',
      distinctivenessScore: 2
    }
  },
  watercourse: {
    featureId,
    ref: 'W1',
    sizeMetres: 500,
    units: 3,
    retentionCategory: 'Retained',
    baseline: { type: 'Ditches', condition: 'Good' },
    proposed: {
      type: 'Ditches',
      condition: 'Good',
      conditionScore: 3,
      distinctiveness: 'Medium',
      distinctivenessScore: 4
    }
  }
}

/**
 * @param {string} type
 * @param {{ comment?: string|null }} [options] the `baselineComment` the
 *   backend sends with a Retained habitat (BMD-1187); none by default, so the
 *   page shows "No data"
 */
function mockBackend(type, { comment = null } = {}) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (url.endsWith(`/post-intervention/features/${featureId}`)) {
      return Promise.resolve({
        payload: { type, feature: FEATURES[type], baselineComment: comment }
      })
    }
    return Promise.resolve({
      payload: {
        project: {
          name: 'Project 1',
          baseline: { habitats: [{ featureId: baselineFeatureId, ref: 'A1' }] }
        }
      }
    })
  })
}

const withoutBroadHabitat = (feature) => {
  const { broadHabitat: _broad, ...values } = createdAreaValues(feature)
  return values
}

// Created features, and the Enhanced ones whose page has the same box
// (BMD-1190), with a saved comment, and the reference each is edited
// against. An enhancement reference's URL carries its baseline as a query.
const EDIT_PAGES = {
  'Created habitat': {
    type: 'habitat',
    feature: createdAreaFeature,
    reference: ['/reference/area-creation', creationReference],
    values: createdAreaValues
  },
  'Created tree': {
    type: 'tree',
    feature: createdTree,
    reference: ['/reference/tree-creation', treeCreationReference],
    values: createdAreaValues
  },
  'Created hedgerow': {
    type: 'hedgerow',
    feature: createdHedgerowFeature,
    reference: ['/reference/hedgerow-creation', hedgerowCreationReference],
    values: withoutBroadHabitat
  },
  'Created watercourse': {
    type: 'watercourse',
    feature: createdWatercourseFeature,
    reference: [
      '/reference/watercourse-creation',
      watercourseCreationReference
    ],
    values: withoutBroadHabitat
  },
  'Enhanced habitat': {
    type: 'habitat',
    feature: enhancedAreaFeature,
    reference: ['/reference/area-enhancement?', enhancementReference],
    values: createdAreaValues
  },
  'Enhanced tree': {
    type: 'tree',
    feature: enhancedTree,
    reference: ['/reference/tree-enhancement', treeEnhancementReference],
    values: createdAreaValues
  },
  'Enhanced hedgerow': {
    type: 'hedgerow',
    feature: enhancedHedgerowFeature,
    reference: [
      '/reference/hedgerow-enhancement?',
      hedgerowEnhancementReference
    ],
    values: withoutBroadHabitat
  }
}

/**
 * @param {string} type a key of EDIT_PAGES
 */
function mockEditPageBackend(type) {
  const { feature, reference, type: featureType } = EDIT_PAGES[type]
  const [referencePath, referencePayload] = reference
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (servesReference(url, referencePath)) {
      return Promise.resolve({ payload: referencePayload })
    }
    if (url.endsWith(`/post-intervention/features/${featureId}`)) {
      return Promise.resolve({
        payload: {
          type: featureType,
          feature: {
            ...feature,
            featureId,
            comment: 'Planted along the northern boundary.\nSee the plan.'
          }
        }
      })
    }
    return Promise.resolve({ payload: { project: { name: 'Project 1' } } })
  })
}

describe('Post-intervention habitat details page accessibility checks', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    vi.mocked(wreck.get).mockReset()
    _resetCreatedAreaReferenceCache()
  })

  it.each(['habitat', 'hedgerow', 'watercourse'])(
    'should have no HTML accessibility issues for a retained %s',
    async (type) => {
      mockBackend(type)
      const { document } = await loadPage({
        requestUrl: `/post-intervention-habitat-details?featureId=${featureId}&projectId=${projectId}`,
        server,
        auth: authedAuth
      })
      assertLayoutLandmarks(document)
      await runAxeChecks(document.documentElement)
    }
  )

  it.each(['habitat', 'hedgerow', 'watercourse'])(
    'should have no HTML accessibility issues for a retained %s with supporting information',
    async (type) => {
      mockBackend(type, {
        comment: 'Existing woodland on the boundary.\nSee the BNG report.'
      })
      const { document } = await loadPage({
        requestUrl: `/post-intervention-habitat-details?featureId=${featureId}&projectId=${projectId}`,
        server,
        auth: authedAuth
      })
      assertLayoutLandmarks(document)
      await runAxeChecks(document.documentElement)
    }
  )

  it('should have no HTML accessibility issues when the habitat reference is refused', async () => {
    mockBackend('habitat')
    const crumb = await primeCrumb(server)
    const response = await server.inject({
      method: 'POST',
      url: '/post-intervention-habitat-details',
      payload: { projectId, featureId, habitatRef: ' ', crumb: crumb.token },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })
    expect(response.statusCode).toBe(400)
    const document = new DOMParser().parseFromString(
      response.result,
      'text/html'
    )
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })

  // The Created and Enhanced edit pages, with their supporting information
  // box (BMD-1153, BMD-1190).
  describe.each(Object.keys(EDIT_PAGES))('the %s edit page', (type) => {
    it('should have no HTML accessibility issues', async () => {
      mockEditPageBackend(type)
      const { document } = await loadPage({
        requestUrl: `/post-intervention-habitat-details?featureId=${featureId}&projectId=${projectId}`,
        server,
        auth: authedAuth
      })
      expect(document.getElementById('comment')).not.toBeNull()
      assertLayoutLandmarks(document)
      await runAxeChecks(document.documentElement)
    })

    it('should have no HTML accessibility issues when the supporting information is refused', async () => {
      mockEditPageBackend(type)
      const { feature, values } = EDIT_PAGES[type]
      const crumb = await primeCrumb(server)
      const response = await server.inject({
        method: 'POST',
        url: '/post-intervention-habitat-details',
        payload: {
          projectId,
          featureId,
          ...values(feature),
          comment: `�${'a'.repeat(1000)}`,
          crumb: crumb.token
        },
        headers: { cookie: crumb.cookie },
        auth: authedAuth
      })
      expect(response.statusCode).toBe(200)
      const document = new DOMParser().parseFromString(
        response.result,
        'text/html'
      )
      expect(
        document.querySelector('.govuk-error-summary a[href="#comment"]')
      ).not.toBeNull()
      assertLayoutLandmarks(document)
      await runAxeChecks(document.documentElement)
    })
  })
})
