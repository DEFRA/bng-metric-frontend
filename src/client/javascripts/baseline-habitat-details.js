// Client-side dropdown behaviour on the Habitat Details page. Used by the
// area-habitat (BMD-480), hedgerow (BMD-501) and watercourse (BMD-502) forms.
//
// Embedded reference-data (#bhd-reference-data):
//   {
//     featureType: 'area' | 'hedgerow' | 'watercourse',
//     habitatTypes: Array<{ name, distinctiveness, distinctivenessScore,
//                           broad: string | null }>,
//     tradingRulesByBand: { [band]: string },
//     // watercourse only — full option lists the client filters per habitat
//     // type (culvert vs non-culvert) when the type dropdown changes:
//     watercourseEncroachments: string[],
//     riparianEncroachments: string[]
//   }
//
// `broad` is the parent broad-habitat for area entries and null for hedgerow
// and watercourse entries. Only the area variant uses the broad-habitat
// dropdown — the watercourse page renders a placeholder broad row per its
// spec, so we can't infer the variant from the DOM; `featureType` is the
// source of truth.
//
// All changes are display-only; persistence happens on form submit (POST
// handler in baseline-habitat-details/controller.js).

// Element IDs this module reads from the rendered page. Exported so the
// server-side controller test can assert the template still renders each
// one — without that, a renamed `id="..."` on the template would leave the
// JS silently broken while these unit tests stayed green.
export const BROAD_ID = 'broadHabitat'
export const TYPE_ID = 'habitatType'
export const CONDITION_ID = 'condition'
export const WATERCOURSE_ENCROACHMENT_ID = 'watercourseEncroachment'
export const RIPARIAN_ENCROACHMENT_ID = 'riparianEncroachment'
export const DISTINCTIVENESS_ID = 'distinctivenessDisplay'
export const TRADING_RULE_ID = 'tradingRuleDisplay'
export const REFERENCE_DATA_ID = 'bhd-reference-data'

export const REQUIRED_ELEMENT_IDS_HEDGEROW = [
  TYPE_ID,
  CONDITION_ID,
  DISTINCTIVENESS_ID,
  TRADING_RULE_ID,
  REFERENCE_DATA_ID
]
export const REQUIRED_ELEMENT_IDS_AREA = [
  BROAD_ID,
  ...REQUIRED_ELEMENT_IDS_HEDGEROW
]
export const REQUIRED_ELEMENT_IDS_WATERCOURSE = [
  ...REQUIRED_ELEMENT_IDS_HEDGEROW,
  WATERCOURSE_ENCROACHMENT_ID,
  RIPARIAN_ENCROACHMENT_ID
]

const CONDITIONS_ENDPOINT = '/api/reference/conditions'
const CHOOSE_TYPE_LABEL = 'Choose habitat type'
const CHOOSE_CONDITION_LABEL = 'Choose condition'
const CHOOSE_WATERCOURSE_ENCROACHMENT_LABEL = 'Choose watercourse encroachment'
const CHOOSE_RIPARIAN_ENCROACHMENT_LABEL = 'Choose riparian encroachment'

// Culverts carry a single "N/A - Culvert" encroachment value on both the
// watercourse and riparian dropdowns; every other watercourse habitat type
// excludes it. Mirrors the server-side filter in the watercourse strategy so
// the option lists stay consistent after a habitat-type change (BMD-597).
const CULVERT_TYPE = 'Culvert'
const CULVERT_ENCROACHMENT = 'N/A - Culvert'

function encroachmentOptionsFor(watercourseType, allOptions) {
  if (watercourseType === CULVERT_TYPE) {
    return allOptions.filter((option) => option === CULVERT_ENCROACHMENT)
  }
  return allOptions.filter((option) => option !== CULVERT_ENCROACHMENT)
}

export function initBaselineHabitatDetails() {
  const dataEl = document.getElementById(REFERENCE_DATA_ID)
  if (!dataEl) {
    return
  }

  const data = parseReferenceData(dataEl)
  if (!data) {
    return
  }

  const typeSelect = document.getElementById(TYPE_ID)
  const conditionSelect = document.getElementById(CONDITION_ID)
  if (!typeSelect || !conditionSelect) {
    return
  }

  wireVariant({ data, typeSelect, conditionSelect })
}

// Parse the embedded reference JSON, returning null on malformed input so the
// caller bails out rather than wiring up handlers against garbage.
function parseReferenceData(dataEl) {
  try {
    return JSON.parse(dataEl.textContent || '{}')
  } catch {
    return null
  }
}

