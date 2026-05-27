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
      habitatRows = habitats.map((h) => [
        {
          html: `<a class="govuk-link" href="/baseline-habitat-details/${h.featureId}">${h.ref}</a>`
        },
        { text: h.type ?? '' },
        {
          text: formatAreaHectares(h.sizeSquareMetres),
          attributes: {
            'data-sort-value': h.sizeSquareMetres
          }
        },
        { text: h.distinctiveness ?? '' },
        { text: h.condition ?? '' },
        { text: h.units },
        { text: h.status ?? 'Complete' }
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
