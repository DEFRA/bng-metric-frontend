import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { hasBaselineData } from '../common/helpers/project-state.js'
import {
  AREA_BASELINE_PATH,
  AREA_HABITATS_TEXT,
  buildUnitTypeNavigation,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import { fetchProjectOrThrow } from '../common/helpers/fetch-project.js'
import {
  areaBaselineAction,
  areaInterventionSummary,
  areaUnits,
  buildUnitSummary,
  isFiniteNumber
} from '../common/helpers/unit-summary.js'
import {
  formatAreaHectares,
  formatHabitatUnits
} from '../common/helpers/format-habitat-values.js'
import { HABITAT_UPLOAD_TYPES } from '../common/helpers/habitat-upload-types.js'
import { DEFAULT_PROJECT_NAME } from '../common/constants.js'

const PAGE_HEADING = 'Baseline for area habitats'
const RESULTS_HEADING = 'Area habitats results'
const DETAILS_HEADING = 'Area habitat details'
// Strategic significance is fixed at Low (1) for MVS (BMD-315 AC9), matching the
// baseline and post-intervention details pages. The engine hardcodes the baseline
// multiplier to 1, so the uploaded category must not be shown against these units.
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'
const EMPTY_DISPLAY = ''
const REF_SORT_LOCALE = 'en'
// MoJ's SortableTable compares a non-numeric data-sort-value with a plain
// localeCompare, which would put 'P-10' before 'P-2'. Zero-padding each run of
// digits keeps a Ref click in the order the server rendered.
const SORT_KEY_DIGIT_WIDTH = 10
const TOTALS_LABEL = 'Total'
const BOLD_CELL_CLASS = 'govuk-!-font-weight-bold'

function featureRef(feature) {
  const ref = feature?.ref?.trim()
  return ref || feature?.featureId || EMPTY_DISPLAY
}

function compareFeatureRefs(left, right) {
  return featureRef(left).localeCompare(featureRef(right), REF_SORT_LOCALE, {
    numeric: true
  })
}

function refSortValue(reference) {
  return reference.replaceAll(/\d+/g, (digits) =>
    digits.padStart(SORT_KEY_DIGIT_WIDTH, '0')
  )
}

function habitatDetailsHref(featureId, projectId) {
  const params = new URLSearchParams({
    featureId,
    projectId
  })
  return `/${HABITAT_UPLOAD_TYPES.baseline.detailsRoute}?${params.toString()}`
}

function withScore(label, score) {
  return `${label} (${score})`
}

function formatLabelAndScore(label, score) {
  if (label == null || label === EMPTY_DISPLAY) {
    return EMPTY_DISPLAY
  }

  if (isFiniteNumber(score)) {
    return withScore(label, score)
  }

  return String(label)
}

function textCell(text) {
  return { text: text ?? EMPTY_DISPLAY }
}

function numericCell(text, sortValue) {
  const cell = { text, numeric: true }

  if (isFiniteNumber(sortValue)) {
    cell.attributes = { 'data-sort-value': sortValue }
  }

  return cell
}

function buildRefCell(feature, projectId) {
  const reference = featureRef(feature)
  const cell = {
    text: reference,
    attributes: { 'data-sort-value': refSortValue(reference) }
  }

  if (feature.featureId) {
    cell.href = habitatDetailsHref(feature.featureId, projectId)
  }

  return cell
}

function boldCell(cell) {
  return { ...cell, classes: BOLD_CELL_CLASS }
}

function sumFinite(features, readValue) {
  return features.reduce((total, feature) => {
    const value = readValue(feature)

    if (isFiniteNumber(value)) {
      return total + value
    }

    return total
  }, 0)
}

const COLUMNS = [
  {
    text: 'Ref',
    cell: buildRefCell,
    total: () => boldCell(textCell(TOTALS_LABEL))
  },
  {
    text: 'Units',
    numeric: true,
    cell: (feature) =>
      numericCell(formatHabitatUnits(feature.units), feature.units),
    total: (totals) => boldCell(numericCell(formatHabitatUnits(totals.units)))
  },
  {
    text: 'Size',
    numeric: true,
    cell: (feature) =>
      numericCell(
        formatAreaHectares(feature.sizeSquareMetres),
        feature.sizeSquareMetres
      ),
    total: (totals) =>
      boldCell(numericCell(formatAreaHectares(totals.sizeSquareMetres)))
  },
  {
    text: 'Broad habitat',
    cell: (feature) => textCell(feature.broadType)
  },
  {
    text: 'Habitat type',
    cell: (feature) => textCell(feature.type)
  },
  {
    text: 'Distinctiveness',
    cell: (feature) =>
      textCell(
        formatLabelAndScore(
          feature.distinctiveness,
          feature.distinctivenessScore
        )
      )
  },
  {
    text: 'Condition',
    cell: (feature) =>
      textCell(formatLabelAndScore(feature.condition, feature.conditionScore))
  },
  {
    text: 'Strategic significance',
    cell: () => textCell(FIXED_STRATEGIC_SIGNIFICANCE)
  }
]

function headerColumns() {
  return COLUMNS.map(({ text, numeric }) => ({ text, numeric }))
}

function buildHabitatRow(feature, projectId) {
  return COLUMNS.map((column) => column.cell(feature, projectId))
}

function buildTotalsRow(features) {
  const totals = {
    units: sumFinite(features, (feature) => feature.units),
    sizeSquareMetres: sumFinite(features, (feature) => feature.sizeSquareMetres)
  }

  return COLUMNS.map((column) => column.total?.(totals) ?? textCell())
}

function collectAreaFeatures(project) {
  const habitats = project?.baseline?.habitats ?? []
  const trees = project?.baseline?.trees ?? []
  return [...habitats, ...trees].sort(compareFeatureRefs)
}

function buildAreaBaseline(project, projectId) {
  const returnUrl = `/projects/${projectId}/area-baseline`
  const uploadHref = uploadFileHref(projectId, returnUrl)
  const features = collectAreaFeatures(project)
  const interventionSummary = project?.postIntervention
    ? areaInterventionSummary(project.postIntervention.units)
    : null

  return {
    projectName: project?.name ?? DEFAULT_PROJECT_NAME,
    heading: PAGE_HEADING,
    resultsHeading: RESULTS_HEADING,
    detailsHeading: DETAILS_HEADING,
    detailsRegionLabel: DETAILS_HEADING,
    uploadHref,
    navigationItems: buildUnitTypeNavigation(
      project,
      projectId,
      projectPageHref(projectId, AREA_BASELINE_PATH)
    ),
    unitSummary: buildUnitSummary({
      label: AREA_HABITATS_TEXT,
      baselineUnits: areaUnits(project?.baseline?.units),
      uploadHref,
      intervention: interventionSummary,
      baselineAction: areaBaselineAction()
    }),
    columns: headerColumns(),
    habitatRows: features.map((feature) => buildHabitatRow(feature, projectId)),
    totalsRow: buildTotalsRow(features)
  }
}

export const getController = {
  async handler(request, h) {
    const { id } = request.params
    const project = await fetchProjectOrThrow(request, id)

    if (!hasBaselineData(project)) {
      return h.redirect(`/add-project-details/${id}`)
    }

    const viewModel = buildAreaBaseline(project, id)

    return h.view('area-baseline/index', {
      pageTitle: PAGE_HEADING,
      ...viewModel
    })
  }
}

export { buildAreaBaseline }
