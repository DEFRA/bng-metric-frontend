import Joi from 'joi'

import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants.js'
import {
  MAX_YEARS,
  UNCHANGED_VALUE,
  resolveCreatedTiming,
  createdAreaDerived,
  selectedHabitat,
  YEAR_OPTIONS
} from '../../shared/created-area-details.js'
import { saveHabitat } from '../common/helpers/habitat-details-controller.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { formatAreaHectaresValue } from '../common/helpers/format-habitat-values.js'
import { buildCreatedHedgerowViewOnlyViewModel } from './enhanced-hedgerow-view-only-view-model.js'
import { formatLengthDisplay } from './view-only-shared.js'
import { MAX_REF_LENGTH } from './constants.js'
import { postInterventionBackHref } from './navigation.js'
import { buildCreatedAreaViewOnlyViewModel } from './created-area-view-only-view-model.js'

export const CREATED_EDIT_KINDS = {
  habitat: {
    loadReference: loadCreatedAreaReference,
    buildBase: buildCreatedAreaViewOnlyViewModel,
    formatSize: (feature) => formatAreaHectaresValue(feature.sizeSquareMetres),
    sizeLabel: 'Size (hectares)',
    backType: 'habitat',
    savePath: 'habitats',
    hasBroadHabitat: true,
    habitatTypeError: 'Choose a habitat type for the selected broad habitat'
  },
  hedgerow: {
    loadReference: loadCreatedHedgerowReference,
    buildBase: buildCreatedHedgerowViewOnlyViewModel,
    formatSize: (feature) => formatLengthDisplay(feature.sizeMetres),
    sizeLabel: 'Length (km)',
    backType: 'hedgerow',
    savePath: 'hedgerows',
    hasBroadHabitat: false,
    habitatTypeError: 'Choose a valid hedgerow habitat type'
  }
}

function createdKind(reference) {
  if (!Object.hasOwn(CREATED_EDIT_KINDS, reference.featureType)) {
    throw new Error(
      `Unsupported Created feature type: ${reference.featureType}`
    )
  }
  return CREATED_EDIT_KINDS[reference.featureType]
}

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
    .valid('', ...YEAR_OPTIONS, UNCHANGED_VALUE)
    .required(),
  delayYears: Joi.string()
    .valid('', ...YEAR_OPTIONS, UNCHANGED_VALUE)
    .required(),
  returnUrl: Joi.string().allow('').optional(),
  crumb: Joi.string().optional()
})

export const createdHedgerowPayloadSchema = createdAreaPayloadSchema.fork(
  'broadHabitat',
  (schema) => schema.forbidden()
)

export function createdReferenceForFeature(reference, feature) {
  const kind = createdKind(reference)
  reference = { ...reference, hasBroadHabitat: kind.hasBroadHabitat }
  const saved = createdAreaValues(feature)
  const importedYears = Object.fromEntries(
    ['advanceYears', 'delayYears']
      .filter(
        (field) => saved[field] !== '' && !YEAR_OPTIONS.includes(saved[field])
      )
      .map((field) => [field, saved[field]])
  )
  const importedCondition = importedHedgerowCondition(reference, saved)
  return {
    ...reference,
    importedYears,
    importedCondition,
    importedCalculation: {
      values: {
        ...saved,
        ...(importedCondition ? { condition: UNCHANGED_VALUE } : {}),
        ...Object.fromEntries(
          Object.keys(importedYears).map((field) => [field, UNCHANGED_VALUE])
        )
      },
      finalTimeToTargetDisplay:
        feature.proposed?.finalTimeToTargetCondition ?? ''
    }
  }
}

function createdEditValues(feature, reference) {
  const saved = createdAreaValues(feature)
  for (const field of Object.keys(reference.importedYears ?? {})) {
    saved[field] = UNCHANGED_VALUE
  }
  if (reference.importedCondition) {
    saved.condition = UNCHANGED_VALUE
  }
  return saved
}

function importedHedgerowCondition(reference, values) {
  if (reference.featureType !== 'hedgerow' || !values.condition) {
    return null
  }
  const type = selectedHabitat(reference, values)
  return type && !type.conditions.some((c) => c.condition === values.condition)
    ? { habitatType: values.habitatType, condition: values.condition }
    : null
}

function keepImportedCondition(reference, values) {
  return reference.importedCondition?.habitatType === values.habitatType
}

const referencePromises = new Map()

export function loadCreatedAreaReference() {
  return loadCreationReference('habitat', 'area')
}

export function loadCreatedHedgerowReference() {
  return loadCreationReference('hedgerow')
}

async function loadCreationReference(kind, referenceName = kind) {
  if (!referencePromises.has(kind)) {
    referencePromises.set(
      kind,
      wreck
        .get(`${backendUrl}/reference/${referenceName}-creation`)
        .then(({ res, payload }) => {
          if (
            res?.statusCode >= statusCodes.badRequest ||
            !Array.isArray(payload?.habitatTypes) ||
            !Array.isArray(payload?.strategicSignificance) ||
            !payload?.timeMultipliers
          ) {
            throw new Error(
              `Invalid ${referenceName} creation reference response`
            )
          }
          return {
            ...structuredClone(payload),
            featureType: kind,
            hasBroadHabitat: createdKind({ featureType: kind }).hasBroadHabitat
          }
        })
        .catch((error) => {
          referencePromises.delete(kind)
          throw error
        })
    )
  }
  return structuredClone(await referencePromises.get(kind))
}

