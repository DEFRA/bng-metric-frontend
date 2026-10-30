import Joi from 'joi'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import {
  MAX_YEARS,
  createdAreaDerived,
  selectedHabitat,
  YEAR_OPTIONS
} from '../../shared/created-area-details.js'
import { saveHabitat } from '../common/helpers/habitat-details-controller.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { formatAreaHectaresValue } from '../common/helpers/format-habitat-values.js'
import { MAX_REF_LENGTH } from './constants.js'
import { postInterventionBackHref } from './navigation.js'
import { buildCreatedAreaViewOnlyViewModel } from './created-area-view-only-view-model.js'

const backendUrl = config.get('backend').url.replace(/\/$/, '')
const FIELD_ORDER = [
  'ref',
  'broadHabitat',
  'habitatType',
  'strategicSignificance',
  'condition',
  'advanceYears',
  'delayYears'
]

const ERROR_SUMMARY_TEXT = {
  'Enter a valid habitat reference.':
    'You have entered an invalid habitat reference.',
  'Either the advance or delay field must be set at zero.':
    'A habitat cannot be created both in advance and with a delay.'
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

let creationReferencePromise = null

export async function loadCreatedAreaReference() {
  creationReferencePromise ??= wreck
    .get(`${backendUrl}/reference/area-creation`)
    .then(({ res, payload }) => {
      if (
        res?.statusCode >= statusCodes.badRequest ||
        !Array.isArray(payload?.habitatTypes) ||
        !Array.isArray(payload?.strategicSignificance) ||
        !payload?.timeMultipliers
      ) {
        throw new Error('Invalid area creation reference response')
      }
      return structuredClone(payload)
    })
    .catch((error) => {
      creationReferencePromise = null
      throw error
    })
  return structuredClone(await creationReferencePromise)
}

// Match the existing area-strategy cache reset convention for isolated tests.
export function _resetCreatedAreaReferenceCache() {
  creationReferencePromise = null
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
    ref: String(feature.ref ?? ''),
    broadHabitat: proposed.broadType ?? '',
    habitatType: proposed.type ?? '',
    condition: stripConditionPrefix(proposed.condition) ?? '',
    strategicSignificance:
      proposed.strategicSignificanceCategory ??
      proposed.strategicSignificance ??
      '',
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
      const messages = {
        broadHabitat: 'Choose a valid broad habitat',
        habitatType: 'Choose a habitat type for the selected broad habitat',
        condition: 'Choose a target condition for the selected habitat type',
        strategicSignificance: 'Choose a valid strategic significance'
      }
      errors[field] = messages[field]
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

function choiceHint(id, items, value, initialLoad) {
  const hints = []
  if (id === 'strategicSignificance') {
    hints.push(
      "Habitats are always of 'Low' strategic significance unless designated as otherwise in a Local Nature Recovery Strategy (LNRS)."
    )
  }
  if (initialLoad && value && !items.some((item) => item.value === value)) {
    hints.push(
      `The imported value "${value}" is not available. Choose a valid option; saving without a new selection will clear this value.`
    )
  }
  return hints.join(' ') || null
}

function createdAreaFields(reference, values, type, initialLoad) {
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
    [
      'advanceYears',
      'Habitat created in advance (years)',
      options(YEAR_OPTIONS)
    ],
    [
      'delayYears',
      'Delay in starting habitat creation (years)',
      options(YEAR_OPTIONS)
    ]
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
    hint: choiceHint(id, items, values[id], initialLoad),
    items: selectItems(
      items,
      values[id],
      placeholders[id] ?? label.toLowerCase()
    )
  }))
}

function createdAreaDisplayFields(feature, reference, values, base) {
  const baseline = stripConditionPrefix(feature.baseline?.condition)
  const baselineCondition = typeof baseline === 'string' ? baseline : ''
  const originalDerived = createdAreaDerived(
    reference,
    createdAreaValues(feature),
    baselineCondition
  )
  const derived = createdAreaDerived(reference, values, baselineCondition)
  for (const field of Object.keys(derived)) {
    if (
      derived[field] &&
      derived[field] === originalDerived[field] &&
      base[field]
    ) {
      derived[field] = base[field]
    }
  }
  return { baselineCondition, ...derived }
}

function editFieldsWithImportHints(feature, reference, values) {
  const originalValues = createdAreaValues(feature)
  const originalFields = new Map(
    createdAreaFields(
      reference,
      originalValues,
      selectedHabitat(reference, originalValues),
      true
    ).map((field) => [field.id, field])
  )
  const fields = createdAreaFields(
    reference,
    values,
    selectedHabitat(reference, values),
    false
  )
  return Object.fromEntries(
    fields.map((field) => {
      const importedValue = originalValues[field.id]
      const pendingClear =
        importedValue &&
        (!values[field.id] || values[field.id] === importedValue)
      const importedField = originalFields.get(field.id)
      const unavailable = !importedField.items.some(
        (item) => item.value === importedValue
      )
      return [
        field.id,
        {
          ...field,
          hint: pendingClear && unavailable ? importedField.hint : field.hint
        }
      ]
    })
  )
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
  const { baselineCondition, ...derived } = createdAreaDisplayFields(
    feature,
    reference,
    values,
    base
  )
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
    baselineCondition,
    referenceHint:
      initialLoad && Array.from(values.ref.trim()).length > MAX_REF_LENGTH
        ? `This imported reference exceeds ${MAX_REF_LENGTH} characters. Shorten it to ${MAX_REF_LENGTH} characters or fewer before saving.`
        : null,
    errorList: FIELD_ORDER.filter(
      (field) =>
        errors[field] && (field !== 'delayYears' || !errors.advanceYears)
    ).map((field) => ({
      text: ERROR_SUMMARY_TEXT[errors[field]] ?? errors[field],
      href: `#${field}`
    })),
    fields: editFieldsWithImportHints(feature, reference, values),
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
  return saveHabitat(
    request,
    `projects/${projectId}/post-intervention/habitats/${featureId}`,
    createdAreaSavePayload(values)
  )
}
