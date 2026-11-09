import Boom from '@hapi/boom'

import { statusCodes } from '../../constants.js'

/**
 * A stand-in for the backend that serves one service-template project
 * fixture, for tests that drive a page through `server.inject` with
 * `wreck.get` mocked. It answers the project, its baseline and
 * post-intervention features by featureId, and the reference lists the
 * details pages read, built from the fixture's own features so every type and
 * condition it holds is one the reference knows. Any other URL throws, so a
 * page that calls something new fails its test rather than rendering on a
 * guess.
 *
 * @example
 * vi.mocked(wreck.get).mockImplementation(serviceTemplateBackend(body))
 */

const BASELINE_LAYERS = Object.freeze({
  habitats: 'habitat',
  verticalHabitats: 'verticalHabitat',
  trees: 'tree',
  hedgerows: 'hedgerow',
  watercourses: 'watercourse'
})

const CONDITIONS = Object.freeze([
  { condition: 'Good', score: 3 },
  { condition: 'Fairly Good', score: 2.5 },
  { condition: 'Moderate', score: 2 },
  { condition: 'Fairly Poor', score: 1.5 },
  { condition: 'Poor', score: 1 },
  { condition: 'N/A - Agricultural', score: 1 },
  { condition: 'N/A - Other', score: 0 }
])

const TRADING_RULES = Object.freeze({
  'V.High': 'Same habitat required - bespoke compensation option',
  High: 'Same habitat required =',
  Medium: 'Same broad habitat or a higher distinctiveness habitat required (≥)',
  Low: 'Same distinctiveness or better habitat required ≥',
  'V.Low': 'Compensation Not Required'
})

const ENCROACHMENTS = Object.freeze({
  watercourse: ['No Encroachment', 'Minor', 'Major', 'N/A - Culvert'],
  riparian: ['No Encroachment', 'Minor/Minor', 'Major/Major', 'N/A - Culvert']
})

const STRATEGIC_SIGNIFICANCE = Object.freeze([
  { value: 'Low', score: 1 },
  { value: 'High', score: 1.15 }
])

const TIME_MULTIPLIERS = Object.freeze({
  0: 1,
  1: 0.965,
  '30+': 0.3197967361
})

const LOCAL_PLANNING_AUTHORITIES = Object.freeze([
  { name: 'Anytown Borough Council', reference: 'E60000001' }
])

const ok = (payload) => ({ res: { statusCode: statusCodes.ok }, payload })

/** A URL's path, without its origin or query: the backend URL is absolute. */
const pathOf = (url) => url.replace(/^[a-z]+:\/\/[^/]+/u, '').split('?')[0]

/**
 * What `@hapi/wreck` rejects with for a 404: a Boom error carrying the
 * response, which callers such as fetchFeature turn into their own 404.
 */
const notFound = (url) =>
  Boom.notFound(`Response Error: 404 Not Found for ${url}`, {
    isResponseError: true,
    res: { statusCode: statusCodes.notFound },
    payload: null
  })

/** Every feature of one stage, with the type the feature endpoint names it. */
function featuresOf(stage) {
  return Object.entries(BASELINE_LAYERS).flatMap(([layer, type]) =>
    (stage?.[layer] ?? []).map((feature) => ({ type, feature }))
  )
}

/** The habitat type a feature names: its own, else the one it proposes. */
function habitatOf(feature) {
  const source = feature.type ? feature : (feature.proposed ?? {})
  return {
    broad: source.broadType,
    name: source.type,
    distinctiveness: source.distinctiveness,
    distinctivenessScore: source.distinctivenessScore
  }
}

/** Each distinct habitat type in a layer of both stages, first seen first. */
function typesIn(project, layer) {
  const seen = new Map()
  for (const stage of [project.baseline, project.postIntervention]) {
    for (const feature of stage?.[layer] ?? []) {
      const habitat = habitatOf(feature)
      if (habitat.name && !seen.has(`${habitat.broad}|${habitat.name}`)) {
        seen.set(`${habitat.broad}|${habitat.name}`, habitat)
      }
    }
  }
  return [...seen.values()]
}

function typesByBroad(project) {
  const byBroad = {}
  for (const { broad, ...habitat } of typesIn(project, 'habitats')) {
    byBroad[broad] ??= []
    byBroad[broad].push(habitat)
  }
  return byBroad
}

function namedTypes(project, layer) {
  return typesIn(project, layer).map(({ broad: _broad, ...habitat }) => habitat)
}

function creationReference(project, layer, featureType) {
  return {
    featureType,
    hasBroadHabitat: layer === 'habitats',
    habitatTypes: typesIn(project, layer).map((habitat) => ({
      ...habitat,
      difficulty: 'Low',
      difficultyMultiplier: 1,
      conditions: CONDITIONS.map((c) => ({ ...c, years: 1 }))
    })),
    strategicSignificance: STRATEGIC_SIGNIFICANCE,
    timeMultipliers: TIME_MULTIPLIERS,
    ...(layer === 'watercourses' && {
      watercourseEncroachment: ENCROACHMENTS.watercourse,
      riparianEncroachment: ENCROACHMENTS.riparian
    })
  }
}

/**
 * @param {object} body the fixture, as `GET /projects/{id}` returns it
 * @returns {(url: string) => Promise<{ res: { statusCode: number }, payload: unknown }>}
 */
function serviceTemplateBackend(body) {
  const { project } = body
  const projectPath = `/projects/${body.id}`
  const baseline = featuresOf(project.baseline)
  const postIntervention = featuresOf(project.postIntervention)

  const featureRoutes = [
    {
      prefix: `${projectPath}/post-intervention/features/`,
      features: postIntervention
    },
    { prefix: `${projectPath}/features/`, features: baseline }
  ]
  const references = new Map([
    ['/reference/habitat-types-by-broad', () => typesByBroad(project)],
    ['/reference/hedgerow-types', () => namedTypes(project, 'hedgerows')],
    ['/reference/watercourse-types', () => namedTypes(project, 'watercourses')],
    ['/reference/watercourse-encroachments', () => ENCROACHMENTS],
    ['/reference/local-planning-authorities', () => LOCAL_PLANNING_AUTHORITIES],
    [
      '/reference/area-creation',
      () => creationReference(project, 'habitats', 'habitat')
    ],
    [
      '/reference/hedgerow-creation',
      () => creationReference(project, 'hedgerows', 'hedgerow')
    ],
    [
      '/reference/watercourse-creation',
      () => creationReference(project, 'watercourses', 'watercourse')
    ]
  ])

  return async (url) => {
    const path = pathOf(url)
    const route = featureRoutes.find(({ prefix }) => path.includes(prefix))
    if (route) {
      const featureId = path.slice(
        path.indexOf(route.prefix) + route.prefix.length
      )
      const match = route.features.find(
        (f) => f.feature.featureId === featureId
      )
      if (!match) {
        throw notFound(url)
      }
      return ok(match)
    }
    if (path.endsWith(projectPath)) {
      return ok(body)
    }
    if (path.endsWith('/reference/conditions')) {
      return ok(CONDITIONS)
    }
    if (path.endsWith('/reference/trading-rules')) {
      return ok(TRADING_RULES)
    }
    const reference = [...references].find(([suffix]) => path.endsWith(suffix))
    if (reference) {
      return ok(reference[1]())
    }
    throw new Error(`The service-template backend stub has no route for ${url}`)
  }
}

export { BASELINE_LAYERS, serviceTemplateBackend }
