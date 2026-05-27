import { fetchProject } from '../common/services/projects.js'
import {
  formatTotalAreaSize,
  formatTotalLengthSize
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

    return h.view('habitat-list/habitat-list', {
      pageTitle: 'On-site baseline habitats',
      heading: 'On-site baseline habitats',
      caption: projectName,
      projectId: id,
      totalSizes
    })
  }
}
