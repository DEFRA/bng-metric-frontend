import { createdStrategicSignificance } from './created-strategic-significance.js'

function hasUnsupportedStoredType(kind, feature, reference) {
  return Boolean(
    kind.unsupportedTypeMessage &&
    feature.proposed?.type &&
    !reference.habitatTypes.some(
      (habitat) => habitat.name === feature.proposed.type
    )
  )
}

function unsupportedStoredSignificance(feature, reference) {
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
  if (hasUnsupportedStoredType(kind, feature, reference)) {
    return kind.unsupportedTypeMessage
  }
  const unsupported = unsupportedStoredSignificance(feature, reference)
  return unsupported !== null
    ? `${kind.unsupportedSignificanceMessage} Imported value: "${unsupported}".`
    : null
}
