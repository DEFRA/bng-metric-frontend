import Boom from '@hapi/boom'
import { config } from '../../../config/config.js'
import { statusCodes } from '../constants.js'
import { wreck } from '../helpers/wreck-client.js'

const url = `${config.get('backend').url.replace(/\/$/, '')}/reference/local-planning-authorities`

export async function fetchLocalPlanningAuthorities() {
  try {
    const { res, payload } = await wreck.get(url)
    if (
      res.statusCode !== statusCodes.ok ||
      !Array.isArray(payload) ||
      !payload.length ||
      payload.some(
        (entry) =>
          !entry ||
          typeof entry.name !== 'string' ||
          !entry.name ||
          typeof entry.reference !== 'string' ||
          !entry.reference
      )
    ) {
      throw new Error('Invalid LPA lookup response')
    }
    return payload
  } catch {
    throw Boom.badGateway('Failed to fetch Local Planning Authorities')
  }
}
