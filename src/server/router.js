import inert from '@hapi/inert'

import { config } from '../config/config.js'
import { home } from './home/index.js'
import { about } from './about/index.js'
import { auth } from './auth/index.js'
import { dbInfo } from './db-info/index.js'
import { projects } from './projects/index.js'
import { defineProjectName } from './define-project-name/index.js'
import { changeProjectName } from './change-project-name/index.js'
import { uploadBaselineFile } from './upload-baseline-file/index.js'
import { uploadReceived } from './upload-received/index.js'
import { uploadResult } from './upload-result/index.js'
import { checkBaselineImport } from './check-baseline-import/index.js'
import { invalidFile } from './invalid-file/index.js'
import { health } from './health/index.js'
import { serveStaticFiles } from './common/helpers/serve-static-files.js'
import { swagger } from './common/helpers/swagger.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])

      // Health check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here
      await server.register([
        home,
        about,
        auth,
        dbInfo,
        projects,
        defineProjectName,
        changeProjectName,
        uploadBaselineFile,
        uploadReceived,
        uploadResult,
        checkBaselineImport,
        invalidFile
      ])

      // Static assets
      await server.register([serveStaticFiles])

      // Swagger API documentation (opt-in via USE_SWAGGER env var)
      if (config.get('useSwagger')) {
        await server.register([swagger])
      }
    }
  }
}
