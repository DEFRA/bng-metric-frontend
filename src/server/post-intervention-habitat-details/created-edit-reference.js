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

async function loadCreationReference(kind, referenceName, hasBroadHabitat) {
  if (!referencePromises.has(kind)) {
    referencePromises.set(
      kind,
      wreck
        .get(`${backendUrl}/reference/${referenceName}-creation`)
        .then(({ res, payload }) => {
          if (
            res?.statusCode >= statusCodes.badRequest ||
            !Array.isArray(payload?.habitatTypes) ||
            !Array.isArray(payload?.strategicSignificance) ||
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
