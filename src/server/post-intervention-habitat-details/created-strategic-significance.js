// Legacy uploads retain the metric's descriptive labels when incomplete rows
// have no derived category. Match the labels accepted by the metric engine;
// leave missing and unsupported values unchanged rather than defaulting to Low.
// Keep these labels in sync with bng-library/metric's
// STRATEGIC_SIGNIFICANCE_MULTIPLIER (the frontend does not import bng-library).
const CATEGORIES = new Map([
  ['low', 'Low'],
  ['high', 'High'],
  ['area/compensation not in local strategy/no local strategy', 'Low'],
  ['formally identified in local strategy', 'High']
])

export function createdStrategicSignificance(value) {
  if (typeof value !== 'string') {
    return value
  }
  const key = value
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, ' ')
    .replaceAll(' /', '/')
    .replaceAll('/ ', '/')
    .replace(/ strategic significance$/, '')
  return CATEGORIES.get(key) ?? value
}
