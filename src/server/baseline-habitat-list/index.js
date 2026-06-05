import Joi from 'joi'
import { getController } from './controller.js'
import { requireBngCompleterRole } from '../common/helpers/auth/verify-role.js'

/**
 * @openapi
 * /projects/{id}/baseline-habitat-list:
 *   get:
 *     tags:
 *       - Habitat
 *     summary: Baseline habitat list
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Renders the baseline habitat list page
 *       302:
 *         description: Redirects to login if not authenticated
 */
const protectedRouteOptions = {
  auth: 'session',
  pre: [requireBngCompleterRole]
}

export const baselineHabitatList = {
  plugin: {
    name: 'baseline-habitat-list',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/baseline-habitat-list',
          options: {
            ...protectedRouteOptions,
            validate: {
              params: Joi.object({
                id: Joi.string().guid({ version: 'uuidv4' }).required()
              })
            },
            handler: getController.handler
          }
        }
      ])
    }
  }
}
