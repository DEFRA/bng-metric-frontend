import { getController, postController } from './controller.js'

export const uploadBaselineFile = {
  plugin: {
    name: 'upload-baseline-file',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-baseline',
          ...getController
        },
        {
          method: 'POST',
          path: '/projects/{id}/upload-baseline',
          options: {
            payload: {
              output: 'stream',
              parse: true,
              multipart: true,
              maxBytes: 1048576
            }
          },
          ...postController
        }
      ])
    }
  }
}
