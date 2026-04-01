import {
  projectsListController,
  projectDetailController
} from './controller.js'

export const projects = {
  plugin: {
    name: 'projects',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/projects',
          ...projectsListController
        },
        {
          method: 'GET',
          path: '/projects/{id}',
          ...projectDetailController
        }
      ])
    }
  }
}
