import {
  ATTACHMENTS,
  columnWidths,
  confluenceClient,
  pageBody,
  text
} from './confluence.mjs'
import { CHECK } from './content-design.mjs'
import { COLUMNS, STATUS } from './rows.mjs'

const META = {
  date: '2026-11-25',
  branch: 'main',
  commit: '39a95e5bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  commitUrl: 'https://github.com/x/commit/39a95e5',
  fileUrl: 'https://github.com/x/blob/39a95e5/error-text.yaml'
}

const ROWS = [
  {
    ...Object.fromEntries(COLUMNS.map(({ key }) => [key, ''])),
    id: 'NO_REDLINE',
    status: STATUS.FINAL,
    body: 'The boundary is <missing> & "gone".\nDraw it again.',
    source: `${META.fileUrl}#L561\n${META.fileUrl}#L1300`
  }
]

const RESULTS = [
  {
    ref: '17',
    id: 'NO_REDLINE',
    problem: 'No boundary',
    check: CHECK.DIFFERS_FROM_FINAL,
    status: STATUS.FINAL,
    source: `${META.fileUrl}#L561\n${META.fileUrl}#L1300`,
    parts: [{ label: 'H2', sheet: 'Red line boundary', service: '(none)' }]
  }
]

describe('text', () => {
  test('escapes XHTML and turns each line break into <br />', () => {
    expect(text('a < b & "c"\nd')).toBe('a &lt; b &amp; &quot;c&quot;<br />d')
  })
})

describe('columnWidths', () => {
  test('sizes each column to its text, within bounds', () => {
    const long = 'x'.repeat(200)
    expect(
      columnWidths(
        ['Ref', 'Error ID', 'Body'],
        [
          ['1', 'NO_REDLINE', long],
          ['2', 'A_CODE', `short\n${long}`]
        ]
      )
    ).toEqual([60, 94, 480])
  })

  test('sizes a column to its longer cells, not one long cell alone', () => {
    const rows = Array.from({ length: 20 }, () => ['short'])
    rows.push(['x'.repeat(60)])
    expect(columnWidths(['A'], rows)).toEqual([60])
  })
})

describe('pageBody', () => {
  const body = pageBody(ROWS, META, { results: RESULTS })

  test('says the page is generated and edits will be overwritten', () => {
    expect(body).toContain(
      'This page is generated from the code. Edits made here will be overwritten.'
    )
  })

  test('says the date, branch and commit it was generated from', () => {
    expect(body).toContain(
      'Generated 2026-11-25 from branch <code>main</code> at commit <a href="https://github.com/x/commit/39a95e5">39a95e5</a>.'
    )
  })

  test('links to each attached file', () => {
    for (const name of Object.values(ATTACHMENTS)) {
      expect(body).toContain(`<ri:attachment ri:filename="${name}" />`)
    }
  })

  test('shows each check as a coloured status, with its count', () => {
    expect(body).toContain(
      '<ac:parameter ac:name="colour">Red</ac:parameter><ac:parameter ac:name="title">Differs from Final</ac:parameter></ac:structured-macro> 1'
    )
  })

  test('links an error ID to its first entry', () => {
    expect(body).toContain(`<a href="${META.fileUrl}#L561">NO_REDLINE</a>`)
  })

  test('has no table but the one', () => {
    expect(body.match(/<table/g)).toHaveLength(1)
  })

  test('lists every message, escaped, when the sheet was not read', () => {
    const unread = pageBody(ROWS, META, { error: 'HTTP 404' })
    expect(unread).toContain(`<a href="${META.fileUrl}#L561">NO_REDLINE</a>`)
    expect(unread).toContain('Sheet not read')
    expect(unread).toContain(
      'Body: The boundary is &lt;missing&gt; &amp; &quot;gone&quot;.<br />Draw it again.'
    )
  })

  test('gives the check table column widths for its content', () => {
    expect(body).toMatch(
      /<table data-layout="default" data-table-width="\d+"><colgroup>(<col style="width: \d+px;" \/>){6}<\/colgroup>/
    )
  })

  test('says why the sheet was not compared', () => {
    expect(pageBody(ROWS, META, { error: 'HTTP 404' })).toContain(
      'The content design sheet was not compared: HTTP 404'
    )
    expect(pageBody(ROWS, META, {})).toContain('no sheet was given')
  })
})

