import { dbInfoController } from './controller.js'

export const dbInfo = {
  plugin: {
    name: 'db-info',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/db-info',
          ...dbInfoController
        }
      ])
    }
  }
}
