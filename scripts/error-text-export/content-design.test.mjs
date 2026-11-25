import {
  CHECK,
  CHECK_COLUMNS,
  checkCounts,
  checkRecord,
  codesIn,
  compareWithSheet,
  fetchSheet,
  normalise,
  notCompared,
  parseCsv,
  readSheet,
  SHEET_HEADERS,
  SHEET_LAYOUT_COLUMNS,
  sheetCsvUrl,
  sheetLayoutRecords
} from './content-design.mjs'
import { SHOWN, STATUS, isUploadText } from './rows.mjs'

const HEADER =
  'Error category,Ref,Problem,Code,When checked,Dropout page title (H1),Dropout error subheading (H2),Bodytext,Bodytext (Plural),Candidate for user testing?,Original Jira'

function sheetCsv(...lines) {
  return [HEADER, ...lines].join('\r\n')
}

/** An export row, with only the columns the comparison reads. */
function row(id, cells = {}) {
  return {
    id,
    shown: SHOWN.UPLOAD,
    status: STATUS.FINAL,
    source: `https://x/blob/abc/error-text.yaml#L${id.length}`,
    pageHeading: '',
    pageHeadingSeveral: '',
    subheading: '',
    subheadingSeveral: '',
    body: '',
    bodySeveral: '',
    listHeading: '',
    ...cells
  }
}

const ROWS = [
  row('upload.page.title', { body: 'There is a problem with your file' }),
  row('upload.page.listHeading', {
    body: 'We couldn’t accept your {fileLabel} file'
  }),
  row('upload.fileProblem', {
    shown: SHOWN.FALLBACK,
    status: STATUS.AWAITING_UCD,
    pageHeading: 'Your file contains an error',
    body: 'Check your file and [upload a new file](upload).'
  }),
  row('HABITAT_REF_MISSING', {
    subheading: 'Habitat parcels',
    body: 'Your file contains a habitat with no habitat reference.'
  }),
  row('NO_REDLINE', {
    pageHeading: 'Your Geopackage (.gpkg) file contains an error',
    body: 'The redline boundary is missing. Draw it and [upload a new file](upload).',
    listHeading: 'Baseline file contains no redline boundary polygon'
  }),
  row('TREES_OUTSIDE_REDLINE', {
    status: STATUS.AWAITING_UCD,
    listHeading:
      'One or more trees are not entirely within the redline boundary'
  }),
  row('PARCEL_OVERLAPS', {
    body: 'If {refA} and {refB} are known: These parcels are overlapping.\nOtherwise: Some parcels overlap.'
  }),
  row('GPKG_RIVERS_NO_GEOMETRY', { listHeading: 'Rivers have no geometry' }),
  row('GPKG_RIVERS_WRONG_TYPE', { listHeading: 'Rivers are the wrong type' }),
  row('NOT_IN_SHEET_CODE', { status: STATUS.AWAITING_UCD }),
  row('forms.projectName.required', { shown: SHOWN.FORM, body: 'Enter a name' })
]

describe('parseCsv', () => {
  test('reads quoted fields holding commas, quotes and line breaks', () => {
    expect(parseCsv('a,"b, c","d ""e""\nf"\r\n1,2,3')).toEqual([
      ['a', 'b, c', 'd "e"\nf'],
      ['1', '2', '3']
    ])
  })

  test('ignores a byte-order mark', () => {
    expect(parseCsv('\uFEFFa,b')).toEqual([['a', 'b']])
  })
})

describe('readSheet', () => {
  test('reads each row by its column header, trimmed, and skips blank rows', () => {
    expect(
      readSheet(
        sheetCsv(
          'Cat,1,No boundary,NO_REDLINE,x,H1 ,H2,Body ,n/a,N,BMD-1',
          ',,,,,,,,,,'
        )
      )
    ).toEqual([
      {
        ref: '1',
        problem: 'No boundary',
        code: 'NO_REDLINE',
        h1: 'H1',
        h2: 'H2',
        body: 'Body',
        plural: 'n/a',
        category: 'Cat',
        whenChecked: 'x',
        candidate: 'N',
        jira: 'BMD-1'
      }
    ])
  })

  test('leaves the sheet’s other columns blank when it has none', () => {
    const [row] = readSheet(
      'Ref,Problem,Code,Dropout page title (H1),Dropout error subheading (H2),Bodytext,Bodytext (Plural)\n1,P,A_B,,,Words,'
    )
    expect(row).toMatchObject({
      category: '',
      whenChecked: '',
      candidate: '',
      jira: ''
    })
  })

  test('refuses a sheet without a column it reads', () => {
    expect(() => readSheet('Ref,Code\n1,A_B')).toThrow(
      'The content design sheet has no "Problem", "Dropout page title (H1)"'
    )
  })
})

