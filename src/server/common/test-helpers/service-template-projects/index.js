import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Projects uploaded in the BNG Service template, as `GET /projects/{id}`
 * returns them (BMD-1086). See README.md for where each comes from.
 */
const SERVICE_TEMPLATE_PROJECTS = Object.freeze({
  /** The harness's default site: both stages, linked to their parents. */
  twoStages: 'two-stages.json',
  /** The default site's baseline-stage file: no post-intervention document. */
  baselineOnly: 'baseline-only.json',
  /** A degraded watercourse whose advance the backend clears, saved Incomplete. */
  watercourseAdvanceIncomplete: 'watercourse-advance-incomplete.json'
})

const cache = new Map()

/**
 * A fresh copy of one fixture's response body, so a test can change it.
 *
 * @param {keyof typeof SERVICE_TEMPLATE_PROJECTS} name
 * @returns {object} the `GET /projects/{id}` body: the document is `.project`
 */
function serviceTemplateProject(name) {
  const file = SERVICE_TEMPLATE_PROJECTS[name]
  if (!file) {
    throw new Error(`No service-template project fixture named ${name}`)
  }
  if (!cache.has(file)) {
    cache.set(
      file,
      JSON.parse(readFileSync(path.join(import.meta.dirname, file), 'utf-8'))
    )
  }
  return structuredClone(cache.get(file))
}

export { SERVICE_TEMPLATE_PROJECTS, serviceTemplateProject }
