import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { ERROR_TEXT_FILE } from '../../src/server/common/error-text/error-text.js'
import { toCsv } from './csv.mjs'
import {
  CHECK_COLUMNS,
  checkCounts,
  checkRecord,
  compareWithSheet,
  fetchSheet,
  readSheet
} from './content-design.mjs'
import {
  ATTACHMENTS,
  PAGE_PROPERTIES,
  confluenceClient,
  pageBody
} from './confluence.mjs'
import { checkErrorText, exportMeta } from './export.mjs'
import { DEFAULT_GROUPS, buildRows } from './rows.mjs'
import { toXlsx } from './xlsx.mjs'

// npm run publish:error-text [-- --dry-run DIR] [--sha SHA] [--branch NAME]
//   [--summary FILE]
//
// Publishes error-text.yaml's messages to the error messages Confluence page:
// the content design sheet compared with the service's wording, every
// message as a table, and the .xlsx and .csv files, with the comparison as a
// CSV of its own. The Error Messages Export workflow runs it when a push
// changes the wording on main, or on demand.
//
// It reads, from the environment:
//   CONFLUENCE_BASE_URL       the site, as https://eaflood.atlassian.net
//   CONFLUENCE_PAGE_ID        the page to replace
//   CONFLUENCE_EMAIL          the Atlassian account that publishes it
//   CONFLUENCE_API_TOKEN      that account's API token
//   CONTENT_DESIGN_SHEET_URL  the content design sheet, shared with anyone
//                             with the link, as opened in a browser
//
// Without the sheet, or when it cannot be read, the page is still published
// and says why the sheet was not compared. The comparison is never written to
// GitHub: the repository is public, and the sheet is not.
//
// --dry-run DIR publishes nothing and needs no Confluence settings: it writes
// the page's body and its files into DIR, to see what a fix changes before it
// is merged. Only main is published: the page is the current record of the
// service's messages.

const PUBLISHED_BRANCH = 'main'
const SHORT_SHA_LENGTH = 7
const CSV_TYPE = 'text/csv'
const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PAGE_FILE = 'confluence-page.xml'

const REQUIRED_ENV = Object.freeze([
  'CONFLUENCE_BASE_URL',
  'CONFLUENCE_PAGE_ID',
  'CONFLUENCE_EMAIL',
  'CONFLUENCE_API_TOKEN'
])

const USAGE = `Usage: npm run publish:error-text [-- options]

  --dry-run DIR    write the page and its files into DIR, and publish nothing
  --sha SHA        the commit the source links name (default: GITHUB_SHA, or HEAD)
  --branch NAME    the branch it is read from (default: the GitHub ref, or the current branch)
  --summary FILE   append what was published, as Markdown, to FILE
  --help           show this message`

/**
 * The content design check: the sheet compared with the rows, or why it was
 * not. Never throws, as the page is published either way.
 *
 * @param {string | undefined} sheetUrl
 * @param {Array<Record<string, string>>} rows
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ results?: ReturnType<typeof compareWithSheet>, error?: string }>}
 */
