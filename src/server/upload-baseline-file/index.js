import { getController, postController } from './controller.js'

export const uploadBaselineFile = {
  plugin: {
    name: 'upload-baseline-file',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects/{id}/upload-baseline-file',
          ...getController
        },
        {
          method: 'POST',
          path: '/projects/{id}/upload-baseline-file',
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
