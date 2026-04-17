import { getController, postController } from './controller.js'
import { MAX_FILE_SIZE_BYTES } from '../common/constants/file-upload.js'

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
              maxBytes: MAX_FILE_SIZE_BYTES
            }
          },
          ...postController
        }
      ])
    }
  }
}
