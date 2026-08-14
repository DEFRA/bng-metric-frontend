import Boom from '@hapi/boom'

import { HTTP_SUCCESS_MAX, statusCodes } from '../common/constants.js'
import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { isBaselineOnlyProject } from '../common/helpers/project-state.js'
import { fetchProject } from '../common/services/projects.js'

const SIGNIFICANT_FIGURES = 15
const DECIMAL_PLACES = 2
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

function buildUnitSummary(label, baselineUnits, uploadHref) {
  const normalisedBaseline = normaliseUnits(baselineUnits)
  const hasBaselineUnits = normalisedBaseline > 0

  return {
    id: label.toLowerCase().replaceAll(' ', '-'),
    label,
    netPercentageChange: hasBaselineUnits ? '-100.00%' : 'N/A',
    status: hasBaselineUnits
      ? { text: 'Not met', classes: 'govuk-tag--red' }
      : null,
    tradingRules: { text: 'View trading rules' },
    baseline: {
      units: `${formatUnits(normalisedBaseline)} units`,
      action: { text: 'View on-site baseline' }
    },
    postIntervention: {
      units: '0.00 units',
      action: {
        text: 'Upload on-site post intervention file',
        href: uploadHref
      }
    },
    netUnitChange: `${formatUnits(-normalisedBaseline)} units`
  }
}

function buildProjectSummary(project, projectId) {
  const units = project?.baseline?.units
  const returnUrl = `/projects/${projectId}/project-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)

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
      buildUnitSummary('Area habitats', areaUnits(units), uploadHref),
      buildUnitSummary('Hedgerows', units?.hedgerowsTotal, uploadHref),
      buildUnitSummary('Watercourses', units?.watercoursesTotal, uploadHref)
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

    if (!isBaselineOnlyProject(project)) {
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

export { buildProjectSummary, formatUnits }