export async function contentDesignCheck(sheetUrl, rows, fetchImpl = fetch) {
  if (!sheetUrl) {
    return {}
  }
  try {
    const sheet = readSheet(await fetchSheet(sheetUrl, fetchImpl))
    return { results: compareWithSheet(sheet, rows) }
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * The page's body and its files.
 *
 * @param {ReturnType<typeof exportMeta>} meta
 * @param {Awaited<ReturnType<typeof contentDesignCheck>>} check
 * @param {Array<Record<string, string>>} rows - from buildRows, every group
 */
export async function pageContents(meta, check, rows) {
  const records = (check.results ?? []).map(checkRecord)
  return {
    body: pageBody(rows, meta, check),
    files: [
      {
        name: ATTACHMENTS.XLSX,
        content: await toXlsx(rows, meta),
        contentType: XLSX_TYPE
      },
      {
        name: ATTACHMENTS.CSV,
        content: toCsv(rows, meta),
        contentType: CSV_TYPE
      },
      {
        name: ATTACHMENTS.CHECK_CSV,
        content: toCsv(records, meta, CHECK_COLUMNS),
        contentType: CSV_TYPE
      }
    ]
  }
}

/** What the content design check found, as a line. */
export function checkLine(check) {
  if (check.error) {
    return `The content design sheet was not compared: ${check.error}`
  }
  if (!check.results) {
    return 'The content design sheet was not compared: CONTENT_DESIGN_SHEET_URL is not set.'
  }
  const counts = checkCounts(check.results)
    .map(([name, count]) => `${count} ${name}`)
    .join(', ')
  return `Content design check: ${counts}.`
}

/**
 * Publish the page: its files first, so its links to them work as soon as it
 * shows, its properties, then its body as a new version.
 *
 * @param {ReturnType<typeof confluenceClient>} client
 * @param {string} pageId
 * @param {Awaited<ReturnType<typeof pageContents>>} contents
 * @param {ReturnType<typeof exportMeta>} meta
 * @returns {Promise<{ version: number, url: string }>}
 */
export async function publishPage(client, pageId, contents, meta) {
  const page = await client.getPage(pageId)
  const message = `Generated from ${meta.branch} at ${meta.commit.slice(0, SHORT_SHA_LENGTH)}`
  for (const file of contents.files) {
    await client.putAttachment(pageId, { ...file, comment: message })
    console.log(`Attached ${file.name}`)
  }
  for (const [key, value] of PAGE_PROPERTIES) {
    await client.setPageProperty(pageId, key, value)
  }
  const updated = await client.updatePage(pageId, {
    title: page.title,
    body: contents.body,
    version: page.version.number,
    message
  })
  return {
    version: updated.version?.number ?? page.version.number + 1,
    url: updated._links ? `${updated._links.base}${updated._links.webui}` : ''
  }
}

function missingEnv(env) {
  return REQUIRED_ENV.filter((name) => !env[name])
}

function writeDryRun(dir, contents) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, PAGE_FILE), contents.body)
  for (const file of contents.files) {
    writeFileSync(path.join(dir, file.name), file.content)
  }
  console.log(`Wrote the page and its files into ${dir}: nothing was published`)
}

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'string' },
      sha: { type: 'string' },
      branch: { type: 'string' },
      summary: { type: 'string' },
      help: { type: 'boolean', default: false }
    }
  })
  if (values.help) {
    console.log(USAGE)
    return
  }
  const env = process.env
  const dryRun = values['dry-run']
  const meta = exportMeta(values)
  if (!dryRun && meta.branch !== PUBLISHED_BRANCH) {
    throw new Error(
      `Only ${PUBLISHED_BRANCH} is published, not ${meta.branch}: use --dry-run DIR to see the page`
    )
  }
  const missing = dryRun ? [] : missingEnv(env)
  if (missing.length > 0) {
    throw new Error(`Set ${missing.join(', ')} to publish`)
  }

  const source = readFileSync(ERROR_TEXT_FILE, 'utf8')
  checkErrorText(source)
  const rows = buildRows(source, {
    sourceUrl: (line) => `${meta.fileUrl}#L${line}`,
    groups: DEFAULT_GROUPS
  })
  const check = await contentDesignCheck(env.CONTENT_DESIGN_SHEET_URL, rows)
  console.log(checkLine(check))
  const contents = await pageContents(meta, check, rows)

  if (dryRun) {
    writeDryRun(path.resolve(dryRun), contents)
    return
  }
  const client = confluenceClient({
    baseUrl: env.CONFLUENCE_BASE_URL,
    email: env.CONFLUENCE_EMAIL,
    token: env.CONFLUENCE_API_TOKEN
  })
  const { version, url } = await publishPage(
    client,
    env.CONFLUENCE_PAGE_ID,
    contents,
    meta
  )
  const published = `Published ${rows.length} error IDs from \`${meta.branch}\` at ${meta.commit.slice(0, SHORT_SHA_LENGTH)} to Confluence${url ? ` ([version ${version}](${url}))` : ` (version ${version})`}.`
  console.log(published)
  if (values.summary) {
    // The counts only: the sheet's words stay off GitHub.
    appendFileSync(
      values.summary,
      `## Confluence\n\n${published}\n\n${checkLine(check)}\n`
    )
  }
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
