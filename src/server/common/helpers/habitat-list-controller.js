import { fetchProject } from '../services/projects.js'
import {
  formatTotalAreaSize,
  formatTotalLengthSize,
  formatAreaHectares,
  formatLengthKm,
  formatHabitatUnits
} from './format-habitat-values.js'

const NO_DATA_DISPLAY = 'No data'

function formatLinearUnits(features, total) {
  if (!features?.length) {
    return NO_DATA_DISPLAY
  }
  return formatHabitatUnits(total)
}

function featureDetailsHref(uploadType, featureId, projectId) {
  const params = new URLSearchParams({
    featureId,
    projectId
  })
  return `/${uploadType.detailsRoute}?${params.toString()}`
}

function buildHabitatRow(habitat, projectId, uploadType) {
  return [
    {
      html: `<a class="govuk-link" href="${featureDetailsHref(uploadType, habitat.featureId, projectId)}">${habitat.ref}</a>`,
      attributes: {
        'data-sort-value': habitat.ref
      }
    },
    { text: habitat.type ?? '' },
    {
      text: formatAreaHectares(habitat.sizeSquareMetres),
      attributes: {
        'data-sort-value': habitat.sizeSquareMetres
      }
    },
    { text: habitat.distinctiveness ?? '' },
    { text: habitat.condition ?? '' },
    { text: formatHabitatUnits(habitat.units) },
    { text: habitat.status ?? '' }
  ]
}

function buildHedgerowRow(hedgerow, projectId, uploadType) {
  return [
    {
      html: `<a class="govuk-link" href="${featureDetailsHref(uploadType, hedgerow.featureId, projectId)}">${hedgerow.ref}</a>`,
      attributes: {
        'data-sort-value': hedgerow.ref
      }
    },
    { text: hedgerow.type ?? '' },
    {
      text: formatLengthKm(hedgerow.sizeMetres),
      attributes: {
        'data-sort-value': hedgerow.sizeMetres
      }
    },
    { text: hedgerow.distinctiveness ?? '' },
    { text: hedgerow.condition ?? '' },
    { text: formatHabitatUnits(hedgerow.units) },
    { text: hedgerow.status ?? '' }
  ]
}

function createHabitatListController(uploadType) {
  return {
    async handler(request, h) {
      const { id } = request.params
      const project = await fetchProject(id)
      const projectName = project?.project?.name ?? 'Project'
      const habitatsData = project?.project?.[uploadType.projectKey]
      const habitatSizes = habitatsData?.habitatSizes
      const unitsTotals = habitatsData?.units

      const totalSizes = {
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
        hedgerows: formatLinearUnits(
          habitatsData?.hedgerows,
          unitsTotals?.hedgerowsTotal
        ),
        watercourses: formatLinearUnits(
          habitatsData?.watercourses,
          unitsTotals?.watercoursesTotal
        )
      }

      const habitats = habitatsData?.habitats ?? null
      const habitatRows = habitats
        ? habitats.map((habitat) => buildHabitatRow(habitat, id, uploadType))
        : null

      const hedgerows = habitatsData?.hedgerows ?? null
      const hedgerowRows = hedgerows
        ? hedgerows.map((hedgerow) =>
            buildHedgerowRow(hedgerow, id, uploadType)
          )
        : null

      return h.view('habitat-list/habitat-list', {
        pageTitle: uploadType.pageHeading,
        heading: uploadType.pageHeading,
        caption: projectName,
        projectId: id,
        backHref: `/add-project-details/${id}`,
        uploadDifferentHref: `/projects/${id}/${uploadType.uploadRoute}`,
        totalSizes,
        totalUnits,
        habitatRows,
        hedgerowRows
      })
    }
  }
}

export { createHabitatListController }
