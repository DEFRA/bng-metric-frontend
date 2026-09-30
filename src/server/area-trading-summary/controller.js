import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import {
  AREA_SUMMARY_PATH,
  AREA_TRADING_SUMMARY_PATH,
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

const PAGE_HEADING = 'Area habitats trading summary'
const MEDIUM_DEFICIT_LABEL =
  'Medium distinctiveness unit deficit required to meet trading rules'

// The backend cumulates the Medium habitats of both intertidal broad habitats
// under this one key, because the trading rules treat them as one broad
// habitat. The page shows that group in its own grid, with each habitat's own
// broad habitat beside it.
const MERGED_INTERTIDAL_BROAD_HABITAT =
  'Intertidal sediment and hard structures'
const INTERTIDAL_HEADING = 'Intertidal sediment and Intertidal hard structures'

const HABITAT_TYPE_SEPARATOR = ' - '

/**
 * The habitat type without its broad habitat. The engine keys habitats as
 * "{Broad habitat} - {Habitat type}", and every grid on this page already shows
 * the broad habitat, as a heading or a column of its own.
 */
function habitatTypeText({ habitatType, broadHabitat }) {
  const prefix = `${broadHabitat}${HABITAT_TYPE_SEPARATOR}`
  return habitatType.startsWith(prefix)
    ? habitatType.slice(prefix.length)
    : habitatType
}

function habitatRow(habitat, { includeBroadHabitat = false } = {}) {
  const cells = []

  if (includeBroadHabitat) {
    cells.push({ text: habitat.broadHabitat })
  }

  cells.push(
    { text: habitatTypeText(habitat) },
    unitChangeCell(habitat.netUnitChange)
  )
  return cells
}

function habitatsCumulatedUnder(broadHabitat, mediumHabitats) {
  return mediumHabitats.filter(
    (habitat) => habitat.tradingBroadHabitat === broadHabitat.broadHabitat
  )
}

const BROAD_HABITAT_COLUMNS = ['Habitat type', 'Unit change']
const BROAD_AND_TYPE_COLUMNS = [
  'Broad habitat',
  'Habitat type',
  'On-site unit change'
]
const TOTAL_BROAD_HABITAT_CHANGE = 'Total broad habitat change'

function buildBroadHabitatGrid(broadHabitat, mediumHabitats) {
  return buildUnitChangeGrid({
    heading: broadHabitat.broadHabitat,
    columns: BROAD_HABITAT_COLUMNS,
    rows: habitatsCumulatedUnder(broadHabitat, mediumHabitats).map((habitat) =>
      habitatRow(habitat)
    ),
    totalsLabel: TOTAL_BROAD_HABITAT_CHANGE,
    totalsValue: broadHabitat.netUnitChange
  })
}

function buildIntertidalGrid(broadHabitat, mediumHabitats) {
  return buildUnitChangeGrid({
    heading: INTERTIDAL_HEADING,
    columns: BROAD_AND_TYPE_COLUMNS,
    rows: habitatsCumulatedUnder(broadHabitat, mediumHabitats).map((habitat) =>
      habitatRow(habitat, { includeBroadHabitat: true })
    ),
    totalsLabel: TOTAL_BROAD_HABITAT_CHANGE,
    totalsValue: broadHabitat.netUnitChange
  })
}

function mediumGrids(figures, mediumHabitats) {
  const broadHabitats = figures.medium?.broadHabitats ?? []
  const intertidal = broadHabitats.find(
    (entry) => entry.broadHabitat === MERGED_INTERTIDAL_BROAD_HABITAT
  )
  const grids = broadHabitats
    .filter((entry) => entry !== intertidal)
    .map((entry) => buildBroadHabitatGrid(entry, mediumHabitats))

  if (intertidal) {
    grids.push(buildIntertidalGrid(intertidal, mediumHabitats))
  }

  return grids
}

/**
 * The page's view of the trading-rules figures saved with the post-intervention
 * upload. Null when there are none to show — a file uploaded before the figures
 * were calculated, or one whose calculation failed.
 */
function buildTradingSections(project) {
  const figures = project?.postIntervention?.tradingRules?.areaHabitats
  if (!figures) {
    return null
  }

  const statuses = project?.tradingRuleStatuses?.areaHabitats
  const habitatTypes = figures.habitatTypes ?? []
  const mediumHabitats = habitatsIn(habitatTypes, MEDIUM)
  const lowHabitats = habitatsIn(habitatTypes, LOW)
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
          grids: mediumGrids(figures, mediumHabitats)
        })
      : null,
    low: hasLow
      ? buildLowSection({
          netUnitChange: figures.low?.netUnitChange,
          mediumSurplus: figures.medium?.surplus,
          cumulativeAvailability: figures.low?.cumulativeAvailability,
          columns: BROAD_AND_TYPE_COLUMNS,
          rows: lowHabitats.map((habitat) =>
            habitatRow(habitat, { includeBroadHabitat: true })
          )
        })
      : null
  }
}

function buildAreaTradingSummary(project, projectId) {
  const pageHref = projectPageHref(projectId, AREA_TRADING_SUMMARY_PATH)

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
    // file is uploaded, and the page is not linked to before then.
    if (!project.postIntervention) {
      return h.redirect(projectPageHref(id, AREA_SUMMARY_PATH))
    }

    return h.view('area-trading-summary/index', {
      pageTitle: PAGE_HEADING,
      ...buildAreaTradingSummary(project, id)
    })
  }
}

export { buildAreaTradingSummary }
