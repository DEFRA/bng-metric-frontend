import inert from '@hapi/inert'

import { config } from '../config/config.js'
import { home } from './home/index.js'
import { about } from './about/index.js'
import { auth } from './auth/index.js'
import { dbInfo } from './db-info/index.js'
import { projects } from './projects/index.js'
import { defineProjectName } from './project-name/index.js'
import { changeProjectName } from './change-project-name/index.js'
import { uploadBaselineFile } from './upload-baseline-file/index.js'
import { uploadPostInterventionFile } from './upload-post-intervention-file/index.js'
import { uploadFile } from './upload-file/index.js'
import { uploadReceived } from './upload-received/index.js'
import { postInterventionUploadReceived } from './post-intervention-upload-received/index.js'
import { baselineHabitatDetails } from './baseline-habitat-details/index.js'
import { postInterventionHabitatDetails } from './post-intervention-habitat-details/index.js'
import { invalidFile } from './error-file/index.js'
import { baselineHabitatList } from './baseline-habitat-list/index.js'
import { postInterventionHabitatList } from './post-intervention-habitat-list/index.js'
import { projectDetails } from './project-details/index.js'
import { projectSummary } from './project-summary/index.js'
import { areaSummary } from './area-summary/index.js'
import { areaBaseline } from './area-baseline/index.js'
import { hedgerowsSummary } from './hedgerows-summary/index.js'
import { hedgerowsBaseline } from './hedgerows-baseline/index.js'
import { watercoursesSummary } from './watercourses-summary/index.js'
import { watercoursesBaseline } from './watercourses-baseline/index.js'
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
        uploadFile,
        uploadBaselineFile,
        uploadPostInterventionFile,
        uploadReceived,
        postInterventionUploadReceived,
        baselineHabitatDetails,
        postInterventionHabitatDetails,
        baselineHabitatList,
        postInterventionHabitatList,
        invalidFile,
        projectDetails,
        projectSummary,
        areaSummary,
        areaBaseline,
        hedgerowsSummary,
        hedgerowsBaseline,
        watercoursesSummary,
        watercoursesBaseline
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
