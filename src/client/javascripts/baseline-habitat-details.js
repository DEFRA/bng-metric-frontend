// Client-side dropdown behaviour on the Habitat Details page. Used by both
// the area-habitat form (BMD-480) and the hedgerow form (BMD-501); the only
// structural difference is whether the broad-habitat select is in the DOM.
//
// Embedded reference-data (#bhd-reference-data):
//   {
//     habitatTypes: Array<{ name, distinctiveness, distinctivenessScore,
//                           broad: string | null }>,
//     tradingRulesByBand: { [band]: string }
//   }
//
// `broad` is the parent broad-habitat for area entries and null for hedgerow
// entries. The area form filters by `broad`; the hedgerow form ignores it.
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

const CONDITIONS_ENDPOINT = '/api/reference/conditions'
const CHOOSE_TYPE_LABEL = 'Choose habitat type'
const CHOOSE_CONDITION_LABEL = 'Choose condition'

export function initBaselineHabitatDetails() {
  const dataEl = document.getElementById(REFERENCE_DATA_ID)
  if (!dataEl) {
    return
  }

  let data
  try {
    data = JSON.parse(dataEl.textContent || '{}')
  } catch {
    return
  }

  const typeSelect = document.getElementById(TYPE_ID)
  const conditionSelect = document.getElementById(CONDITION_ID)
  if (!typeSelect || !conditionSelect) {
    return
  }

  const broadSelect = document.getElementById(BROAD_ID)
  const habitatTypes = data.habitatTypes ?? []
  const tradingRulesByBand = data.tradingRulesByBand ?? {}

  if (broadSelect) {
    initAreaVariant({
      broadSelect,
      typeSelect,
      conditionSelect,
      habitatTypes,
      tradingRulesByBand
    })
  } else {
    initHedgerowVariant({
      typeSelect,
      conditionSelect,
      habitatTypes,
      tradingRulesByBand
    })
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

function initHedgerowVariant({
  typeSelect,
  conditionSelect,
  habitatTypes,
  tradingRulesByBand
}) {
  typeSelect.addEventListener('change', () => {
    handleHedgerowTypeChange({
      typeSelect,
      conditionSelect,
      habitatTypes,
      tradingRulesByBand
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

async function handleHedgerowTypeChange({
  typeSelect,
  conditionSelect,
  habitatTypes,
  tradingRulesByBand
}) {
  const type = typeSelect.value
  resetSelect(conditionSelect, CHOOSE_CONDITION_LABEL)

  // AC3 — deselecting the habitat type clears the derived display fields and
  // leaves the condition dropdown at its placeholder. No fetch needed.
  if (!type) {
    hideDerived()
    return
  }

  // AC2 — habitat-type metadata travels with the reference JSON on page load
  // (the engine's hedgerow type list is short), so distinctiveness + trading
  // rules can update without a round trip; only the condition options need
  // to be refetched per type.
  const meta = habitatTypes.find((t) => t.name === type)
  if (meta) {
    showDistinctiveness(meta.distinctiveness, meta.distinctivenessScore)
    showTradingRule(tradingRulesByBand[meta.distinctiveness])
  } else {
    hideDerived()
  }

  const conditions = await loadConditions({
    habitatType: type,
    featureType: 'hedgerow'
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
