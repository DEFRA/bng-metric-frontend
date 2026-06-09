import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../config/config.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

// BMD-546 spike: lightweight proxy so the browser can fetch baseline
// geometries without talking to the backend directly. Mirrors how the
// existing services in src/server/common/services/* shape backend calls.
export const baselineGeoJson = {
  plugin: {
    name: 'baseline-geojson-proxy',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/api/projects/{id}/baseline/geojson',
          options: {
            auth: 'session',
            pre: [requireBngCompleterRole],
            validate: {
              params: Joi.object({
                id: Joi.string().guid({ version: 'uuidv4' }).required()
              })
            },
            handler: async (request, h) => {
              const { id } = request.params
              try {
                const { payload } = await wreck.get(
                  `${backendUrl}/projects/${id}/baseline/geojson`
                )
                return h.response(payload).type('application/json')
              } catch (err) {
                if (err?.output?.statusCode === 404) {
                  throw Boom.notFound(`Project ${id} not found`)
                }
                throw Boom.badGateway(
                  'Unable to fetch baseline geometries',
                  err
                )
              }
            }
          }
        }
      ])
    }
  }
}
