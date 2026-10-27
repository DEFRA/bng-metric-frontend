import Boom from '@hapi/boom'
import Joi from 'joi'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import {
  MAX_YEARS,
  createdAreaDerived,
  selectedHabitat,
  YEAR_OPTIONS
} from '../../shared/created-area-details.js'
import { backendRequest } from '../common/helpers/auth/backend-request.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { formatAreaHectaresValue } from '../common/helpers/format-habitat-values.js'
import { MAX_REF_LENGTH } from './constants.js'
import { postInterventionBackHref } from './navigation.js'
import { buildCreatedAreaViewOnlyViewModel } from './created-area-view-only-view-model.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')
const ERROR_SUMMARY_TEXT = {
  ref: 'You have entered an invalid habitat reference.',
  advanceYears: 'A habitat cannot be created both in advance and with a delay.'
}

export const createdAreaPayloadSchema = Joi.object({
  projectId: Joi.string().uuid().required(),
  featureId: Joi.string().uuid().required(),
  ref: Joi.string().allow('').required(),
  broadHabitat: Joi.string().allow('').required(),
  habitatType: Joi.string().allow('').required(),
  condition: Joi.string().allow('').required(),
  strategicSignificance: Joi.string().allow('').required(),
  advanceYears: Joi.string()
    .valid('', ...YEAR_OPTIONS)
    .required(),
  delayYears: Joi.string()
    .valid('', ...YEAR_OPTIONS)
    .required(),
  returnUrl: Joi.string().allow('').optional(),
  crumb: Joi.string().optional()
})

export async function loadCreatedAreaReference() {
  const { payload } = await wreck.get(`${backendUrl}/reference/area-creation`)
  return payload
}

function yearValue(value, is30Plus) {
  if (value === null || value === undefined) {
    return ''
  }
  return is30Plus && Number(value) === MAX_YEARS ? '30+' : String(value)
}

export function createdAreaValues(feature) {
  const proposed = feature.proposed ?? {}
  return {
    ref: feature.ref ?? '',
    broadHabitat: proposed.broadType ?? '',
    habitatType: proposed.type ?? '',
    condition: stripConditionPrefix(proposed.condition) ?? '',
    strategicSignificance: proposed.strategicSignificanceCategory ?? '',
    advanceYears: yearValue(
      proposed.advanceYears,
      proposed.advanceYearsIs30Plus
    ),
    delayYears: yearValue(proposed.delayYears, proposed.delayYearsIs30Plus)
  }
}

function validateReference(ref, errors) {
  if (!ref.trim() || !ref.isWellFormed() || ref.includes('\uFFFD')) {
    errors.ref = 'Enter a valid habitat reference.'
    return
  }
  if (Array.from(ref.trim()).length > MAX_REF_LENGTH) {
    errors.ref = `Enter a habitat reference of ${MAX_REF_LENGTH} characters or fewer.`
  }
}

export function validateCreatedArea(values, reference) {
  const errors = {}
  validateReference(values.ref, errors)
  if (
    Number.parseInt(values.advanceYears) > 0 &&
    Number.parseInt(values.delayYears) > 0
  ) {
    errors.advanceYears =
      'Either the advance or delay field must be set at zero.'
    errors.delayYears = errors.advanceYears
  }
  const type = selectedHabitat(reference, values)
  const choices = {
    broadHabitat: [...new Set(reference.habitatTypes.map((t) => t.broad))],
    habitatType: reference.habitatTypes
      .filter((t) => t.broad === values.broadHabitat)
      .map((t) => t.name),
    condition: (type?.conditions ?? []).map((c) => c.condition),
    strategicSignificance: reference.strategicSignificance.map((s) => s.value)
  }
  for (const [field, options] of Object.entries(choices)) {
    if (values[field] && !options.includes(values[field])) {
      errors[field] = 'Choose a valid option'
    }
  }
  return errors
}

function selectItems(options, value, label) {
  return [
    {
      value: '',
      text: `Choose ${label}`,
      selected: !options.some((o) => o.value === value)
    },
    ...options.map((option) => ({
      ...option,
      selected: option.value === value
    }))
  ]
}

function choiceHint(id, items, value) {
  const hints = []
  if (id === 'strategicSignificance') {
    hints.push(
      "Habitats are always of 'Low' strategic significance unless designated as otherwise in a Local Nature Recovery Strategy (LNRS)."
    )
  }
  if (value && !items.some((item) => item.value === value)) {
    hints.push(
      `The imported value "${value}" is not available. Choose a valid option; saving without a new selection will clear this value.`
    )
  }
  return hints.join(' ') || null
}

