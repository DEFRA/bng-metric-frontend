// BMD-480 AC1–AC5: client-side dropdown behaviour on the Habitat Details
// page. Updates display-only fields (distinctiveness, trading rules) and
// resets child dropdowns as the user changes broad habitat / habitat type.
// All changes are local — saving is on form submit (POST handler in
// baseline-habitat-details/controller.js).

const BROAD_ID = 'broadHabitat'
const TYPE_ID = 'habitatType'
const CONDITION_ID = 'condition'
const DISTINCTIVENESS_ID = 'distinctivenessDisplay'
const TRADING_RULE_ID = 'tradingRuleDisplay'
const REFERENCE_DATA_ID = 'bhd-reference-data'
const CONDITIONS_ENDPOINT = '/api/reference/conditions'

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
  const habitatTypesByBroad = data.habitatTypesByBroad ?? {}
  const tradingRulesByBand = data.tradingRulesByBand ?? {}

  const broadSelect = document.getElementById(BROAD_ID)
  const typeSelect = document.getElementById(TYPE_ID)
  const conditionSelect = document.getElementById(CONDITION_ID)
  if (!broadSelect || !typeSelect || !conditionSelect) {
    return
  }

  broadSelect.addEventListener('change', () => {
    handleBroadChange({
      broadSelect,
      typeSelect,
      conditionSelect,
      habitatTypesByBroad
    })
  })

  typeSelect.addEventListener('change', () => {
    handleTypeChange({
      broadSelect,
      typeSelect,
      conditionSelect,
      habitatTypesByBroad,
      tradingRulesByBand
    })
  })
}

function handleBroadChange({
  broadSelect,
  typeSelect,
  conditionSelect,
  habitatTypesByBroad
}) {
  const broad = broadSelect.value
  hideDerived()
  resetSelect(conditionSelect, 'Choose condition')

  if (!broad) {
    resetSelect(typeSelect, 'Choose habitat type')
    return
  }

  const types = habitatTypesByBroad[broad] ?? []
  populateTypeOptions(typeSelect, types)
}

async function handleTypeChange({
  broadSelect,
  typeSelect,
  conditionSelect,
  habitatTypesByBroad,
  tradingRulesByBand
}) {
  const type = typeSelect.value
  resetSelect(conditionSelect, 'Choose condition')

  if (!type) {
    hideDerived()
    return
  }

  const broad = broadSelect.value
  const meta = (habitatTypesByBroad[broad] ?? []).find((t) => t.name === type)
  if (meta) {
    showDistinctiveness(meta.distinctiveness, meta.distinctivenessScore)
    showTradingRule(tradingRulesByBand[meta.distinctiveness])
  } else {
    hideDerived()
  }

  const conditions = await loadConditions(broad, type)
  populateConditionOptions(conditionSelect, conditions)
}

async function loadConditions(broad, type) {
  const key = `${broad} - ${type}`
  const url = `${CONDITIONS_ENDPOINT}?habitatType=${encodeURIComponent(key)}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    return []
  }
  return response.json()
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
  placeholder.textContent = 'Choose habitat type'
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
  placeholder.textContent = 'Choose condition'
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
