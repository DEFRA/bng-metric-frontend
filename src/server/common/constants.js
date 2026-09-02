export const DEFAULT_PROJECT_NAME = 'Project'

// Backend field names for the per-unit-type baseline/post-intervention totals.
export const HEDGEROWS_TOTAL_KEY = 'hedgerowsTotal'
export const WATERCOURSES_TOTAL_KEY = 'watercoursesTotal'

export const statusCodes = {
  ok: 200,
  noContent: 204,
  redirect: 302,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  imATeapot: 418,
  internalServerError: 500,
  badGateway: 502,
  gatewayTimeout: 504,
  serviceUnavailable: 503
}

export const MAX_FILE_SIZE_BYTES = 104857600 // 100 MB

export const HTTP_SUCCESS_MAX = 300
