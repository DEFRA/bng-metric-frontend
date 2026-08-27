import {
  formatBaselineTotalLengthSize,
  formatLengthKmDisplay
} from './format-habitat-values.js'
import { createHabitatBaselineController } from './create-habitat-baseline-controller.js'

function createLinearHabitatBaselineController(config) {
  return createHabitatBaselineController({
    ...config,
    collectFeatures: (project) => project?.baseline?.[config.habitatKey] ?? [],
    baselineUnits: (project) => project?.baseline?.units?.[config.unitsKey],
    readSize: (feature) => feature.sizeMetres,
    formatSize: formatLengthKmDisplay,
    formatSizeTotal: formatBaselineTotalLengthSize
  })
}

export { createLinearHabitatBaselineController }