function createdAreaFields(reference, values, type) {
  const options = (list) => list.map((value) => ({ value, text: value }))
  const fields = [
    [
      'broadHabitat',
      'Broad habitat',
      options(
        [...new Set(reference.habitatTypes.map((t) => t.broad))].sort((a, b) =>
          a.localeCompare(b)
        )
      )
    ],
    [
      'habitatType',
      'Habitat type',
      options(
        reference.habitatTypes
          .filter((t) => t.broad === values.broadHabitat)
          .map((t) => t.name)
      )
    ],
    [
      'condition',
      'Target condition (multiplier)',
      (type?.conditions ?? []).map((c) => ({
        value: c.condition,
        text: `${c.condition} (${c.score})`
      }))
    ],
    [
      'strategicSignificance',
      'Strategic significance (multiplier)',
      reference.strategicSignificance.map((s) => ({
        value: s.value,
        text: `${s.value} (${s.score})`
      }))
    ],
    ['advanceYears', 'Habitat created in advance', options(YEAR_OPTIONS)],
    ['delayYears', 'Delay in starting habitat creation', options(YEAR_OPTIONS)]
  ]
  const placeholders = {
    advanceYears: 'advance',
    delayYears: 'delay',
    condition: 'target condition',
    strategicSignificance: 'strategic significance'
  }
  return fields.map(([id, label, items]) => ({
    id,
    label,
    hint: choiceHint(id, items, values[id]),
    items: selectItems(
      items,
      values[id],
      placeholders[id] ?? label.toLowerCase()
    )
  }))
}

export function buildCreatedAreaEditViewModel(
  feature,
  reference,
  ctx,
  values = null,
  errors = {}
) {
  const base = buildCreatedAreaViewOnlyViewModel(feature, ctx)
  const initialLoad = values === null
  values ??= createdAreaValues(feature)
  const derived = createdAreaDerived(reference, values)
  if (initialLoad) {
    for (const field of Object.keys(derived)) {
      if (derived[field] && base[field]) {
        derived[field] = base[field]
      }
    }
  }
  const type = selectedHabitat(reference, values)
  const backHref = postInterventionBackHref(
    ctx.projectId,
    'habitat',
    ctx.returnUrl
  )
  return {
    ...base,
    ...derived,
    sizeDisplay: formatAreaHectaresValue(feature.sizeSquareMetres),
    pageTitle: `${Object.keys(errors).length ? 'Error: ' : ''}${base.pageTitle}`,
    projectId: ctx.projectId,
    featureId: feature.featureId,
    values,
    errors,
    errorList: Object.entries(errors)
      .filter(([field]) => field !== 'delayYears' || !errors.advanceYears)
      .map(([field, text]) => ({
        text: ERROR_SUMMARY_TEXT[field] ?? text,
        href: `#${field}`
      })),
    fields: createdAreaFields(reference, values, type),
    referenceJson: JSON.stringify(reference).replaceAll(
      '<',
      String.raw`\u003c`
    ),
    formAction: '/post-intervention-habitat-details',
    backHref,
    cancelHref: backHref,
    returnUrl: backHref,
    uploadHref: uploadFileHref(
      ctx.projectId,
      `/post-intervention-habitat-details?${new URLSearchParams({ projectId: ctx.projectId, featureId: feature.featureId, returnUrl: backHref })}`
    )
  }
}

function createdAreaSavePayload(values) {
  return {
    ref: values.ref.trim(),
    broadType: values.broadHabitat || null,
    habitatType: values.habitatType || null,
    condition: values.condition || null,
    strategicSignificance: values.strategicSignificance || null,
    advanceYears: values.advanceYears === '' ? null : values.advanceYears,
    delayYears: values.delayYears === '' ? null : values.delayYears
  }
}

export async function saveCreatedArea(request, values) {
  const { projectId, featureId } = request.payload
  try {
    const { res } = await backendRequest(
      request,
      'put',
      `${backendUrl}/projects/${projectId}/post-intervention/habitats/${featureId}`,
      {
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(createdAreaSavePayload(values))
      }
    )
    if (res.statusCode >= statusCodes.badRequest) {
      throw Boom.boomify(new Error('Backend rejected habitat save'), {
        statusCode: res.statusCode
      })
    }
  } catch (err) {
    if (err.data?.sessionExpired) {
      throw err
    }
    if (
      err.output?.statusCode === statusCodes.conflict ||
      err.data?.res?.statusCode === statusCodes.conflict
    ) {
      throw Boom.conflict('Another user is editing this project')
    }
    throw Boom.badGateway('Failed to save habitat')
  }
}