describe('sheetCsvUrl', () => {
  test('gives the CSV download of the tab a sheet is opened at', () => {
    expect(
      sheetCsvUrl(
        'https://docs.google.com/spreadsheets/d/abc_1/edit?gid=42#gid=42'
      )
    ).toBe(
      'https://docs.google.com/spreadsheets/d/abc_1/export?format=csv&gid=42'
    )
  })

  test('reads the tab from the hash, and keeps a download URL', () => {
    expect(
      sheetCsvUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=7')
    ).toBe('https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=7')
    const download =
      'https://docs.google.com/spreadsheets/d/abc/export?format=csv&gid=7'
    expect(sheetCsvUrl(download)).toBe(download)
  })
})

describe('fetchSheet', () => {
  const respond = (status, type, body) => () =>
    Promise.resolve(
      new Response(body, { status, headers: { 'content-type': type } })
    )

  test('gives the sheet as CSV', async () => {
    await expect(
      fetchSheet(
        'https://x/spreadsheets/d/a/edit',
        respond(200, 'text/csv', 'a,b')
      )
    ).resolves.toBe('a,b')
  })

  test('says the sheet may not be shared when Google sends a page', async () => {
    await expect(
      fetchSheet(
        'https://x/spreadsheets/d/a/edit',
        respond(200, 'text/html', '<html>')
      )
    ).rejects.toThrow('may no longer be shared with anyone with the link')
  })

  test('names the HTTP status of a failure', async () => {
    await expect(
      fetchSheet(
        'https://x/spreadsheets/d/a/edit',
        respond(404, 'text/html', '')
      )
    ).rejects.toThrow('HTTP 404')
  })
})

describe('normalise', () => {
  test('reads links by their text and any {value} alike', () => {
    expect(normalise('[Upload a file](upload) for {Parcel ref}')).toBe(
      normalise('Upload a file for {ref}')
    )
  })

  test('ignores quotes, spacing and a full stop at the end', () => {
    expect(normalise(' The file’s  “name”. ')).toBe('The file\'s "name"')
  })

  test('keeps capitals and spelling', () => {
    expect(normalise('Red line')).not.toBe(normalise('red line'))
    expect(normalise('redline')).not.toBe(normalise('red line'))
  })
})

describe('codesIn', () => {
  const known = ['GPKG_RIVERS_B', 'GPKG_RIVERS_A', 'NO_REDLINE']

  test('finds each code, ignoring notes beside them', () => {
    expect(codesIn('NO_REDLINE\nDuplicated (see Ref 20)', known)).toEqual([
      'NO_REDLINE'
    ])
    expect(codesIn('A_ONE\nB_TWO', known)).toEqual(['A_ONE', 'B_TWO'])
  })

  test('gives every known code a wildcard begins, in order', () => {
    expect(codesIn('GPKG_RIVERS_* (3 each)', known)).toEqual([
      'GPKG_RIVERS_A',
      'GPKG_RIVERS_B'
    ])
  })

  test('keeps a wildcard that begins no known code, as a code the service lacks', () => {
    expect(codesIn('VALIDATION_FOO_*', ['NO_REDLINE'])).toEqual([
      'VALIDATION_FOO_*'
    ])
    const [result] = compareWithSheet(
      readSheet(sheetCsv('C,1,Gone,VALIDATION_FOO_*,x,,,Words,,N,')),
      ROWS
    )
    expect(result).toMatchObject({
      id: 'VALIDATION_FOO_*',
      check: CHECK.NOT_IN_SERVICE
    })
  })

  test('finds a wildcard whose prefix is one word', () => {
    expect(codesIn('GPKG_*', ['GPKG_B', 'GPKG_A', 'NO_REDLINE'])).toEqual([
      'GPKG_A',
      'GPKG_B'
    ])
  })

  test('finds a shared page by its key, and nothing in a note', () => {
    expect(codesIn('upload.fileProblem', known)).toEqual(['upload.fileProblem'])
    expect(codesIn('BMD-1099 will implement this', known)).toEqual([])
  })
})

