import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../config/config.js'
import { backendRequest } from '../common/helpers/auth/backend-request.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

// BMD-546 spike: lightweight proxy so the browser can fetch baseline and
// post-intervention geometries without talking to the backend directly.
// Mirrors src/server/common/services/*.
function makeProxy({ publicPath, upstreamStage, label }) {
  return {
    method: 'GET',
    path: publicPath,
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
          const upstream = `${backendUrl}/projects/${id}/${upstreamStage}/geometry`
          // Forward the user's bearer token (and refresh-retry on 401) — the
          // backend requires auth on every route via server.auth.default.
          const { payload } = await backendRequest(request, 'get', upstream)
          return h.response(payload).type('application/json')
        } catch (err) {
          if (err?.output?.statusCode === 404) {
            throw Boom.notFound(`Project ${id} not found`)
          }
          throw Boom.badGateway(`Unable to fetch ${label} geometries`, err)
        }
      }
    }
  }
}

export const geometryProxy = {
  plugin: {
    name: 'geometry-proxy',
    register(server) {
      server.route([
        makeProxy({
          publicPath: '/api/projects/{id}/baseline/geometry',
          upstreamStage: 'baseline',
          label: 'baseline'
        }),
        makeProxy({
          publicPath: '/api/projects/{id}/post-intervention/geometry',
          upstreamStage: 'post-intervention',
          label: 'post-intervention'
        })
      ])
    }
  }
}
