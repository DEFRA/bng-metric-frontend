/* global DOMParser */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import nunjucks from 'nunjucks'

import * as filters from '../../config/nunjucks/filters/filters.js'
import * as globals from '../../config/nunjucks/globals/globals.js'

// Stand-alone Nunjucks environment for client-JS tests. Mirrors the
// production config in src/config/nunjucks/nunjucks.js so the rendered
// HTML matches what the real page produces, but it lives in its own
// environment so it doesn't fight the global Nunjucks state and doesn't
// require Hapi to be running. The extra search path under `src/server`
// is what lets pages like `habitat-upload-file/habitat-upload-file.njk`
// be addressed by the same relative name the Vision plugin uses at
// runtime.
const dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(dirname, '../../..')

const loader = new nunjucks.FileSystemLoader([
  path.resolve(projectRoot, 'node_modules/govuk-frontend/dist/'),
  path.resolve(dirname, '..'),
  path.resolve(dirname, '../common/templates'),
  path.resolve(dirname, '../common/components')
])

const env = new nunjucks.Environment(loader, {
  autoescape: true,
  throwOnUndefined: false,
  trimBlocks: true,
  lstripBlocks: true
})

for (const [name, global] of Object.entries(globals)) {
  env.addGlobal(name, global)
}

for (const [name, filter] of Object.entries(filters)) {
  env.addFilter(name, filter)
}

// Minimum context the layout templates expect. Real values come from the
// per-request `context(request)` function in src/config/nunjucks/context;
// here we just stub it with values that are safe for tests.
const defaultContext = {
  assetPath: '/public/assets',
  serviceName: 'Biodiversity Net Gain',
  serviceUrl: '/',
  breadcrumbs: [],
  navigation: [],
  user: null,
  isAuthenticated: false,
  canSelectDifferentOrganisation: false,
  getAssetPath: (asset) => `/public/${asset}`
}

/**
 * Render a Nunjucks template with the given view model.
 * @param {string} templatePath relative path beneath `src/server` (without `.njk`-ish flexibility)
 * @param {object} [viewModel]
 * @returns {string} the rendered HTML
 */
export function renderTemplate(templatePath, viewModel = {}) {
  return env.render(templatePath, { ...defaultContext, ...viewModel })
}

/**
 * Render a Nunjucks template and load it into the happy-dom document so
 * client-side JS can be exercised against the real markup. Parses the
 * full HTML so `<head>` and `<body>` end up where they belong.
 *
 * @param {string} templatePath
 * @param {object} [viewModel]
 */
export function renderTemplateIntoDocument(templatePath, viewModel = {}) {
  const html = renderTemplate(templatePath, viewModel)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  document.head.innerHTML = doc.head.innerHTML
  document.body.innerHTML = doc.body.innerHTML

  // Setting innerHTML doesn't apply the `selected` HTML attribute to the
  // parent <select>'s `.value` property in happy-dom (the property is only
  // hydrated when the parser builds the element from scratch, not when
  // children are pasted in). Mirror each select's initial selection from
  // the freshly-parsed source so the JS under test sees the same starting
  // state the browser would.
  for (const sourceSelect of doc.querySelectorAll('select[id]')) {
    const target = document.getElementById(sourceSelect.id)
    const selectedOption = sourceSelect.querySelector('option[selected]')
    if (target && selectedOption) {
      target.value = selectedOption.getAttribute('value') ?? ''
    }
  }
}
