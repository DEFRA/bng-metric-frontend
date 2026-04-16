import { getController } from './controller.js'

export const uploadResult = {
  plugin: {
    name: 'upload-result',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-result',
          ...getController
        }
      ])
    }
  }
}
