import Boom from '@hapi/boom'

import { HTTP_SUCCESS_MAX, statusCodes } from '../common/constants.js'
import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import {
  hasBaselineData,
  projectHasHabitatData
} from '../common/helpers/project-state.js'
import { fetchProject } from '../common/services/projects.js'

const SIGNIFICANT_FIGURES = 15
const DECIMAL_PLACES = 2
const NET_GAIN_TARGET_PERCENTAGE = 10
const NO_POST_INTERVENTION_PERCENTAGE = -100
const FETCH_PROJECT_ERROR = 'Failed to fetch project'

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function normaliseUnits(value) {
  return isFiniteNumber(value) ? value : 0
}

function formatUnits(value) {
  const normalised = normaliseUnits(value)
  const rounded = Number(normalised.toPrecision(SIGNIFICANT_FIGURES))
  const formatted = rounded.toFixed(DECIMAL_PLACES)
  return formatted === '-0.00' ? '0.00' : formatted
}

function formatOptionalUnits(value) {
  return isFiniteNumber(value) ? `${formatUnits(value)} units` : 'N/A'
}

function areaUnits(units, missingValue = 0) {
  const habitatsTotal = units?.habitatsTotal
  const treesTotal = units?.treesTotal

  if (!isFiniteNumber(habitatsTotal) && !isFiniteNumber(treesTotal)) {
    return missingValue
  }

  return normaliseUnits(habitatsTotal) + normaliseUnits(treesTotal)
}

function percentageSummary(value) {
  if (!isFiniteNumber(value)) {
    return { netPercentageChange: 'N/A', status: null }
  }

  const formattedPercentage = formatUnits(value)
  const targetMet = Number(formattedPercentage) >= NET_GAIN_TARGET_PERCENTAGE

  return {
    netPercentageChange: `${formattedPercentage}%`,
    status: {
      text: targetMet ? 'Met' : 'Not met',
      classes: targetMet ? 'govuk-tag--green' : 'govuk-tag--red'
    }
  }
}

function buildUnitSummary(label, baselineUnits, uploadHref, intervention) {
  const normalisedBaseline = normaliseUnits(baselineUnits)
  const hasIntervention = Boolean(intervention)
  let percentage =
    normalisedBaseline > 0 ? NO_POST_INTERVENTION_PERCENTAGE : null
  let netUnitChange = -normalisedBaseline

  if (hasIntervention) {
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
      heading: hasIntervention
        ? 'On-site post-intervention'
        : 'On-site post intervention',
      units: hasIntervention
        ? formatOptionalUnits(intervention.units)
        : '0.00 units',
      action: hasIntervention
        ? { text: 'View on-site post intervention' }
        : {
            text: 'Upload on-site post intervention file',
            href: uploadHref
          }
    },
    netUnitChange: hasIntervention
      ? formatOptionalUnits(netUnitChange)
      : `${formatUnits(netUnitChange)} units`
  }
}

function buildUnitTypeSummary(
  unitType,
  postInterventionUnits,
  uploadHref,
  hasPostIntervention
) {
  const intervention = hasPostIntervention
    ? unitType.buildIntervention(postInterventionUnits)
    : null

  return buildUnitSummary(
    unitType.label,
    unitType.baselineUnits,
    uploadHref,
    intervention
  )
}

function buildProjectSummary(project, projectId) {
  const baselineUnits = project?.baseline?.units
  const postInterventionUnits = project?.postIntervention?.units
  const returnUrl = `/projects/${projectId}/project-summary`
  const uploadHref = uploadFileHref(projectId, returnUrl)

  const unitTypes = [
    {
      visible: true,
      label: 'Area habitats',
      baselineUnits: areaUnits(baselineUnits),
      buildIntervention: (units) => ({
        units: areaUnits(units, null),
        netUnitChange: units?.habitatsNetUnitChange,
        netPercentageChange: units?.habitatsNetUnitChangePercentage
      })
    },
    {
      visible: projectHasHabitatData(project, 'hedgerows'),
      label: 'Hedgerows',
      baselineUnits: baselineUnits?.hedgerowsTotal,
      buildIntervention: (units) => ({
        units: units?.hedgerowsTotal,
        netUnitChange: units?.hedgerowsNetUnitChange,
        netPercentageChange: units?.hedgerowsNetUnitChangePercentage
      })
    },
    {
      visible: projectHasHabitatData(project, 'watercourses'),
      label: 'Watercourses',
      baselineUnits: baselineUnits?.watercoursesTotal,
      buildIntervention: (units) => ({
        units: units?.watercoursesTotal,
        netUnitChange: units?.watercoursesNetUnitChange,
        netPercentageChange: units?.watercoursesNetUnitChangePercentage
      })
    }
  ]
  const visibleUnitTypes = unitTypes.filter(({ visible }) => visible)

  return {
    projectName: project?.name ?? 'Project',
    uploadHref,
    navigationItems: [
      { text: 'Summary', current: true },
      ...visibleUnitTypes.map(({ label }) => ({
        text: label
      }))
    ],
    unitSummaries: visibleUnitTypes.map((unitType) =>
      buildUnitTypeSummary(
        unitType,
        postInterventionUnits,
        uploadHref,
        Boolean(project?.postIntervention)
      )
    )
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
