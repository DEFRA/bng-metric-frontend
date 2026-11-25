import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { ERROR_TEXT_FILE } from '../../src/server/common/error-text/error-text.js'
import { toCsv } from './csv.mjs'
import {
  CHECK_COLUMNS,
  SHEET_LAYOUT_COLUMNS,
  checkCounts,
  checkRecord,
  compareWithSheet,
  fetchSheet,
  notCompared,
  readSheet,
  sheetLayoutRecords
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
//   [--summary FILE] [--force]
//
// Publishes error-text.yaml's messages to the error messages Confluence page:
// the content design sheet compared with the service's wording, every
// message as a table, and the .xlsx and .csv files, with the comparison as a
// CSV of its own. The Error Messages Export workflow runs it on each push to
// main, and on demand.
//
// The page keeps a fingerprint of what it shows. A run that would show the
// same (the same messages, sheet comparison and layout, whatever else the
// commit changed) leaves the page alone, so its history has a version only
// for a change. --force publishes anyway.
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
// service's messages. --branch main alone is not enough: the commit must be on
// origin/main too, and error-text.yaml is read from that commit, not from the
// working tree.

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
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
  --force          publish even when the page already shows the same
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
      },
      {
        // As the page's table: every message, compared when the sheet was read.
        name: ATTACHMENTS.SHEET_LAYOUT_CSV,
        content: toCsv(
          sheetLayoutRecords(check.results ?? notCompared(rows), rows),
          meta,
          SHEET_LAYOUT_COLUMNS
        ),
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

// The page property that holds the fingerprint of what the page shows.
const FINGERPRINT_PROPERTY = 'bng-error-text-fingerprint'
// The fingerprint while a publish is under way, which no content has.
const INCOMPLETE = 'incomplete'

/** Rows or results without the links that name the commit they came from. */
function withoutSource(items) {
  return items?.map(({ source, ...rest }) => rest)
}

/**
 * The export's own code, as text: what builds the page and its files. A change
 * to how either is laid out, such as a column added to the .xlsx or a new
 * escape in the .csv, changes the fingerprint, though no message changed.
 *
 * @returns {string}
 */
function exportCode() {
  return readdirSync(import.meta.dirname)
    .filter((name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs'))
    .sort()
    .map((name) => readFileSync(path.join(import.meta.dirname, name), 'utf8'))
    .join('\n')
}

/**
 * A fingerprint of what the page and its files show, apart from the date and
 * commit they were generated at: the same for two commits whose rows (every
 * column, as the attachments have them), sheet comparison and page layout are
 * the same, and whose export code is the same, whichever other files changed
 * between them. It is kept
 * on the page, so a run that would change nothing leaves the page alone.
 *
 * @param {Array<Record<string, string>>} rows
 * @param {Awaited<ReturnType<typeof contentDesignCheck>>} check
 * @param {string} [code] - the export's code, by default as it is on disk
 * @returns {string}
 */
export function contentFingerprint(rows, check, code = exportCode()) {
  const stable = {
    date: '',
    branch: '',
    commit: '',
    commitUrl: '',
    fileUrl: ''
  }
  const results = withoutSource(check.results)
  const body = pageBody(withoutSource(rows), stable, { ...check, results })
  return createHash('sha256')
    .update(code)
    .update(JSON.stringify(PAGE_PROPERTIES))
    .update(JSON.stringify(withoutSource(rows)))
    .update(JSON.stringify(results ?? check.error ?? null))
    .update(body)
    .digest('hex')
}

/**
 * Publish the page, unless it already shows what it would (its fingerprint is
 * the same) and `force` is not set: its files first, so its links to them work
 * as soon as it shows, its properties, then its body as a new version.
 *
 * @param {ReturnType<typeof confluenceClient>} client
 * @param {string} pageId
 * @param {Awaited<ReturnType<typeof pageContents>>} contents
 * @param {ReturnType<typeof exportMeta>} meta
 * @param {{ fingerprint?: string, force?: boolean }} [options]
 * @returns {Promise<{ version: number, url: string, unchanged?: boolean }>}
 */
export async function publishPage(
  client,
  pageId,
  contents,
  meta,
  { fingerprint, force = false } = {}
) {
  const page = await client.getPage(pageId)
  if (fingerprint && !force) {
    const published = await client.getPageProperty(pageId, FINGERPRINT_PROPERTY)
    if (published?.value === fingerprint) {
      return { version: page.version.number, url: '', unchanged: true }
    }
  }
  const message = `Generated from ${meta.branch} at ${meta.commit.slice(0, SHORT_SHA_LENGTH)}`
  if (fingerprint) {
    // Until every change has been made, the page matches no fingerprint: a
    // publish that fails part way is redone by the next run, whatever it
    // would show.
    await client.setPageProperty(pageId, FINGERPRINT_PROPERTY, INCOMPLETE)
  }
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
  if (fingerprint) {
    await client.setPageProperty(pageId, FINGERPRINT_PROPERTY, fingerprint)
  }
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

/**
 * Whether `commit` is on main as origin has it: the page must only ever show
 * wording that reached main, whatever --branch says.
 *
 * @param {string} commit
 * @param {string} [main] - the branch it must be on
 * @param {string} [repository] - the repository's folder
 * @returns {boolean}
 */
export function commitIsOnMain(
  commit,
  main = `origin/${PUBLISHED_BRANCH}`,
  repository = REPO_ROOT
) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, main], {
      cwd: repository,
      stdio: 'ignore'
    })
    return true
  } catch {
    return false
  }
}