// Dispatch to the per-featureType wiring. Unknown / missing featureType falls
// through to a no-op: the page still renders server-side, we just don't wire
// up interactive handlers.
function wireVariant({ data, typeSelect, conditionSelect }) {
  const broadSelect = document.getElementById(BROAD_ID)
  const habitatTypes = data.habitatTypes ?? []
  const tradingRulesByBand = data.tradingRulesByBand ?? {}

  if (data.featureType === 'area') {
    initAreaVariant({
      broadSelect,
      typeSelect,
      conditionSelect,
      habitatTypes,
      tradingRulesByBand
    })
    return
  }
  if (data.featureType === 'hedgerow' || data.featureType === 'watercourse') {
    initFlatTypeVariant({
      featureType: data.featureType,
      typeSelect,
      conditionSelect,
      habitatTypes,
      tradingRulesByBand,
      // Only the watercourse form carries encroachment dropdowns; hedgerows
      // pass `null` and skip the reset/repopulate step.
      encroachment:
        data.featureType === 'watercourse'
          ? buildEncroachmentConfig(data)
          : null
    })
  }
}

function buildEncroachmentConfig(data) {
  const watercourseSelect = document.getElementById(WATERCOURSE_ENCROACHMENT_ID)
  const riparianSelect = document.getElementById(RIPARIAN_ENCROACHMENT_ID)
  if (!watercourseSelect || !riparianSelect) {
    return null
  }
  return {
    watercourseSelect,
    riparianSelect,
    watercourseOptions: data.watercourseEncroachments ?? [],
    riparianOptions: data.riparianEncroachments ?? []
  }
}

function initAreaVariant({
  broadSelect,
  typeSelect,
  conditionSelect,
  habitatTypes,
  tradingRulesByBand
}) {
  broadSelect.addEventListener('change', () => {
    handleAreaBroadChange({
      broadSelect,
      typeSelect,
      conditionSelect,
      habitatTypes
    })
  })
  typeSelect.addEventListener('change', () => {
    handleAreaTypeChange({
      broadSelect,
      typeSelect,
      conditionSelect,
      habitatTypes,
      tradingRulesByBand
    })
  })
}

function initFlatTypeVariant({
  featureType,
  typeSelect,
  conditionSelect,
  habitatTypes,
  tradingRulesByBand,
  encroachment
}) {
  typeSelect.addEventListener('change', () => {
    handleFlatTypeChange({
      featureType,
      typeSelect,
      conditionSelect,
      habitatTypes,
      tradingRulesByBand,
      encroachment
    })
  })
}

function handleAreaBroadChange({
  broadSelect,
  typeSelect,
  conditionSelect,
  habitatTypes
}) {
  const broad = broadSelect.value
  hideDerived()
  resetSelect(conditionSelect, CHOOSE_CONDITION_LABEL)

  if (!broad) {
    resetSelect(typeSelect, CHOOSE_TYPE_LABEL)
    return
  }

  const types = habitatTypes.filter((t) => t.broad === broad)
  populateTypeOptions(typeSelect, types)
}

async function handleAreaTypeChange({
  broadSelect,
  typeSelect,
  conditionSelect,
  habitatTypes,
  tradingRulesByBand
}) {
  const type = typeSelect.value
  resetSelect(conditionSelect, CHOOSE_CONDITION_LABEL)

  if (!type) {
    hideDerived()
    return
  }

  const broad = broadSelect.value
  const meta = habitatTypes.find((t) => t.broad === broad && t.name === type)
  if (meta) {
    showDistinctiveness(meta.distinctiveness, meta.distinctivenessScore)
    showTradingRule(tradingRulesByBand[meta.distinctiveness])
  } else {
    hideDerived()
  }

  const key = `${broad} - ${type}`
  const conditions = await loadConditions({ habitatType: key })
  populateConditionOptions(conditionSelect, conditions)
}

