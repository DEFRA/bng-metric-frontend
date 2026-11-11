// @vitest-environment happy-dom
import { HabitatDetailsSortableTable } from './habitat-details-sortable-table.js'

const STATUS_HEADING = 1
const UNITS_HEADING = 2

// Ref sort values are zero-padded as the server renders them, so P-10 follows P-2.
const ROWS = [
  { ref: 'P-10', sortRef: 'P-0000000010', status: 'Incomplete', units: 1 },
  { ref: 'P-2', sortRef: 'P-0000000002', status: 'Complete', units: 3 },
  { ref: 'P-1', sortRef: 'P-0000000001', status: 'Incomplete', units: 4 },
  { ref: 'P-3', sortRef: 'P-0000000003', status: 'Complete', units: 2 }
]

function statusCell(status) {
  const colour = status === 'Complete' ? 'grey' : 'blue'
  return `<td data-sort-value="${status}"><strong class="govuk-tag govuk-tag--${colour}">${status}</strong></td>`
}

function renderTable() {
  // The page template's snippet adds this; GOV.UK components refuse to start without it.
  document.body.className = 'govuk-frontend-supported'
  document.body.innerHTML = `
    <table data-module="moj-sortable-table">
      <thead>
        <tr>
          <th aria-sort="none">Ref</th>
          <th aria-sort="none" data-sort-ties-by-ref="true">Status</th>
          <th aria-sort="none">Units</th>
        </tr>
      </thead>
      <tbody>
        ${ROWS.map(
          (row) => `<tr>
            <td data-sort-value="${row.sortRef}">${row.ref}</td>
            ${statusCell(row.status)}
            <td data-sort-value="${row.units}">${row.units}</td>
          </tr>`
        ).join('')}
      </tbody>
      <tfoot><tr><td>Total</td><td></td><td>10</td></tr></tfoot>
    </table>`
  const $table = document.querySelector('table')
  return { $table, component: new HabitatDetailsSortableTable($table) }
}

function clickHeading($table, index) {
  $table.querySelectorAll('thead th')[index].querySelector('button').click()
}

function refOrder($table) {
  return Array.from($table.querySelectorAll('tbody tr'), (row) =>
    row.querySelector('td').textContent.trim()
  )
}

describe('HabitatDetailsSortableTable', () => {
  test('sorts Status ascending with ties in Ref order (BMD-1101 AC5)', () => {
    const { $table } = renderTable()

    clickHeading($table, STATUS_HEADING)

    expect(refOrder($table)).toEqual(['P-2', 'P-3', 'P-1', 'P-10'])
  })

  test('sorts Status descending with ties still in ascending Ref order (BMD-1101 AC6)', () => {
    const { $table } = renderTable()

    clickHeading($table, STATUS_HEADING)
    clickHeading($table, STATUS_HEADING)

    expect(refOrder($table)).toEqual(['P-1', 'P-10', 'P-2', 'P-3'])
  })

  test('puts ties back in Ref order after another column was sorted first', () => {
    const { $table } = renderTable()

    // Units ascending leaves the Complete rows as P-3, P-2.
    clickHeading($table, UNITS_HEADING)
    clickHeading($table, STATUS_HEADING)

    expect(refOrder($table)).toEqual(['P-2', 'P-3', 'P-1', 'P-10'])
  })

  test('keeps the totals row at the bottom', () => {
    const { $table } = renderTable()

    clickHeading($table, STATUS_HEADING)

    expect($table.querySelector('tfoot td').textContent).toBe('Total')
    expect($table.querySelectorAll('tbody tr')).toHaveLength(ROWS.length)
  })

  test('leaves a column without the attribute to the MoJ sort', () => {
    const { $table } = renderTable()

    clickHeading($table, UNITS_HEADING)

    expect(refOrder($table)).toEqual(['P-10', 'P-3', 'P-2', 'P-1'])
  })
})