describe('compareWithSheet', () => {
  const sheet = readSheet(
    sheetCsv(
      'C,1,Missing ref,HABITAT_REF_MISSING,x,We couldn’t accept your {file} file,Habitat parcels,Your file contains a habitat with no habitat reference. ,n/a,N,',
      'C,2,No boundary,NO_REDLINE,x,There is a problem with your file,Red line boundary,The red line boundary is missing. ,n/a,N,',
      'C,3,Trees,TREES_OUTSIDE_REDLINE,x,,,{Habitat ref} is outside the red line boundary.,These trees are outside.,N,',
      'C,4,Overlap,PARCEL_OVERLAPS,x,,,These parcels are overlapping.,,N,',
      'C,5,Rivers,GPKG_RIVERS_*,x,,,Rivers have no geometry,,N,',
      'C,6,Again,"NO_REDLINE\nDuplicated (see Ref 2)",x,,,Anything,,N,',
      'C,7,Gone,OLD_CODE,x,,,Old words,,N,',
      'C,8,Edit,upload.fileProblem,x,n/a,n/a,n/a,n/a,N,',
      'C,9,Later,BMD-1099 will implement this,x,,,Irreplaceable habitats,,N,'
    )
  )
  const results = compareWithSheet(sheet, ROWS)
  const byRefAndId = (ref, id) =>
    results.find((result) => result.ref === ref && result.id === id)

  test('matches the sheet’s H1 to the problems list’s heading', () => {
    expect(byRefAndId('1', 'HABITAT_REF_MISSING')).toMatchObject({
      check: CHECK.MATCHES,
      parts: []
    })
  })

  test('marks a difference from Final wording, giving each part’s two texts', () => {
    expect(byRefAndId('2', 'NO_REDLINE')).toMatchObject({
      check: CHECK.DIFFERS_FROM_FINAL,
      status: STATUS.FINAL,
      parts: [
        {
          label: 'H1',
          sheet: 'There is a problem with your file',
          service: 'Your Geopackage (.gpkg) file contains an error'
        },
        { label: 'H2', sheet: 'Red line boundary', service: '(none)' },
        {
          label: 'Body',
          sheet: 'The red line boundary is missing.',
          service:
            'The redline boundary is missing. Draw it and [upload a new file](upload).\nList heading: Baseline file contains no redline boundary polygon'
        }
      ]
    })
  })

  test('marks a difference from wording awaiting UCD as Differs', () => {
    const result = byRefAndId('3', 'TREES_OUTSIDE_REDLINE')
    expect(result.check).toBe(CHECK.DIFFERS)
    expect(result.parts.map((part) => part.label)).toEqual(['Body', 'Plural'])
  })

  test('matches any case a cell is shown in', () => {
    expect(byRefAndId('4', 'PARCEL_OVERLAPS').check).toBe(CHECK.MATCHES)
  })

  test('compares each code a wildcard stands for', () => {
    expect(byRefAndId('5', 'GPKG_RIVERS_NO_GEOMETRY').check).toBe(CHECK.MATCHES)
    expect(byRefAndId('5', 'GPKG_RIVERS_WRONG_TYPE').check).toBe(
      CHECK.DIFFERS_FROM_FINAL
    )
  })

  test('marks a code the sheet has twice as a duplicate of its first row', () => {
    expect(byRefAndId('6', 'NO_REDLINE')).toMatchObject({
      check: CHECK.DUPLICATE,
      duplicateOf: '2'
    })
  })

  test('flags a code the service does not have, with the sheet’s words', () => {
    expect(byRefAndId('7', 'OLD_CODE')).toMatchObject({
      check: CHECK.NOT_IN_SERVICE,
      parts: [{ label: 'Body', sheet: 'Old words', service: '' }]
    })
  })

  test('says when the sheet gives no words', () => {
    expect(byRefAndId('8', 'upload.fileProblem').check).toBe(CHECK.NO_WORDING)
  })

  test('says when a row names no code', () => {
    expect(byRefAndId('9', 'BMD-1099 will implement this').check).toBe(
      CHECK.NO_CODE
    )
  })

  test('flags each error code and shared page the sheet does not have, with its words', () => {
    const missing = results.filter(
      (result) => result.check === CHECK.NOT_IN_SHEET
    )
    expect(missing.map((result) => result.id)).toEqual(['NOT_IN_SHEET_CODE'])
    expect(checkRecord(missing[0]).service).toBe(
      `Where it is shown: ${SHOWN.UPLOAD}`
    )
  })

  test('lists the messages the sheet does not cover last, with their words', () => {
    expect(results.at(-1)).toMatchObject({
      id: 'forms.projectName.required',
      check: CHECK.OUTSIDE_SHEET
    })
    expect(checkRecord(results.at(-1)).service).toBe(
      `Where it is shown: ${SHOWN.FORM}\nBody: Enter a name`
    )
  })

  test('has a result for every error, and none for the drop-out page’s building blocks', () => {
    const ids = new Set(results.map((result) => result.id))
    expect(ROWS.filter((row) => !ids.has(row.id)).map((row) => row.id)).toEqual(
      ['upload.page.title', 'upload.page.listHeading']
    )
  })

  test('leaves the building blocks out when the sheet was not read too', () => {
    const ids = notCompared(ROWS).map((result) => result.id)
    expect(ids).not.toContain('upload.page.title')
    expect(ids).toContain('NO_REDLINE')
    expect(
      sheetLayoutRecords(notCompared(ROWS), ROWS).map(({ code }) => code)
    ).toEqual(ids)
  })

  test('counts each check, most in need of a fix first', () => {
    expect(checkCounts(results)).toEqual([
      [CHECK.DIFFERS_FROM_FINAL, 2],
      [CHECK.NOT_IN_SERVICE, 1],
      [CHECK.NOT_IN_SHEET, 1],
      [CHECK.DIFFERS, 1],
      [CHECK.NO_CODE, 1],
      [CHECK.DUPLICATE, 1],
      [CHECK.NO_WORDING, 1],
      [CHECK.MATCHES, 3],
      [CHECK.OUTSIDE_SHEET, 1]
    ])
  })
})

