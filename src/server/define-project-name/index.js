import {
  defineProjectNameController,
  defineProjectNamePostController
} from './controller.js'

export const defineProjectName = {
  plugin: {
    name: 'defineProjectName',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/define-project-name',
          ...defineProjectNameController
        },
        {
          method: 'POST',
          path: '/define-project-name',
          ...defineProjectNamePostController
        }
      ])
    }
  }
}
