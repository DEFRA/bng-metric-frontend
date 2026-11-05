import { createdStrategicSignificance } from './created-strategic-significance.js'

export function unsupportedStoredSignificance(feature, reference) {
  const proposed = feature.proposed ?? {}
  return (
    [
      proposed.strategicSignificanceCategory,
      proposed.strategicSignificance,
      proposed.rejectedStrategicSignificance
    ]
      .map((value) => createdStrategicSignificance(value ?? ''))
      .find(
        (value) =>
          value !== '' &&
          !reference.strategicSignificance.some(
            (option) => option.value === value
          )
      ) ?? null
  )
}

export function createdReadOnlyReason(kind, feature, reference) {
  if (kind.defaultsUnsupportedChoices) {
    return null
  }
  const unsupported = unsupportedStoredSignificance(feature, reference)
  return unsupported !== null
    ? `${kind.unsupportedSignificanceMessage} Imported value: "${unsupported}".`
    : null
}
