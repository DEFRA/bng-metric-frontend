import { fileURLToPath } from 'node:url'
import path from 'node:path'
import nunjucks from 'nunjucks'
import { load } from 'cheerio'

import * as filters from '../../config/nunjucks/filters/filters.js'
import * as globals from '../../config/nunjucks/globals/globals.js'
import { resolveSingleErrorCopy } from './single-error-copy.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader([
    path.resolve(dirname, '../../../node_modules/govuk-frontend/dist/'),
    path.resolve(dirname, '../common/templates'),
    path.resolve(dirname, '../common/components'),
    dirname
  ]),
  { trimBlocks: true, lstripBlocks: true }
)
Object.entries(globals).forEach(([name, global]) => env.addGlobal(name, global))
Object.entries(filters).forEach(([name, filter]) => env.addFilter(name, filter))

const PROJECT_ID = 'p-1'
const UPLOAD_HREF = `/projects/${PROJECT_ID}/upload-baseline`

function renderSingleError(code) {
  const singleError = resolveSingleErrorCopy(
    { code, message: 'x' },
    UPLOAD_HREF
  )
  return load(
    env.render('index.njk', {
      // The layout's asset helper, which the app's context supplies.
      getAssetPath: (asset) => asset,
      singleError,
      projectId: PROJECT_ID,
      uploadHref: UPLOAD_HREF
    })
  )
}

describe('error-file page', () => {
  test.each([
    'LEGACY_TEMPLATE_NOT_ACCEPTED',
    'HABITAT_REF_MISSING',
    'HABITAT_REF_INVALID_CHARACTERS'
  ])('keeps the way back to uploading for plain text copy (%s)', (code) => {
    const $ = renderSingleError(code)

    expect($('.govuk-button').attr('href')).toBe(UPLOAD_HREF)
    expect($('.govuk-button').text().trim()).toBe('Upload a different file')
    expect($(`a[href="/projects/${PROJECT_ID}/project-summary"]`).text()).toBe(
      'Back to project'
    )
  })

  test('shows no upload button on a metric-tool page, where there is nothing to upload', () => {
    const $ = renderSingleError('BASELINE_NOT_ENHANCEABLE')

    expect($('.govuk-button')).toHaveLength(0)
  })
})
