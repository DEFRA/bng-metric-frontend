import ExcelJS from 'exceljs'

import { COLUMNS } from './rows.mjs'

// The export as an Excel workbook: a sheet of the rows, filterable, with its
// header row and error IDs frozen in view, and a sheet saying which commit
// the rows were read from.

const SHEET_NAME = 'Error messages'
const ABOUT_SHEET_NAME = 'About'
const HEADER_ROW = 1
const ABOUT_KEY_WIDTH = 14
const ABOUT_VALUE_WIDTH = 80

/**
 * @param {Array<Record<string, string>>} rows - from buildRows
 * @param {{ date: string, branch: string, commit: string, commitUrl: string }} meta
 * @param {typeof COLUMNS} [columns]
 * @returns {Promise<Buffer>}
 */
export async function toXlsx(rows, meta, columns = COLUMNS) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'bng-metric-frontend'
  workbook.created = new Date(meta.date)
  workbook.modified = workbook.created

  const sheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: HEADER_ROW }]
  })
  sheet.columns = columns.map(({ key, header, width }) => ({
    key,
    header,
    width
  }))
  for (const row of rows) {
    sheet.addRow(row)
  }

  sheet.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true }
  })
  sheet.getRow(HEADER_ROW).font = { bold: true }
  sheet.autoFilter = {
    from: { row: HEADER_ROW, column: 1 },
    to: { row: HEADER_ROW, column: columns.length }
  }

  // A cell holds one link: a row's first source, which is the drop-out
  // page's entry for a code that is in two sections.
  const source = sheet.getColumn('source')
  source.eachCell((cell, rowNumber) => {
    if (rowNumber > HEADER_ROW && cell.value) {
      const [first] = String(cell.value).split('\n')
      cell.value = { text: String(cell.value), hyperlink: first }
    }
  })

  const about = workbook.addWorksheet(ABOUT_SHEET_NAME)
  about.columns = [{ width: ABOUT_KEY_WIDTH }, { width: ABOUT_VALUE_WIDTH }]
  about.addRows([
    ['Generated', meta.date],
    ['Branch', meta.branch],
    ['Commit', { text: meta.commit, hyperlink: meta.commitUrl }],
    ['Error IDs', rows.length]
  ])

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
