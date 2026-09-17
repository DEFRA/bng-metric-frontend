import { createProjectGetPlugin } from './create-project-get-plugin.js'

describe('createProjectGetPlugin', () => {
  test('registers an authenticated GET route under /projects/{id}', () => {
    const getController = { handler() {} }
    const plugin = createProjectGetPlugin({
      name: 'example-plugin',
      path: 'example-path',
      getController
    })
    const server = { route: vi.fn() }

    plugin.plugin.register(server)

    expect(plugin.plugin.name).toBe('example-plugin')
    expect(server.route).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/projects/{id}/example-path',
        handler: getController.handler
      })
    )
  })
})
