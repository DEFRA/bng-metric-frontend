import { load } from 'cheerio'

import { toHtml } from './html.mjs'
import { STATUS } from './rows.mjs'

const meta = {
  date: '2026-11-10',
  branch: 'main',
  commit: '39a95e5aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  commitUrl: 'https://github.com/DEFRA/bng-metric-frontend/commit/39a95e5'
}

const columns = [
  { key: 'id', header: 'Error ID' },
  { key: 'status', header: 'Status' },
  { key: 'listHeading', header: 'List heading' },
  { key: 'source', header: 'Source' }
]

const row = {
  id: 'GPKG_UNEXPECTED_FEATURE_LAYER',
  status: STATUS.FINAL,
  listHeading: 'Unexpected feature layer "{layer}" <b>& more</b>',
  source: 'https://x/error-text.yaml#L311\nhttps://x/error-text.yaml#L1133'
}

describe('toHtml', () => {
  const html = toHtml([row], meta, columns)
  const $ = load(html)

  test('renders a row, escaping its text', () => {
    expect($('tbody tr').first().html()).toMatchInlineSnapshot(
      `"<td>GPKG_UNEXPECTED_FEATURE_LAYER</td><td>Final</td><td>Unexpected feature layer "{layer}" &lt;b&gt;&amp; more&lt;/b&gt;</td><td><a href="https://x/error-text.yaml#L311">Line 311</a><br><a href="https://x/error-text.yaml#L1133">Line 1133</a></td>"`
    )
    expect($('tbody b')).toHaveLength(0)
  })

  test('has a header for each column', () => {
    expect(
      $('thead th')
        .map((_, th) => $(th).text())
        .get()
    ).toEqual(['Error ID', 'Status', 'List heading', 'Source'])
  })

  test('says when, and from which commit, it was made, and counts each status', () => {
    const intro = $('h1 + p').text()
    expect(intro).toContain(
      'generated 2026-11-10 from branch main, commit 39a95e5'
    )
    expect(intro).toContain(
      '1 error IDs: 0 Needs content, 0 Awaiting UCD, 1 Final'
    )
    expect($('h1 + p a').attr('href')).toBe(meta.commitUrl)
  })

  test('is self-contained, with a search box that filters the rows', () => {
    expect($('link, script[src]')).toHaveLength(0)
    expect($('input#search').length).toBe(1)
    expect($('label[for="search"]').text()).toBe('Search')
    expect($('script').text()).toContain('row.hidden = !match')
  })
})
