import Joi from 'joi'

import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { statusCodes } from '../common/constants.js'

const logger = createLogger()

const defaultCacheControl = 'public, max-age=86400'
const cacheControlHeader = 'cache-control'
const contentTypeHeader = 'content-type'
const pngContentType = 'image/png'
const maxTileMatrixZoom = 24

export const routePath = '/aerial-base-map'

// Getmapping APGB aerial imagery, served from its WMTS RESTful GoogleMapsExtended
// tile matrix (row/col == standard XYZ). The licence token is the only secret —
// injected here so it never reaches the browser. z/y/x arrive already validated
// as integers, so nothing user-controlled can escape the tile path.
function buildUpstreamUrl(token, z, y, x) {
  return `https://getmapping.com/GmWMTS/${token}/APGB/1.0.0/APGB_Latest_UK_125mm/default/GoogleMapsExtended/${z}/${y}/${x}.png`
}

async function handleUpstreamError(res, h, tile, duration) {
  logger.warn(
    `Aerial proxy upstream: ${tile} returned ${res.status} (${duration}ms)`
  )
  const body = Buffer.from(await res.arrayBuffer())
  return h.response(body).code(res.status)
}

async function handleTileResponse(res, h, tile, duration) {
  const payload = Buffer.from(await res.arrayBuffer())
  const cacheControl =
    res.headers.get(cacheControlHeader) || defaultCacheControl
  const contentType = res.headers.get(contentTypeHeader) || pngContentType
  logger.debug(
    `Aerial proxy response: ${tile} ${res.status} ${payload.length} bytes (${duration}ms)`
  )
  return h
    .response(payload)
    .type(contentType)
    .header(cacheControlHeader, cacheControl)
}

const proxyHandler = {
  method: 'GET',
  path: `${routePath}/{z}/{y}/{x}`,
  options: {
    auth: false,
    validate: {
      params: Joi.object({
        z: Joi.number().integer().min(0).max(maxTileMatrixZoom).required(),
        y: Joi.number().integer().min(0).required(),
        x: Joi.number().integer().min(0).required()
      })
    }
  },
  async handler(request, h) {
    const token = config.get('map.aerialToken')
    if (!token) {
      logger.warn(
        'Aerial imagery token (AERIAL_APGB_TOKEN) is not set — aerial tile requests will fail'
      )
      return h
        .response('Aerial imagery not configured')
        .code(statusCodes.notFound)
    }

    const { z, y, x } = request.params
    const tile = `${z}/${y}/${x}`
    const startTime = Date.now()

    try {
      const res = await fetch(buildUpstreamUrl(token, z, y, x), {
        redirect: 'follow'
      })
      const duration = Date.now() - startTime

      return res.ok
        ? handleTileResponse(res, h, tile, duration)
        : handleUpstreamError(res, h, tile, duration)
    } catch (err) {
      logger.error(
        `Aerial proxy error for ${tile}: ${err.message} (${err.code || 'no error code'})`
      )
      return h
        .response('Aerial tile request failed')
        .code(statusCodes.badGateway)
    }
  }
}

export default [proxyHandler]
