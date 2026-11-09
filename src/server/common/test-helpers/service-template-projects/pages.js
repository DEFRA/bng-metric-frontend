import { load } from 'cheerio'
import { vi } from 'vitest'

import { createServer } from '../../../server.js'
import { wreck } from '../../helpers/wreck-client.js'
import { serviceTemplateBackend } from './backend-stub.js'

/**
 * Drive a page through the real server, against a service-template project
 * fixture served by serviceTemplateBackend. The test file must mock
 * `../common/helpers/wreck-client.js` itself, as vi.mock is hoisted per file.
 */

const AUTH = Object.freeze({
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
})

const SIGNIFICANCE_DISPLAY = Object.freeze({
  Low: 'Low (1)',
  High: 'High (1.15)'
})

async function startServer() {
  const server = await createServer()
  await server.initialize()
  return server
}

/** Serve this project, as `GET /projects/{id}` returns it, to every page. */
function serveProject(body) {
  vi.mocked(wreck.get).mockImplementation(serviceTemplateBackend(body))
}

/**
 * @returns {Promise<{ statusCode: number, headers: object, $: import('cheerio').CheerioAPI }>}
 */
async function getPage(server, url) {
  const response = await server.inject({ method: 'GET', url, auth: AUTH })
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    $: load(response.result ?? '')
  }
}

function projectPageUrl(body, page) {
  return `/projects/${body.id}/${page}`
}

function baselineDetailsUrl(body, featureId) {
  return `/baseline-habitat-details?featureId=${featureId}&projectId=${body.id}`
}

function postInterventionDetailsUrl(body, featureId) {
  return `/post-intervention-habitat-details?featureId=${featureId}&projectId=${body.id}`
}

const cellText = ($, cell) => $(cell).text().replaceAll(/\s+/gu, ' ').trim()

/**
 * Each body row of a table as `{ ref, href, cells }`, where `cells` maps each
 * column heading to the cell's text.
 */
function tableRows($, table) {
  const headings = $(table)
    .find('thead th')
    .map((_, th) => cellText($, th))
    .get()
  return $(table)
    .find('tbody tr')
    .map((_, row) => {
      const values = $(row)
        .find('th, td')
        .map((_, cell) => cellText($, cell))
        .get()
      return {
        ref: cellText($, $(row).find('a').first()),
        href: $(row).find('a').first().attr('href'),
        cells: Object.fromEntries(headings.map((h, i) => [h, values[i]]))
      }
    })
    .get()
}

/** How a grid or details page shows a significance the backend stored. */
function significanceDisplay(category) {
  return SIGNIFICANCE_DISPLAY[category]
}

export {
  AUTH,
  baselineDetailsUrl,
  getPage,
  postInterventionDetailsUrl,
  projectPageUrl,
  serveProject,
  significanceDisplay,
  startServer,
  tableRows
}
