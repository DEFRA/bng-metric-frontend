import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')
const referencePromises = new Map()

export function loadCreatedAreaReference() {
  return loadCreationReference('habitat', 'area', true)
}

export function loadCreatedHedgerowReference() {
  return loadCreationReference('hedgerow', 'hedgerow', false)
}

export function loadCreatedWatercourseReference() {
  return loadCreationReference('watercourse', 'watercourse', false)
}

// An individual tree's choices, Urban tree and Rural tree in Individual trees.
export function loadCreatedTreeReference() {
  return loadCreationReference('tree', 'tree', true)
}

// An Enhanced individual tree's choices: for each of Urban tree and Rural
// tree, the target conditions each baseline condition can be enhanced to,
// with the Metric's enhancement times to target and difficulty.
export function loadEnhancedTreeReference() {
  return loadCreationReference('enhancedTree', 'tree', true, 'enhancement')
}

// BMD-1045: an Enhanced area chooses only from the valid enhancements of its
// baseline, which the backend lists per baseline habitat and condition.
export function loadEnhancedAreaReference(baseline = {}) {
  const query = new URLSearchParams(
    Object.entries({
      broadType: baseline.broadType,
      type: baseline.type,
      condition: baseline.condition
    }).filter(([, value]) => typeof value === 'string' && value !== '')
  )
  return loadReference({
    cacheKey: `enhanced-habitat?${query}`,
    kind: 'habitat',
    url: `${backendUrl}/reference/area-enhancement?${query}`,
    referenceName: 'area enhancement',
    hasBroadHabitat: true
  })
}

function hasRequiredArrays(kind, payload) {
  const fields = ['habitatTypes', 'strategicSignificance']
  if (kind === 'watercourse') {
    fields.push('watercourseEncroachment', 'riparianEncroachment')
  }
  return fields.every((field) => Array.isArray(payload?.[field]))
}

function loadCreationReference(
  kind,
  referenceName,
  hasBroadHabitat,
  intervention = 'creation'
) {
  return loadReference({
    cacheKey: kind,
    kind,
    url: `${backendUrl}/reference/${referenceName}-${intervention}`,
    referenceName: `${referenceName} ${intervention}`,
    hasBroadHabitat
  })
}

// The reference data is static for a backend release, so each response is
// fetched once per process; a failed fetch is retried on the next request.
const CACHE_LIMIT = 500

async function loadReference({
  cacheKey,
  kind,
  url,
  referenceName,
  hasBroadHabitat
}) {
  if (!referencePromises.has(cacheKey)) {
    if (referencePromises.size >= CACHE_LIMIT) {
      referencePromises.clear()
    }
    referencePromises.set(
      cacheKey,
      wreck
        .get(url)
        .then(({ res, payload }) => {
          if (
            res?.statusCode >= statusCodes.badRequest ||
            !hasRequiredArrays(kind, payload) ||
            !payload?.timeMultipliers
          ) {
            throw new Error(`Invalid ${referenceName} reference response`)
          }
          return {
            ...structuredClone(payload),
            featureType: kind,
            hasBroadHabitat
          }
        })
        .catch((error) => {
          referencePromises.delete(cacheKey)
          throw error
        })
    )
  }
  return structuredClone(await referencePromises.get(cacheKey))
}

export function _resetCreatedAreaReferenceCache() {
  referencePromises.clear()
}