describe('checkRecord', () => {
  test('gives each differing part a line on each side', () => {
    const record = checkRecord({
      ref: '2',
      id: 'NO_REDLINE',
      problem: 'No boundary',
      check: CHECK.DIFFERS,
      status: STATUS.AWAITING_UCD,
      source: 'https://x#L1',
      parts: [
        { label: 'H2', sheet: 'Red line boundary', service: '(none)' },
        { label: 'Body', sheet: 'Missing.', service: 'Gone.' }
      ]
    })
    expect(Object.keys(record)).toEqual(CHECK_COLUMNS.map(({ key }) => key))
    expect(record).toMatchObject({
      differs: 'H2, Body',
      sheet: 'H2: Red line boundary\nBody: Missing.',
      service: 'H2: (none)\nBody: Gone.'
    })
  })

  test('names the row a duplicate repeats', () => {
    expect(
      checkRecord({
        ref: '6',
        id: 'A_B',
        problem: '',
        check: CHECK.DUPLICATE,
        duplicateOf: '2',
        status: '',
        source: '',
        parts: []
      }).check
    ).toBe('Duplicate row of Ref 2')
  })
})

describe('compareWithSheet, part by part', () => {
  const VARIANT_ROW = row('GPKG_LAYER_MISMATCH', {
    listHeading:
      'Layer "{layer}" baseline mismatch\nbng-service variant: Layer "{layer}" does not match the BNG Service template'
  })
  const SEVERAL_ROW = row('PARCELS_SEVERAL', {
    pageHeading: 'This parcel {ref} contains an error',
    pageHeadingSeveral: 'These parcels contain an error',
    subheading: 'Habitat parcels',
    subheadingSeveral: 'Your habitat parcels',
    body: 'This parcel is too small.',
    bodySeveral: 'These parcels are too small.',
    listHeading: 'Parcels are smaller than 1 square metre'
  })
  const rows = [VARIANT_ROW, SEVERAL_ROW]
  const compare = (line) => compareWithSheet(readSheet(sheetCsv(line)), rows)[0]

  test('matches a variant’s words without its label', () => {
    expect(
      compare(
        'C,1,Layer,GPKG_LAYER_MISMATCH,x,,,"Layer ""{name}"" does not match the BNG Service template",,N,'
      ).check
    ).toBe(CHECK.MATCHES)
  })

  test('matches the wording for several habitats in each of its columns', () => {
    expect(
      compare(
        'C,1,Small,PARCELS_SEVERAL,x,These parcels contain an error,Your habitat parcels,This parcel is too small.,These parcels are too small.,N,'
      ).check
    ).toBe(CHECK.MATCHES)
  })

  test('matches the Plural part to the problems list heading', () => {
    expect(
      compare(
        'C,1,Small,PARCELS_SEVERAL,x,,,,Parcels are smaller than 1 square metre,N,'
      ).check
    ).toBe(CHECK.MATCHES)
  })

  test('gives the service’s words for several habitats when they differ', () => {
    const result = compare(
      'C,1,Small,PARCELS_SEVERAL,x,Those parcels have errors,Parcels,,Those parcels are tiny.,N,'
    )
    expect(result.check).toBe(CHECK.DIFFERS_FROM_FINAL)
    expect(result.parts).toEqual([
      {
        label: 'H1',
        sheet: 'Those parcels have errors',
        service:
          'This parcel {ref} contains an error\nPage heading (several): These parcels contain an error'
      },
      {
        label: 'H2',
        sheet: 'Parcels',
        service: 'Habitat parcels\nSubheading (several): Your habitat parcels'
      },
      {
        label: 'Plural',
        sheet: 'Those parcels are tiny.',
        service:
          'These parcels are too small.\nList heading: Parcels are smaller than 1 square metre'
      }
    ])
  })
})

