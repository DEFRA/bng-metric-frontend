import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import {
  formatAreaHectares,
  formatHabitatUnits
} from '../common/helpers/format-habitat-values.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')

// Strategic significance is fixed at Low (1) for MVS (BMD-315 AC9).
const FIXED_STRATEGIC_SIGNIFICANCE = { label: 'Low', score: 1 }

async function fetchProjectName(projectId) {
  try {
    const { payload } = await wreck.get(`${backendUrl}/projects/${projectId}`)
    return payload?.project?.name ?? 'Project'
  } catch {
    return 'Project'
  }
}

async function fetchHabitat(projectId, habitatId) {
  try {
    const { payload } = await wreck.get(
      `${backendUrl}/projects/${projectId}/habitats/${habitatId}`
    )
    return payload
  } catch (err) {
    if (
      err.output?.statusCode === statusCodes.notFound ||
      err.data?.res?.statusCode === statusCodes.notFound
    ) {
      throw Boom.notFound(`Habitat ${habitatId} not found`)
    }
    throw err
  }
}

// Static reference data (broads, habitat-types-by-broad, trading-rules) is
// bundled into bng-metric-engine at build time, so it only changes with a
// backend deploy — which restarts this process anyway. Caching the bulk
// fetch in a module-level Promise turns subsequent page loads into zero
// round trips for the static slice. Conditions are per-habitat-type and
// stay uncached.
let staticReferencePromise = null

function fetchStaticReference() {
  if (!staticReferencePromise) {
    staticReferencePromise = Promise.all([
      wreck.get(`${backendUrl}/reference/habitat-types-by-broad`),
      wreck.get(`${backendUrl}/reference/trading-rules`)
    ])
      .then(([types, rules]) => ({
        habitatTypesByBroad: types.payload,
        broadHabitats: Object.keys(types.payload).sort((a, b) =>
          a.localeCompare(b)
        ),
        tradingRules: rules.payload
      }))
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

async function fetchReference(habitat) {
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
    habitatTypes: habitat.broadType
      ? (staticRef.habitatTypesByBroad[habitat.broadType] ?? [])
      : [],
    habitatTypesByBroad: staticRef.habitatTypesByBroad,
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

function buildViewModel(habitat, reference, projectId, projectName) {
  // Habitat units are computed and persisted by the backend's enrichment step
  // (BMD-426 / bng-metric-engine). When the value is absent the display falls
  // through to an empty cell, signalling "not yet calculated" rather than the
  // misleading "0.00".
  const habitatTypeNames = reference.habitatTypes.map((t) => t.name)
  return {
    projectId,
    projectName,
    habitatRef: habitat.ref ?? '',
    areaDisplay: formatAreaHectares(habitat.sizeSquareMetres),
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
      habitatTypesByBroad: reference.habitatTypesByBroad,
      tradingRulesByBand: reference.tradingRules
    }),
    backHref: `/projects/${projectId}/habitat-list`,
    cancelHref: `/projects/${projectId}/habitat-list#habitat-${habitat.featureId}`,
    featureId: habitat.featureId
  }
}

export const getController = {
  options: {
    validate: {
      query: Joi.object({
        habitatId: Joi.string().uuid().required(),
        projectId: Joi.string().uuid().required()
      })
    }
  },
  async handler(request, h) {
    const { habitatId, projectId } = request.query
    const [habitat, projectName] = await Promise.all([
      fetchHabitat(projectId, habitatId),
      fetchProjectName(projectId)
    ])
    const reference = await fetchReference(habitat)
    const viewModel = buildViewModel(habitat, reference, projectId, projectName)

    return h.view('baseline-habitat-details/baseline-habitat-details', {
      pageTitle: `Biodiversity Net Gain - Habitat ${viewModel.habitatRef}`,
      heading: `Habitat ${viewModel.habitatRef}`,
      caption: projectName,
      ...viewModel
    })
  }
}

export const postController = {
  options: {
    validate: {
      payload: Joi.object({
        projectId: Joi.string().uuid().required(),
        featureId: Joi.string().uuid().required(),
        broadHabitat: Joi.string().allow('').optional(),
        habitatType: Joi.string().allow('').optional(),
        condition: Joi.string().allow('').optional(),
        crumb: Joi.string().optional()
      })
    }
  },
  async handler(request, h) {
    const { projectId, featureId, broadHabitat, habitatType, condition } =
      request.payload

    const { res } = await wreck.put(
      `${backendUrl}/projects/${projectId}/habitats/${featureId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify({
          broadType: broadHabitat || null,
          habitatType: habitatType || null,
          condition: condition || null
        })
      }
    )

    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.badGateway('Failed to save habitat')
    }

    return h.redirect(
      `/projects/${projectId}/habitat-list#habitat-${featureId}`
    )
  }
}

// Thin proxy to the backend's /reference/conditions endpoint so the client
// JS can refresh condition options on habitat-type change without crossing
// origins. Read-only; auth + role check sit on the route.
export const conditionsProxyController = {
  options: {
    validate: {
      query: Joi.object({
        habitatType: Joi.string().min(1).required()
      })
    }
  },
  async handler(request, _h) {
    const { habitatType } = request.query
    const { payload } = await wreck.get(
      `${backendUrl}/reference/conditions?habitatType=${encodeURIComponent(habitatType)}`
    )
    return payload
  }
}
