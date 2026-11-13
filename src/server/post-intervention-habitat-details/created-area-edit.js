import {
  loadCreatedAreaReference,
  loadCreatedHedgerowReference,
  loadCreatedWatercourseReference,
  loadEnhancedAreaReference
} from './created-edit-reference.js'
import { CREATED_TREE_KIND, ENHANCED_TREE_KIND } from './tree-edit-kinds.js'
export { enhancedTreeReference } from './tree-edit-kinds.js'
export {
  loadCreatedAreaReference,
  loadCreatedHedgerowReference,
  loadCreatedTreeReference,
  loadCreatedWatercourseReference,
  loadEnhancedTreeReference,
  _resetCreatedAreaReferenceCache
} from './created-edit-reference.js'
import {
  buildCreatedEditFields,
  ENCROACHMENT_FIELDS,
  FIELD_ORDER,
  keepImportedCondition
} from './created-area-edit-fields.js'
import { featureRetentionCategory } from './retention.js'
import Joi from 'joi'
import { buildCreatedWatercourseViewOnlyViewModel } from './created-watercourse-view-only-view-model.js'

import {
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
import { createdUnitsDisplay, formatLengthDisplay } from './view-only-shared.js'
import {
  AREA_SECTIONS_TEMPLATE,
  AREA_SIZE_LABEL,
  MAX_REF_LENGTH
} from './constants.js'
import { postInterventionBackHref } from './navigation.js'
import { buildCreatedAreaViewOnlyViewModel } from './created-area-view-only-view-model.js'
import {
  createdAreaValues,
  createdImportedChoices
} from './created-choice-values.js'
export { createdAreaValues } from './created-choice-values.js'
import { formErrorText } from '../common/error-text/error-text.js'
import { HABITAT_REF_ERROR } from '../common/helpers/habitat-ref.js'

// A { summary, inline } pair from error-text.yaml's forms section, frozen as it
// is shared by every request.
const formError = (field, rule, values) =>
  Object.freeze(formErrorText(field, rule, values))

const ERRORS = Object.freeze({
  refInvalid: HABITAT_REF_ERROR,
  refTooLong: formError('habitatRef', 'tooLong', { max: MAX_REF_LENGTH }),
  timingInvalid: formError('advanceOrDelay', 'invalid'),
  timingBoth: formError('advanceOrDelay', 'both'),
  broadHabitat: formError('broadHabitat', 'invalid'),
  condition: formError('condition', 'notForHabitatType'),
  strategicSignificance: formError('strategicSignificance', 'invalid'),
  watercourseEncroachment: formError('watercourseEncroachment', 'invalid'),
  riparianEncroachment: formError('riparianEncroachment', 'invalid')
})

const CREATED_AREA_KIND = {
  loadReference: loadCreatedAreaReference,
  label: 'Area habitat',
  optionalReference: false,
  readOnlyTemplate: AREA_SECTIONS_TEMPLATE,
  buildBase: buildCreatedAreaViewOnlyViewModel,
  formatSize: (feature) => formatAreaHectaresValue(feature.sizeSquareMetres),
  sizeLabel: AREA_SIZE_LABEL,
  backType: 'habitat',
  savePath: 'habitats',
  hasBroadHabitat: true,
  habitatTypeError: formError('habitatType', 'notInBroadHabitat')
}

// BMD-1045: an Enhanced area is edited on the Created area form, with the
// choices limited to the valid enhancements of its baseline. Everything else
// (fields, validation, derived values, save) is the Created area's.
const ENHANCED_AREA_KIND = Object.freeze({
  ...CREATED_AREA_KIND,
  loadReference: (feature) => loadEnhancedAreaReference(feature?.baseline),
  label: 'Enhanced area habitat'
})

export const CREATED_EDIT_KINDS = {
  habitat: CREATED_AREA_KIND,
  watercourse: {
    loadReference: loadCreatedWatercourseReference,
    label: 'Watercourse',
    optionalReference: true,
    readOnlyTemplate: 'habitat-details/pi-watercourse-details-created',
    buildBase: buildCreatedWatercourseViewOnlyViewModel,
    formatSize: (feature) => formatLengthDisplay(feature.sizeMetres),
    sizeLabel: 'Length (km)',
    backType: 'watercourse',
    savePath: 'watercourses',
    hasBroadHabitat: false,
    hasEncroachments: true,
    // Match the merged Created editors: imported choices are kept through omission.
    preservesImportedType: true,
    restoresLineageAdvance: true,
    habitatTypeError: formError('habitatType', 'invalidWatercourse')
  },
  hedgerow: {
    loadReference: loadCreatedHedgerowReference,
    label: 'Hedgerow',
    optionalReference: true,
    readOnlyTemplate: 'habitat-details/pi-hedgerow-details-enhanced',
    buildBase: buildCreatedHedgerowViewOnlyViewModel,
    formatSize: (feature) => formatLengthDisplay(feature.sizeMetres),
    sizeLabel: 'Length (km)',
    backType: 'hedgerow',
    savePath: 'hedgerows',
    hasBroadHabitat: false,
    habitatTypeError: formError('habitatType', 'invalidHedgerow')
  },
  tree: CREATED_TREE_KIND,
  enhancedTree: ENHANCED_TREE_KIND,
  enhancedHabitat: ENHANCED_AREA_KIND
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
  reference = {
    ...(kind.forFeature ? kind.forFeature(reference, feature) : reference),
    hasBroadHabitat: kind.hasBroadHabitat
  }
  const saved = createdAreaValues(feature)
  const importedYears = Object.fromEntries(
    ['advanceYears', 'delayYears']
      .filter(
        (field) => saved[field] !== '' && !YEAR_OPTIONS.includes(saved[field])
      )
      .map((field) => [field, saved[field]])
  )
  const importedChoices = createdImportedChoices(feature, reference, kind)
  const importedCondition = importedLinearCondition(reference, saved)
  if (importedCondition && importedChoices.habitatType) {
    importedCondition.habitatType = UNCHANGED_VALUE
  }
  return {
    ...reference,
    importedYears,
    importedCondition,
    importedChoices,
    importedCalculation: {
      values: {
        ...saved,
        ...Object.fromEntries(
          Object.keys(importedChoices).map((field) => [field, UNCHANGED_VALUE])
        ),
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
  for (const field of [
    ...Object.keys(reference.importedYears ?? {}),
    ...Object.keys(reference.importedChoices ?? {})
  ]) {
    saved[field] = UNCHANGED_VALUE
  }
  if (reference.importedCondition) {
    saved.condition = UNCHANGED_VALUE
  }
  return withFixedBroadHabitat(saved, createdKind(reference))
}

/**
 * The values with a kind's fixed broad habitat in place of whatever was
 * stored or posted: a tree is always Individual trees, so its habitat types,
 * conditions and checks are read against that, however the tree was saved.
 *
 * @param {object} values
 * @param {{ fixedBroadHabitat?: string }} kind
 * @returns {object}
 */
export function withFixedBroadHabitat(values, kind) {
  return kind.fixedBroadHabitat
    ? { ...values, broadHabitat: kind.fixedBroadHabitat }
    : values
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

function validateReference(ref, errors) {
  if (!ref.trim() || !ref.isWellFormed() || ref.includes('\uFFFD')) {
    errors.ref = ERRORS.refInvalid
    return
  }
  if (Array.from(ref.trim()).length > MAX_REF_LENGTH) {
    errors.ref = ERRORS.refTooLong
  }
}

function validateCreatedTiming(values, reference, errors) {
  const timing = resolveCreatedTiming(values, reference)
  for (const field of ['advanceYears', 'delayYears']) {
    if (
      values[field] === UNCHANGED_VALUE &&
      !reference.importedYears?.[field]
    ) {
      errors[field] = ERRORS.timingInvalid
    }
  }
  if (
    Number.parseFloat(timing.advanceYears) > 0 &&
    Number.parseFloat(timing.delayYears) > 0
  ) {
    errors.advanceYears = ERRORS.timingBoth
    errors.delayYears = errors.advanceYears
  }
}

function invalidChoice(value, options, reference, field) {
  if (
    value === UNCHANGED_VALUE &&
    Object.hasOwn(reference.importedChoices ?? {}, field)
  ) {
    return false
  }
  return Boolean(value) && !options.includes(value)
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
          ENCROACHMENT_FIELDS.map((field) => [field, reference[field]])
        )
      : {})
  }
  if (kind.habitatTypeRequired && !values.habitatType) {
    errors.habitatType = kind.habitatTypeError
  }
  for (const [field, options] of Object.entries(choices)) {
    if (invalidChoice(values[field], options, reference, field)) {
      const messages = {
        broadHabitat: ERRORS.broadHabitat,
        habitatType: kind.habitatTypeError,
        condition: kind.conditionError ?? ERRORS.condition,
        strategicSignificance: ERRORS.strategicSignificance,
        watercourseEncroachment: ERRORS.watercourseEncroachment,
        riparianEncroachment: ERRORS.riparianEncroachment
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

function createdReferenceJson(reference, storedValues, storedDisplay, derived) {
  return JSON.stringify({
    ...reference,
    storedPreview: {
      values: storedValues,
      labels: Object.fromEntries(
        Object.keys(derived).map((field) => [field, storedDisplay[field]])
      )
    }
  }).replaceAll('<', String.raw`\u003c`)
}

function createdUploadHref(ctx, feature, returnUrl) {
  return uploadFileHref(
    ctx.projectId,
    `/post-intervention-habitat-details?${new URLSearchParams({ projectId: ctx.projectId, featureId: feature.featureId, returnUrl })}`
  )
}

// A backend refusal comes first, unlinked; then each field's error in page
// order, leaving out the delay error when the advance one is shown.
function createdErrorList(errors, refusal) {
  return [
    ...(refusal ? [{ text: refusal.summaryOnly }] : []),
    ...FIELD_ORDER.filter(
      (field) =>
        errors[field] && (field !== 'delayYears' || !errors.advanceYears)
    ).map((field) => ({
      text: errors[field].summary,
      href: `#${field}`
    }))
  ]
}

/**
 * The Created edit page's view model. `values` and `errors` are set when the
 * form's own checks refused a save, and `ctx.refusal` when the backend refused
 * one for a reason no one field can put right (`summaryOnly`, as
 * stored-value-refusal.js gives), which the error summary shows unlinked.
 */
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
  const storedValues = createdEditValues(feature, reference)
  values ??= storedValues
  const { baselineCondition, ...derived } = createdAreaDisplayFields(
    feature,
    reference,
    values,
    base
  )
  const storedDisplay = createdAreaDisplayFields(
    feature,
    reference,
    storedValues,
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
    habitatUnitsDisplay: createdUnitsDisplay(feature),
    sizeDisplay: kind.formatSize(feature),
    sizeLabel: kind.sizeLabel,
    pageTitle: `${Object.keys(errors).length || ctx.refusal ? 'Error: ' : ''}${base.pageTitle}`,
    projectId: ctx.projectId,
    featureId: feature.featureId,
    values,
    errors,
    baselineCondition,
    referenceHint:
      initialLoad && Array.from(values.ref.trim()).length > MAX_REF_LENGTH
        ? `This imported reference exceeds ${MAX_REF_LENGTH} characters. Shorten it to ${MAX_REF_LENGTH} characters or fewer before saving.`
        : null,
    errorList: createdErrorList(errors, ctx.refusal),
    fixedBroadHabitat: kind.fixedBroadHabitat ?? null,
    fields: buildCreatedEditFields(reference, values, storedValues, kind),
    referenceJson: createdReferenceJson(
      reference,
      storedValues,
      storedDisplay,
      derived
    ),
    formAction: '/post-intervention-habitat-details',
    backHref,
    cancelHref: backHref,
    returnUrl: backHref,
    uploadHref: createdUploadHref(ctx, feature, backHref)
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
  const hasPositiveDelay = Number.parseFloat(values.delayYears) > 0
  // Preserve a lineage-hidden advance on rename, but clear it for a positive delay.
  const keepBlank =
    kind.restoresLineageAdvance &&
    feature &&
    feature.proposed?.advanceYears == null &&
    !hasPositiveDelay
  return timingPayload(values, 'advanceYears', keepBlank)
}

function createdAreaSavePayload(values, kind, feature) {
  return {
    ref: values.ref.trim(),
    ...(kind.hasBroadHabitat ? { broadType: values.broadHabitat || null } : {}),
    ...(values.habitatType === UNCHANGED_VALUE
      ? {}
      : { habitatType: habitatTypePayload(values, kind, feature) }),
    ...(kind.hasBroadHabitat || values.condition !== UNCHANGED_VALUE
      ? { condition: values.condition || null }
      : {}),
    ...timingPayload(values, 'strategicSignificance'),
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
