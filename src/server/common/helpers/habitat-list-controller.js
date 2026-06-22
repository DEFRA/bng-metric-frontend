import { fetchProject } from '../services/projects.js'
import {
  formatTotalAreaSize,
  formatTotalLengthSize,
  formatAreaHectares,
  formatLengthKm,
  formatHabitatUnits,
  KM_UNIT
} from './format-habitat-values.js'

const NO_DATA_DISPLAY = 'No data'

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

function createHabitatListController(uploadType) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const project = await fetchProject(request, id)
      const projectName = project?.project?.name ?? 'Project'
      const habitatsData = project?.project?.[uploadType.projectKey]
      const habitatSizes = habitatsData?.habitatSizes
      const unitsTotals = habitatsData?.units

      // Individual trees are a special area habitat: their notional areas are
      // excluded from the "Area habitats" size (which feeds the future total
      // area vs red line boundary check) but included in the overall "Site"
      // size, so Site ≥ Area habitats whenever trees are present.
      const areaTabUnitsTotal =
        (unitsTotals?.habitatsTotal ?? 0) + (unitsTotals?.treesTotal ?? 0)

      const totalSizes = {
        site: formatTotalAreaSize(habitatSizes?.site?.totalSquareMetres),
        areaHabitats: formatTotalAreaSize(
          habitatSizes?.areaHabitats?.totalSquareMetres
        ),
        hedgerows: formatTotalLengthSize(habitatSizes?.hedgerows?.totalMetres),
        watercourses: formatTotalLengthSize(
          habitatSizes?.watercourses?.totalMetres
        )
      }

      const totalUnits = {
        areaHabitats: formatHabitatUnits(unitsTotals?.habitatsTotal),
        // The Areas tab table lists parcels and trees together, so its footer
        // total spans both.
        areaTab: formatHabitatUnits(areaTabUnitsTotal),
        hedgerows: formatLinearUnits(
          habitatsData?.hedgerows,
          unitsTotals?.hedgerowsTotal
        ),
        watercourses: formatLinearUnits(
          habitatsData?.watercourses,
          unitsTotals?.watercoursesTotal
        )
      }

      // Trees are listed as their own rows in the Areas tab, treated the same
      // as any other area habitat (one row per tree).
      const areaFeatures = [
        ...(habitatsData?.habitats ?? []),
        ...(habitatsData?.trees ?? [])
      ]
      const habitatRows = areaFeatures.length
        ? areaFeatures.map((habitat) =>
            buildHabitatRow(habitat, id, uploadType)
          )
        : null

      const hedgerows = habitatsData?.hedgerows ?? null
      const hedgerowRows = hedgerows?.length
        ? hedgerows.map((hedgerow) =>
            buildLinearFeatureRow(hedgerow, id, uploadType)
          )
        : null

      const watercourses = habitatsData?.watercourses ?? null
      const watercourseRows = watercourses?.length
        ? watercourses.map((watercourse) =>
            buildLinearFeatureRow(watercourse, id, uploadType)
          )
        : null

      return h.view(uploadType.listView, {
        pageTitle: uploadType.pageHeading,
        heading: uploadType.pageHeading,
        caption: projectName,
        projectId: id,
        backHref: `/add-project-details/${id}`,
        uploadDifferentHref: `/projects/${id}/${uploadType.uploadRoute}`,
        isPostIntervention: uploadType.isPostIntervention,
        totalSizes,
        totalUnits,
        habitatRows,
        hedgerowRows,
        watercourseRows
      })
    }
  }
}

export { createHabitatListController }
