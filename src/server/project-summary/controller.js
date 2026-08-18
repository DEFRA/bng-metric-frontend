import Boom from '@hapi/boom'

import { HTTP_SUCCESS_MAX, statusCodes } from '../common/constants.js'
import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import { fetchProject } from '../common/services/projects.js'

const SIGNIFICANT_FIGURES = 15
const DECIMAL_PLACES = 2
const NET_GAIN_TARGET_PERCENTAGE = 10
const FETCH_PROJECT_ERROR = 'Failed to fetch project'

function normaliseUnits(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatUnits(value) {
  const normalised = normaliseUnits(value)
  const rounded = Number(normalised.toPrecision(SIGNIFICANT_FIGURES))
  return (rounded === 0 ? 0 : rounded).toFixed(DECIMAL_PLACES)
}

function areaUnits(units) {
  return (
    normaliseUnits(units?.habitatsTotal) + normaliseUnits(units?.treesTotal)
  )
}

function percentageSummary(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { netPercentageChange: 'N/A', status: null }
  }

  const targetMet = value >= NET_GAIN_TARGET_PERCENTAGE

  return {
    netPercentageChange: `${formatUnits(value)}%`,
    status: {
      text: targetMet ? 'Met' : 'Not met',
      classes: targetMet ? 'govuk-tag--green' : 'govuk-tag--red'
    }
  }
}

function buildUnitSummary(label, baselineUnits, uploadHref, intervention) {
  const normalisedBaseline = normaliseUnits(baselineUnits)
  let percentage = normalisedBaseline > 0 ? -100 : null
  let netUnitChange = -normalisedBaseline

  if (intervention) {
    percentage = intervention.netPercentageChange
    netUnitChange = intervention.netUnitChange
  }

  return {
    id: label.toLowerCase().replaceAll(' ', '-'),
    label,
    ...percentageSummary(percentage),
    tradingRules: { text: 'View trading rules' },
    baseline: {
      units: `${formatUnits(normalisedBaseline)} units`,
      action: { text: 'View on-site baseline' }
    },
    postIntervention: {
      heading: intervention
        ? 'On-site post-intervention'
        : 'On-site post intervention',
      units: `${formatUnits(intervention?.units)} units`,
      action: intervention
        ? { text: 'View on-site post intervention' }
        : {
            text: 'Upload on-site post intervention file',
            href: uploadHref
          }
    },
    netUnitChange: `${formatUnits(netUnitChange)} units`
  }
}

function buildProjectSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = `/projects/${projectId}/project-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)

  const interventionSummary = project?.postIntervention
    ? {
        areaHabitats: {
          units: areaUnits(postInterventionUnits),
          netUnitChange: postInterventionUnits?.habitatsNetUnitChange,
          netPercentageChange:
            postInterventionUnits?.habitatsNetUnitChangePercentage
        },
        hedgerows: {
          units: postInterventionUnits?.hedgerowsTotal,
          netUnitChange: postInterventionUnits?.hedgerowsNetUnitChange,
          netPercentageChange:
            postInterventionUnits?.hedgerowsNetUnitChangePercentage
        },
        watercourses: {
          units: postInterventionUnits?.watercoursesTotal,
          netUnitChange: postInterventionUnits?.watercoursesNetUnitChange,
          netPercentageChange:
            postInterventionUnits?.watercoursesNetUnitChangePercentage
        }
      }
    : null

  return {
    projectName: project?.name ?? 'Project',
    uploadHref,
    navigationItems: [
      { text: 'Summary', current: true },
      { text: 'Area Habitats' },
      { text: 'Hedgerows' },
      { text: 'Watercourses' }
    ],
    unitSummaries: [
      buildUnitSummary(
        'Area habitats',
        areaUnits(baselineUnits),
        uploadHref,
        interventionSummary?.areaHabitats
      ),
      buildUnitSummary(
        'Hedgerows',
        baselineUnits?.hedgerowsTotal,
        uploadHref,
        interventionSummary?.hedgerows
      ),
      buildUnitSummary(
        'Watercourses',
        baselineUnits?.watercoursesTotal,
        uploadHref,
        interventionSummary?.watercourses
      )
    ]
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const result = await fetchProject(request, id)

    if (!result) {
      throw Boom.badGateway(FETCH_PROJECT_ERROR)
    }
    if (result.statusCode === statusCodes.notFound) {
      throw Boom.notFound('Project not found')
    }
    if (
      result.statusCode < statusCodes.ok ||
      result.statusCode >= HTTP_SUCCESS_MAX
    ) {
      throw Boom.badGateway(FETCH_PROJECT_ERROR)
    }

    const project = result.payload?.project

    if (!hasBaselineData(project)) {
      return h.redirect(`/add-project-details/${id}`)
    }

    const summary = buildProjectSummary(project, id)

    return h.view('project-summary/index', {
      pageTitle: 'Summary',
      heading: 'Summary',
      ...summary
    })
  }
}

export { buildProjectSummary, formatUnits, percentageSummary }
