import {
  loadCreatedAreaReference,
  loadCreatedHedgerowReference,
  loadCreatedWatercourseReference
} from './created-edit-reference.js'
export {
  loadCreatedAreaReference,
  loadCreatedHedgerowReference,
  loadCreatedWatercourseReference,
  _resetCreatedAreaReferenceCache
} from './created-edit-reference.js'
import {
  buildCreatedEditFields,
  ENCROACHMENT_FIELDS,
  FIELD_ORDER,
  ERROR_SUMMARY_TEXT,
  keepImportedCondition
} from './created-area-edit-fields.js'
import { featureRetentionCategory } from './retention.js'
import Joi from 'joi'
import { buildCreatedWatercourseViewOnlyViewModel } from './created-watercourse-view-only-view-model.js'

import {
  MAX_YEARS,
  UNCHANGED_VALUE,
  resolveCreatedTiming,
  createdAreaDerived,
  createdDerivedInputsUnchanged,
  selectedHabitat,
  YEAR_OPTIONS
} from '../../shared/created-area-details.js'
import { saveHabitat } from '../common/helpers/habitat-details-controller.js'
import { uploadFileHref } from '../common/helpers/upload-file-navigation.js'
import { stripConditionPrefix } from '../common/helpers/strip-condition-prefix.js'
import { formatAreaHectaresValue } from '../common/helpers/format-habitat-values.js'
import { buildCreatedHedgerowViewOnlyViewModel } from './enhanced-hedgerow-view-only-view-model.js'
import { formatLengthDisplay } from './view-only-shared.js'
import { MAX_REF_LENGTH } from './constants.js'
import { postInterventionBackHref } from './navigation.js'
import { buildCreatedAreaViewOnlyViewModel } from './created-area-view-only-view-model.js'
import { createdStrategicSignificance } from './created-strategic-significance.js'

