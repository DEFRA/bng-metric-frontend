import { getController } from './controller.js'

export const uploadReceived = {
  plugin: {
    name: 'upload-received',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-received',
          ...getController
        }
      ])
    }
  }
}
