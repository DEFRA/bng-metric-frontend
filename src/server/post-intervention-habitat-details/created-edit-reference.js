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

function hasRequiredArrays(kind, payload) {
  const fields = ['habitatTypes', 'strategicSignificance']
  if (kind === 'watercourse') {
    fields.push('watercourseEncroachment', 'riparianEncroachment')
  }
  return fields.every((field) => Array.isArray(payload?.[field]))
}

async function loadCreationReference(
  kind,
  referenceName,
  hasBroadHabitat,
  intervention = 'creation'
) {
  if (!referencePromises.has(kind)) {
    referencePromises.set(
      kind,
      wreck
        .get(`${backendUrl}/reference/${referenceName}-${intervention}`)
        .then(({ res, payload }) => {
          if (
            res?.statusCode >= statusCodes.badRequest ||
            !hasRequiredArrays(kind, payload) ||
            !payload?.timeMultipliers
          ) {
            throw new Error(
              `Invalid ${referenceName} ${intervention} reference response`
            )
          }
          return {
            ...structuredClone(payload),
            featureType: kind,
            hasBroadHabitat
          }
        })
        .catch((error) => {
          referencePromises.delete(kind)
          throw error
        })
    )
  }
  return structuredClone(await referencePromises.get(kind))
}

export function _resetCreatedAreaReferenceCache() {
  referencePromises.clear()
}