describe('sheetLayoutRecords', () => {
  const sheet = readSheet(
    sheetCsv(
      'Area,2,No boundary,NO_REDLINE,On upload,There is a problem with your file,Red line boundary,The red line boundary is missing.,n/a,Y,BMD-9',
      'Area,7,Gone,OLD_CODE,On upload,,,Old words,Old plural,N,BMD-8'
    )
  )
  const results = compareWithSheet(sheet, ROWS)
  const records = sheetLayoutRecords(results, ROWS)
  const byCode = (code) => records.find((record) => record.code === code)

  test('puts the sheet’s own columns first, in its order, then the check', () => {
    expect(
      SHEET_LAYOUT_COLUMNS.slice(0, 11).map(({ header }) => header)
    ).toEqual(HEADER.split(','))
    expect(SHEET_LAYOUT_COLUMNS.slice(11).map(({ header }) => header)).toEqual([
      'Check',
      'Status in service',
      'Where it is shown',
      'Source'
    ])
    expect(SHEET_HEADERS.h1).toBe('Dropout page title (H1)')
  })

  test('gives the service’s current wording in full, with the sheet’s other columns', () => {
    expect(byCode('NO_REDLINE')).toEqual({
      category: 'Area',
      ref: '2',
      problem: 'No boundary',
      code: 'NO_REDLINE',
      whenChecked: 'On upload',
      h1: 'Your Geopackage (.gpkg) file contains an error',
      h2: '',
      body: 'The redline boundary is missing. Draw it and [upload a new file](upload).',
      plural: '',
      candidate: 'Y',
      jira: 'BMD-9',
      check: CHECK.DIFFERS_FROM_FINAL,
      status: STATUS.FINAL,
      shown: SHOWN.UPLOAD,
      source: ROWS.find((row) => row.id === 'NO_REDLINE').source
    })
  })

  test('keeps the sheet’s words for a code the service does not have', () => {
    expect(byCode('OLD_CODE')).toMatchObject({
      ref: '7',
      body: 'Old words',
      plural: 'Old plural',
      check: CHECK.NOT_IN_SERVICE,
      status: ''
    })
  })

  test('lists every message, the sheet’s rows first, each with the service’s words', () => {
    expect(records.map((record) => record.code)).toEqual(
      results.map((result) => result.id)
    )
    expect(byCode('forms.projectName.required')).toMatchObject({
      ref: '',
      body: 'Enter a name',
      check: CHECK.OUTSIDE_SHEET,
      shown: SHOWN.FORM
    })
  })
})

describe('isUploadText', () => {
  test('is true for the drop-out page’s building blocks alone', () => {
    for (const id of [
      'upload.page.opensInNewTab',
      'upload.names.feature',
      'upload.unknown.blank',
      'upload.distinctiveness.High',
      'upload.layers.habitats'
    ]) {
      expect(isUploadText({ id })).toBe(true)
    }
    for (const id of [
      'upload.catchAll',
      'upload.fileProblem',
      'NO_REDLINE',
      'forms.projectName.required',
      'pages.notFound'
    ]) {
      expect(isUploadText({ id })).toBe(false)
    }
  })
})
