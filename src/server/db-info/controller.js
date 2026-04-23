import { backendClient } from '../common/services/backend-client.js'

export const dbInfoController = {
  async handler(request, h) {
    const { payload } = await backendClient(request).get('/db-info', {
      json: true
    })

    return h.view('db-info/index', {
      pageTitle: 'DB Info',
      heading: 'Database Info',
      dbInfo: JSON.stringify(payload, null, 2)
    })
  }
}