export const CREATED_EDIT_KINDS = {
  habitat: {
    loadReference: loadCreatedAreaReference,
    label: 'Area habitat',
    optionalReference: false,
    readOnlyTemplate: 'habitat-details/pi-habitat-details-enhanced',
    unsupportedSignificanceMessage:
      'This habitat cannot be edited because its imported strategic significance is not supported. To change it, upload a new post-intervention file with supported strategic significance.',
    buildBase: buildCreatedAreaViewOnlyViewModel,
    formatSize: (feature) => formatAreaHectaresValue(feature.sizeSquareMetres),
    sizeLabel: 'Size (hectares)',
    backType: 'habitat',
    savePath: 'habitats',
    hasBroadHabitat: true,
    habitatTypeError: 'Choose a habitat type for the selected broad habitat'
  },
  watercourse: {
    loadReference: loadCreatedWatercourseReference,
    label: 'Watercourse',
    optionalReference: true,
    readOnlyTemplate: 'habitat-details/pi-watercourse-details-created',
    unsupportedTypeMessage:
      'This watercourse cannot be edited because its imported habitat type is not supported. To change it, upload a new post-intervention file with a supported habitat type.',
    unsupportedSignificanceMessage:
      'This watercourse cannot be edited because its imported strategic significance is not supported. To change it, upload a new post-intervention file with supported strategic significance.',
    buildBase: buildCreatedWatercourseViewOnlyViewModel,
    formatSize: (feature) => formatLengthDisplay(feature.sizeMetres),
    sizeLabel: 'Length (km)',
    backType: 'watercourse',
    savePath: 'watercourses',
    hasBroadHabitat: false,
    hasEncroachments: true,
    habitatTypeError: 'Choose a valid watercourse habitat type'
  },
  hedgerow: {
    loadReference: loadCreatedHedgerowReference,
    label: 'Hedgerow',
    optionalReference: true,
    readOnlyTemplate: 'habitat-details/pi-hedgerow-details-enhanced',
    unsupportedSignificanceMessage:
      'This hedgerow cannot be edited because its imported strategic significance is not supported. To change it, upload a new post-intervention file with supported strategic significance.',
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

export const createdWatercoursePayloadSchema =
  createdHedgerowPayloadSchema.keys(
    Object.fromEntries(
      ENCROACHMENT_FIELDS.map((field) => [
        field,
        Joi.string().allow('').required()
      ])
    )
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
  const importedCondition = importedLinearCondition(reference, saved)
  return {
    ...reference,
    importedYears,
    importedCondition,
    importedEncroachments: importedEncroachmentValues(reference, feature),
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
  if (reference.featureType === 'watercourse') {
    for (const field of ENCROACHMENT_FIELDS) {
      saved[field] = reference.importedEncroachments?.[field]
        ? UNCHANGED_VALUE
        : (feature.proposed?.[field] ?? '')
    }
  }
  return saved
}

function importedEncroachmentValues(reference, feature) {
  if (reference.featureType !== 'watercourse') {
    return {}
  }
  return Object.fromEntries(
    ENCROACHMENT_FIELDS.filter(
      (field) =>
        feature.proposed?.[field] &&
        !reference[field].includes(feature.proposed[field])
    ).map((field) => [field, feature.proposed[field]])
  )
}

function importedLinearCondition(reference, values) {
  if (createdKind(reference).hasBroadHabitat || !values.condition) {
    return null
  }
  const type = selectedHabitat(reference, values)
  return !type?.conditions.some((c) => c.condition === values.condition)
    ? { habitatType: values.habitatType, condition: values.condition }
    : null
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
    strategicSignificance: createdStrategicSignificance(
      proposed.strategicSignificanceCategory ??
        proposed.strategicSignificance ??
        ''
    ),
    advanceYears: yearValue(
      proposed.advanceYears,
      proposed.advanceYearsIs30Plus
    ),
    delayYears: yearValue(proposed.delayYears, proposed.delayYearsIs30Plus),
    ...Object.fromEntries(
      ENCROACHMENT_FIELDS.filter((field) => Object.hasOwn(proposed, field)).map(
        (field) => [field, proposed[field] ?? '']
      )
    )
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
    strategicSignificance: reference.strategicSignificance.map((s) => s.value),
    ...(kind.hasEncroachments
      ? Object.fromEntries(
          ENCROACHMENT_FIELDS.map((field) => [
            field,
            [
              ...reference[field],
              ...(reference.importedEncroachments?.[field]
                ? [UNCHANGED_VALUE]
                : [])
            ]
          ])
        )
      : {})
  }
  for (const [field, options] of Object.entries(choices)) {
    if (values[field] && !options.includes(values[field])) {
      const messages = {
        broadHabitat: 'Choose a valid broad habitat',
        habitatType: kind.habitatTypeError,
        condition: 'Choose a target condition for the selected habitat type',
        strategicSignificance: 'Choose a valid strategic significance',
        watercourseEncroachment: 'Choose a valid watercourse encroachment',
        riparianEncroachment: 'Choose a valid riparian encroachment'
      }
      errors[field] = messages[field]
    }
  }
  return errors
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
  const originalValues = createdEditValues(feature, reference)
  for (const field of Object.keys(derived)) {
    const sameInputs = createdDerivedInputsUnchanged(
      field,
      values,
      originalValues
    )
    if (
      sameInputs &&
      derived[field] &&
      derived[field] === originalDerived[field] &&
      base[field]
    ) {
      derived[field] = base[field]
    }
  }
  return { baselineCondition, ...derived }
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
  const base = kind.buildBase(
    {
      ...feature,
      retentionCategory: featureRetentionCategory(feature)
    },
    ctx
  )
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
    fields: buildCreatedEditFields(
      reference,
      values,
      createdEditValues(feature, reference),
      kind
    ),
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

function timingPayload(values, field, keepBlank = false) {
  if (
    values[field] === UNCHANGED_VALUE ||
    (keepBlank && values[field] === '')
  ) {
    return {}
  }
  return { [field]: values[field] === '' ? null : values[field] }
}

function habitatTypePayload(values, kind, feature) {
  if (
    !kind.hasBroadHabitat &&
    values.condition === UNCHANGED_VALUE &&
    feature
  ) {
    // The backend compares types before preserving an omitted condition.
    // Keep a stored empty string distinct from null on an unchanged-type save.
    return feature.proposed?.type ?? null
  }
  return values.habitatType || null
}

function advancePayload(values, kind, feature) {
  const delayYears =
    values.delayYears === UNCHANGED_VALUE
      ? feature?.proposed?.delayYears
      : values.delayYears
  const hasPositiveDelay = Number.parseFloat(delayYears) > 0
  // Preserve a lineage-hidden advance on rename, but clear it when a positive
  // delay is selected or kept from the imported timing options.
  const keepBlank =
    kind.hasEncroachments &&
    feature &&
    feature.proposed?.advanceYears == null &&
    !hasPositiveDelay
  return timingPayload(values, 'advanceYears', keepBlank)
}

function createdAreaSavePayload(values, kind, feature) {
  return {
    ref: values.ref.trim(),
    ...(kind.hasBroadHabitat ? { broadType: values.broadHabitat || null } : {}),
    habitatType: habitatTypePayload(values, kind, feature),
    ...(kind.hasBroadHabitat || values.condition !== UNCHANGED_VALUE
      ? { condition: values.condition || null }
      : {}),
    strategicSignificance: values.strategicSignificance || null,
    ...advancePayload(values, kind, feature),
    ...timingPayload(values, 'delayYears'),
    ...(kind.hasEncroachments
      ? Object.assign(
          {},
          ...ENCROACHMENT_FIELDS.map((field) => timingPayload(values, field))
        )
      : {})
  }
}

export async function saveCreatedArea(
  request,
  values,
  kind = CREATED_EDIT_KINDS.habitat,
  feature = null
) {
  const { projectId, featureId } = request.payload
  return saveHabitat(
    request,
    `projects/${projectId}/post-intervention/${kind.savePath}/${featureId}`,
    createdAreaSavePayload(values, kind, feature)
  )
}
