import { isSafeRelativePath } from '../common/helpers/upload-file-navigation.js'
import { habitatDetailsDestination } from '../common/helpers/habitat-details-destination.js'

export function postInterventionBackHref(projectId, type, returnUrl) {
  const destination = habitatDetailsDestination(
    projectId,
    type,
    'postIntervention'
  )
  return isSafeRelativePath(returnUrl) &&
    (returnUrl === destination || returnUrl.startsWith(`${destination}#`))
    ? returnUrl
    : destination
}
