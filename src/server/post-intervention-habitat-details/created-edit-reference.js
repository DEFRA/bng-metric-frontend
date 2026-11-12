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

// An individual tree's choices, Urban tree and Rural tree in Individual trees
// (BMD-1172).
export function loadCreatedTreeReference() {
  return loadCreationReference('tree', 'tree', true)
}

function hasRequiredArrays(kind, payload) {
  const fields = ['habitatTypes', 'strategicSignificance']
  if (kind === 'watercourse') {
    fields.push('watercourseEncroachment', 'riparianEncroachment')
  }
  return fields.every((field) => Array.isArray(payload?.[field]))
}

async function loadCreationReference(kind, referenceName, hasBroadHabitat) {
  if (!referencePromises.has(kind)) {
    referencePromises.set(
      kind,
      wreck
        .get(`${backendUrl}/reference/${referenceName}-creation`)
        .then(({ res, payload }) => {
          if (
            res?.statusCode >= statusCodes.badRequest ||
            !hasRequiredArrays(kind, payload) ||
            !payload?.timeMultipliers
          ) {
            throw new Error(
              `Invalid ${referenceName} creation reference response`
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
