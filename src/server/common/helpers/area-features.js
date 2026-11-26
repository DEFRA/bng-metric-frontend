const BASELINE_PHASE = 'baseline'

/**
 * Every feature that counts towards area units in one phase of a project:
 * area habitat parcels, vertical habitats (green walls and intertidal hard
 * structures) and individual trees. The area baseline and post-intervention
 * pages list these together, so anything counting "area habitats" reads them
 * here to agree with those pages.
 *
 * @param {object} project
 * @param {'baseline' | 'postIntervention'} [phase]
 * @returns {object[]}
 */
export function collectAreaFeatures(project, phase = BASELINE_PHASE) {
  const source = project?.[phase]
  return [
    ...(source?.habitats ?? []),
    ...(source?.verticalHabitats ?? []),
    ...(source?.trees ?? [])
  ]
}
