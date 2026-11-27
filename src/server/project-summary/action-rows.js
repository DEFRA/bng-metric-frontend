// The rows of the project summary's Actions table that tell the user what is
// left to do (BMD-1111): one for each kind of incomplete habitat, then one
// for incomplete project details. The download row (BMD-1141) follows them in
// the template.

import { collectAreaFeatures } from '../common/helpers/area-features.js'
import {
  featureMatchesCategory,
  interventionTabId
} from '../common/helpers/intervention-tabs.js'
import {
  AREA_BASELINE_PATH,
  AREA_POST_INTERVENTION_PATH,
  HEDGEROWS_BASELINE_PATH,
  HEDGEROWS_HABITAT_KEY,
  HEDGEROWS_POST_INTERVENTION_PATH,
  PROJECT_SUMMARY_PATH,
  WATERCOURSES_BASELINE_PATH,
  WATERCOURSES_HABITAT_KEY,
  WATERCOURSES_POST_INTERVENTION_PATH,
  projectDetailsHref,
  projectPageHref
} from '../common/helpers/unit-type-navigation.js'
import {
  RETENTION_CREATED,
  RETENTION_ENHANCED
} from '../post-intervention-habitat-details/retention.js'

// The status the backend saves against a habitat whose units cannot be
// calculated yet (BMD-482).
const STATUS_INCOMPLETE = 'Incomplete'
const BASELINE_PHASE = 'baseline'
const POST_INTERVENTION_PHASE = 'postIntervention'
const BASELINE_QUALIFIER = 'baseline'
const VALIDATION_NOTE =
  '(Entries may have been removed as part of the data validation process)'

function collectLinearFeatures(habitatKey) {
  return (project, phase) => project?.[phase]?.[habitatKey] ?? []
}

// In the order their rows are shown. `collect` reads the same features the
// linked page lists, so a row's count is the number of Incomplete tags there.
const UNIT_TYPES = [
  {
    key: 'area',
    recordNoun: 'area habitat',
    listNoun: 'area habitats',
    collect: collectAreaFeatures,
    baselinePath: AREA_BASELINE_PATH,
    postInterventionPath: AREA_POST_INTERVENTION_PATH
  },
  {
    key: 'hedgerows',
    recordNoun: 'hedgerow habitat',
    listNoun: 'hedgerows',
    collect: collectLinearFeatures(HEDGEROWS_HABITAT_KEY),
    baselinePath: HEDGEROWS_BASELINE_PATH,
    postInterventionPath: HEDGEROWS_POST_INTERVENTION_PATH
  },
  {
    key: 'watercourses',
    recordNoun: 'watercourse habitat',
    listNoun: 'watercourses',
    collect: collectLinearFeatures(WATERCOURSES_HABITAT_KEY),
    baselinePath: WATERCOURSES_BASELINE_PATH,
    postInterventionPath: WATERCOURSES_POST_INTERVENTION_PATH
  }
]

// Enhanced before Created. A Retained habitat is never incomplete, so it has
// no row.
const INTERVENTION_TYPES = [RETENTION_ENHANCED, RETENTION_CREATED]

function isIncomplete(feature) {
  return feature?.status === STATUS_INCOMPLETE
}

/**
 * One habitat row, or null when there is nothing incomplete to act on.
 *
 * @param {object} options
 * @param {number} options.count incomplete habitats of this kind
 * @param {string} options.qualifier "baseline", "enhanced" or "created"
 * @param {object} options.unitType one of UNIT_TYPES
 * @param {string} options.href the list the habitats are completed from
 */
function habitatRow({ count, qualifier, unitType, href }) {
  if (count === 0) {
    return null
  }
  const records = count === 1 ? 'record' : 'records'
  return {
    description: `${count} incomplete ${qualifier} ${unitType.recordNoun} ${records}. ${VALIDATION_NOTE}`,
    linkText: `View ${qualifier} ${unitType.listNoun} list`,
    href,
    testId: `action-incomplete-${qualifier}-${unitType.key}`
  }
}

function baselineRows(project, projectId) {
  return UNIT_TYPES.map((unitType) =>
    habitatRow({
      count: unitType.collect(project, BASELINE_PHASE).filter(isIncomplete)
        .length,
      qualifier: BASELINE_QUALIFIER,
      unitType,
      href: projectPageHref(projectId, unitType.baselinePath)
    })
  )
}

function postInterventionRows(project, projectId) {
  return INTERVENTION_TYPES.flatMap((interventionType) =>
    UNIT_TYPES.map((unitType) =>
      habitatRow({
        count: unitType
          .collect(project, POST_INTERVENTION_PHASE)
          .filter(
            (feature) =>
              isIncomplete(feature) &&
              featureMatchesCategory(feature, interventionType)
          ).length,
        qualifier: interventionType.toLowerCase(),
        unitType,
        // The fragment opens the page on that intervention type's tab.
        href: `${projectPageHref(projectId, unitType.postInterventionPath)}#${interventionTabId(interventionType)}`
      })
    )
  )
}

function isBlank(value) {
  return typeof value !== 'string' || value.trim() === ''
}

/**
 * Whether any detail that final submission needs is missing: the project
 * name, who completed the survey and when, the applicant and the local
 * planning authority. The authority may be one chosen from the list (its
 * reference) or a name saved before the list existed. The planning
 * application's reference and type are optional, so are not looked at.
 */
function projectDetailsIncomplete(project) {
  const details = project?.details ?? {}
  const authorityMissing =
    isBlank(details.localPlanningAuthorityReference) &&
    isBlank(details.localPlanningAuthority)
  return (
    authorityMissing ||
    [
      project?.name,
      details.surveyCompleters,
      details.surveyCompletionDate,
      details.applicant
    ].some(isBlank)
  )
}

function projectDetailsRow(project, projectId) {
  if (!projectDetailsIncomplete(project)) {
    return null
  }
  return {
    description: 'Complete your project details',
    linkText: 'View and update project details',
    // Save and Cancel on the details page come back to the summary.
    href: projectDetailsHref(
      projectId,
      projectPageHref(projectId, PROJECT_SUMMARY_PATH)
    ),
    testId: 'action-project-details'
  }
}

/**
 * The Actions table's rows for what the user still has to do, in the order
 * shown: incomplete baseline habitats, incomplete post-intervention habitats
 * (Enhanced, then Created), then incomplete project details. Each group runs
 * area habitats, hedgerows, watercourses. Nothing to do gives no row.
 *
 * @param {object} project the project document
 * @param {string} projectId
 * @returns {{ description: string, linkText: string, href: string, testId: string }[]}
 */
export function buildActionRows(project, projectId) {
  return [
    ...baselineRows(project, projectId),
    ...postInterventionRows(project, projectId),
    projectDetailsRow(project, projectId)
  ].filter(Boolean)
}
