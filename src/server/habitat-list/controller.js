import { fetchProject } from '../common/services/projects.js'
import {
  formatTotalAreaSize,
  formatTotalLengthSize,
  formatAreaHectares
} from '../common/helpers/format-habitat-values.js'

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProject(id)
    const projectName = project?.project?.name ?? 'Project'
    const habitatSizes = project?.project?.baseline?.habitatSizes

    const totalSizes = {
      areaHabitats: formatTotalAreaSize(
        habitatSizes?.areaHabitats?.totalSquareMetres
      ),
      hedgerows: formatTotalLengthSize(habitatSizes?.hedgerows?.totalMetres),
      watercourses: formatTotalLengthSize(
        habitatSizes?.watercourses?.totalMetres
      )
    }

    const habitats = project?.project?.baseline?.habitats ?? null
    let habitatRows = null

    if (habitats) {
      habitatRows = habitats.map((habitat) => [
        {
          html: `<a class="govuk-link" href="/baseline-habitat-details/${habitat.featureId}">${habitat.ref}</a>`,
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
        { text: habitat.units },
        { text: habitat.status ?? '' }
      ])
    }

    return h.view('habitat-list/habitat-list', {
      pageTitle: 'On-site baseline habitats',
      heading: 'On-site baseline habitats',
      caption: projectName,
      projectId: id,
      totalSizes,
      habitatRows
    })
  }
}
