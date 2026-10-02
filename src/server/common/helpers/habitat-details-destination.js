import {
  AREA_BASELINE_PATH,
  AREA_POST_INTERVENTION_PATH,
  HEDGEROWS_BASELINE_PATH,
  HEDGEROWS_POST_INTERVENTION_PATH,
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_POST_INTERVENTION_PATH,
  projectPageHref
} from './unit-type-navigation.js'

const PAGE_PATHS = {
  baseline: {
    habitat: AREA_BASELINE_PATH,
    tree: AREA_BASELINE_PATH,
    hedgerow: HEDGEROWS_BASELINE_PATH,
    watercourse: WATERCOURSES_BASELINE_PATH
  },
  postIntervention: {
    habitat: AREA_POST_INTERVENTION_PATH,
    tree: AREA_POST_INTERVENTION_PATH,
    hedgerow: HEDGEROWS_POST_INTERVENTION_PATH,
    watercourse: WATERCOURSES_POST_INTERVENTION_PATH
  }
}

function habitatDetailsDestination(projectId, type, phase) {
  const paths = PAGE_PATHS[phase]
  return projectPageHref(projectId, paths[type] ?? paths.habitat)
}

export { habitatDetailsDestination }
