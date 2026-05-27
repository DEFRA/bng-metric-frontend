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

async function fetchReference(habitat) {
  // The backend's conditions lookup is keyed by the combined "Broad - Type"
  // string (e.g. "Grassland - Modified grassland"); the habitat document
  // stores broadType and type separately, so we reconstruct the key here.
  const conditionLookupKey =
    habitat.broadType && habitat.type
      ? `${habitat.broadType} - ${habitat.type}`
      : null
  const [broads, types, conditions, tradingRules] = await Promise.all([
    wreck.get(`${backendUrl}/reference/broad-habitats`),
    habitat.broadType
      ? wreck.get(
          `${backendUrl}/reference/habitat-types?broad=${encodeURIComponent(habitat.broadType)}`
        )
      : Promise.resolve({ payload: [] }),
    conditionLookupKey
      ? wreck.get(
          `${backendUrl}/reference/conditions?habitatType=${encodeURIComponent(conditionLookupKey)}`
        )
      : Promise.resolve({ payload: [] }),
    wreck.get(`${backendUrl}/reference/trading-rules`)
  ])
  return {
    broadHabitats: broads.payload,
    habitatTypes: types.payload,
    conditions: conditions.payload,
    tradingRules: tradingRules.payload
  }
}

function toSelectItems(values, selected, labelFor = (v) => v) {
  return values.map((value) => ({
    value,
    text: labelFor(value),
    selected: value === selected
  }))
}

function buildViewModel(habitat, reference, projectId, projectName) {
  // Habitat units are computed and persisted by the backend's enrichment step
  // (BMD-426 / bng-metric-engine). When the value is absent the display falls
  // through to an empty cell, signalling "not yet calculated" rather than the
  // misleading "0.00".
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
    broadHabitatOptions: toSelectItems(
      reference.broadHabitats,
      habitat.broadType
    ),
    // /reference/habitat-types returns { name, distinctiveness,
    // distinctivenessScore } objects, not bare strings — map down to the
    // name for both value and text so the select renders correctly.
    habitatTypeOptions: reference.habitatTypes.map((t) => ({
      value: t.name,
      text: t.name,
      selected: t.name === habitat.type
    })),
    conditionOptions: reference.conditions.map((c) => ({
      value: c.condition,
      text: `${c.condition} (${c.score})`,
      selected: c.condition === habitat.condition
    })),
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
