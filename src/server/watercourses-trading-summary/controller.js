import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import {
  WATERCOURSES_SUMMARY_PATH,
  WATERCOURSES_TRADING_SUMMARY_PATH,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  LOW,
  MEDIUM,
  buildBandStatusRows,
  buildLowSection,
  buildMediumSection,
  buildUnitChangeGrid,
  habitatsIn,
  unitChangeCell
} from '../common/helpers/trading-summary.js'
import { DEFAULT_PROJECT_NAME } from '../common/constants.js'

const PAGE_HEADING = 'Watercourses trading summary'
const MEDIUM_DEFICIT_LABEL = 'Remaining losses; like for like not satisfied'
const MEDIUM_COLUMNS = ['Habitat type', 'Unit change']
const LOW_COLUMNS = ['Habitat type', 'Unit change']

function habitatRow(habitat) {
  return [{ text: habitat.habitatType }, unitChangeCell(habitat.netUnitChange)]
}

/**
 * Saved watercourse trading-rules figures (BMD-995) plus the Met / Not met
 * statuses the backend derives from them. High and very high distinctiveness
 * are outside the MVS trading rules, so only Medium and Low are shown.
 *
 * Null when nothing was saved — a file uploaded before the figures were
 * calculated, or one whose calculation failed.
 */
function buildTradingSections(project) {
  const figures = project?.postIntervention?.tradingRules?.watercourses
  if (!figures) {
    return null
  }

  const statuses = project?.tradingRuleStatuses?.watercourses
  const habitats = figures.habitats ?? []
  const mediumHabitats = habitatsIn(habitats, MEDIUM)
  const lowHabitats = habitatsIn(habitats, LOW)
  const hasMedium = mediumHabitats.length > 0
  const hasLow = lowHabitats.length > 0

  return {
    statusRows: buildBandStatusRows(
      [
        { label: MEDIUM, key: 'medium', present: hasMedium },
        { label: LOW, key: 'low', present: hasLow }
      ],
      statuses
    ),
    medium: hasMedium
      ? buildMediumSection({
          deficit: figures.medium?.deficit,
          deficitLabel: MEDIUM_DEFICIT_LABEL,
          status: statuses?.medium,
          grids: [
            buildUnitChangeGrid({
              columns: MEDIUM_COLUMNS,
              rows: mediumHabitats.map(habitatRow)
            })
          ]
        })
      : null,
    low: hasLow
      ? buildLowSection({
          netUnitChange: figures.low?.netUnitChange,
          mediumSurplus: figures.medium?.surplus,
          cumulativeAvailability: figures.low?.cumulativeAvailability,
          columns: LOW_COLUMNS,
          rows: lowHabitats.map(habitatRow),
          showTotals: false
        })
      : null
  }
}

function buildWatercoursesTradingSummary(project, projectId) {
  const pageHref = projectPageHref(projectId, WATERCOURSES_TRADING_SUMMARY_PATH)

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    heading: PAGE_HEADING,
    uploadHref: uploadFileHref(projectId, pageHref),
    navigationItems: buildUnitTypeNavigation(project, projectId, pageHref),
    trading: buildTradingSections(project)
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProjectOrThrow(request, id)

    if (!hasBaselineData(project)) {
      return h.redirect(`/add-project-details/${id}`)
    }

    // Nothing has been delivered to trade against until a post-intervention
    // file is uploaded. Links onto this page are a separate story.
    if (!project.postIntervention) {
      return h.redirect(projectPageHref(id, WATERCOURSES_SUMMARY_PATH))
    }

    return h.view('watercourses-trading-summary/index', {
      pageTitle: PAGE_HEADING,
      ...buildWatercoursesTradingSummary(project, id)
    })
  }
}

export { buildWatercoursesTradingSummary }
