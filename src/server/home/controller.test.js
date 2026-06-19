import { vi } from 'vitest'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { homeController } from './controller.js'
import { renderTemplate } from '../test-helpers/render-template.js'

describe('#homeController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(result).toEqual(expect.stringContaining('Home -'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#homeController handler — current org context', () => {
  const requestWith = (user) => ({
    yar: { get: () => (user ? { user } : undefined) }
  })

  test('passes the current org name and account type for an employee', () => {
    const view = vi.fn()
    homeController.handler(
      requestWith({
        currentRelationshipId: 'rel-1',
        relationships: ['rel-1:org-1:Acme Ltd:0:Employee:1']
      }),
      { view }
    )
    expect(view).toHaveBeenCalledWith(
      'home/index',
      expect.objectContaining({
        orgName: 'Acme Ltd',
        relationshipType: 'Employee'
      })
    )
  })

  test('passes a null org but keeps the account type for a citizen', () => {
    const view = vi.fn()
    homeController.handler(
      requestWith({
        currentRelationshipId: 'rel-1',
        relationships: ['rel-1:::0:Citizen:0']
      }),
      { view }
    )
    expect(view).toHaveBeenCalledWith(
      'home/index',
      expect.objectContaining({ orgName: null, relationshipType: 'Citizen' })
    )
  })

  test('uses the current relationship for an agent acting across several orgs', () => {
    const view = vi.fn()
    homeController.handler(
      requestWith({
        currentRelationshipId: 'rel-2',
        relationships: [
          'rel-1:org-1:First Org:0:Agent:1',
          'rel-2:org-2:Second Org:0:Agent:1'
        ]
      }),
      { view }
    )
    expect(view).toHaveBeenCalledWith(
      'home/index',
      expect.objectContaining({
        orgName: 'Second Org',
        relationshipType: 'Agent'
      })
    )
  })

  test('passes nulls when there is no signed-in user', () => {
    const view = vi.fn()
    homeController.handler(requestWith(null), { view })
    expect(view).toHaveBeenCalledWith(
      'home/index',
      expect.objectContaining({ orgName: null, relationshipType: null })
    )
  })
})

describe('home/index template — org / account type', () => {
  const authed = { isAuthenticated: true, user: { email: 'a@b.test' } }

  test('shows the org and account type when both are present', () => {
    const html = renderTemplate('home/index.njk', {
      ...authed,
      orgName: 'Acme Ltd',
      relationshipType: 'Employee'
    })
    expect(html).toContain('data-testid="user-org"')
    expect(html).toContain('Acme Ltd')
    expect(html).toContain('data-testid="user-relationship"')
    expect(html).toContain('Employee')
  })

  test('hides the org section for a citizen (null org) but shows the account type', () => {
    const html = renderTemplate('home/index.njk', {
      ...authed,
      orgName: null,
      relationshipType: 'Citizen'
    })
    expect(html).not.toContain('data-testid="user-org"')
    expect(html).toContain('data-testid="user-relationship"')
    expect(html).toContain('Citizen')
  })
})
