import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import {
  AREA_SUMMARY_PATH,
  AREA_TRADING_SUMMARY_PATH,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import { formatUnits } from '../common/helpers/unit-summary.js'
import { tradingRulesStatusTag } from '../common/helpers/trading-rules-status.js'
import { DEFAULT_PROJECT_NAME } from '../common/constants.js'

const PAGE_HEADING = 'Area habitats trading summary'

const MEDIUM = 'Medium'
const LOW = 'Low'

// The backend cumulates the Medium habitats of both intertidal broad habitats
// under this one key, because the trading rules treat them as one broad
// habitat. The page shows that group in its own grid, with each habitat's own
// broad habitat beside it.
const MERGED_INTERTIDAL_BROAD_HABITAT =
  'Intertidal sediment and hard structures'
const INTERTIDAL_HEADING = 'Intertidal sediment and Intertidal hard structures'

const HABITAT_TYPE_SEPARATOR = ' - '

function unitsText(value) {
  return `${formatUnits(value)} units`
}

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

function unitChangeCell(value, { bold = false } = {}) {
  return {
    text: formatUnits(value),
    numeric: true,
    classes: bold ? 'govuk-!-font-weight-bold' : undefined
  }
}

function totalLabelCell(text) {
  return { text, classes: 'govuk-!-font-weight-bold' }
}

function habitatsIn(habitatTypes, distinctiveness) {
  return habitatTypes.filter(
    (habitat) => habitat.distinctiveness === distinctiveness
  )
}

function statusRow(text, status) {
  return { text, status: tradingRulesStatusTag(status) }
}

function buildStatusRows(hasMedium, hasLow, statuses) {
  const rows = []

  if (hasMedium) {
    rows.push(statusRow(MEDIUM, statuses?.medium))
  }
  if (hasLow) {
    rows.push(statusRow(LOW, statuses?.low))
  }

  return rows
}

function habitatsCumulatedUnder(broadHabitat, mediumHabitats) {
  return mediumHabitats.filter(
    (habitat) => habitat.tradingBroadHabitat === broadHabitat.broadHabitat
  )
}

function buildBroadHabitatGrid(broadHabitat, mediumHabitats) {
  return {
    heading: broadHabitat.broadHabitat,
    rows: habitatsCumulatedUnder(broadHabitat, mediumHabitats).map(
      (habitat) => [
        { text: habitatTypeText(habitat) },
        unitChangeCell(habitat.netUnitChange)
      ]
    ),
    totalsRow: [
      totalLabelCell('Total broad habitat change'),
      unitChangeCell(broadHabitat.netUnitChange, { bold: true })
    ]
  }
}

function buildIntertidalGrid(broadHabitat, mediumHabitats) {
  return {
    heading: INTERTIDAL_HEADING,
    rows: habitatsCumulatedUnder(broadHabitat, mediumHabitats).map(
      (habitat) => [
        { text: habitat.broadHabitat },
        { text: habitatTypeText(habitat) },
        unitChangeCell(habitat.netUnitChange)
      ]
    ),
    totalsRow: [
      totalLabelCell('Total broad habitat change'),
      { text: '' },
      unitChangeCell(broadHabitat.netUnitChange, { bold: true })
    ]
  }
}

function buildMediumSection(figures, mediumHabitats, status) {
  const broadHabitats = figures.medium?.broadHabitats ?? []
  const intertidal = broadHabitats.find(
    (entry) => entry.broadHabitat === MERGED_INTERTIDAL_BROAD_HABITAT
  )

  return {
    deficit: unitsText(figures.medium?.deficit),
    status: tradingRulesStatusTag(status),
    broadHabitatGrids: broadHabitats
      .filter((entry) => entry !== intertidal)
      .map((entry) => buildBroadHabitatGrid(entry, mediumHabitats)),
    intertidalGrid: intertidal
      ? buildIntertidalGrid(intertidal, mediumHabitats)
      : null
  }
}

function buildLowSection(figures, lowHabitats) {
  return {
    netUnitChange: unitsText(figures.low?.netUnitChange),
    mediumSurplus: unitsText(figures.medium?.surplus),
    cumulativeSurplus: unitsText(figures.low?.cumulativeAvailability),
    grid: {
      rows: lowHabitats.map((habitat) => [
        { text: habitat.broadHabitat },
        { text: habitatTypeText(habitat) },
        unitChangeCell(habitat.netUnitChange)
      ]),
      totalsRow: [
        totalLabelCell('Total on-site unit change'),
        { text: '' },
        unitChangeCell(figures.low?.netUnitChange, { bold: true })
      ]
    }
  }
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
    statusRows: buildStatusRows(hasMedium, hasLow, statuses),
    medium: hasMedium
      ? buildMediumSection(figures, mediumHabitats, statuses?.medium)
      : null,
    low: hasLow ? buildLowSection(figures, lowHabitats) : null
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
