import { SortableTable } from '@ministryofjustice/frontend'

import {
  REF_COLUMN_INDEX,
  SORT_TIES_BY_REF_ATTRIBUTE
} from '../../shared/habitat-details-sort.js'

function compareValues(left, right) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }
  return left.toString().localeCompare(right.toString())
}

/**
 * MoJ's sortable table, except that a column whose heading carries
 * SORT_TIES_BY_REF_ATTRIBUTE keeps tied rows in ascending Ref order in both
 * directions. MoJ alone reverses its comparison for a descending sort, so a
 * tie would keep whatever order the last sort left it in.
 */
export class HabitatDetailsSortableTable extends SortableTable {
  sort($rows, columnNumber, sortDirection) {
    const $heading = this.$headings[columnNumber]
    if (!$heading?.hasAttribute(SORT_TIES_BY_REF_ATTRIBUTE)) {
      return super.sort($rows, columnNumber, sortDirection)
    }

    const valueAt = ($row, index) => {
      const $cell = $row.querySelectorAll('td, th')[index]
      return $cell ? this.getCellValue($cell) : ''
    }
    const direction = sortDirection === 'ascending' ? 1 : -1

    return $rows.sort(
      ($rowA, $rowB) =>
        direction *
          compareValues(
            valueAt($rowA, columnNumber),
            valueAt($rowB, columnNumber)
          ) ||
        compareValues(
          valueAt($rowA, REF_COLUMN_INDEX),
          valueAt($rowB, REF_COLUMN_INDEX)
        )
    )
  }
}
