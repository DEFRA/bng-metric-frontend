import { ATTACHMENTS } from './confluence.mjs'
import {
  checkLine,
  contentDesignCheck,
  pageContents,
  publishPage
} from './publish.mjs'
import { STATUS } from './rows.mjs'

const META = {
  date: '2026-11-25',
  branch: 'main',
  commit: '39a95e5bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  commitUrl: 'https://github.com/x/commit/39a95e5',
  fileUrl: 'https://github.com/x/blob/39a95e5/error-text.yaml',
  groups: ['codes']
}

const ROWS = [
  { id: 'NO_REDLINE', status: STATUS.FINAL, body: 'Missing', source: '#L1' }
]

const SHEET =
  'Ref,Problem,Code,Dropout page title (H1),Dropout error subheading (H2),Bodytext,Bodytext (Plural)\n1,No boundary,NO_REDLINE,,,Missing,n/a'

function csvFetch(body, type = 'text/csv') {
  return () =>
    Promise.resolve(new Response(body, { headers: { 'content-type': type } }))
}

describe('contentDesignCheck', () => {
  test('compares the sheet with the rows', async () => {
    const check = await contentDesignCheck(
      'https://x/spreadsheets/d/a/edit',
      ROWS,
      csvFetch(SHEET)
    )
    expect(check.results.map(({ id, check: name }) => [id, name])).toEqual([
      ['NO_REDLINE', 'Matches']
    ])
    expect(checkLine(check)).toBe('Content design check: 1 Matches.')
  })

  test('gives why, rather than failing, when the sheet cannot be read', async () => {
    const check = await contentDesignCheck(
      'https://x/spreadsheets/d/a/edit',
      ROWS,
      csvFetch('<html>', 'text/html')
    )
    expect(check.error).toContain('may no longer be shared')
    expect(checkLine(check)).toContain('was not compared')
  })

  test('compares nothing without a sheet', async () => {
    expect(await contentDesignCheck(undefined, ROWS)).toEqual({})
    expect(checkLine({})).toContain('CONTENT_DESIGN_SHEET_URL is not set')
  })
})

describe('publishPage', () => {
  test('attaches the files, then puts the page as its next version', async () => {
    const calls = []
    const client = {
      getPage: (id) => {
        calls.push(['getPage', id])
        return Promise.resolve({ title: 'Error codes', version: { number: 7 } })
      },
      putAttachment: (id, file) => {
        calls.push(['putAttachment', id, file.name, file.comment])
        return Promise.resolve({})
      },
      setPageProperty: (id, key, value) => {
        calls.push(['setPageProperty', id, key, value])
        return Promise.resolve(false)
      },
      updatePage: (id, update) => {
        calls.push([
          'updatePage',
          id,
          update.title,
          update.version,
          update.message
        ])
        return Promise.resolve({
          version: { number: 8 },
          _links: { base: 'https://s/wiki', webui: '/pages/1' }
        })
      }
    }
    const contents = await pageContents(META, { results: [] }, ROWS)
    const published = await publishPage(client, '1', contents, META)

    const message = 'Generated from main at 39a95e5'
    expect(calls).toEqual([
      ['getPage', '1'],
      ['putAttachment', '1', ATTACHMENTS.XLSX, message],
      ['putAttachment', '1', ATTACHMENTS.CSV, message],
      ['putAttachment', '1', ATTACHMENTS.CHECK_CSV, message],
      ['setPageProperty', '1', 'content-appearance-published', 'max'],
      ['setPageProperty', '1', 'content-appearance-draft', 'max'],
      ['setPageProperty', '1', 'editor', 'v2'],
      ['updatePage', '1', 'Error codes', 7, message]
    ])
    expect(published).toEqual({ version: 8, url: 'https://s/wiki/pages/1' })
  })
})
