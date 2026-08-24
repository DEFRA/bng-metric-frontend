import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import { buildUnitTypeNavigation } from '../common/helpers/unit-type-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  NET_GAIN_TARGET_PERCENTAGE,
  areaUnits,
  buildUnitSummary,
  formatUnits
} from '../common/helpers/unit-summary.js'

const PERCENTAGE_DIVISOR = 100
const MIN_UNIT_DEFICIT = 0

function buildTargetsSummary(baselineAreaUnits, postInterventionAreaUnits) {
  const unitsRequired =
    baselineAreaUnits * (1 + NET_GAIN_TARGET_PERCENTAGE / PERCENTAGE_DIVISOR)
  const unitDeficit = Math.max(
    MIN_UNIT_DEFICIT,
    unitsRequired - postInterventionAreaUnits
  )

  return {
    targetPercentage: { text: `${NET_GAIN_TARGET_PERCENTAGE}%` },
    unitsRequired: `${formatUnits(unitsRequired)} units`,
    unitDeficit: `${formatUnits(unitDeficit)} units`
  }
}

function buildAreaSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = `/projects/${projectId}/area-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)

  const interventionSummary = project?.postIntervention
    ? {
        units: areaUnits(postInterventionUnits, null),
        netUnitChange: postInterventionUnits?.habitatsNetUnitChange,
        netPercentageChange:
          postInterventionUnits?.habitatsNetUnitChangePercentage
      }
    : null

  const baselineAreaUnits = areaUnits(baselineUnits)
  const postInterventionAreaUnits = areaUnits(postInterventionUnits)

  return {
    projectName: project?.name ?? 'Project',
    uploadHref,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      'Area habitats'
    ),
    unitSummary: buildUnitSummary(
      'Area habitats',
      baselineAreaUnits,
      uploadHref,
      interventionSummary
    ),
    targetsSummary: buildTargetsSummary(
      baselineAreaUnits,
      postInterventionAreaUnits
    )
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProjectOrThrow(request, id)

    if (!hasBaselineData(project)) {
      return h.redirect(`/add-project-details/${id}`)
    }

    const summary = buildAreaSummary(project, id)

    return h.view('area-summary/index', {
      pageTitle: 'Area habitats',
      heading: 'Area habitats',
      ...summary
    })
  }
}

export { buildAreaSummary }
