import { formatHabitatUnits } from './format-habitat-values.js'
import { HABITAT_UPLOAD_TYPES } from './habitat-upload-types.js'
import {
  FIXED_STRATEGIC_SIGNIFICANCE,
  TOTALS_LABEL,
  boldCell,
  buildHabitatGrid,
  buildRefCell,
  formatLabelAndScore,
  numericCell,
  textCell
} from './habitat-grid.js'

const BROAD_HABITAT_HEADER = 'Broad habitat'

const BROAD_HABITAT_COLUMN = {
  text: BROAD_HABITAT_HEADER,
  cell: (feature) => textCell(feature.broadType)
}

function buildColumns({ readSize, formatSize, formatSizeTotal, extraColumns }) {
  return [
    {
      text: 'Ref',
      cell: (feature, projectId) =>
        buildRefCell(
          feature,
          projectId,
          HABITAT_UPLOAD_TYPES.baseline.detailsRoute
        ),
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
        numericCell(formatSize(readSize(feature)), readSize(feature)),
      total: (totals) => boldCell(numericCell(formatSizeTotal(totals.size)))
    },
    ...extraColumns,
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
}

/**
 * Build the habitat-details grid (header, body rows and totals) for a baseline
 * page. Size display is supplied by the caller so area (ha) and linear (km)
 * pages can share the rest of the table.
 *
 * @param {object} options
 * @param {object[]} options.features
 * @param {string} options.projectId
 * @param {(feature: object) => number|null|undefined} options.readSize
 * @param {(value: number|null|undefined) => string} options.formatSize
 * @param {(value: number|null|undefined) => string} options.formatSizeTotal
 * @param {object[]} [options.extraColumns]
 */
function buildBaselineHabitatGrid({
  features,
  projectId,
  readSize,
  formatSize,
  formatSizeTotal,
  extraColumns = []
}) {
  return buildHabitatGrid({
    columns: buildColumns({
      readSize,
      formatSize,
      formatSizeTotal,
      extraColumns
    }),
    features,
    projectId,
    readSize
  })
}

export { BROAD_HABITAT_COLUMN, BROAD_HABITAT_HEADER, buildBaselineHabitatGrid }
