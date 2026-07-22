import { fetchProject } from '../services/projects.js'
import {
  formatTotalAreaSize,
  formatTotalLengthSize,
  formatAreaHectares,
  formatLengthKm,
  formatHabitatUnits,
  KM_UNIT
} from './format-habitat-values.js'
import { interventionDisplay } from '../../post-intervention-habitat-details/retention.js'

const NO_DATA_DISPLAY = 'No data'
const SQUARE_METRES_PER_HECTARE = 10000
const METRES_PER_KILOMETRE = 1000

/**
 * Resolve display fields for a baseline feature (reads top-level properties).
 *
 * @param {object} feature
 * @returns {{ type: string|null, distinctiveness: string|null, condition: string|null }}
 */
export function resolveBaselineDisplayFields(feature) {
  return {
    type: feature.type ?? null,
    distinctiveness: feature.distinctiveness ?? null,
    condition: feature.condition ?? null
  }
}

/**
 * Resolve display fields for a post-intervention feature (reads the `proposed`
 * sub-object).
 *
 * @param {object} feature
 * @returns {{ type: string|null, distinctiveness: string|null, condition: string|null }}
 */
export function resolveProposedDisplayFields(feature) {
  const src = feature.proposed ?? {}
  return {
    type: src.type ?? null,
    distinctiveness: src.distinctiveness ?? null,
    condition: src.condition ?? null
  }
}

function formatLinearUnits(features, total) {
  if (features?.length) {
    return formatHabitatUnits(total)
  }
  return NO_DATA_DISPLAY
}

function featureDetailsHref(uploadType, featureId, projectId) {
  const params = new URLSearchParams({
    featureId,
    projectId
  })
  return `/${uploadType.detailsRoute}?${params.toString()}`
}

function buildRefLinkCell(feature, projectId, uploadType) {
  return {
    html: `<a class="govuk-link" href="${featureDetailsHref(uploadType, feature.featureId, projectId)}">${feature.ref}</a>`,
    attributes: {
      'data-sort-value': feature.ref
    }
  }
}

function buildFeatureRow(feature, projectId, uploadType, sizeCell) {
  const display = uploadType.isPostIntervention
    ? resolveProposedDisplayFields(feature)
    : resolveBaselineDisplayFields(feature)
  return [
    buildRefLinkCell(feature, projectId, uploadType),
    // Post-intervention habitats carry a persisted intervention type (Created,
    // Retained or Enhanced) shown between "Ref" and "Habitat type"; baseline
    // habitats have no such column.
    ...(uploadType.isPostIntervention
      ? [{ text: interventionDisplay(feature.retentionCategory) }]
      : []),
    { text: display.type ?? '' },
    sizeCell,
    { text: display.distinctiveness ?? '' },
    { text: display.condition ?? '' },
    { text: formatHabitatUnits(feature.units) },
    { text: feature.status ?? '' }
  ]
}

function buildLinearSizeCell(sizeMetres) {
  return {
    text: formatLengthKm(sizeMetres) + KM_UNIT,
    attributes: {
      'data-sort-value': sizeMetres
    }
  }
}

function buildHabitatRow(habitat, projectId, uploadType) {
  return buildFeatureRow(habitat, projectId, uploadType, {
    text: formatAreaHectares(habitat.sizeSquareMetres),
    attributes: {
      'data-sort-value': habitat.sizeSquareMetres
    }
  })
}

function buildLinearFeatureRow(feature, projectId, uploadType) {
  return buildFeatureRow(
    feature,
    projectId,
    uploadType,
    buildLinearSizeCell(feature.sizeMetres)
  )
}

/**
 * Map a feature list to table rows, or null when there are none (the template
 * shows an empty-state message for null).
 */
function mapRowsOrNull(features, projectId, uploadType, buildRow) {
  if (!features?.length) {
    return null
  }
  return features.map((feature) => buildRow(feature, projectId, uploadType))
}

function buildTotalSizes(habitatSizes) {
  return {
    // "Site" is parcels only (excludes special habitats); "Area habitats" is the
    // total area size (parcels + individual trees).
    site: formatTotalAreaSize(habitatSizes?.site?.totalSquareMetres),
    areaHabitats: formatTotalAreaSize(
      habitatSizes?.areaHabitats?.totalSquareMetres
    ),
    hedgerows: formatTotalLengthSize(habitatSizes?.hedgerows?.totalMetres),
    watercourses: formatTotalLengthSize(habitatSizes?.watercourses?.totalMetres)
  }
}

