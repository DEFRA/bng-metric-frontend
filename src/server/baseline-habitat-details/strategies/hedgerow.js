import Joi from 'joi'

import { config } from '../../../config/config.js'
import { wreck } from '../../common/helpers/wreck-client.js'
import {
  formatHabitatUnits,
  formatLengthKm
} from '../../common/helpers/format-habitat-values.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

// Strategic significance is fixed at Low (1) in MVS, mirroring AC9 of the area
// page; the variable multipliers come post-MVS.
const FIXED_STRATEGIC_SIGNIFICANCE = { label: 'Low', score: 1 }

// Hedgerow static reference is keyed by habitat type rather than by broad, so
// it has its own cache. Stays warm for the lifetime of the process; reset
// helper exists for tests.
let staticReferencePromise = null

function fetchStaticReference() {
  if (!staticReferencePromise) {
    staticReferencePromise = Promise.all([
      wreck.get(`${backendUrl}/reference/hedgerow-types`),
      wreck.get(`${backendUrl}/reference/trading-rules`)
    ])
      .then(([types, rules]) => ({
        // `broad: null` keeps the shape uniform with the area variant's
        // habitatTypes entries; hedgerows have no parent broad habitat.
        habitatTypes: types.payload.map((t) => ({ ...t, broad: null })),
        tradingRules: rules.payload
      }))
      .catch((err) => {
        staticReferencePromise = null
        throw err
      })
  }
  return staticReferencePromise
}

export function _resetReferenceCache() {
  staticReferencePromise = null
}

async function loadReference(hedgerow) {
  const [staticRef, conditions] = await Promise.all([
    fetchStaticReference(),
    hedgerow.type
      ? wreck.get(
          `${backendUrl}/reference/conditions?habitatType=${encodeURIComponent(hedgerow.type)}&featureType=hedgerow`
        )
      : Promise.resolve({ payload: [] })
  ])

  return {
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

function buildViewModel(hedgerow, reference, { projectId, projectName }) {
  const habitatTypeNames = reference.habitatTypes.map((t) => t.name)
  const habitatRef = hedgerow.ref ?? ''
  return {
    headingPrefix: 'Hedgerow',
    projectId,
    projectName,
    habitatRef,
    sizeDisplay: formatLengthKm(hedgerow.sizeMetres),
    sizeLabel: 'Length (km)',
    showBroadHabitatRow: false,
    distinctivenessDisplay:
      hedgerow.distinctiveness &&
      typeof hedgerow.distinctivenessScore === 'number'
        ? `${hedgerow.distinctiveness} (${hedgerow.distinctivenessScore})`
        : '',
    strategicSignificanceDisplay: `${FIXED_STRATEGIC_SIGNIFICANCE.label} (${FIXED_STRATEGIC_SIGNIFICANCE.score})`,
    tradingRule: hedgerow.distinctiveness
      ? (reference.tradingRules[hedgerow.distinctiveness] ?? '')
      : '',
    habitatUnitsDisplay: formatHabitatUnits(hedgerow.units),
    habitatTypeOptions: buildSelectItems(
      habitatTypeNames,
      hedgerow.type,
      'Choose habitat type'
    ),
    conditionOptions: [
      { value: '', text: 'Choose condition', selected: !hedgerow.condition },
      ...reference.conditions.map((c) => ({
        value: c.condition,
        text: `${c.condition} (${c.score})`,
        selected: c.condition === hedgerow.condition
      }))
    ],
    referenceJson: JSON.stringify({
      habitatTypes: reference.habitatTypes,
      tradingRulesByBand: reference.tradingRules
    }),
    backHref: `/projects/${projectId}/baseline-habitat-list#hedgerows`,
    cancelHref: `/projects/${projectId}/baseline-habitat-list#hedgerows`,
    featureId: hedgerow.featureId
  }
}

/** @type {import('./area.js').Strategy} */
export const hedgerowStrategy = {
  loadReference,
  buildViewModel,
  payloadSchema: Joi.object({
    projectId: Joi.string().uuid().required(),
    featureId: Joi.string().uuid().required(),
    habitatType: Joi.string().allow('').optional(),
    condition: Joi.string().allow('').optional(),
    crumb: Joi.string().optional()
  })
}