async function handleFlatTypeChange({
  featureType,
  typeSelect,
  conditionSelect,
  habitatTypes,
  tradingRulesByBand,
  encroachment
}) {
  const type = typeSelect.value
  resetSelect(conditionSelect, CHOOSE_CONDITION_LABEL)
  // Encroachment dropdowns reset on every habitat-type change and repopulate
  // with the culvert-aware option lists for the newly selected type (BMD-597).
  resetEncroachmentSelects(encroachment, type)

  // Deselecting the habitat type clears the derived display fields and
  // leaves the condition dropdown at its placeholder. No fetch needed.
  if (!type) {
    hideDerived()
    return
  }

  // Habitat-type metadata travels with the reference JSON on page load
  // (the engine's hedgerow and watercourse type lists are short), so
  // distinctiveness + trading rules can update without a round trip; only
  // the condition options need to be refetched per type.
  const meta = habitatTypes.find((t) => t.name === type)
  if (meta) {
    showDistinctiveness(meta.distinctiveness, meta.distinctivenessScore)
    showTradingRule(tradingRulesByBand[meta.distinctiveness])
  } else {
    hideDerived()
  }

  const conditions = await loadConditions({
    habitatType: type,
    featureType
  })
  populateConditionOptions(conditionSelect, conditions)
}

async function loadConditions({ habitatType, featureType }) {
  let url = `${CONDITIONS_ENDPOINT}?habitatType=${encodeURIComponent(habitatType)}`
  if (featureType) {
    url += `&featureType=${encodeURIComponent(featureType)}`
  }
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) {
      return []
    }
    return await response.json()
  } catch {
    // Network error, abort, CORS, malformed JSON — fall through to an empty
    // condition list so the dropdown is left with only its "Choose condition"
    // placeholder rather than the page falling over.
    return []
  }
}

function resetSelect(select, defaultText) {
  while (select.options.length > 0) {
    select.remove(0)
  }
  const opt = document.createElement('option')
  opt.value = ''
  opt.textContent = defaultText
  opt.selected = true
  select.add(opt)
}

function populateTypeOptions(typeSelect, types) {
  while (typeSelect.options.length > 0) {
    typeSelect.remove(0)
  }
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = CHOOSE_TYPE_LABEL
  placeholder.selected = true
  typeSelect.add(placeholder)
  for (const t of types) {
    const opt = document.createElement('option')
    opt.value = t.name
    opt.textContent = t.name
    typeSelect.add(opt)
  }
}

// Reset both encroachment dropdowns to their placeholder and repopulate them
// with the options valid for `type`. With no type selected the lists collapse
// to the placeholder only (matching the deselect ACs); the culvert filter
// otherwise narrows each list to "N/A - Culvert" or excludes it.
function resetEncroachmentSelects(encroachment, type) {
  if (!encroachment) {
    return
  }
  const {
    watercourseSelect,
    riparianSelect,
    watercourseOptions,
    riparianOptions
  } = encroachment
  const filteredWatercourse = type
    ? encroachmentOptionsFor(type, watercourseOptions)
    : []
  const filteredRiparian = type
    ? encroachmentOptionsFor(type, riparianOptions)
    : []
  populateOptionValues(
    watercourseSelect,
    filteredWatercourse,
    CHOOSE_WATERCOURSE_ENCROACHMENT_LABEL
  )
  populateOptionValues(
    riparianSelect,
    filteredRiparian,
    CHOOSE_RIPARIAN_ENCROACHMENT_LABEL
  )
}

// Rebuild a select from a flat list of string values, leaving the placeholder
// selected. Used for the encroachment dropdowns whose option text equals value.
function populateOptionValues(select, values, placeholderLabel) {
  while (select.options.length > 0) {
    select.remove(0)
  }
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = placeholderLabel
  placeholder.selected = true
  select.add(placeholder)
  for (const value of values) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = value
    select.add(opt)
  }
  select.value = ''
}

function populateConditionOptions(conditionSelect, conditions) {
  while (conditionSelect.options.length > 0) {
    conditionSelect.remove(0)
  }
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = CHOOSE_CONDITION_LABEL
  conditionSelect.add(placeholder)
  for (const c of conditions) {
    const opt = document.createElement('option')
    opt.value = c.condition
    opt.textContent = `${c.condition} (${c.score})`
    conditionSelect.add(opt)
  }
  conditionSelect.value = ''
}

function showDistinctiveness(band, score) {
  const el = document.getElementById(DISTINCTIVENESS_ID)
  if (!el) {
    return
  }
  if (band && typeof score === 'number') {
    el.textContent = `${band} (${score})`
  } else {
    el.textContent = ''
  }
}

function showTradingRule(text) {
  const el = document.getElementById(TRADING_RULE_ID)
  if (el) {
    el.textContent = text ?? ''
  }
}

function hideDerived() {
  showDistinctiveness(null, null)
  showTradingRule(null)
}
