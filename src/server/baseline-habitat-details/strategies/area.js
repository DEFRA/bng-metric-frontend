import Joi from 'joi'

import { config } from '../../../config/config.js'
import { wreck } from '../../common/helpers/wreck-client.js'
import {
  formatAreaHectares,
  formatHabitatUnits
} from '../../common/helpers/format-habitat-values.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

// Strategic significance is fixed at Low (1) for MVS (BMD-315 AC9).
const FIXED_STRATEGIC_SIGNIFICANCE = { label: 'Low', score: 1 }

// Static reference data (broads, habitat-types-by-broad, trading-rules) is
// bundled into bng-metric-engine at build time, so it only changes with a
// backend deploy — which restarts this process anyway. Caching the bulk fetch
// in a module-level Promise turns subsequent page loads into zero round trips
// for the static slice. Conditions are per-habitat-type and stay uncached.
let staticReferencePromise = null

function fetchStaticReference() {
  if (!staticReferencePromise) {
    staticReferencePromise = Promise.all([
      wreck.get(`${backendUrl}/reference/habitat-types-by-broad`),
      wreck.get(`${backendUrl}/reference/trading-rules`)
    ])
      .then(([types, rules]) => {
        const typesByBroad = types.payload
        const habitatTypes = Object.entries(typesByBroad).flatMap(
          ([broad, list]) => list.map((t) => ({ ...t, broad }))
        )
        return {
          habitatTypes,
          broadHabitats: Object.keys(typesByBroad).sort((a, b) =>
            a.localeCompare(b)
          ),
          tradingRules: rules.payload
        }
      })
      .catch((err) => {
        // Drop the cached rejection so the next request retries.
        staticReferencePromise = null
        throw err
      })
  }
  return staticReferencePromise
}

// Exported for tests — resets the in-process cache between scenarios.
export function _resetReferenceCache() {
  staticReferencePromise = null
}

async function loadReference(habitat) {
  // The backend's conditions lookup is keyed by the combined "Broad - Type"
  // string (e.g. "Grassland - Modified grassland"); the habitat document
  // stores broadType and type separately, so we reconstruct the key here.
  const conditionLookupKey =
    habitat.broadType && habitat.type
      ? `${habitat.broadType} - ${habitat.type}`
      : null
  const [staticRef, conditions] = await Promise.all([
    fetchStaticReference(),
    conditionLookupKey
      ? wreck.get(
          `${backendUrl}/reference/conditions?habitatType=${encodeURIComponent(conditionLookupKey)}`
        )
      : Promise.resolve({ payload: [] })
  ])

  return {
    broadHabitats: staticRef.broadHabitats,
    habitatTypes: staticRef.habitatTypes,
    conditions: conditions.payload,
    tradingRules: staticRef.tradingRules
  }
}

function buildSelectItems(values, selectedValue, defaultText) {
  const items = [{ value: '', text: defaultText, selected: !selectedValue }]
  for (const value of values) {
    items.push({
      value,
      text: value,
      selected: value === selectedValue
    })
  }
  return items
}

function buildViewModel(habitat, reference, { projectId, projectName }) {
  // Habitat units are computed and persisted by the backend's enrichment step
  // (BMD-426 / bng-metric-engine). When the value is absent the display falls
  // through to an empty cell, signalling "not yet calculated" rather than the
  // misleading "0.00".
  const habitatTypeNames = reference.habitatTypes
    .filter((t) => t.broad === habitat.broadType)
    .map((t) => t.name)
  const habitatRef = habitat.ref ?? ''
  return {
    headingPrefix: 'Habitat',
    projectId,
    projectName,
    habitatRef,
    sizeDisplay: formatAreaHectares(habitat.sizeSquareMetres),
    sizeLabel: 'Area (hectares)',
    showBroadHabitatRow: true,
    distinctivenessDisplay:
      habitat.distinctiveness &&
      typeof habitat.distinctivenessScore === 'number'
        ? `${habitat.distinctiveness} (${habitat.distinctivenessScore})`
        : '',
    strategicSignificanceDisplay: `${FIXED_STRATEGIC_SIGNIFICANCE.label} (${FIXED_STRATEGIC_SIGNIFICANCE.score})`,
    tradingRule: habitat.distinctiveness
      ? (reference.tradingRules[habitat.distinctiveness] ?? '')
      : '',
    habitatUnitsDisplay: formatHabitatUnits(habitat.units),
    broadHabitatOptions: buildSelectItems(
      reference.broadHabitats,
      habitat.broadType,
      'Choose broad habitat'
    ),
    habitatTypeOptions: buildSelectItems(
      habitatTypeNames,
      habitat.type,
      'Choose habitat type'
    ),
    conditionOptions: [
      { value: '', text: 'Choose condition', selected: !habitat.condition },
      ...reference.conditions.map((c) => ({
        value: c.condition,
        text: `${c.condition} (${c.score})`,
        selected: c.condition === habitat.condition
      }))
    ],
    referenceJson: JSON.stringify({
      habitatTypes: reference.habitatTypes,
      tradingRulesByBand: reference.tradingRules
    }),
    backHref: `/projects/${projectId}/baseline-habitat-list`,
    cancelHref: `/projects/${projectId}/baseline-habitat-list#habitat-${habitat.featureId}`,
    featureId: habitat.featureId
  }
}

/**
 * @typedef Strategy
 * @property {(feature: object) => Promise<object>} loadReference
 * @property {(feature: object, reference: object, ctx: { projectId: string, projectName: string }) => object} buildViewModel
 * @property {import('joi').ObjectSchema} payloadSchema
 */

/** @type {Strategy} */
export const areaStrategy = {
  loadReference,
  buildViewModel,
  payloadSchema: Joi.object({
    projectId: Joi.string().uuid().required(),
    featureId: Joi.string().uuid().required(),
    broadHabitat: Joi.string().allow('').optional(),
    habitatType: Joi.string().allow('').optional(),
    condition: Joi.string().allow('').optional(),
    crumb: Joi.string().optional()
  })
}