describe('confluenceClient', () => {
  function fakeFetch(...responses) {
    const calls = []
    const fetchImpl = (url, init) => {
      calls.push({ url, ...init })
      return Promise.resolve(responses.shift())
    }
    return { calls, fetchImpl }
  }
  const json = (value, status = 200) =>
    new Response(JSON.stringify(value), { status })

  test('reads a page with the account’s basic authorisation', async () => {
    const { calls, fetchImpl } = fakeFetch(
      json({ title: 'T', version: { number: 3 } })
    )
    const client = confluenceClient({
      baseUrl: 'https://site.example/',
      email: 'a@b',
      token: 't',
      fetchImpl
    })
    await expect(client.getPage('12')).resolves.toEqual({
      title: 'T',
      version: { number: 3 }
    })
    expect(calls[0].url).toBe('https://site.example/wiki/api/v2/pages/12')
    expect(calls[0].headers.Authorization).toBe(
      `Basic ${Buffer.from('a@b:t').toString('base64')}`
    )
  })

  test('puts a new version of the page, numbered after the last', async () => {
    const { calls, fetchImpl } = fakeFetch(json({ version: { number: 4 } }))
    const client = confluenceClient({
      baseUrl: 'https://s',
      email: 'a',
      token: 't',
      fetchImpl
    })
    await client.updatePage('12', {
      title: 'T',
      body: '<p/>',
      version: 3,
      message: 'm'
    })
    expect(calls[0].method).toBe('PUT')
    expect(JSON.parse(calls[0].body)).toEqual({
      id: '12',
      status: 'current',
      title: 'T',
      body: { representation: 'storage', value: '<p/>' },
      version: { number: 4, message: 'm' }
    })
  })

  test('attaches a file with the header Confluence asks for', async () => {
    const { calls, fetchImpl } = fakeFetch(json({ results: [] }))
    const client = confluenceClient({
      baseUrl: 'https://s',
      email: 'a',
      token: 't',
      fetchImpl
    })
    await client.putAttachment('12', {
      name: 'x.csv',
      content: 'a,b',
      contentType: 'text/csv',
      comment: 'c'
    })
    expect(calls[0].method).toBe('PUT')
    const file = calls[0].body.get('file')
    expect(await file.text()).toBe('a,b')
    expect(file.type).toBe('text/csv')
    expect(calls[0].body.get('comment')).toBe('c')
    expect(calls[0].body.get('minorEdit')).toBe('true')
    expect(calls[0].url).toBe(
      'https://s/wiki/rest/api/content/12/child/attachment'
    )
    expect(calls[0].headers['X-Atlassian-Token']).toBe('no-check')
    expect(calls[0].body.get('file').name).toBe('x.csv')
  })

  test('sets a page property only when it differs', async () => {
    const property = (value) =>
      json({ results: [{ id: '9', value, version: { number: 2 } }] })
    const { calls, fetchImpl } = fakeFetch(
      property('max'),
      property('fixed-width'),
      json({}),
      json({ results: [] }),
      json({})
    )
    const client = confluenceClient({
      baseUrl: 'https://s',
      email: 'a',
      token: 't',
      fetchImpl
    })
    await expect(client.setPageProperty('12', 'k', 'max')).resolves.toBe(false)
    await expect(client.setPageProperty('12', 'k', 'max')).resolves.toBe(true)
    await expect(client.setPageProperty('12', 'k', 'max')).resolves.toBe(true)
    expect(calls.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'GET https://s/wiki/api/v2/pages/12/properties?key=k',
      'GET https://s/wiki/api/v2/pages/12/properties?key=k',
      'PUT https://s/wiki/api/v2/pages/12/properties/9',
      'GET https://s/wiki/api/v2/pages/12/properties?key=k',
      'POST https://s/wiki/api/v2/pages/12/properties'
    ])
    expect(JSON.parse(calls[2].body)).toEqual({
      key: 'k',
      value: 'max',
      version: { number: 3 }
    })
  })

  test('names the request and the response of a failure, not the token', async () => {
    const { fetchImpl } = fakeFetch(
      new Response('Not allowed', { status: 403 })
    )
    const client = confluenceClient({
      baseUrl: 'https://s',
      email: 'a',
      token: 'secret',
      fetchImpl
    })
    const error = await client.getPage('12').catch((caught) => caught)
    expect(error.message).toBe(
      'Confluence GET /wiki/api/v2/pages/12 failed: HTTP 403 Not allowed'
    )
    expect(error.message).not.toContain('secret')
  })
})