export function _resetCreatedAreaReferenceCache() {
  referencePromises.clear()
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

function validateCreatedTiming(values, reference, errors) {
  const timing = resolveCreatedTiming(values, reference)
  for (const field of ['advanceYears', 'delayYears']) {
    if (
      values[field] === UNCHANGED_VALUE &&
      !reference.importedYears?.[field]
    ) {
      errors[field] = 'Choose a valid advance or delay value'
    }
  }
  if (
    Number.parseFloat(timing.advanceYears) > 0 &&
    Number.parseFloat(timing.delayYears) > 0
  ) {
    errors.advanceYears =
      'Either the advance or delay field must be set at zero.'
    errors.delayYears = errors.advanceYears
  }
}

export function validateCreatedArea(values, reference) {
  const errors = {}
  validateReference(values.ref, errors)
  validateCreatedTiming(values, reference, errors)
  const kind = createdKind(reference)
  const type = selectedHabitat(reference, values)
  const choices = {
    ...(!kind.hasBroadHabitat
      ? {}
      : {
          broadHabitat: [...new Set(reference.habitatTypes.map((t) => t.broad))]
        }),
    habitatType: reference.habitatTypes
      .filter((t) => !kind.hasBroadHabitat || t.broad === values.broadHabitat)
      .map((t) => t.name),
    condition: [
      ...(type?.conditions ?? []).map((c) => c.condition),
      ...(keepImportedCondition(reference, values) ? [UNCHANGED_VALUE] : [])
    ],
    strategicSignificance: reference.strategicSignificance.map((s) => s.value)
  }
  for (const [field, options] of Object.entries(choices)) {
    if (values[field] && !options.includes(values[field])) {
      const messages = {
        broadHabitat: 'Choose a valid broad habitat',
        habitatType: kind.habitatTypeError,
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

function createdFieldChoices(reference, values, type, kind) {
  const options = (list) => list.map((value) => ({ value, text: value }))
  return [
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
          .filter(
            (t) => !kind.hasBroadHabitat || t.broad === values.broadHabitat
          )
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
}

function createdAreaFields(reference, values, type, initialLoad) {
  const kind = createdKind(reference)
  const fields = createdFieldChoices(reference, values, type, kind)
  const placeholders = {
    advanceYears: 'advance',
    delayYears: 'delay',
    condition: 'target condition',
    strategicSignificance: 'strategic significance'
  }
  return fields
    .filter(([id]) => id !== 'broadHabitat' || kind.hasBroadHabitat)
    .map(([id, label, items]) => {
      const imported =
        id === 'condition' && keepImportedCondition(reference, values)
          ? reference.importedCondition.condition
          : reference.importedYears?.[id]
      if (imported !== undefined) {
        items = [
          ...items,
          { value: UNCHANGED_VALUE, text: `${imported} (imported value)` }
        ]
      }
      return {
        id,
        label,
        hint:
          imported !== undefined
            ? `The imported value is ${imported}. Keep it unchanged, choose a new value, or choose the default option to clear it.`
            : choiceHint(id, items, values[id], initialLoad),
        items: selectItems(
          items,
          values[id],
          placeholders[id] ?? label.toLowerCase()
        )
      }
    })
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
  const originalValues = createdEditValues(feature, reference)
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
  reference = createdReferenceForFeature(reference, feature)
  const kind = createdKind(reference)
  const base = kind.buildBase(feature, ctx)
  const initialLoad = values === null
  values ??= createdEditValues(feature, reference)
  const { baselineCondition, ...derived } = createdAreaDisplayFields(
    feature,
    reference,
    values,
    base
  )
  const backHref = postInterventionBackHref(
    ctx.projectId,
    kind.backType,
    ctx.returnUrl
  )
  return {
    ...base,
    ...derived,
    sizeDisplay: kind.formatSize(feature),
    sizeLabel: kind.sizeLabel,
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

function timingPayload(values, field) {
  if (values[field] === UNCHANGED_VALUE) {
    return {}
  }
  return { [field]: values[field] === '' ? null : values[field] }
}

function createdAreaSavePayload(values, kind) {
  return {
    ref: values.ref.trim(),
    ...(kind.hasBroadHabitat ? { broadType: values.broadHabitat || null } : {}),
    habitatType: values.habitatType || null,
    ...(kind.hasBroadHabitat || values.condition !== UNCHANGED_VALUE
      ? { condition: values.condition || null }
      : {}),
    strategicSignificance: values.strategicSignificance || null,
    ...timingPayload(values, 'advanceYears'),
    ...timingPayload(values, 'delayYears')
  }
}

export async function saveCreatedArea(
  request,
  values,
  kind = CREATED_EDIT_KINDS.habitat
) {
  const { projectId, featureId } = request.payload
  return saveHabitat(
    request,
    `projects/${projectId}/post-intervention/${kind.savePath}/${featureId}`,
    createdAreaSavePayload(values, kind)
  )
}