function buildTotalUnits(habitatsData) {
  const unitsTotals = habitatsData?.units
  // Individual tree units are included in the area-habitats total — the Areas
  // tab lists parcels and trees together (summary row and table footer span
  // both). Stay null when neither total is present so formatHabitatUnits keeps
  // showing an empty "not yet calculated" cell rather than a misleading "0.00".
  const habitatsTotal = unitsTotals?.habitatsTotal
  const treesTotal = unitsTotals?.treesTotal
  const areaHabitatsUnitsTotal =
    habitatsTotal == null && treesTotal == null
      ? null
      : (habitatsTotal ?? 0) + (treesTotal ?? 0)
  return {
    areaHabitats: formatHabitatUnits(areaHabitatsUnitsTotal),
    hedgerows: formatLinearUnits(
      habitatsData?.hedgerows,
      unitsTotals?.hedgerowsTotal
    ),
    watercourses: formatLinearUnits(
      habitatsData?.watercourses,
      unitsTotals?.watercoursesTotal
    )
  }
}

function areaUnitsTotal(units) {
  if (units?.habitatsTotal == null && units?.treesTotal == null) {
    return null
  }
  return (units?.habitatsTotal ?? 0) + (units?.treesTotal ?? 0)
}

function formatPercentage(value) {
  const formatted = formatHabitatUnits(value)
  return formatted ? `${formatted}%` : ''
}

function formatSummaryAreaSize(squareMetres) {
  if (typeof squareMetres !== 'number' || !Number.isFinite(squareMetres)) {
    return ''
  }
  return `${(squareMetres / SQUARE_METRES_PER_HECTARE).toFixed(2)}ha`
}

function formatSummaryLengthSize(metres) {
  if (typeof metres !== 'number' || !Number.isFinite(metres) || metres === 0) {
    return NO_DATA_DISPLAY
  }
  return `${(metres / METRES_PER_KILOMETRE).toFixed(2)}km`
}

function buildPostInterventionSummary(project) {
  const baselineUnits = project?.baseline?.units
  const postIntervention = project?.postIntervention
  const postInterventionUnits = postIntervention?.units
  const habitatSizes = postIntervention?.habitatSizes

  return {
    areaHabitats: {
      size: formatSummaryAreaSize(
        habitatSizes?.areaHabitats?.totalSquareMetres
      ),
      baselineUnits: formatHabitatUnits(areaUnitsTotal(baselineUnits)),
      postInterventionUnits: formatHabitatUnits(
        areaUnitsTotal(postInterventionUnits)
      ),
      netUnitChange: formatHabitatUnits(
        postInterventionUnits?.habitatsNetUnitChange
      ),
      netPercentageChange: formatPercentage(
        postInterventionUnits?.habitatsNetUnitChangePercentage
      )
    },
    hedgerows: {
      size: formatSummaryLengthSize(habitatSizes?.hedgerows?.totalMetres),
      baselineUnits: formatHabitatUnits(baselineUnits?.hedgerowsTotal),
      postInterventionUnits: formatHabitatUnits(
        postInterventionUnits?.hedgerowsTotal
      ),
      netUnitChange: formatHabitatUnits(
        postInterventionUnits?.hedgerowsNetUnitChange
      ),
      netPercentageChange: formatPercentage(
        postInterventionUnits?.hedgerowsNetUnitChangePercentage
      )
    },
    watercourses: {
      size: formatSummaryLengthSize(habitatSizes?.watercourses?.totalMetres),
      baselineUnits: formatHabitatUnits(baselineUnits?.watercoursesTotal),
      postInterventionUnits: formatHabitatUnits(
        postInterventionUnits?.watercoursesTotal
      ),
      netUnitChange: formatHabitatUnits(
        postInterventionUnits?.watercoursesNetUnitChange
      ),
      netPercentageChange: formatPercentage(
        postInterventionUnits?.watercoursesNetUnitChangePercentage
      )
    }
  }
}

function createHabitatListController(uploadType) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const project = await fetchProject(request, id)
      const projectData = project?.payload?.project
      const projectName = projectData?.name ?? 'Project'
      const habitatsData = projectData?.[uploadType.projectKey]

      // Trees are listed as their own rows in the Areas tab, treated the same as
      // any other area habitat (one row per tree).
      const areaFeatures = [
        ...(habitatsData?.habitats ?? []),
        ...(habitatsData?.trees ?? [])
      ]
      return h.view(uploadType.listView, {
        pageTitle: uploadType.pageHeading,
        heading: uploadType.pageHeading,
        caption: projectName,
        projectId: id,
        backHref: `/add-project-details/${id}`,
        uploadDifferentHref: `/projects/${id}/${uploadType.uploadRoute}`,
        isPostIntervention: uploadType.isPostIntervention,
        totalSizes: buildTotalSizes(habitatsData?.habitatSizes),
        totalUnits: buildTotalUnits(habitatsData),
        postInterventionSummary: uploadType.isPostIntervention
          ? buildPostInterventionSummary(projectData)
          : null,
        habitatRows: mapRowsOrNull(
          areaFeatures,
          id,
          uploadType,
          buildHabitatRow
        ),
        hedgerowRows: mapRowsOrNull(
          habitatsData?.hedgerows,
          id,
          uploadType,
          buildLinearFeatureRow
        ),
        watercourseRows: mapRowsOrNull(
          habitatsData?.watercourses,
          id,
          uploadType,
          buildLinearFeatureRow
        )
      })
    }
  }
}

export { createHabitatListController }
