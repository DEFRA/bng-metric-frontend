import { currentRelationship } from '../common/helpers/auth/relationship.js'

/**
 * Home page. For a signed-in user it shows their current org context — the org
 * name and relationship type (Citizen | Employee | Agent) for the relationship
 * they are currently acting in (the token's currentRelationshipId). The org is
 * omitted for citizens, who have no organisation. The same verified token claims
 * are persisted by the backend, so what is shown matches what is stored.
 */
export const homeController = {
  handler(request, h) {
    const user = request?.yar?.get('auth')?.user ?? null
    const current = currentRelationship(user)

    return h.view('home/index', {
      pageTitle: 'Home',
      heading: 'Home',
      orgName: current?.orgName ?? null,
      relationshipType: current?.relationship ?? null
    })
  }
}
