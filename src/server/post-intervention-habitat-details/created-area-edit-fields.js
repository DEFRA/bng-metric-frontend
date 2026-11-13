import {
  UNCHANGED_VALUE,
  YEAR_OPTIONS,
  selectedHabitat
} from '../../shared/created-area-details.js'

export const ENCROACHMENT_FIELDS = [
  'watercourseEncroachment',
  'riparianEncroachment'
]

export const FIELD_ORDER = [
  'ref',
  'broadHabitat',
  'habitatType',
  'strategicSignificance',
  'watercourseEncroachment',
  'riparianEncroachment',
  'condition',
  'advanceYears',
  'delayYears'
]

export function keepImportedCondition(reference, values) {
  return reference.importedCondition?.habitatType === values.habitatType
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
      kind.timingLabels?.advanceYears ?? 'Habitat created in advance (years)',
      options(YEAR_OPTIONS)
    ],
    [
      'delayYears',
      kind.timingLabels?.delayYears ??
        'Delay in starting habitat creation (years)',
      options(YEAR_OPTIONS)
    ]
  ]
}

function createdAreaFields(reference, values, type, initialLoad, kind) {
  const fields = createdFieldChoices(reference, values, type, kind)
  if (kind.hasEncroachments) {
    fields.push(
      ...ENCROACHMENT_FIELDS.map((field) => [
        field,
        field === 'watercourseEncroachment'
          ? 'Watercourse encroachment'
          : 'Riparian encroachment',
        reference[field].map((value) => ({ value, text: value }))
      ])
    )
  }
  const placeholders = {
    advanceYears: 'advance',
    delayYears: 'delay',
    condition: 'target condition',
    strategicSignificance: 'strategic significance',
    watercourseEncroachment: 'watercourse encroachment',
    riparianEncroachment: 'riparian encroachment'
  }
  return fields
    .filter(
      ([id]) =>
        id !== 'broadHabitat' ||
        (kind.hasBroadHabitat && !kind.fixedBroadHabitat)
    )
    .map(([id, label, items]) => {
      const imported =
        id === 'condition' && keepImportedCondition(reference, values)
          ? reference.importedCondition.condition
          : (reference.importedChoices?.[id] ?? reference.importedYears?.[id])
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
        items: withoutRequiredBlank(
          selectItems(
            items,
            values[id],
            placeholders[id] ?? label.toLowerCase()
          ),
          { id, items, value: values[id], kind }
        )
      }
    })
}

// A tree with a habitat type has no blank choice for it, as on the baseline
// page: a tree is always an Urban tree or a Rural tree. One saved
// without a valid type keeps the blank, so the user is asked to choose.
function withoutRequiredBlank(selectItemList, { id, items, value, kind }) {
  if (
    id !== 'habitatType' ||
    !kind.habitatTypeRequired ||
    !items.some((item) => item.value === value)
  ) {
    return selectItemList
  }
  return selectItemList.filter((item) => item.value !== '')
}

export function buildCreatedEditFields(
  reference,
  values,
  originalValues,
  kind
) {
  const originalFields = new Map(
    createdAreaFields(
      reference,
      originalValues,
      selectedHabitat(reference, originalValues),
      true,
      kind
    ).map((field) => [field.id, field])
  )
  const fields = createdAreaFields(
    reference,
    values,
    selectedHabitat(reference, values),
    false,
    kind
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
