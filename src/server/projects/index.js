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
          path: '/project-dashboard',
          ...projectsListController
        },
        {
          method: 'GET',
          path: '/project-dashboard/{id}',
          ...projectDetailController
        }
      ])
    }
  }
}
