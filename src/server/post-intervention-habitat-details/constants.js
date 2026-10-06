// Shared by the controller and the view-model builder so the page heading and
// the habitat-type destination stays in step across every render path.
export const PI_DETAILS_HEADING = 'Post-intervention habitat details'
export const TIME_DIFFICULTY_SECTION_HEADING = 'Time to target / difficulty'
export const HABITAT_UNITS_DELIVERED_LABEL = 'Habitat units delivered'
export const STANDARD_TIME_TO_TARGET_SUFFIX = ' years'
// bng-library/metric's time-to-target key for "more than 30 years", which the
// metric words "30+" (BMD-1040). Every "30+" habitat has it as its standard.
export const OVER_MAX_YEARS = '>30'
export const OVER_MAX_YEARS_DISPLAY = '30+'
// Created / "to be created" parcels in the GeoPackage store these as the
// Baseline Condition sentinel — there is no real prior condition to show.
export const ABSENT_BASELINE_CONDITION = 'N/A'
export const ABSENT_BASELINE_CONDITION_PREFIX = 'N/A -'
export const AREAS_TAB_ANCHOR = '#area-habitats'
export const HEDGEROWS_TAB_ANCHOR = '#hedgerows'
export const WATERCOURSES_TAB_ANCHOR = '#watercourses'
