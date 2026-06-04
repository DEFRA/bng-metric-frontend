import { fetchProject } from '../common/services/projects.js'
import {
  formatTotalAreaSize,
  formatTotalLengthSize,
  formatAreaHectares,
  formatLengthKm,
  formatHabitatUnits
} from '../common/helpers/format-habitat-values.js'

const NO_DATA_DISPLAY = 'No data'

function formatLinearUnits(features, total) {
  if (!features?.length) {
    return NO_DATA_DISPLAY
  }
  return formatHabitatUnits(total)
}

function buildHabitatRow(habitat, projectId) {
  return [
    {
      html: `<a class="govuk-link" href="/baseline-habitat-details?featureId=${habitat.featureId}&projectId=${projectId}">${habitat.ref}</a>`,
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

function buildHedgerowRow(hedgerow, projectId) {
  return [
    {
      html: `<a class="govuk-link" href="/baseline-habitat-details?featureId=${hedgerow.featureId}&projectId=${projectId}">${hedgerow.ref}</a>`,
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

function buildWatercoureRow(hedgerow, projectId) {
  return [
    {
      html: `<a class="govuk-link" href="/baseline-habitat-details?featureId=${hedgerow.featureId}&projectId=${projectId}">${hedgerow.ref}</a>`,
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

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProject(id)
    const projectName = project?.project?.name ?? 'Project'
    const baseline = project?.project?.baseline
    const habitatSizes = baseline?.habitatSizes
    const unitsTotals = baseline?.units

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
        baseline?.hedgerows,
        unitsTotals?.hedgerowsTotal
      ),
      watercourses: formatLinearUnits(
        baseline?.watercourses,
        unitsTotals?.watercoursesTotal
      )
    }

    const habitats = baseline?.habitats ?? null
    const habitatRows = habitats
      ? habitats.map((habitat) => buildHabitatRow(habitat, id))
      : null

    const hedgerows = baseline?.hedgerows ?? null
    const hedgerowRows = hedgerows
      ? hedgerows.map((hedgerow) => buildHedgerowRow(hedgerow, id))
      : null

    const watercourses = baseline?.watercourses ?? null
    const watercourseRows = watercourses?.length
      ? watercourses.map((watercourse) => buildWatercoureRow(watercourse, id))
      : null

    return h.view('baseline-habitat-list/baseline-habitat-list', {
      pageTitle: 'On-site baseline habitats',
      heading: 'On-site baseline habitats',
      caption: projectName,
      projectId: id,
      totalSizes,
      totalUnits,
      habitatRows,
      hedgerowRows,
      watercourseRows
    })
  }
}
