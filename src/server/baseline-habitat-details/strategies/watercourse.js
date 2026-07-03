import Joi from 'joi'

import { config } from '../../../config/config.js'
import { wreck } from '../../common/helpers/wreck-client.js'
import {
  formatHabitatUnits,
  formatLengthKm
} from '../../common/helpers/format-habitat-values.js'
import { stripConditionPrefix } from '../../common/helpers/strip-condition-prefix.js'
import { encroachmentOptionsFor } from '../encroachment.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

// Strategic significance is fixed at Low (1) in MVS, mirroring AC9 on the area
// and hedgerow strategies. The variable significance multipliers come later.
const FIXED_STRATEGIC_SIGNIFICANCE = { label: 'Low', score: 1 }

// Static slice (habitat types + trading rules + the two encroachment lists)
// caches in a module-level promise; the conditions lookup is per-habitat-type
// and stays uncached.
let staticReferencePromise = null

function fetchStaticReference() {
  if (!staticReferencePromise) {
    staticReferencePromise = Promise.all([
      wreck.get(`${backendUrl}/reference/watercourse-types`),
      wreck.get(
        `${backendUrl}/reference/trading-rules?featureType=watercourse`
      ),
      wreck.get(`${backendUrl}/reference/watercourse-encroachments`)
    ])
      .then(([types, rules, encroachments]) => ({
        // `broad: null` keeps the shape uniform with the area variant's
        // habitatTypes entries; watercourses have no parent broad habitat.
        habitatTypes: types.payload.map((t) => ({ ...t, broad: null })),
        tradingRules: rules.payload,
        watercourseEncroachments: encroachments.payload.watercourse,
        riparianEncroachments: encroachments.payload.riparian
      }))
      .catch((err) => {
        // Drop the cached rejection so the next request retries.
        staticReferencePromise = null
        throw err
      })
  }
  return staticReferencePromise
}

export function _resetReferenceCache() {
  staticReferencePromise = null
}

async function loadReference(watercourse) {
  const [staticRef, conditions] = await Promise.all([
    fetchStaticReference(),
    watercourse.type
      ? wreck.get(
          `${backendUrl}/reference/conditions?habitatType=${encodeURIComponent(watercourse.type)}&featureType=watercourse`
        )
      : Promise.resolve({ payload: [] })
  ])

  return {
    habitatTypes: staticRef.habitatTypes,
    conditions: conditions.payload,
    tradingRules: staticRef.tradingRules,
    watercourseEncroachments: staticRef.watercourseEncroachments,
    riparianEncroachments: staticRef.riparianEncroachments
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

function buildViewModel(watercourse, reference, { projectId, projectName }) {
  const habitatTypeNames = reference.habitatTypes.map((t) => t.name)
  const habitatRef = watercourse.ref ?? ''
  const savedCondition = stripConditionPrefix(watercourse.condition)
  return {
    headingPrefix: 'Watercourse',
    projectId,
    projectName,
    habitatRef,
    sizeDisplay: formatLengthKm(watercourse.sizeMetres),
    sizeLabel: 'Length (km)',
    // Watercourses have no broad habitat dimension.
    showBroadHabitatRow: false,
    showWatercourseEncroachmentRows: true,
    distinctivenessDisplay:
      watercourse.distinctiveness &&
      typeof watercourse.distinctivenessScore === 'number'
        ? `${watercourse.distinctiveness} (${watercourse.distinctivenessScore})`
        : '',
    strategicSignificanceDisplay: `${FIXED_STRATEGIC_SIGNIFICANCE.label} (${FIXED_STRATEGIC_SIGNIFICANCE.score})`,
    tradingRule: watercourse.distinctiveness
      ? (reference.tradingRules[watercourse.distinctiveness] ?? '')
      : '',
    habitatUnitsDisplay: formatHabitatUnits(watercourse.units),
    habitatTypeOptions: buildSelectItems(
      habitatTypeNames,
      watercourse.type,
      'Choose habitat type'
    ),
    conditionOptions: [
      { value: '', text: 'Choose condition', selected: !savedCondition },
      ...reference.conditions.map((c) => ({
        value: c.condition,
        text: `${c.condition} (${c.score})`,
        selected: c.condition === savedCondition
      }))
    ],
    // The encroachment options depend on the saved habitat type: culverts show
    // only "N/A - Culvert", every other type excludes it (BMD-597 AC set 1).
    watercourseEncroachmentOptions: buildSelectItems(
      encroachmentOptionsFor(
        watercourse.type,
        reference.watercourseEncroachments
      ),
      watercourse.watercourseEncroachment,
      'Choose watercourse encroachment'
    ),
    riparianEncroachmentOptions: buildSelectItems(
      encroachmentOptionsFor(watercourse.type, reference.riparianEncroachments),
      watercourse.riparianEncroachment,
      'Choose riparian encroachment'
    ),
    referenceJson: JSON.stringify({
      featureType: 'watercourse',
      habitatTypes: reference.habitatTypes,
      tradingRulesByBand: reference.tradingRules,
      watercourseEncroachments: reference.watercourseEncroachments,
      riparianEncroachments: reference.riparianEncroachments
    }),
    backHref: `/projects/${projectId}/baseline-habitat-list#watercourses`,
    cancelHref: `/projects/${projectId}/baseline-habitat-list#watercourses`,
    featureId: watercourse.featureId
  }
}

/** @type {import('./area.js').Strategy} */
export const watercourseStrategy = {
  loadReference,
  buildViewModel,
  payloadSchema: Joi.object({
    projectId: Joi.string().uuid().required(),
    featureId: Joi.string().uuid().required(),
    habitatType: Joi.string().allow('').optional(),
    condition: Joi.string().allow('').optional(),
    watercourseEncroachment: Joi.string().allow('').optional(),
    riparianEncroachment: Joi.string().allow('').optional(),
    crumb: Joi.string().optional()
  })
}
