import Joi from 'joi'

// Where a baseline habitat's details page sends Back and Cancel when it was
// opened from "View baseline details" on a post-intervention details page.

const PI_DETAILS_PATH = '/post-intervention-habitat-details'

/**
 * The post-intervention details page `url` points at, rebuilt from its
 * featureId and projectId alone, or null when it is not one for this project.
 *
 * @param {URL} url
 * @param {string} projectId
 * @returns {string | null}
 */
function postInterventionDetailsHref(url, projectId) {
  const featureId = url.searchParams.get('featureId')
  if (
    url.pathname === PI_DETAILS_PATH &&
    url.searchParams.get('projectId') === projectId &&
    !Joi.string().uuid().required().validate(featureId).error
  ) {
    return `${PI_DETAILS_PATH}?${new URLSearchParams({
      featureId,
      projectId
    }).toString()}`
  }
  return null
}

/**
 * Where Back and Cancel go when the page was opened from "View baseline
 * details" on a post-intervention details page: the referrer, on GET.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} projectId
 * @returns {string | null}
 */
export function postInterventionBackHref(request, projectId) {
  try {
    const referer = new URL(request.headers.referer)
    return referer.host === request.headers.host
      ? postInterventionDetailsHref(referer, projectId)
      : null
  } catch {
    // Missing or malformed referrers use the baseline summary fallback.
    return null
  }
}

/**
 * The same origin carried through the form as `returnUrl`, on a POST, whose
 * referrer is the baseline page itself. Only a same-site path is taken.
 *
 * @param {unknown} returnUrl
 * @param {string} projectId
 * @returns {string | null}
 */
export function returnedPostInterventionHref(returnUrl, projectId) {
  if (
    typeof returnUrl !== 'string' ||
    !returnUrl.startsWith('/') ||
    returnUrl.startsWith('//')
  ) {
    return null
  }
  return postInterventionDetailsHref(
    new URL(returnUrl, 'http://localhost'),
    projectId
  )
}