// error-text.yaml's path from the repository's root, as git names it.
const ERROR_TEXT_PATH = path
  .relative(REPO_ROOT, ERROR_TEXT_FILE)
  .split(path.sep)
  .join('/')

/**
 * error-text.yaml as it is at `commit`: what a publish shows, so the page
 * never shows wording a working tree has that the commit it names does not.
 *
 * @param {string} commit
 * @param {string} [repository] - the repository's folder
 * @returns {string}
 */
export function sourceAt(commit, repository = REPO_ROOT) {
  return execFileSync('git', ['show', `${commit}:${ERROR_TEXT_PATH}`], {
    cwd: repository,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

/** Refuse to publish anything but main, or without the settings to. */
function checkPublishable(meta, env, isOnMain) {
  if (meta.branch !== PUBLISHED_BRANCH) {
    throw new Error(
      `Only ${PUBLISHED_BRANCH} is published, not ${meta.branch}: use --dry-run DIR to see the page`
    )
  }
  if (!isOnMain(meta.commit)) {
    throw new Error(
      `Only ${PUBLISHED_BRANCH} is published, and ${meta.commit.slice(0, SHORT_SHA_LENGTH)} is not on origin/${PUBLISHED_BRANCH}: use --dry-run DIR to see the page`
    )
  }
  const missing = missingEnv(env)
  if (missing.length > 0) {
    throw new Error(`Set ${missing.join(', ')} to publish`)
  }
}

function publishedLine(rows, meta, { version, url, unchanged }) {
  if (unchanged) {
    return `The Confluence page (version ${version}) already shows these ${rows.length} error IDs, so it was left as it is.`
  }
  const where = url ? `[version ${version}](${url})` : `version ${version}`
  return `Published ${rows.length} error IDs from \`${meta.branch}\` at ${meta.commit.slice(0, SHORT_SHA_LENGTH)} to Confluence (${where}).`
}

/**
 * The command: publish the page, or with --dry-run write it into a folder.
 *
 * @param {string[]} args - the command's arguments
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   fetchImpl?: typeof fetch,
 *   isOnMain?: (commit: string) => boolean,
 *   readCommit?: (commit: string) => string
 * }} [options] - readCommit gives error-text.yaml at a commit
 */
export async function run(
  args,
  {
    env = process.env,
    fetchImpl = fetch,
    isOnMain = commitIsOnMain,
    readCommit = sourceAt
  } = {}
) {
  const { values } = parseArgs({
    args,
    options: {
      'dry-run': { type: 'string' },
      sha: { type: 'string' },
      branch: { type: 'string' },
      summary: { type: 'string' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false }
    }
  })
  if (values.help) {
    console.log(USAGE)
    return
  }
  const dryRun = values['dry-run']
  const meta = exportMeta(values, env)
  if (!dryRun) {
    checkPublishable(meta, env, isOnMain)
  }

  // A dry run shows the working tree, to see a change before it is
  // committed; a publish shows the commit it names.
  const source = dryRun
    ? readFileSync(ERROR_TEXT_FILE, 'utf8')
    : readCommit(meta.commit)
  checkErrorText(source)
  const rows = buildRows(source, {
    sourceUrl: (line) => `${meta.fileUrl}#L${line}`,
    groups: DEFAULT_GROUPS
  })
  const check = await contentDesignCheck(
    env.CONTENT_DESIGN_SHEET_URL,
    rows,
    fetchImpl
  )
  console.log(checkLine(check))
  const contents = await pageContents(meta, check, rows)

  if (dryRun) {
    writeDryRun(path.resolve(dryRun), contents)
    return
  }
  const client = confluenceClient({
    baseUrl: env.CONFLUENCE_BASE_URL,
    email: env.CONFLUENCE_EMAIL,
    token: env.CONFLUENCE_API_TOKEN,
    fetchImpl
  })
  const published = publishedLine(
    rows,
    meta,
    await publishPage(client, env.CONFLUENCE_PAGE_ID, contents, meta, {
      fingerprint: contentFingerprint(rows, check),
      force: values.force
    })
  )
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
    await run(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
